#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  NORMALIZED_DB_SCHEMA_VERSION,
  PRISMA_SOURCE_PATH,
  buildContract,
  stableStringify,
  withoutUpdatedAt
} from './lib/normalized-db-schema.mjs';

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = 'docs/context/db/schema.json';
const COMMANDS = new Set(['status', 'sync', 'verify', 'help']);

function usage(stream = process.stdout) {
  stream.write(`Usage:
  node ${path.join(SCRIPT_DIR, 'ctl-db-schema.mjs')} status --repo-root <repo> [--format text|json]
  node ${path.join(SCRIPT_DIR, 'ctl-db-schema.mjs')} sync --repo-root <repo> [--format text|json]
  node ${path.join(SCRIPT_DIR, 'ctl-db-schema.mjs')} verify --repo-root <repo> [--format text|json]
  node ${path.join(SCRIPT_DIR, 'ctl-db-schema.mjs')} help

Fixed input:  ${PRISMA_SOURCE_PATH}
Fixed output: ${OUTPUT_PATH}

This controller only reads Prisma schema text and writes its normalized projection.
It never connects to a database or runs Prisma CLI.
`);
}

function fail(message, includeUsage = false) {
  process.stderr.write(`[error] ${message}\n`);
  if (includeUsage) usage(process.stderr);
  process.exitCode = 1;
}

function parseArgs(argv) {
  const args = [...argv];
  const command = args.shift();
  if (!command || command === '-h' || command === '--help') return { command: 'help', options: {} };
  if (!COMMANDS.has(command)) throw new Error(`Unknown command "${command}".`);
  const options = {};
  while (args.length) {
    const token = args.shift();
    if (token === '-h' || token === '--help') return { command: 'help', options: {} };
    if (token !== '--repo-root' && token !== '--format') {
      throw new Error(`Unknown option "${token}".`);
    }
    if (!args.length || args[0].startsWith('--')) throw new Error(`Option ${token} requires a value.`);
    const key = token.slice(2);
    if (Object.hasOwn(options, key)) throw new Error(`Option ${token} was provided more than once.`);
    options[key] = args.shift();
  }
  return { command, options };
}

function inside(root, target) {
  const relative = path.relative(root, target);
  return relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

function nearestExistingParent(target) {
  let current = target;
  while (!fs.existsSync(current)) {
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
  return current;
}

function resolvePaths(repoRootOption) {
  if (!repoRootOption) throw new Error('--repo-root <repo> is required.');
  const repoRoot = path.resolve(repoRootOption);
  if (!fs.existsSync(repoRoot) || !fs.statSync(repoRoot).isDirectory()) {
    throw new Error(`Repo root is not a directory: ${repoRoot}`);
  }
  const realRoot = fs.realpathSync(repoRoot);
  const input = path.resolve(repoRoot, PRISMA_SOURCE_PATH);
  const output = path.resolve(repoRoot, OUTPUT_PATH);
  if (!inside(repoRoot, input) || !inside(repoRoot, output)) {
    throw new Error('Managed paths must remain inside repo root.');
  }
  if (fs.existsSync(input) && !inside(realRoot, fs.realpathSync(input))) {
    throw new Error(`${PRISMA_SOURCE_PATH} resolves outside repo root.`);
  }
  const outputAnchor = nearestExistingParent(output);
  if (!outputAnchor || !inside(realRoot, fs.realpathSync(outputAnchor))) {
    throw new Error(`${OUTPUT_PATH} resolves outside repo root.`);
  }
  return { repoRoot, input, output };
}

function readExistingJson(output) {
  if (!fs.existsSync(output)) return { exists: false, value: null, error: null };
  try {
    return { exists: true, value: JSON.parse(fs.readFileSync(output, 'utf8')), error: null };
  } catch (error) {
    return { exists: true, value: null, error: `Output is not valid JSON: ${error.message}` };
  }
}

function inspect(paths) {
  const inputExists = fs.existsSync(paths.input);
  const outputRead = readExistingJson(paths.output);
  if (!inputExists) {
    return {
      inputExists: false,
      outputExists: outputRead.exists,
      fresh: false,
      modelCount: 0,
      checksumSha256: null,
      warnings: [],
      errors: [`Missing input: ${PRISMA_SOURCE_PATH}`],
      expected: null,
      existing: outputRead.value
    };
  }

  const schemaText = fs.readFileSync(paths.input, 'utf8');
  const built = buildContract(schemaText, 'IGNORED');
  const errors = [];
  if (!outputRead.exists) errors.push(`Missing output: ${OUTPUT_PATH}`);
  if (outputRead.error) errors.push(outputRead.error);
  const existing = outputRead.value;
  if (existing) {
    if (existing.version !== NORMALIZED_DB_SCHEMA_VERSION) {
      errors.push(`Expected version "${NORMALIZED_DB_SCHEMA_VERSION}".`);
    }
    if (existing.ssot?.mode !== 'repo-prisma') errors.push('Expected ssot.mode "repo-prisma".');
    if (existing.ssot?.source?.path !== PRISMA_SOURCE_PATH) {
      errors.push(`Expected ssot.source.path "${PRISMA_SOURCE_PATH}".`);
    }
    if (existing.ssot?.source?.checksumSha256 !== built.contract.ssot.source.checksumSha256) {
      errors.push('Source checksum does not match current prisma/schema.prisma.');
    }
    if (
      stableStringify(withoutUpdatedAt(existing)) !==
      stableStringify(withoutUpdatedAt(built.contract))
    ) {
      errors.push('Normalized structure does not match the current Prisma schema.');
    }
  }
  return {
    inputExists: true,
    outputExists: outputRead.exists,
    fresh: errors.length === 0,
    modelCount: built.contract.tables.length,
    checksumSha256: built.contract.ssot.source.checksumSha256,
    warnings: built.warnings,
    errors,
    expected: built.contract,
    existing
  };
}

function emit(command, result, format) {
  if (format === 'json') {
    process.stdout.write(`${JSON.stringify({ command, ...result }, null, 2)}\n`);
    return;
  }
  const label = result.ok ? 'ok' : command === 'status' ? 'status' : 'error';
  process.stdout.write(`[${label}] ${result.message}\n`);
  if (result.paths) {
    process.stdout.write(`  Input:  ${result.paths.input} (${result.inputExists ? 'present' : 'missing'})\n`);
    process.stdout.write(`  Output: ${result.paths.output} (${result.outputExists ? 'present' : 'missing'})\n`);
  }
  if (typeof result.fresh === 'boolean') process.stdout.write(`  Fresh:  ${result.fresh ? 'yes' : 'no'}\n`);
  if (typeof result.modelCount === 'number') process.stdout.write(`  Models: ${result.modelCount}\n`);
  for (const warning of result.warnings || []) process.stdout.write(`[warn] ${warning}\n`);
  for (const error of result.errors || []) process.stdout.write(`[error] ${error}\n`);
}

function status(paths, format) {
  const report = inspect(paths);
  emit('status', {
    ok: true,
    message: report.fresh ? 'DB schema projection is fresh.' : 'DB schema projection is not fresh.',
    paths: { input: PRISMA_SOURCE_PATH, output: OUTPUT_PATH },
    inputExists: report.inputExists,
    outputExists: report.outputExists,
    fresh: report.fresh,
    modelCount: report.modelCount,
    checksumSha256: report.checksumSha256,
    warnings: report.warnings,
    errors: report.errors
  }, format);
}

function sync(paths, format) {
  if (!fs.existsSync(paths.input)) {
    const result = {
      ok: false,
      message: `Cannot sync without ${PRISMA_SOURCE_PATH}.`,
      warnings: [],
      errors: [`Missing input: ${PRISMA_SOURCE_PATH}`]
    };
    emit('sync', result, format);
    process.exitCode = 1;
    return;
  }
  const schemaText = fs.readFileSync(paths.input, 'utf8');
  const built = buildContract(schemaText);
  if (built.contract.tables.length === 0) {
    emit('sync', {
      ok: false,
      message: 'Cannot sync a Prisma schema with no model blocks.',
      warnings: built.warnings,
      errors: ['No Prisma models were parsed.']
    }, format);
    process.exitCode = 1;
    return;
  }

  const existing = readExistingJson(paths.output);
  const same = existing.value &&
    stableStringify(withoutUpdatedAt(existing.value)) ===
    stableStringify(withoutUpdatedAt(built.contract));
  if (same) {
    emit('sync', {
      ok: true,
      message: 'Projection already matches; file left unchanged.',
      changed: false,
      output: OUTPUT_PATH,
      modelCount: built.contract.tables.length,
      checksumSha256: built.contract.ssot.source.checksumSha256,
      warnings: built.warnings,
      errors: []
    }, format);
    return;
  }

  if (existing.value?.updatedAt && typeof existing.value.updatedAt === 'string') {
    built.contract.updatedAt = new Date().toISOString();
  }
  fs.mkdirSync(path.dirname(paths.output), { recursive: true });
  fs.writeFileSync(paths.output, `${JSON.stringify(built.contract, null, 2)}\n`, 'utf8');
  emit('sync', {
    ok: true,
    message: `Wrote ${OUTPUT_PATH}.`,
    changed: true,
    output: OUTPUT_PATH,
    modelCount: built.contract.tables.length,
    checksumSha256: built.contract.ssot.source.checksumSha256,
    warnings: built.warnings,
    errors: []
  }, format);
}

function verify(paths, format) {
  const report = inspect(paths);
  if (report.modelCount === 0 && report.inputExists) report.errors.push('No Prisma models were parsed.');
  if (report.warnings.length > 0) {
    report.errors.push(
      'Projection has parser warnings and cannot be treated as complete; inspect the warnings and read prisma/schema.prisma for omitted details.'
    );
  }
  const ok = report.errors.length === 0;
  emit('verify', {
    ok,
    message: ok ? 'DB schema projection verified.' : 'DB schema projection verification failed.',
    paths: { input: PRISMA_SOURCE_PATH, output: OUTPUT_PATH },
    inputExists: report.inputExists,
    outputExists: report.outputExists,
    fresh: ok,
    modelCount: report.modelCount,
    checksumSha256: report.checksumSha256,
    warnings: report.warnings,
    errors: report.errors
  }, format);
  if (!ok) process.exitCode = 1;
}

function main() {
  let parsed;
  try {
    parsed = parseArgs(process.argv.slice(2));
    if (parsed.command === 'help') {
      usage();
      return;
    }
    const format = String(parsed.options.format || 'text').toLowerCase();
    if (format !== 'text' && format !== 'json') throw new Error('--format must be text or json.');
    const paths = resolvePaths(parsed.options['repo-root']);
    if (parsed.command === 'status') status(paths, format);
    else if (parsed.command === 'sync') sync(paths, format);
    else if (parsed.command === 'verify') verify(paths, format);
  } catch (error) {
    fail(error.message, true);
  }
}

main();

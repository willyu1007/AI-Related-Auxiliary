#!/usr/bin/env node
/** Install or explicitly refresh the shared repository task-governance resource. */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { canonicalPath, normalizeEol } from './project/.ai/scripts/lib/governance-read.mjs';

const RESOURCE_ROOT = canonicalPath(path.dirname(fileURLToPath(import.meta.url)));
const SHIPPED_ROOT = path.join(RESOURCE_ROOT, 'project');

function fail(message) {
  console.error(message);
  process.exit(1);
}

function usage(exitCode = 0) {
  console.log(`
Usage:
  node install.mjs [options]

Options:
  --repo-root <path>  Repo root (default: auto-detect from cwd)
  --dry-run           Show the initialization or refresh plan without writing
  --refresh           Explicitly replace installed fixed assets with the shared resource
  -h, --help          Show this help

Without --refresh, install missing fixed assets and stop when an existing one differs. Project-owned
hub data is created only when missing and is never refreshed.
`.trim());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const opts = { repoRoot: null, dryRun: false, refresh: false };
  const seen = new Set();
  for (let index = 2; index < argv.length; index++) {
    const token = argv[index];
    if (token === '-h' || token === '--help') usage(0);
    if (!token.startsWith('--')) fail(`[error] Unexpected positional argument: "${token}".`);

    const key = token.slice(2);
    if (!['repo-root', 'dry-run', 'refresh'].includes(key)) {
      fail(`[error] Unknown option: --${key}.`);
    }
    if (seen.has(key)) fail(`[error] Option --${key} was provided more than once.`);
    seen.add(key);

    if (key === 'dry-run' || key === 'refresh') {
      if (key === 'dry-run') opts.dryRun = true;
      else opts.refresh = true;
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      fail(`[error] Option --${key} requires a value.`);
    }
    opts.repoRoot = path.resolve(value);
    index++;
  }
  return opts;
}

function toPosix(value) {
  return String(value).replace(/\\/g, '/');
}

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function writeText(filePath, content) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content, 'utf8');
}

function findRepoRoot(startDir) {
  let current = path.resolve(startDir);
  while (true) {
    if (exists(path.join(current, '.git'))) return current;
    const parent = path.dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function collectFiles(dir, base = dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(absolute, base));
    else if (entry.isFile()) files.push(path.relative(base, absolute));
  }
  return files;
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  );
}

function planFixedAssets({ repoRoot, refresh, shippedFiles, actions }) {
  const drift = [];
  for (const relative of shippedFiles) {
    const source = path.join(SHIPPED_ROOT, relative);
    const target = path.join(repoRoot, relative);
    const content = readText(source);
    if (content === null) throw new Error(`Cannot read shipped asset: ${toPosix(source)}.`);
    const previous = readText(target);
    if (previous !== null && normalizeEol(previous) === normalizeEol(content)) continue;
    if (previous !== null && !refresh) {
      drift.push(toPosix(relative));
      continue;
    }
    actions.push({ op: previous === null ? 'write' : 'update', path: target, content });
  }

  if (drift.length > 0) {
    fail(
      '[error] Installed fixed task-governance assets differ from the shared resource. ' +
        'Review an explicit --dry-run --refresh before replacing them:\n' +
        drift.map((relative) => `  - ${relative}`).join('\n')
    );
  }
}

function planHubInitialization({ repoRoot, actions }) {
  const templatesDir = path.join(SHIPPED_ROOT, '.ai', 'project', 'templates');
  if (!exists(templatesDir)) {
    throw new Error(`Missing project templates directory: ${toPosix(templatesDir)}.`);
  }

  for (const file of ['registry.json', 'dashboard.md', 'feature-map.md']) {
    const target = path.join(repoRoot, '.ai', 'project', file);
    if (exists(target)) continue;
    const source = path.join(templatesDir, file);
    const content = readText(source);
    if (content === null) throw new Error(`Missing project template: ${toPosix(source)}.`);
    actions.push({ op: 'write', path: target, content, note: 'initialize project data' });
  }
}

function applyActions(actions) {
  for (const action of actions) writeText(action.path, action.content);
}

function printActions(repoRoot, actions, dryRun) {
  if (actions.length === 0) {
    console.log(`[ok] Task governance is current.${dryRun ? ' (dry-run)' : ''}`);
    return;
  }
  console.log(`[ok] Task governance ${dryRun ? 'plan complete' : 'installed'}.`);
  for (const action of actions) {
    const note = action.note ? ` (${action.note})` : '';
    const mode = dryRun ? ' (dry-run)' : '';
    console.log(`  ${action.op}: ${toPosix(path.relative(repoRoot, action.path))}${note}${mode}`);
  }
}

function main() {
  const opts = parseArgs(process.argv);
  const discoveredRoot = opts.repoRoot || findRepoRoot(process.cwd());
  const repoRoot = discoveredRoot ? canonicalPath(discoveredRoot) : null;
  if (!repoRoot || !exists(path.join(repoRoot, '.git'))) {
    fail('[error] Task governance must be installed at a Git repository root.');
  }
  if (isPathInside(RESOURCE_ROOT, repoRoot) || isPathInside(repoRoot, RESOURCE_ROOT)) {
    fail('[error] The task-governance resource library cannot install into itself or its containing repository.');
  }
  if (!exists(SHIPPED_ROOT)) {
    fail(`[error] Shipped project assets are missing at ${toPosix(SHIPPED_ROOT)}.`);
  }

  const shippedFiles = collectFiles(SHIPPED_ROOT);
  const actions = [];
  planFixedAssets({ repoRoot, refresh: opts.refresh, shippedFiles, actions });
  planHubInitialization({ repoRoot, actions });
  if (!opts.dryRun) applyActions(actions);
  printActions(repoRoot, actions, opts.dryRun);
}

try {
  main();
} catch (error) {
  fail(`[error] Installation aborted: ${error?.message || String(error)}`);
}

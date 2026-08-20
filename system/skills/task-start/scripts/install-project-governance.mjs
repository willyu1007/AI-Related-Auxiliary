#!/usr/bin/env node
/**
 * Install or refresh the repository task-governance system.
 *
 * This runs from the skill source, independent of any target-repository runtime copy. Fixed assets
 * are refreshed; project-owned hub data is created only when missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getUnsupportedGovernanceFiles,
  normalizeEol,
} from '../assets/project/.ai/scripts/lib/governance-read.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHIPPED_ROOT = path.resolve(__dirname, '..', 'assets', 'project');
function fail(message) {
  console.error(message);
  process.exit(1);
}

function usage(exitCode = 0) {
  console.log(`
Usage:
  node install-project-governance.mjs [options]

Options:
  --repo-root <path>  Repo root (default: auto-detect; fallback: cwd)
  --dry-run           Show planned refresh and initialization without writing
  -h, --help          Show this help

Refresh fixed task-governance assets and create missing project-owned hub files without
overwriting existing project data.
`.trim());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const opts = { repoRoot: null, dryRun: false };
  const seen = new Set();
  for (let index = 2; index < argv.length; index++) {
    const token = argv[index];
    if (token === '-h' || token === '--help') usage(0);
    if (!token.startsWith('--')) fail(`[error] Unexpected positional argument: "${token}".`);

    const key = token.slice(2);
    if (!['repo-root', 'dry-run'].includes(key)) fail(`[error] Unknown option: --${key}.`);
    if (seen.has(key)) fail(`[error] Option --${key} was provided more than once.`);
    seen.add(key);

    if (key === 'dry-run') {
      opts.dryRun = true;
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

function assertGovernanceLayout(repoRoot) {
  const unsupported = getUnsupportedGovernanceFiles(repoRoot);
  if (unsupported.length === 0) return;

  const paths = unsupported
    .map((item) => `  - ${item.file} @ ${item.worktree_path}`)
    .join('\n');
  fail(
    '[error] Unsupported task-governance files conflict with the current single-path layout. ' +
      'Remove them before continuing:\n' +
      paths
    );
}

function refreshAssets({ repoRoot, dryRun, actions }) {
  if (!exists(SHIPPED_ROOT)) {
    fail(`[error] Shipped project assets are missing at ${toPosix(SHIPPED_ROOT)}.`);
  }

  for (const relative of collectFiles(SHIPPED_ROOT)) {
    const source = path.join(SHIPPED_ROOT, relative);
    const target = path.join(repoRoot, relative);
    const content = readText(source);
    if (content === null) fail(`[error] Cannot read shipped asset: ${toPosix(source)}.`);
    const previous = readText(target);
    // Compare with normalized line endings so checkout EOL settings do not force rewrites.
    if (previous !== null && normalizeEol(previous) === normalizeEol(content)) continue;
    actions.push({ op: previous === null ? 'write' : 'update', path: target });
    if (!dryRun) writeText(target, content);
  }
}

function initializeHub({ repoRoot, dryRun, actions }) {
  const targetTemplates = path.join(repoRoot, '.ai', 'project', 'templates');
  const sourceTemplates = path.join(SHIPPED_ROOT, '.ai', 'project', 'templates');
  const templatesDir = exists(targetTemplates) ? targetTemplates : sourceTemplates;
  if (!exists(templatesDir)) {
    fail(`[error] Missing project templates directory: ${toPosix(templatesDir)}.`);
  }

  for (const file of ['registry.json', 'dashboard.md', 'feature-map.md']) {
    const target = path.join(repoRoot, '.ai', 'project', file);
    if (exists(target)) continue;
    const source = path.join(templatesDir, file);
    const raw = readText(source);
    if (raw === null) fail(`[error] Missing project template: ${toPosix(source)}.`);
    actions.push({ op: 'write', path: target, note: 'initialize project data' });
    if (!dryRun) writeText(target, raw);
  }
}

function printActions(repoRoot, actions, dryRun) {
  if (actions.length === 0) {
    console.log(`[ok] Project governance is current.${dryRun ? ' (dry-run)' : ''}`);
    return;
  }
  console.log(`[ok] Project governance ${dryRun ? 'plan complete' : 'installed'}.`);
  for (const action of actions) {
    const note = action.note ? ` (${action.note})` : '';
    const mode = dryRun ? ' (dry-run)' : '';
    console.log(`  ${action.op}: ${toPosix(path.relative(repoRoot, action.path))}${note}${mode}`);
  }
}

function main() {
  const opts = parseArgs(process.argv);
  const repoRoot = opts.repoRoot || findRepoRoot(process.cwd()) || path.resolve(process.cwd());
  if (isPathInside(SHIPPED_ROOT, repoRoot)) {
    fail('[error] The installation target must not be the skill asset source or one of its descendants.');
  }
  assertGovernanceLayout(repoRoot);

  const actions = [];
  refreshAssets({ repoRoot, dryRun: opts.dryRun, actions });
  initializeHub({ repoRoot, dryRun: opts.dryRun, actions });
  printActions(repoRoot, actions, opts.dryRun);
}

try {
  main();
} catch (error) {
  fail(`[error] Installation aborted: ${error?.message || String(error)}`);
}

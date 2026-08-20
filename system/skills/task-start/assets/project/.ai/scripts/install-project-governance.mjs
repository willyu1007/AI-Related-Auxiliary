#!/usr/bin/env node
/**
 * Install or refresh the repository task-governance system.
 *
 * This file is intentionally self-contained so it still works when runtime modules are absent or
 * stale. Fixed assets are refreshed; project-owned hub data is created only when missing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SHIPPED_ROOT = path.resolve(__dirname, '..', '..');
const RETIRED_SHIPPED_FILES = [
  '.ai/project/CONTRACT.md',
  '.ai/project/task-index.md',
  '.ai/project/changelog.md',
  '.ai/project/templates/task-index.md',
  '.ai/project/templates/changelog.md',
  '.ai/project/templates/registry.yaml',
  '.ai/scripts/lib/colors.mjs',
  '.ai/scripts/lib/yaml-lite.mjs',
];
const IGNORE_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  '.ai',
  '.codex',
  '.claude',
  '.cursor',
  '.next',
  'dist',
  'build',
  'coverage',
]);

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
  --dry-run           Show planned refresh, cleanup, and initialization without writing
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

function discoverDevDocsRoots(repoRoot) {
  const roots = [];
  const stack = [repoRoot];
  while (stack.length > 0) {
    const dir = stack.pop();
    const base = path.basename(dir);
    if (IGNORE_DIRS.has(base)) continue;
    if (base.startsWith('.') && dir !== repoRoot) continue;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const absolute = path.join(dir, entry.name);
      if (entry.name === 'dev-docs') {
        if (exists(path.join(absolute, 'active')) || exists(path.join(absolute, 'archive'))) {
          roots.push(absolute);
          continue;
        }
      }
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      stack.push(absolute);
    }
  }
  return [...new Set(roots.map((root) => path.resolve(root)))].sort((a, b) => a.localeCompare(b));
}

function listImmediateChildDirs(dirPath) {
  try {
    return fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

function resolveTaskRoots(repoRoot) {
  const registryRaw = readText(path.join(repoRoot, '.ai', 'project', 'registry.json'));
  if (registryRaw !== null && registryRaw.trim()) {
    let registry = null;
    try {
      registry = JSON.parse(registryRaw);
    } catch {
      // Registry validation belongs to the runtime audit; discovery remains safe here.
    }
    const configured = registry?.task_doc_roots;
    if (Array.isArray(configured) && configured.length > 0) {
      const roots = [];
      let realRepoRoot = null;
      try {
        realRepoRoot = fs.realpathSync(repoRoot);
      } catch {
        // Lexical containment below still protects a not-yet-realpathable repository root.
      }
      for (const item of configured) {
        if (typeof item !== 'string' || !item.trim() || path.isAbsolute(item.trim())) {
          fail('[error] Registry task_doc_roots entries must be non-empty repository-relative paths.');
        }
        const relative = item.trim();
        const absolute = path.resolve(repoRoot, relative);
        if (!isPathInside(repoRoot, absolute)) {
          fail(`[error] Registry task_doc_root escapes the repository: ${relative}.`);
        }
        if (realRepoRoot !== null && exists(absolute)) {
          let realRoot = null;
          try {
            realRoot = fs.realpathSync(absolute);
          } catch {
            // A path that disappears during inspection will be handled as an empty task root.
          }
          if (realRoot !== null && !isPathInside(realRepoRoot, realRoot)) {
            fail(`[error] Registry task_doc_root resolves outside the repository: ${relative}.`);
          }
        }
        roots.push(absolute);
      }
      return [...new Set(roots)].sort((a, b) => a.localeCompare(b));
    }
  }
  return discoverDevDocsRoots(repoRoot);
}

function assertJsonGovernanceLayout(repoRoot) {
  const retired = [];
  const registryYaml = path.join(repoRoot, '.ai', 'project', 'registry.yaml');
  if (exists(registryYaml)) retired.push(registryYaml);
  for (const root of resolveTaskRoots(repoRoot)) {
    for (const phase of ['active', 'archive']) {
      for (const slug of listImmediateChildDirs(path.join(root, phase))) {
        const metadata = path.join(root, phase, slug, '.ai-task.yaml');
        if (exists(metadata)) retired.push(metadata);
      }
    }
  }
  if (retired.length === 0) return;

  const paths = retired.map((file) => `  - ${toPosix(path.relative(repoRoot, file))}`).join('\n');
  fail(
    '[error] YAML task-governance data is not supported by this JSON-only version. ' +
      'Convert or remove these files before continuing:\n' +
      paths
  );
}

function refreshAssets({ repoRoot, dryRun, actions }) {
  if (!exists(SHIPPED_ROOT)) {
    fail(`[error] Shipped project assets are missing at ${toPosix(SHIPPED_ROOT)}.`);
  }

  if (path.resolve(SHIPPED_ROOT) !== path.resolve(repoRoot)) {
    for (const relative of collectFiles(SHIPPED_ROOT)) {
      const source = path.join(SHIPPED_ROOT, relative);
      const target = path.join(repoRoot, relative);
      const content = readText(source);
      if (content === null) fail(`[error] Cannot read shipped asset: ${toPosix(source)}.`);
      const previous = readText(target);
      if (previous === content) continue;
      actions.push({ op: previous === null ? 'write' : 'update', path: target });
      if (!dryRun) writeText(target, content);
    }
  }

  for (const relative of RETIRED_SHIPPED_FILES) {
    const retired = path.join(repoRoot, relative);
    if (!exists(retired)) continue;
    actions.push({ op: 'remove', path: retired });
    if (!dryRun) fs.unlinkSync(retired);
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
  assertJsonGovernanceLayout(repoRoot);

  const actions = [];
  refreshAssets({ repoRoot, dryRun: opts.dryRun, actions });
  initializeHub({ repoRoot, dryRun: opts.dryRun, actions });
  printActions(repoRoot, actions, opts.dryRun);
}

main();

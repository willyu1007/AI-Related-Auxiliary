#!/usr/bin/env node
/**
 * Initialize or refresh `.ai/` and `dev-docs/` in a Git repository.
 *
 * Portable: run from this library, or copy this file to a project root. It locates the shipped
 * task-governance resource from a local checkout, an installed agent home, or a git clone.
 * The resource installer remains the writer; this file only finds it and invokes it.
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const DEFAULT_GIT_URL = 'https://github.com/willyu1007/AI-Related-Auxiliary.git';
const RESOURCE_SEGMENTS = ['system', 'resources', 'task-governance'];
const AGENT_HOMES = ['.cursor', '.codex', '.claude'];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function usage(exitCode = 0) {
  console.log(`
Usage:
  node install-task-governance.mjs [options]

Initialize task-governance in a Git repository (.ai/ and dev-docs/).

Options:
  --repo-root <path>  Target Git repository (default: cwd)
  --source <path|url> Local checkout, resource directory, or git URL
  --from-git          Fetch the library from git, ignoring local checkouts
  --refresh           Replace fixed assets and remove obsolete files
  --dry-run           Show the plan without writing to the target repository
  -h, --help          Show this help

Examples:
  node install-task-governance.mjs
  node install-task-governance.mjs --repo-root D:\\\\Else\\\\MyApp
  node install-task-governance.mjs --from-git --dry-run
`.trim());
  process.exit(exitCode);
}

function parseArgs(argv) {
  const opts = {
    repoRoot: process.cwd(),
    source: null,
    fromGit: false,
    refresh: false,
    dryRun: false,
  };
  const seen = new Set();

  for (let index = 2; index < argv.length; index++) {
    const token = argv[index];
    if (token === '-h' || token === '--help') usage(0);
    if (!token.startsWith('--')) fail(`[error] Unexpected positional argument: "${token}".`);

    const key = token.slice(2);
    if (!['repo-root', 'source', 'from-git', 'refresh', 'dry-run'].includes(key)) {
      fail(`[error] Unknown option: --${key}.`);
    }
    if (seen.has(key)) fail(`[error] Option --${key} was provided more than once.`);
    seen.add(key);

    if (key === 'from-git') {
      opts.fromGit = true;
      continue;
    }
    if (key === 'refresh') {
      opts.refresh = true;
      continue;
    }
    if (key === 'dry-run') {
      opts.dryRun = true;
      continue;
    }

    const value = argv[index + 1];
    if (value === undefined || value.startsWith('--')) {
      fail(`[error] Option --${key} requires a value.`);
    }
    if (key === 'repo-root') opts.repoRoot = path.resolve(value);
    else opts.source = value;
    index++;
  }

  return opts;
}

function exists(filePath) {
  try {
    fs.accessSync(filePath);
    return true;
  } catch {
    return false;
  }
}

function toPosix(value) {
  return String(value).replace(/\\/g, '/');
}

function isResourceRoot(dir) {
  return exists(path.join(dir, 'install.mjs')) && exists(path.join(dir, 'project'));
}

function resourceFromCheckout(root) {
  const candidate = path.join(root, ...RESOURCE_SEGMENTS);
  return isResourceRoot(candidate) ? candidate : null;
}

function isGitUrl(value) {
  return /^(https?:\/\/|git@|ssh:\/\/)/i.test(value) || value.endsWith('.git');
}

function cacheDir() {
  return process.env.AI_RELATED_AUXILIARY_CACHE
    || path.join(os.homedir(), '.cache', 'ai-related-auxiliary');
}

function runGit(args, cwd) {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (result.error) fail(`[error] Failed to run git: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = (result.stderr || result.stdout || '').trim();
    fail(`[error] git ${args.join(' ')} failed.${detail ? `\n${detail}` : ''}`);
  }
  return result.stdout.trim();
}

function fetchLibrary(url) {
  const dest = cacheDir();
  if (exists(path.join(dest, '.git'))) {
    console.log(`[info] Updating ${toPosix(dest)}`);
    runGit(['-C', dest, 'pull', '--ff-only']);
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    console.log(`[info] Cloning ${url}`);
    runGit(['clone', '--depth', '1', url, dest]);
  }
  const resource = resourceFromCheckout(dest);
  if (!resource) {
    fail(`[error] Cloned ${url} but system/resources/task-governance is missing.`);
  }
  return resource;
}

function resolveFromSource(source) {
  if (isGitUrl(source)) return fetchLibrary(source);
  const absolute = path.resolve(source);
  if (isResourceRoot(absolute)) return absolute;
  const fromCheckout = resourceFromCheckout(absolute);
  if (fromCheckout) return fromCheckout;
  fail(`[error] --source is not a task-governance resource, library checkout, or git URL: ${source}`);
}

function resolveLocalResource() {
  const fromScript = resourceFromCheckout(SCRIPT_DIR);
  if (fromScript) return { resource: fromScript, via: 'library checkout' };

  let current = process.cwd();
  while (true) {
    const found = resourceFromCheckout(current);
    if (found) return { resource: found, via: 'nearby checkout' };
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }

  for (const home of AGENT_HOMES) {
    const candidate = path.join(os.homedir(), home, 'resources', 'task-governance');
    if (isResourceRoot(candidate)) {
      return { resource: candidate, via: `${home} agent home` };
    }
  }
  return null;
}

function resolveResource(opts) {
  if (opts.source) {
    const resource = resolveFromSource(opts.source);
    return { resource, via: isGitUrl(opts.source) ? 'git' : '--source' };
  }
  if (!opts.fromGit) {
    const local = resolveLocalResource();
    if (local) return local;
  }
  return { resource: fetchLibrary(DEFAULT_GIT_URL), via: 'git' };
}

function initProject(resource, repoRoot, { dryRun, refresh }) {
  const installer = path.join(resource, 'install.mjs');
  const args = [installer, '--repo-root', repoRoot];
  if (dryRun) args.push('--dry-run');
  if (refresh) args.push('--refresh');
  const result = spawnSync(process.execPath, args, { stdio: 'inherit' });
  if (result.error) fail(`[error] Failed to start project installer: ${result.error.message}`);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function main() {
  const opts = parseArgs(process.argv);
  const { resource, via } = resolveResource(opts);
  console.log(`[info] Resource: ${toPosix(resource)} (${via})`);
  console.log(`[info] Project: ${toPosix(opts.repoRoot)}`);
  initProject(resource, opts.repoRoot, opts);
}

try {
  main();
} catch (error) {
  fail(`[error] Installation aborted: ${error?.message || String(error)}`);
}

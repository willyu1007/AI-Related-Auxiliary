#!/usr/bin/env node
/**
 * Instance-key reachability for UI style maps.
 *
 * Discovers `*.style-reachability.json` under the repo and reports unread keys,
 * stale or deleted known-orphan entries, empty declaration matches, and dynamic
 * indexing of a registered map.
 *
 * Usage:
 *   node scripts/lint-style-key-reachability.mjs
 *   node scripts/lint-style-key-reachability.mjs --repo-root <repo-root>
 */

import fs from 'node:fs';
import path from 'node:path';

const CONFIG_SUFFIX = '.style-reachability.json';
const KINDS = new Set(['object-keys', 'css-module', 'css-vars']);
const ALLOWED_KEYS = {
  'object-keys': new Set([
    'kind',
    'source',
    'objectStart',
    'readersRoot',
    'declared',
    'read',
    'dynamicRead',
    'knownOrphans',
    'minDeclared',
  ]),
  'css-module': new Set([
    'kind',
    'source',
    'readersRoot',
    'importName',
    'declared',
    'read',
    'dynamicRead',
    'knownOrphans',
    'minDeclared',
  ]),
  'css-vars': new Set([
    'kind',
    'source',
    'readersRoot',
    'prefix',
    'declared',
    'read',
    'dynamicRead',
    'knownOrphans',
    'minDeclared',
  ]),
};
const SKIP_DIRS = new Set([
  '.cache',
  '.expo',
  '.git',
  '.next',
  '.turbo',
  'Pods',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
]);
const READER_EXT = new Set([
  '.css',
  '.cjs',
  '.html',
  '.js',
  '.jsx',
  '.less',
  '.mdx',
  '.mjs',
  '.sass',
  '.scss',
  '.svelte',
  '.ts',
  '.tsx',
  '.vue',
]);

function posixRel(from, to) {
  return path.relative(from, to).split(path.sep).join('/');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function compileRe(source, flags) {
  try {
    return new RegExp(source, flags);
  } catch (error) {
    throw new Error(`invalid regex ${JSON.stringify(source)}: ${error.message}`);
  }
}

function walkFiles(dir, out = []) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      walkFiles(full, out);
    } else if (entry.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function discoverConfigs(repoRoot) {
  return walkFiles(repoRoot).filter((file) => file.endsWith(CONFIG_SUFFIX));
}

function sliceObject(source, objectStart) {
  const start = source.indexOf(objectStart);
  if (start < 0) {
    throw new Error(`objectStart not found: ${JSON.stringify(objectStart)}`);
  }
  const braceAt = source.indexOf('{', start);
  if (braceAt < 0) {
    throw new Error('objectStart has no opening brace');
  }
  let depth = 0;
  for (let i = braceAt; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i);
    }
  }
  throw new Error('style object is unterminated');
}

function objectName(objectStart) {
  return objectStart.match(/\b(?:const|let|var)\s+(\w+)/)?.[1] ?? null;
}

function readJson(filePath) {
  let raw;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new Error(`cannot read ${filePath}: ${error.message}`);
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`invalid JSON ${filePath}: ${error.message}`);
  }
}

function loadConfig(configPath) {
  const cfg = readJson(configPath);
  if (cfg === null || typeof cfg !== 'object' || Array.isArray(cfg)) {
    throw new Error('config must be an object');
  }
  if (!KINDS.has(cfg.kind)) {
    throw new Error(`kind must be one of ${[...KINDS].join(', ')}`);
  }
  const extra = Object.keys(cfg).filter((key) => !ALLOWED_KEYS[cfg.kind].has(key));
  if (extra.length > 0) {
    throw new Error(`unknown keys: ${extra.join(', ')}`);
  }
  if (typeof cfg.source !== 'string' || cfg.source.length === 0) {
    throw new Error('source is required');
  }
  if (typeof cfg.readersRoot !== 'string' || cfg.readersRoot.length === 0) {
    throw new Error('readersRoot is required');
  }
  if (cfg.kind === 'object-keys' && (typeof cfg.objectStart !== 'string' || cfg.objectStart.length === 0)) {
    throw new Error('objectStart is required for object-keys');
  }
  if (cfg.knownOrphans != null) {
    if (typeof cfg.knownOrphans !== 'object' || Array.isArray(cfg.knownOrphans)) {
      throw new Error('knownOrphans must be an object of key → reason');
    }
    for (const [key, reason] of Object.entries(cfg.knownOrphans)) {
      if (typeof reason !== 'string' || reason.trim().length === 0) {
        throw new Error(`knownOrphans.${key} needs a non-empty reason`);
      }
    }
  }
  if (cfg.minDeclared != null && (!Number.isInteger(cfg.minDeclared) || cfg.minDeclared < 1)) {
    throw new Error('minDeclared must be a positive integer');
  }
  if (cfg.importName != null && (typeof cfg.importName !== 'string' || cfg.importName.length === 0)) {
    throw new Error('importName must be a non-empty string');
  }
  if (cfg.prefix != null && (typeof cfg.prefix !== 'string' || cfg.prefix.length === 0)) {
    throw new Error('prefix must be a non-empty string');
  }
  for (const field of ['declared', 'read', 'dynamicRead']) {
    if (cfg[field] != null && typeof cfg[field] !== 'string') {
      throw new Error(`${field} must be a regex string`);
    }
  }
  return cfg;
}

function declaredFlags(source) {
  return source.includes('^') ? 'gm' : 'g';
}

function captureKeys(text, regex) {
  return [...text.matchAll(regex)].map((match) => match[1]).filter(Boolean);
}

function cssModuleClasses(source) {
  const withoutGlobal = source.replace(/:global\([^)]*\)/g, '');
  return captureKeys(withoutGlobal, /(?:^|[},{\s])\.([A-Za-z_][\w]*)/gm);
}

function declaredKeys(sourceText, cfg) {
  if (cfg.declared) {
    return captureKeys(sourceText, compileRe(cfg.declared, declaredFlags(cfg.declared)));
  }
  if (cfg.kind === 'css-module') return cssModuleClasses(sourceText);
  if (cfg.kind === 'css-vars') {
    const keys = captureKeys(sourceText, /--([A-Za-z_][\w-]*)\s*:/g).map((name) => `--${name}`);
    if (!cfg.prefix) return keys;
    return keys.filter((key) => key.startsWith(cfg.prefix));
  }
  return captureKeys(sourceText, /^ {2}(\w+)\s*:/gm);
}

function accessName(cfg) {
  if (cfg.kind === 'css-module') return cfg.importName || 'styles';
  if (cfg.kind === 'object-keys') return objectName(cfg.objectStart);
  return null;
}

function collectReadKeys(text, cfg, name) {
  if (cfg.read) {
    return new Set(captureKeys(text, compileRe(cfg.read, 'g')));
  }
  if (cfg.kind === 'css-vars') {
    const keys = captureKeys(text, /var\(\s*(--[A-Za-z_][\w-]*)/g);
    if (!cfg.prefix) return new Set(keys);
    return new Set(keys.filter((key) => key.startsWith(cfg.prefix)));
  }
  if (!name) {
    throw new Error('read pattern required when the object name cannot be derived');
  }
  const keys = new Set();
  const ident = compileRe(`\\b${escapeRegExp(name)}\\.(\\w+)`, 'g');
  const quoted = compileRe(`\\b${escapeRegExp(name)}\\s*\\[\\s*['"]([\\w-]+)['"]\\s*\\]`, 'g');
  for (const key of captureKeys(text, ident)) keys.add(key);
  for (const key of captureKeys(text, quoted)) keys.add(key);
  return keys;
}

function stripLiteralAccess(text, name) {
  const token = escapeRegExp(name);
  return text
    .replace(compileRe(`\\b${token}\\.\\w+`, 'g'), '')
    .replace(compileRe(`\\b${token}\\s*\\[\\s*['"][\\w-]+['"]\\s*\\]`, 'g'), '');
}

function dynamicHits(text, cfg, name, filePath) {
  if (cfg.dynamicRead) {
    return compileRe(cfg.dynamicRead, 'g').test(text) ? [filePath] : [];
  }
  if (cfg.kind === 'css-vars') {
    const leftover = text.replace(/var\(\s*--[A-Za-z_][\w-]*\s*(?:,[^)]*)?\)/g, '');
    return /var\(\s*(?:`--[^)]*\$\{|--\$\{|['"][^)]*\+)/.test(leftover) ? [filePath] : [];
  }
  if (!name) return [];
  const leftover = stripLiteralAccess(text, name);
  return compileRe(`\\b${escapeRegExp(name)}\\s*[\\[\`]`, 'g').test(leftover)
    ? [filePath]
    : [];
}

function readerFiles(readersRoot, sourcePath) {
  const files = [];
  for (const file of walkFiles(readersRoot)) {
    if (file === sourcePath) continue;
    if (!READER_EXT.has(path.extname(file))) continue;
    if (file.endsWith('.d.ts')) continue;
    files.push(file);
  }
  return files;
}

function lintNamespace(repoRoot, configPath) {
  const messages = [];
  const rel = posixRel(repoRoot, configPath);
  let cfg;
  try {
    cfg = loadConfig(configPath);
  } catch (error) {
    return { ok: false, messages: [`${rel}: ${error.message}`] };
  }

  const base = path.dirname(configPath);
  const sourcePath = path.resolve(base, cfg.source);
  const readersRoot = path.resolve(base, cfg.readersRoot);
  const name = accessName(cfg);
  const minDeclared = cfg.minDeclared ?? 1;

  let sourceText;
  try {
    sourceText = fs.readFileSync(sourcePath, 'utf8');
  } catch (error) {
    return { ok: false, messages: [`${rel}: cannot read source ${cfg.source}: ${error.message}`] };
  }

  let declaredSource = sourceText;
  try {
    if (cfg.kind === 'object-keys') declaredSource = sliceObject(sourceText, cfg.objectStart);
  } catch (error) {
    return { ok: false, messages: [`${rel}: ${error.message}`] };
  }

  let declared;
  try {
    declared = declaredKeys(declaredSource, cfg);
  } catch (error) {
    return { ok: false, messages: [`${rel}: ${error.message}`] };
  }

  const knownOrphans = cfg.knownOrphans ?? {};
  const declaredSet = new Set(declared);
  const readSet = new Set();
  const dynamicFiles = [];
  const scanFiles = readerFiles(readersRoot, sourcePath);

  for (const file of [sourcePath, ...scanFiles]) {
    let text;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const skipLiteralOnSource =
      file === sourcePath && cfg.kind === 'object-keys';
    if (!skipLiteralOnSource) {
      try {
        for (const key of collectReadKeys(text, cfg, name)) readSet.add(key);
      } catch (error) {
        return { ok: false, messages: [`${rel}: ${error.message}`] };
      }
    }
    try {
      for (const hit of dynamicHits(text, cfg, name, file)) {
        dynamicFiles.push(posixRel(repoRoot, hit));
      }
    } catch (error) {
      return { ok: false, messages: [`${rel}: ${error.message}`] };
    }
  }

  const orphans = declared.filter((key) => !readSet.has(key) && !(key in knownOrphans));
  const staleKnown = Object.keys(knownOrphans).filter(
    (key) => !declaredSet.has(key) || readSet.has(key),
  );
  const ok =
    declared.length >= minDeclared &&
    orphans.length === 0 &&
    staleKnown.length === 0 &&
    dynamicFiles.length === 0;

  if (declared.length < minDeclared) {
    messages.push(
      `${rel}: declared ${declared.length} keys; objectStart or declared pattern matched nothing`,
    );
  }
  if (orphans.length > 0) messages.push(`${rel}: unread keys: ${orphans.join(', ')}`);
  if (staleKnown.length > 0) {
    messages.push(`${rel}: knownOrphans must leave (deleted or now read): ${staleKnown.join(', ')}`);
  }
  if (dynamicFiles.length > 0) {
    const unique = [...new Set(dynamicFiles)];
    const label = name ? JSON.stringify(name) : 'registered keys';
    messages.push(`${rel}: dynamic indexing of ${label} at ${unique.join(', ')}`);
  }
  if (ok) messages.push(`${rel}: ${declared.length} keys, ${readSet.size} reads`);

  return { ok, messages };
}

function lintRepo(repoRoot) {
  const root = path.resolve(repoRoot);
  const configs = discoverConfigs(root);
  if (configs.length === 0) {
    return {
      ok: true,
      messages: [`No ${CONFIG_SUFFIX} registrations under ${root}`],
    };
  }
  const messages = [];
  let ok = true;
  for (const configPath of configs.sort()) {
    const result = lintNamespace(root, configPath);
    if (!result.ok) ok = false;
    messages.push(...result.messages);
  }
  return { ok, messages };
}

function printHelp() {
  console.log(`Usage:
  node scripts/lint-style-key-reachability.mjs
  node scripts/lint-style-key-reachability.mjs --repo-root <repo-root>

Finds *${CONFIG_SUFFIX} under the repo. Paths in a registration are relative
to that file.`);
}

function parseArgs(argv) {
  const args = { repoRoot: process.cwd(), help: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '-h' || arg === '--help') args.help = true;
    else if (arg === '--repo-root') {
      const value = argv[i + 1];
      if (!value) throw new Error('--repo-root needs a directory');
      args.repoRoot = value;
      i += 1;
    } else {
      throw new Error(`unknown option: ${arg}`);
    }
  }
  return args;
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
  if (args.help) {
    printHelp();
    return;
  }
  const result = lintRepo(args.repoRoot);
  for (const line of result.messages) {
    if (result.ok) console.log(line);
    else console.error(line);
  }
  process.exit(result.ok ? 0 : 1);
}

main();

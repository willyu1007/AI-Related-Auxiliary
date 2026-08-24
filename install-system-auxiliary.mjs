#!/usr/bin/env node
/**
 * Sync system/skills/ and the global instruction docs into the agent homes
 * (~/.claude, ~/.codex, ~/.cursor).
 *
 * - Skills are replaced per directory: a skill shipped by this library overwrites the
 *   same-named skill in the target wholesale; skills the target has that this library
 *   does not ship are left untouched.
 * - ~/.codex does not receive the codex-* skills (Codex does not delegate to itself).
 * - Docs: AGENTS.md -> ~/.codex and ~/.cursor; CLAUDE.md -> ~/.claude.
 * - An agent home that does not exist is skipped, never created.
 *
 * Note: system/resources/ is NOT handled here; see README for the manual copy that
 * keeps resources/ a sibling of skills/ in each agent home.
 *
 * Usage:
 *   node install-system-auxiliary.mjs
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)));
const SKILLS_SRC = path.join(REPO_ROOT, 'system', 'skills');
const DOCS_SRC = path.join(REPO_ROOT, 'system', 'docs');
const HOME = os.homedir();

const AGENTS = [
  { home: '.claude', skillFilter: () => true, docs: ['CLAUDE.md'] },
  { home: '.codex', skillFilter: (name) => !name.startsWith('codex-'), docs: ['AGENTS.md'] },
  { home: '.cursor', skillFilter: () => true, docs: ['AGENTS.md'] },
];

function fail(message) {
  console.error(`[error] ${message}`);
  process.exit(1);
}

function copyTree(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (source) => path.basename(source) !== '.DS_Store',
  });
}

function main() {
  const [arg] = process.argv.slice(2);
  if (arg === '-h' || arg === '--help') {
    console.log('Usage: node install-system-auxiliary.mjs');
    process.exit(0);
  }
  if (arg) fail(`Unknown option: ${arg}`);

  if (!fs.existsSync(SKILLS_SRC)) fail(`Missing source directory: ${SKILLS_SRC}`);
  if (!fs.existsSync(DOCS_SRC)) fail(`Missing source directory: ${DOCS_SRC}`);

  const skillNames = fs
    .readdirSync(SKILLS_SRC, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  if (skillNames.length === 0) fail(`No skills found in ${SKILLS_SRC}`);

  for (const doc of new Set(AGENTS.flatMap((agent) => agent.docs))) {
    if (!fs.existsSync(path.join(DOCS_SRC, doc))) fail(`Missing source doc: system/docs/${doc}`);
  }

  for (const agent of AGENTS) {
    const homeDir = path.join(HOME, agent.home);
    if (!fs.existsSync(homeDir)) {
      console.log(`~/${agent.home}  skipped (directory does not exist)`);
      continue;
    }

    const selected = skillNames.filter(agent.skillFilter);
    const excluded = skillNames.filter((name) => !agent.skillFilter(name));

    const skillsDest = path.join(homeDir, 'skills');
    fs.mkdirSync(skillsDest, { recursive: true });
    for (const name of selected) {
      const dest = path.join(skillsDest, name);
      fs.rmSync(dest, { recursive: true, force: true });
      copyTree(path.join(SKILLS_SRC, name), dest);
    }

    for (const doc of agent.docs) {
      fs.copyFileSync(path.join(DOCS_SRC, doc), path.join(homeDir, doc));
    }

    const parts = [`${selected.length} skills`, `docs: ${agent.docs.join(', ')}`];
    if (excluded.length > 0) parts.push(`excluded: ${excluded.join(', ')}`);
    console.log(`~/${agent.home}  ${parts.join('  |  ')}`);
  }

  console.log('Done.');
}

main();

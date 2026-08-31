#!/usr/bin/env node
/**
 * Sync system/skills/ and the global instruction docs into the agent homes
 * (~/.claude, ~/.codex, ~/.cursor).
 *
 * - Skills are replaced per directory: a skill shipped by this library overwrites the
 *   same-named skill in the target wholesale; skills the target has that this library
 *   does not ship are left untouched.
 * - Library skills outside the selected profile are removed from the target.
 * - ~/.codex does not receive the codex-* skills (Codex does not delegate to itself).
 * - Docs: AGENTS.md -> ~/.codex and ~/.cursor; CLAUDE.md -> ~/.claude.
 * - An agent home that does not exist is skipped, never created.
 *
 * Note: system/resources/ is NOT handled here; see README for the manual copy that
 * keeps resources/ a sibling of skills/ in each agent home.
 *
 * Usage:
 *   node install-system-auxiliary.mjs
 *   node install-system-auxiliary.mjs --profile general
 *   node install-system-auxiliary.mjs --profile all
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

const TIER_RANK = { minimal: 0, general: 1, all: 2 };
const DEFAULT_PROFILE = 'general';
const PROFILE_ALIASES = {
  minimal: 'minimal',
  general: 'general',
  all: 'all',
};

/** Lowest profile that installs the skill before profile-specific exclusions. */
export const SKILL_TIER = {
  'review-code': 'minimal',
  research: 'minimal',
  tdd: 'minimal',
  'using-powershell': 'minimal',
  'task-start': 'minimal',
  'task-plan': 'minimal',
  'task-sync': 'minimal',
  'task-resume': 'minimal',
  'task-handoff': 'minimal',
  'project-status': 'minimal',
  'project-hub-maintain': 'minimal',
  'debug-mode': 'general',
  'resolve-vcs-conflicts': 'general',
  'cleanup-project-residue': 'general',
  'html-communication': 'general',
  'manage-ui-style': 'general',
  'goal-mode': 'general',
  'codex-implementation': 'general',
  'codex-review': 'general',
  'codex-computer-use': 'general',
  wizard: 'general',
  'write-prompt': 'all',
  'sensitive-ops': 'all',
  'sync-db-from-prisma': 'all',
  'manage-llm-config': 'all',
};

/** Higher profiles may replace a lower-profile skill with a broader one. */
export const PROFILE_EXCLUSIONS = {
  minimal: new Set(),
  general: new Set(),
  all: new Set(['wizard']),
};

/** Renamed or retired library skills that should not survive profile changes. */
const OBSOLETE_SKILLS = new Set(['get-sensitive-info']);

function fail(message) {
  console.error(`[error] ${message}`);
  process.exit(1);
}

function usage(exitCode = 0) {
  console.log(`
Usage:
  node install-system-auxiliary.mjs [options]

Sync system/skills and global instruction docs into ~/.claude, ~/.codex, and ~/.cursor.

Options:
  --profile <name>  minimal | general | all
                    Default: general. Higher profiles build on lower ones,
                    with documented replacements.
  -h, --help        Show this help

Profiles:
  minimal   task-* / project-* plus PowerShell, review, research, and tdd
  general   minimal plus everyday debug, UI, HTML, cleanup, Codex, and wizard
  all       general with wizard replaced by sensitive-ops, plus write-prompt,
            Prisma, and .ai/llm

~/.codex never receives the three codex-* skills.
Library skills outside the selected profile are removed from the target.
`.trim());
  process.exit(exitCode);
}

function parseArgs(argv) {
  let profile = DEFAULT_PROFILE;
  const seen = new Set();

  for (let index = 2; index < argv.length; index++) {
    const token = argv[index];
    if (token === '-h' || token === '--help') usage(0);
    if (!token.startsWith('--')) fail(`Unexpected positional argument: "${token}".`);

    const key = token.slice(2);
    if (key !== 'profile') fail(`Unknown option: --${key}.`);
    if (seen.has(key)) fail(`Option --${key} was provided more than once.`);
    seen.add(key);

    const value = argv[++index];
    if (!value || value.startsWith('--')) fail('Option --profile requires a value.');
    const resolved = PROFILE_ALIASES[value];
    if (!resolved) {
      fail(`Unknown profile: "${value}". Use minimal, general, or all.`);
    }
    profile = resolved;
  }

  return { profile };
}

function listSkillDirs() {
  return fs
    .readdirSync(SKILLS_SRC, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

export function assertSkillTiers(skillNames) {
  const names = new Set(skillNames);
  const missing = skillNames.filter((name) => !SKILL_TIER[name]);
  const extra = Object.keys(SKILL_TIER).filter((name) => !names.has(name));
  const invalid = Object.entries(SKILL_TIER)
    .filter(([, tier]) => TIER_RANK[tier] === undefined)
    .map(([name, tier]) => `${name}=${tier}`);
  const invalidExclusions = Object.entries(PROFILE_EXCLUSIONS).flatMap(([profile, excluded]) => {
    if (TIER_RANK[profile] === undefined) return [`unknown profile ${profile}`];
    return [...excluded]
      .filter((name) => !names.has(name))
      .map((name) => `${profile} excludes unknown skill ${name}`);
  });
  const errors = [];
  if (missing.length > 0) errors.push(`skills missing a profile tier: ${missing.join(', ')}`);
  if (extra.length > 0) errors.push(`profile tiers for unknown skills: ${extra.join(', ')}`);
  if (invalid.length > 0) errors.push(`invalid profile tiers: ${invalid.join(', ')}`);
  if (invalidExclusions.length > 0) errors.push(`invalid profile exclusions: ${invalidExclusions.join(', ')}`);
  return errors;
}

export function skillsForProfile(skillNames, profile) {
  const rank = TIER_RANK[profile];
  if (rank === undefined) fail(`Unknown profile: "${profile}".`);
  const excluded = PROFILE_EXCLUSIONS[profile];
  return skillNames.filter((name) => TIER_RANK[SKILL_TIER[name]] <= rank && !excluded.has(name));
}

/** Every library-owned skill not selected for this agent and profile must be removed. */
export function managedSkillsToRemove(skillNames, selectedSkillNames) {
  const selected = new Set(selectedSkillNames);
  return [...new Set([...skillNames, ...OBSOLETE_SKILLS])].filter((name) => !selected.has(name));
}

function copyTree(src, dest) {
  fs.cpSync(src, dest, {
    recursive: true,
    filter: (source) => path.basename(source) !== '.DS_Store',
  });
}

function launchedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return path.resolve(entry) === fileURLToPath(import.meta.url);
}

function main() {
  const { profile } = parseArgs(process.argv);

  if (!fs.existsSync(SKILLS_SRC)) fail(`Missing source directory: ${SKILLS_SRC}`);
  if (!fs.existsSync(DOCS_SRC)) fail(`Missing source directory: ${DOCS_SRC}`);

  const skillNames = listSkillDirs();
  if (skillNames.length === 0) fail(`No skills found in ${SKILLS_SRC}`);

  const tierErrors = assertSkillTiers(skillNames);
  if (tierErrors.length > 0) fail(tierErrors.join('; '));

  const profileSkills = skillsForProfile(skillNames, profile);

  for (const doc of new Set(AGENTS.flatMap((agent) => agent.docs))) {
    if (!fs.existsSync(path.join(DOCS_SRC, doc))) fail(`Missing source doc: system/docs/${doc}`);
  }

  for (const agent of AGENTS) {
    const homeDir = path.join(HOME, agent.home);
    if (!fs.existsSync(homeDir)) {
      console.log(`~/${agent.home}  skipped (directory does not exist)`);
      continue;
    }

    const selected = profileSkills.filter(agent.skillFilter);
    const excluded = profileSkills.filter((name) => !agent.skillFilter(name));

    const skillsDest = path.join(homeDir, 'skills');
    fs.mkdirSync(skillsDest, { recursive: true });

    const removed = [];
    for (const name of managedSkillsToRemove(skillNames, selected)) {
      const dest = path.join(skillsDest, name);
      if (!fs.existsSync(dest)) continue;
      fs.rmSync(dest, { recursive: true, force: true });
      removed.push(name);
    }

    for (const name of selected) {
      const dest = path.join(skillsDest, name);
      fs.rmSync(dest, { recursive: true, force: true });
      copyTree(path.join(SKILLS_SRC, name), dest);
    }

    for (const doc of agent.docs) {
      fs.copyFileSync(path.join(DOCS_SRC, doc), path.join(homeDir, doc));
    }

    const parts = [`profile: ${profile}`, `${selected.length} skills`, `docs: ${agent.docs.join(', ')}`];
    if (excluded.length > 0) parts.push(`excluded: ${excluded.join(', ')}`);
    if (removed.length > 0) parts.push(`removed: ${removed.join(', ')}`);
    console.log(`~/${agent.home}  ${parts.join('  |  ')}`);
  }

  console.log('Done.');
}

if (launchedDirectly()) main();

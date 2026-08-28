#!/usr/bin/env node
/**
 * checks/run.mjs
 *
 * Static self-check for this library: scan system/ for dangling references,
 * cross-linked skills, drifted global docs, and hygiene problems.
 *
 * `checks/` validates the library; `system/` is the library. Nothing under checks/ is ever copied
 * into a target project.
 *
 * Usage:
 *   node checks/run.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertSkillTiers } from '../install-system-auxiliary.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'system', 'skills');
const RESOURCES_DIR = path.join(REPO_ROOT, 'system', 'resources');
const DOCS_DIR = path.join(REPO_ROOT, 'system', 'docs');

const NUL = String.fromCharCode(0);
const SCRIPT_REF_RE = /\.ai\/scripts\/[a-z0-9-]+\.mjs/g;
const MACHINE_PATH_RE = /(?:\/Users\/|\/home\/[a-z]|\/Volumes\/|[A-Z]:\\\\)/;
const SKILL_CROSSLINK_ALLOWLIST = new Map([
  [
    'goal-mode',
    new Set([
      'cleanup-project-residue',
      'review-code',
      'task-plan',
      'task-resume',
      'task-start',
      'task-sync',
    ]),
  ],
]);

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const failures = [];

function fail(check, message) {
  failures.push(`${check}: ${message}`);
}

/** All files under dir, recursively, as absolute paths. */
function walk(dir) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.isFile()) out.push(full);
  }
  return out;
}

function readTextOrNull(filePath) {
  try {
    const raw = fs.readFileSync(filePath, 'utf8');
    // Treat anything with a NUL byte as binary and skip it.
    return raw.includes(NUL) ? null : raw;
  } catch {
    return null;
  }
}

function runStatic() {
  console.log(c.bold('\nStatic checks'));

  // The two global instruction files land on different tools (~/.claude/CLAUDE.md and
  // ~/.codex/AGENTS.md) and are copied verbatim, so everything they have in common is a second
  // copy that drifts the moment one is edited alone. AGENTS.md is CLAUDE.md minus the Claude-only
  // tail; enforcing the prefix is what makes a one-sided edit fail here instead of six weeks later.
  const claudeMd = readTextOrNull(path.join(DOCS_DIR, 'CLAUDE.md'));
  const agentsMd = readTextOrNull(path.join(DOCS_DIR, 'AGENTS.md'));
  if (claudeMd === null || agentsMd === null) {
    fail('docs-drift', 'system/docs/ must hold both CLAUDE.md and AGENTS.md');
  } else if (!claudeMd.startsWith(agentsMd)) {
    fail('docs-drift', 'system/docs/AGENTS.md is no longer a prefix of CLAUDE.md — their shared part drifted');
  }

  // Skills are global and live one level under system/skills/, because skill discovery only scans
  // that depth -- a skill nested deeper is silently never loaded. A skill is addressed by its
  // frontmatter `name` but lives in a directory, so a rename that updates one and not the other
  // breaks routing just as silently.
  const skillOwner = new Map();
  const skillByDir = new Map();
  for (const entry of fs.readdirSync(SKILLS_DIR, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillMd = path.join(SKILLS_DIR, entry.name, 'SKILL.md');

    if (!fs.existsSync(skillMd)) {
      const nested = walk(path.join(SKILLS_DIR, entry.name)).some(
        (f) => path.basename(f) === 'SKILL.md'
      );
      fail(
        'skill-layout',
        nested
          ? `system/skills/${entry.name}/ groups skills in subdirectories; discovery only scans one level deep`
          : `system/skills/${entry.name}/ has no SKILL.md`
      );
      continue;
    }

    const declared = (readTextOrNull(skillMd) || '').match(/^name:[ \t]*(\S+)[ \t]*$/m)?.[1];
    if (!declared) {
      fail('skill-name', `system/skills/${entry.name}/SKILL.md has no frontmatter name`);
      continue;
    }
    if (declared !== entry.name) {
      fail('skill-name', `system/skills/${entry.name}/SKILL.md declares "${declared}"`);
    }
    skillOwner.set(declared, entry.name);
    skillByDir.set(entry.name, declared);
  }

  // Profile membership lives in the installer. A new or renamed skill that is not assigned a
  // lowest tier will silently miss every profile, or leave a stale name in the map.
  for (const message of assertSkillTiers([...skillByDir.keys()])) {
    fail('skill-profile', message);
  }

  // Cross-skill orchestration is exceptional and explicit. Validate the allowlist itself so a
  // renamed or removed orchestrator or target cannot silently leave a dangling handoff.
  for (const [orchestrator, targets] of SKILL_CROSSLINK_ALLOWLIST) {
    if (!skillOwner.has(orchestrator)) {
      fail('skill-crosslink-policy', `allowlisted orchestrator "${orchestrator}" is not a skill`);
    }
    for (const target of targets) {
      if (!skillOwner.has(target)) {
        fail(
          'skill-crosslink-policy',
          `allowlisted target "${target}" for "${orchestrator}" is not a skill`
        );
      }
    }
  }

  // Shared resources are part of the system distribution but are not discoverable skills. Each
  // resource owns its installer so a dependent skill cannot silently rely on an untracked tree.
  const resourceEntries = fs.existsSync(RESOURCES_DIR)
    ? fs.readdirSync(RESOURCES_DIR, { withFileTypes: true }).filter((entry) => entry.isDirectory())
    : [];
  for (const entry of resourceEntries) {
    for (const required of ['install.mjs']) {
      if (!fs.existsSync(path.join(RESOURCES_DIR, entry.name, required))) {
        fail('resource-layout', `system/resources/${entry.name}/ has no ${required}`);
      }
    }
  }

  // Who ships which project-local control script, e.g. ".ai/scripts/foo.mjs" -> the shared
  // resource that installs it. The path below <resource>/project/ is the target-repository path.
  const provider = new Map();
  for (const abs of walk(RESOURCES_DIR)) {
    const rel = path.relative(RESOURCES_DIR, abs).split(path.sep).join('/');
    const match = rel.match(/^([^/]+)\/project\/(\.ai\/scripts\/.+)$/);
    if (!match) continue;
    if (provider.has(match[2])) {
      fail('resource-provider', `${match[2]} is shipped by more than one system resource`);
    } else {
      provider.set(match[2], match[1]);
    }
  }

  for (const abs of walk(SKILLS_DIR)) {
    const shipped = path.relative(SKILLS_DIR, abs).split(path.sep).join('/');
    const owner = skillByDir.get(shipped.split('/')[0]);

    if (path.basename(abs) === '.DS_Store') {
      fail('hygiene', `system/skills/${shipped} should not be committed`);
    }

    const text = readTextOrNull(abs);
    if (text === null) continue;
    if (MACHINE_PATH_RE.test(text)) {
      fail('hygiene', `system/skills/${shipped} contains a machine-specific absolute path`);
    }

    // Every referenced control script must be shipped by a system resource. A reference to a
    // script nothing provides is the failure mode that survives a source repo being retired.
    for (const ref of text.match(SCRIPT_REF_RE) || []) {
      if (!provider.has(ref)) {
        fail('dangling-ref', `system/skills/${shipped} references ${ref}, which nothing ships`);
      }
    }

    // Ordinary skills do not name another skill anywhere in what they ship. In a description the
    // cost is routing; in a body the cost is rename coupling and dangling handoffs. A small,
    // validated allowlist is reserved for an intentional orchestrator whose contract is to
    // sequence existing capabilities. Naming yourself is fine, as is pointing at anything that
    // is not a skill.
    for (const other of skillOwner.keys()) {
      const allowed = SKILL_CROSSLINK_ALLOWLIST.get(owner)?.has(other);
      if (other !== owner && text.includes(other) && !allowed) {
        fail('skill-crosslink', `system/skills/${shipped} names the "${other}" skill`);
      }
    }
  }

  for (const abs of walk(RESOURCES_DIR)) {
    const shipped = path.relative(RESOURCES_DIR, abs).split(path.sep).join('/');
    if (path.basename(abs) === '.DS_Store') {
      fail('hygiene', `system/resources/${shipped} should not be committed`);
    }

    const text = readTextOrNull(abs);
    if (text === null) continue;
    if (MACHINE_PATH_RE.test(text)) {
      fail('hygiene', `system/resources/${shipped} contains a machine-specific absolute path`);
    }
    for (const ref of text.match(SCRIPT_REF_RE) || []) {
      if (!provider.has(ref)) {
        fail('dangling-ref', `system/resources/${shipped} references ${ref}, which nothing ships`);
      }
    }
  }

  if (failures.length === 0) {
    console.log(c.green('  ok') + c.dim(`  layout, hygiene, references, docs, ${skillOwner.size} skills, ${resourceEntries.length} resources`));
  }
}

function main() {
  const [arg] = process.argv.slice(2);
  if (arg === '-h' || arg === '--help') {
    console.log('Usage: node checks/run.mjs');
    process.exit(0);
  }
  if (arg) {
    console.error(c.red(`[error] Unknown option: ${arg}`));
    process.exit(1);
  }

  runStatic();

  console.log('');
  if (failures.length > 0) {
    console.log(c.red(`${failures.length} problem(s):`));
    for (const f of failures) console.log(c.red(`  - ${f}`));
    process.exit(1);
  }
  console.log(c.green('All checks passed.'));
}

main();

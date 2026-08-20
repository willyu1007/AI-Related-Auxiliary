#!/usr/bin/env node
/**
 * checks/run.mjs
 *
 * Self-check for this library. Two parts:
 *
 *   static  - scan system/ for dangling references, cross-linked skills,
 *             drifted global docs, and hygiene problems
 *   smoke   - run each checks/skills/<skill>.sh inside a throwaway git repo
 *
 * `checks/` validates the library; `system/` is the library. Nothing under checks/ is ever copied
 * into a target project.
 *
 * Design notes:
 *   - Dependency-free (Node built-ins only).
 *   - A smoke test starts from an empty repository and provisions it by running the skill's own
 *     installer entry point, so the install path is the thing under test rather than a `cp -R` that only
 *     the test knows how to perform.
 *   - POSIX shell is required for the smoke tests.
 *
 * Usage:
 *   node checks/run.mjs                  # everything
 *   node checks/run.mjs --static         # static checks only
 *   node checks/run.mjs --smoke          # smoke tests only
 *   node checks/run.mjs --only <skill>   # restrict the smoke tests to one skill
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'system', 'skills');
const DOCS_DIR = path.join(REPO_ROOT, 'system', 'docs');
const SKILL_CHECKS_DIR = path.join(REPO_ROOT, 'checks', 'skills');

const NUL = String.fromCharCode(0);
const SCRIPT_REF_RE = /\.ai\/scripts\/[a-z0-9-]+\.mjs/g;
const MACHINE_PATH_RE = /(?:\/Users\/|\/home\/[a-z]|\/Volumes\/|[A-Z]:\\\\)/;
const SKILL_CROSSLINK_ALLOWLIST = new Map([
  [
    'goal-mode',
    new Set([
      'cleanup-project-residue',
      'review-code',
      'task-handoff',
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
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
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

/** Skill smoke tests, named `<skill>.sh` after the skill they exercise. */
function listSkillChecks() {
  try {
    return fs
      .readdirSync(SKILL_CHECKS_DIR)
      .filter((f) => f.endsWith('.sh'))
      .sort();
  } catch {
    return [];
  }
}

// --------------------------------------------------------------------------------------------
// Static checks
// --------------------------------------------------------------------------------------------

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

  // Who ships which control script, e.g. ".ai/scripts/foo.mjs" -> the skill that installs it. A
  // skill ships its installable tree under assets/<bundle>/, laid out exactly as it lands in the
  // target repository, so the path below the bundle directory is the shipped path.
  const provider = new Map();
  for (const abs of walk(SKILLS_DIR)) {
    const rel = path.relative(SKILLS_DIR, abs).split(path.sep).join('/');
    const m = rel.match(/^([^/]+)\/assets\/[^/]+\/(\.ai\/scripts\/.+)$/);
    if (m) provider.set(m[2], m[1]);
  }

  // A skill smoke test is named after the skill it exercises, so a renamed or deleted skill leaves
  // a test that installs nothing and passes.
  for (const file of listSkillChecks()) {
    const skill = path.basename(file, '.sh');
    if (!skillByDir.has(skill)) {
      fail('stale-check', `checks/skills/${file} exercises "${skill}", which is not a skill`);
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

    // Every referenced control script must be shipped by some skill. A reference to a script
    // nothing provides is the failure mode that survives a source repo being retired.
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

  if (failures.length === 0) {
    console.log(
    c.green('  ok') + c.dim(`  layout, hygiene, references, docs, ${skillOwner.size} skills`)
    );
  }
}

// --------------------------------------------------------------------------------------------
// Smoke tests
// --------------------------------------------------------------------------------------------

function runSmoke(files) {
  console.log(c.bold('\nSmoke tests'));

  for (const file of files) {
    const name = path.basename(file, '.sh');
    const verifyPath = path.join(SKILL_CHECKS_DIR, file);

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `aux-${name}-`));
    try {
      execFileSync('git', ['init', '-q'], { cwd: tmp });

      const out = execFileSync('sh', [verifyPath], {
        cwd: tmp,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        // The test provisions the repository from the skill's own assets, so it needs the repo
        // root to reach system/skills/<skill>/assets/.
        env: { ...process.env, AUX_ROOT: REPO_ROOT },
      });
      const summary = out.trim().split('\n').filter(Boolean).pop() || '';
      console.log(`  ${c.green('ok')}   ${name} ${c.dim(summary)}`);
    } catch (e) {
      const detail = [e.stdout, e.stderr].filter(Boolean).join('').trim();
      fail('smoke', `${name} failed`);
      console.log(`  ${c.red('FAIL')} ${name}`);
      if (detail) console.log(detail.split('\n').map((l) => `       ${l}`).join('\n'));
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  }
}

// --------------------------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  if (args.includes('-h') || args.includes('--help')) {
    console.log('Usage: node checks/run.mjs [--static] [--smoke] [--only <skill>]');
    process.exit(0);
  }

  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

  const wantStatic = args.includes('--static') || !args.includes('--smoke');
  const wantSmoke = args.includes('--smoke') || !args.includes('--static');

  const tests = listSkillChecks();
  if (tests.length === 0) {
    console.error(c.red('[error] No smoke tests found under checks/skills/.'));
    process.exit(1);
  }
  if (only && !tests.includes(`${only}.sh`)) {
    const names = tests.map((f) => path.basename(f, '.sh')).join(', ');
    console.error(c.red(`[error] No smoke test for: ${only} (have: ${names})`));
    process.exit(1);
  }

  if (wantStatic) runStatic();
  if (wantSmoke) runSmoke(only ? [`${only}.sh`] : tests);

  console.log('');
  if (failures.length > 0) {
    console.log(c.red(`${failures.length} problem(s):`));
    for (const f of failures) console.log(c.red(`  - ${f}`));
    process.exit(1);
  }
  console.log(c.green('All checks passed.'));
}

main();

#!/usr/bin/env node
/**
 * checks/run.mjs
 *
 * Self-check for this library. Two parts:
 *
 *   static  - scan packs/ for dangling references, missing hook exec bits, and hygiene problems
 *   smoke   - install each pack into a throwaway git repo and run its verify.sh
 *
 * `checks/` validates the library; `packs/<name>/files/` is the library. Nothing in checks/ and
 * nothing in packs/<name>/verify.sh is ever copied into a target project.
 *
 * Design notes:
 *   - Dependency-free (Node built-ins only).
 *   - The smoke test installs with the same `cp -R` the docs tell users to run, so the documented
 *     command is what gets exercised.
 *   - A pack declares smoke-test prerequisites with a `# depends: <pack>, <pack>` line in its
 *     verify.sh. Packs without a verify.sh are installed and otherwise left alone.
 *   - POSIX shell is required for the smoke tests (as it is for the shipped Git hooks).
 *
 * Usage:
 *   node checks/run.mjs                 # everything
 *   node checks/run.mjs --static        # static checks only
 *   node checks/run.mjs --smoke         # smoke tests only
 *   node checks/run.mjs --only <pack>   # restrict the smoke tests to one pack
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PACKS_DIR = path.join(REPO_ROOT, 'packs');
const SKILLS_DIR = path.join(REPO_ROOT, 'system', 'skills');
const DOCS_DIR = path.join(REPO_ROOT, 'system', 'docs');

const SCRIPT_REF_RE = /\.ai\/scripts\/[a-z0-9-]+\.mjs/g;
const MACHINE_PATH_RE = /(?:\/Users\/|\/home\/[a-z]|\/Volumes\/|[A-Z]:\\\\)/;

const c = {
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const failures = [];
const notes = [];

function fail(check, message) {
  failures.push(`${check}: ${message}`);
}

function note(message) {
  notes.push(message);
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
    return raw.includes('\u0000') ? null : raw;
  } catch {
    return null;
  }
}

function listPacks() {
  return fs
    .readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

// --------------------------------------------------------------------------------------------
// Static checks
// --------------------------------------------------------------------------------------------

function runStatic(packs) {
  console.log(c.bold('\nStatic checks'));

  // Which pack ships which control script, e.g. ".ai/scripts/foo.mjs" -> "project-hub".
  const provider = new Map();
  for (const pack of packs) {
    const filesDir = path.join(PACKS_DIR, pack, 'files');
    for (const abs of walk(filesDir)) {
      const shipped = path.relative(filesDir, abs).split(path.sep).join('/');
      if (shipped.startsWith('.ai/scripts/')) provider.set(shipped, pack);
    }
  }

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

  // Skill assets carry the same hazards as pack files: a dead reference or a hook that lost its
  // exec bit fails silently.
  for (const abs of walk(SKILLS_DIR)) {
    const shipped = path.relative(SKILLS_DIR, abs).split(path.sep).join('/');
    const owner = skillByDir.get(shipped.split('/')[0]);

    if (shipped.includes('/assets/githooks/') && !shipped.endsWith('.mjs')) {
      if (!(fs.statSync(abs).mode & 0o111)) {
        fail('exec-bit', `system/skills/${shipped} is not executable`);
      }
    }
    if (path.basename(abs) === '.DS_Store') {
      fail('hygiene', `system/skills/${shipped} should not be committed`);
    }

    const text = readTextOrNull(abs);
    if (text === null) continue;
    if (MACHINE_PATH_RE.test(text)) {
      fail('hygiene', `system/skills/${shipped} contains a machine-specific absolute path`);
    }
    for (const ref of text.match(SCRIPT_REF_RE) || []) {
      if (!provider.has(ref)) {
        fail('dangling-ref', `system/skills/${shipped} references ${ref}, which no pack ships`);
      }
    }

    // No skill names another skill, anywhere in what it ships. In a description the cost is
    // routing: descriptions are all loaded at once, so a sibling's name in an entry that is not
    // the sibling makes the router match that name in several places. In a body the cost is
    // coupling: a skill that hands off by name pins the pair together, and a rename has to find
    // every mention or the handoff points at nothing. State the action instead ("continue that
    // task") and let the router pick who performs it. Naming yourself is fine, as is pointing at
    // anything that is not a skill.
    for (const other of skillOwner.keys()) {
      if (other !== owner && text.includes(other)) {
        fail('skill-crosslink', `system/skills/${shipped} names the "${other}" skill`);
      }
    }
  }

  for (const pack of packs) {
    const packDir = path.join(PACKS_DIR, pack);
    const filesDir = path.join(packDir, 'files');

    if (!fs.existsSync(filesDir)) {
      fail('layout', `${pack} has no files/ directory`);
      continue;
    }
    if (!fs.existsSync(path.join(packDir, 'PACK.md'))) {
      fail('layout', `${pack} has no PACK.md`);
    }

    const packMd = readTextOrNull(path.join(packDir, 'PACK.md')) || '';

    for (const abs of walk(filesDir)) {
      const shipped = path.relative(filesDir, abs).split(path.sep).join('/');

      // Hooks are ignored by Git unless they carry the exec bit, and Git only warns.
      // cp -R preserves mode, so the bit has to be right here.
      if (shipped.startsWith('.githooks/') && !shipped.endsWith('.mjs')) {
        if (!(fs.statSync(abs).mode & 0o111)) {
          fail('exec-bit', `${pack}: ${shipped} is not executable`);
        }
      }

      if (path.basename(abs) === '.DS_Store') {
        fail('hygiene', `${pack}: ${shipped} should not be committed`);
      }

      const text = readTextOrNull(abs);
      if (text === null) continue;

      if (MACHINE_PATH_RE.test(text)) {
        fail('hygiene', `${pack}: ${shipped} contains a machine-specific absolute path`);
      }

      // Every referenced control script must be shipped by some pack. A reference to a script
      // that no pack provides is the failure mode that survives a source repo being retired.
      for (const ref of text.match(SCRIPT_REF_RE) || []) {
        const owner = provider.get(ref);
        if (!owner) {
          fail('dangling-ref', `${pack}: ${shipped} references ${ref}, which no pack ships`);
        } else if (owner !== pack && !packMd.includes(owner)) {
          fail(
            'undeclared-dep',
            `${pack}: ${shipped} references ${ref} from "${owner}", but PACK.md never mentions "${owner}"`
          );
        }
      }
    }
  }

  if (failures.length === 0) {
    console.log(c.green('  ok') + c.dim(`  layout, exec bits, hygiene, references, ${skillOwner.size} skills`));
  }
}

// --------------------------------------------------------------------------------------------
// Smoke tests
// --------------------------------------------------------------------------------------------

/** Prerequisite packs declared by a `# depends: a, b` line in verify.sh. */
function readDeps(verifyPath) {
  const text = readTextOrNull(verifyPath) || '';
  const m = text.match(/^#\s*depends:\s*(.+)$/m);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

function installPack(pack, targetDir) {
  const filesDir = path.join(PACKS_DIR, pack, 'files');
  // The command the docs tell users to run.
  execFileSync('cp', ['-R', `${filesDir}/.`, targetDir]);
}

function runSmoke(packs) {
  console.log(c.bold('\nSmoke tests'));

  for (const pack of packs) {
    const verifyPath = path.join(PACKS_DIR, pack, 'verify.sh');
    const hasVerify = fs.existsSync(verifyPath);
    const deps = hasVerify ? readDeps(verifyPath) : [];

    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `aux-${pack}-`));
    try {
      execFileSync('git', ['init', '-q'], { cwd: tmp });

      for (const dep of deps) {
        if (!fs.existsSync(path.join(PACKS_DIR, dep, 'files'))) {
          fail('smoke', `${pack}: declared dependency "${dep}" does not exist`);
          throw new Error('missing dependency');
        }
        installPack(dep, tmp);
      }
      installPack(pack, tmp);

      if (!hasVerify) {
        console.log(`  ${c.yellow('skip')} ${pack} ${c.dim('(installs cleanly; no verify.sh)')}`);
        continue;
      }

      const out = execFileSync('sh', [verifyPath], {
        cwd: tmp,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
        // Hooks ship with the skill that owns them, so a pack's smoke test needs the repo root to
        // reach system/skills/<skill>/assets/.
        env: { ...process.env, AUX_ROOT: REPO_ROOT },
      });
      const summary = out.trim().split('\n').filter(Boolean).pop() || '';
      const withDeps = deps.length ? c.dim(` +${deps.join(',')}`) : '';
      console.log(`  ${c.green('ok')}   ${pack}${withDeps} ${c.dim(summary)}`);
    } catch (e) {
      const detail = [e.stdout, e.stderr].filter(Boolean).join('').trim();
      fail('smoke', `${pack} failed`);
      console.log(`  ${c.red('FAIL')} ${pack}`);
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
    console.log('Usage: node checks/run.mjs [--static] [--smoke] [--only <pack>]');
    process.exit(0);
  }

  const onlyIdx = args.indexOf('--only');
  const only = onlyIdx !== -1 ? args[onlyIdx + 1] : null;

  const wantStatic = args.includes('--static') || !args.includes('--smoke');
  const wantSmoke = args.includes('--smoke') || !args.includes('--static');

  const all = listPacks();
  if (all.length === 0) {
    console.error(c.red('[error] No packs found under packs/.'));
    process.exit(1);
  }
  if (only && !all.includes(only)) {
    console.error(c.red(`[error] Unknown pack: ${only} (have: ${all.join(', ')})`));
    process.exit(1);
  }

  if (wantStatic) runStatic(all);
  if (wantSmoke) runSmoke(only ? [only] : all);

  for (const n of notes) console.log(c.yellow(`  note  ${n}`));

  console.log('');
  if (failures.length > 0) {
    console.log(c.red(`${failures.length} problem(s):`));
    for (const f of failures) console.log(c.red(`  - ${f}`));
    process.exit(1);
  }
  console.log(c.green('All checks passed.'));
}

main();

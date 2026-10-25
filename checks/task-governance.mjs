/**
 * Behavioral checks for the task-governance resource across linked worktrees:
 * - archiving a task while another worktree still holds its older active copy. The archive move
 *   must be provably newer before it is committed (the pre-commit hook syncs first), and a copy
 *   edited on both sides must still fail closed.
 * - changing a Milestone or Feature while other worktrees still hold the older row. A row the
 *   other worktree never touched is stale; an uncommitted or committed edit of it there conflicts.
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RESOURCE = path.join(REPO_ROOT, 'system', 'resources', 'task-governance');
const TEMPLATES = path.join(RESOURCE, 'project', 'dev-docs', 'templates');
const BUNDLE_FILES = ['00-roadmap.md', '01-status.md', '02-architecture.md', 'verification.md'];

function run(cwd, command, args) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) throw result.error;
  return result;
}

function must(cwd, command, args) {
  const result = run(cwd, command, args);
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed: ${result.stderr || result.stdout}`);
  }
  return result.stdout;
}

function check(failures, condition, message) {
  if (!condition) failures.push(message);
}

export function taskGovernanceArchiveFailures() {
  const failures = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-governance-check-'));
  const repo = path.join(tempDir, 'repo');
  const other = path.join(tempDir, 'other');
  const governance = (cwd, ...args) => run(cwd, 'node', ['.ai/scripts/ctl-project-governance.mjs', ...args]);

  try {
    initRepo(repo);
    const active = path.join(repo, 'dev-docs', 'active', 'demo');
    fs.mkdirSync(active);
    for (const file of BUNDLE_FILES) fs.copyFileSync(path.join(TEMPLATES, file), path.join(active, file));
    must(repo, 'node', ['.ai/scripts/ctl-project-governance.mjs', 'sync', '--apply']);
    must(repo, 'git', ['add', '-A']);
    must(repo, 'git', ['commit', '-q', '-m', 'open demo']);
    must(repo, 'git', ['worktree', 'add', '-q', '--detach', other, 'HEAD']);

    // Archive in the main worktree without committing, as the archive workflow does.
    const archived = path.join(repo, 'dev-docs', 'archive', 'demo');
    fs.renameSync(active, archived);
    for (const file of BUNDLE_FILES) fs.rmSync(path.join(archived, file));
    fs.writeFileSync(path.join(archived, 'summary.md'), '# demo summary\n');

    const sync = governance(repo, 'sync', '--dry-run');
    check(failures, sync.status === 0, `an uncommitted archive move must sync over an older copy: ${sync.stdout}${sync.stderr}`);
    const query = governance(repo, 'query', '--id', 'T-001', '--json');
    const row = query.status === 0 ? JSON.parse(query.stdout)[0] : null;
    check(failures, row?.status === 'archived', 'the archived copy must lead the task row');
    check(
      failures,
      row?.stale_worktrees?.some((entry) => fs.realpathSync(entry.worktree_path) === fs.realpathSync(other)),
      'the older active copy must be reported stale'
    );

    // Edits on both sides are concurrent divergence, archive or not.
    fs.appendFileSync(path.join(other, 'dev-docs', 'active', 'demo', '01-status.md'), '\nEdited elsewhere.\n');
    const concurrent = governance(repo, 'sync', '--dry-run');
    check(failures, concurrent.status !== 0, 'an archive move over a copy edited elsewhere must fail closed');
  } catch (error) {
    failures.push(`task-governance archive scenario could not run: ${error.message}`);
  } finally {
    run(repo, 'git', ['worktree', 'remove', '--force', other]);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return failures;
}

function initRepo(repo) {
  fs.mkdirSync(repo);
  must(repo, 'git', ['init', '-q', '-b', 'main']);
  must(repo, 'git', ['config', 'user.email', 'check@example.invalid']);
  must(repo, 'git', ['config', 'user.name', 'check']);
  must(repo, 'git', ['commit', '-q', '--allow-empty', '-m', 'init']);
  must(repo, 'node', [path.join(RESOURCE, 'install.mjs'), '--repo-root', repo]);
}

function editRegistry(worktree, edit) {
  const file = path.join(worktree, '.ai', 'project', 'registry.json');
  const registry = JSON.parse(fs.readFileSync(file, 'utf8'));
  edit(registry);
  fs.writeFileSync(file, `${JSON.stringify(registry, null, 2)}\n`);
}

export function taskGovernanceProjectFailures() {
  const failures = [];
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'task-governance-project-check-'));
  const repo = path.join(tempDir, 'repo');
  const behind = path.join(tempDir, 'behind');
  const side = path.join(tempDir, 'side');
  const sync = (cwd) => run(cwd, 'node', ['.ai/scripts/ctl-project-governance.mjs', 'sync', '--dry-run']);
  const rows = [
    { kind: 'milestones', label: 'Milestone', id: 'M-000' },
    { kind: 'features', label: 'Feature', id: 'F-000' },
  ];

  try {
    initRepo(repo);
    must(repo, 'node', ['.ai/scripts/ctl-project-governance.mjs', 'sync', '--apply']);
    must(repo, 'git', ['add', '-A']);
    must(repo, 'git', ['commit', '-q', '-m', 'install governance']);
    must(repo, 'git', ['worktree', 'add', '-q', '--detach', behind, 'HEAD']);
    must(repo, 'git', ['worktree', 'add', '-q', '-b', 'side', side, 'HEAD']);

    // The side branch commits an unrelated registry edit; its M-000 / F-000 rows stay untouched.
    editRegistry(side, (registry) => {
      registry.milestones.push({ id: 'M-001', title: 'Side', status: 'planned', description: 'Side work.' });
    });
    must(side, 'git', ['commit', '-q', '-am', 'side milestone']);

    editRegistry(repo, (registry) => {
      for (const { kind, id } of rows) registry[kind].find((row) => row.id === id).status = 'done';
    });
    must(repo, 'node', ['.ai/scripts/ctl-project-governance.mjs', 'sync', '--apply']);
    must(repo, 'git', ['commit', '-q', '-am', 'finish inbox']);

    const ahead = sync(repo);
    check(failures, ahead.status === 0, `rows untouched elsewhere must be stale, not conflicts: ${ahead.stdout}${ahead.stderr}`);
    const behindSync = sync(behind);
    check(failures, behindSync.status === 0, `a worktree behind the newest row must not conflict: ${behindSync.stdout}${behindSync.stderr}`);
    const query = run(repo, 'node', ['.ai/scripts/ctl-project-governance.mjs', 'project-query', '--json']);
    const graph = query.status === 0 ? JSON.parse(query.stdout) : null;
    for (const { label, id } of rows) {
      const row = [...(graph?.milestones || []), ...(graph?.features || [])].find((item) => item.id === id);
      check(failures, row?.status === 'done', `${label} ${id} must take the newest value`);
      check(failures, row?.stale_worktrees?.length === 2, `${label} ${id} must report both older copies stale`);
    }

    for (const { kind, label, id } of rows) {
      const conflicted = (result) =>
        result.status !== 0 && `${result.stdout}${result.stderr}`.includes(`${label} ID ${id} has different`);
      const retitle = (registry) => {
        registry[kind].find((row) => row.id === id).title = 'Edited elsewhere';
      };

      editRegistry(behind, retitle);
      check(failures, conflicted(sync(repo)), `an uncommitted ${label} edit in a worktree behind must conflict`);
      must(behind, 'git', ['checkout', '--', '.ai/project/registry.json']);

      editRegistry(side, retitle);
      must(side, 'git', ['commit', '-q', '-am', `retitle ${id}`]);
      check(failures, conflicted(sync(repo)), `a committed ${label} edit on another branch must conflict`);
      must(side, 'git', ['reset', '-q', '--hard', 'HEAD~1']);
    }
  } catch (error) {
    failures.push(`task-governance project scenario could not run: ${error.message}`);
  } finally {
    for (const worktree of [behind, side]) run(repo, 'git', ['worktree', 'remove', '--force', worktree]);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  return failures;
}

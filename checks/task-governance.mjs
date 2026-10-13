/**
 * Behavioral check for the task-governance resource: archiving a task while another worktree
 * still holds its older active copy. The archive move must be provably newer before it is
 * committed (the pre-commit hook syncs first), and a copy edited on both sides must still
 * fail closed.
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
    fs.mkdirSync(repo);
    must(repo, 'git', ['init', '-q', '-b', 'main']);
    must(repo, 'git', ['config', 'user.email', 'check@example.invalid']);
    must(repo, 'git', ['config', 'user.name', 'check']);
    must(repo, 'git', ['commit', '-q', '--allow-empty', '-m', 'init']);
    must(repo, 'node', [path.join(RESOURCE, 'install.mjs'), '--repo-root', repo]);
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

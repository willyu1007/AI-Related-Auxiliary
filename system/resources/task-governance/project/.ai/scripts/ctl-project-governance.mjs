#!/usr/bin/env node
/**
 * ctl-project-governance.mjs
 *
 * Project governance control tool.
 *
 * @reference .ai/project/AGENTS.md
 *
 * Design notes:
 * - Dependency-free (Node built-ins only).
 * - Ships in the shared task-governance resource and is installed into the target repository.
 * - Task progress SoT remains in the dev-docs task bundle (`01-status.md`).
 * - Task bundles follow the semantics in `dev-docs/AGENTS.md`.
 * - Task identity SoT is anchored by `.ai-task.json` (`task_id`).
 */

import path from 'node:path';

import { cmdLint } from './lib/governance-lint.mjs';
import { cmdProjectQuery } from './lib/governance-project-read.mjs';
import {
  RESUME_DEFAULT_COMMIT_LIMIT,
  RESUME_DEFAULT_SCAN_LIMIT,
  RESUME_MAX_COMMIT_LIMIT,
  RESUME_MAX_SCAN_LIMIT,
  TASK_ID_RE,
  TASK_STATUS,
  canonicalPath,
  cmdQuery,
  cmdResume,
  findRepoRoot,
} from './lib/governance-read.mjs';
import {
  cmdFeature,
  cmdMap,
  cmdMilestone,
  cmdSync,
  withGovernanceWriteLock,
} from './lib/governance-write.mjs';

function die(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

function usage(exitCode = 0) {
  const msg = `
Usage:
  node .ai/scripts/ctl-project-governance.mjs <command> [options]

Commands:
  lint
    --repo-root <path>        Repo root (default: auto-detect from cwd)
    --task <T-###>            Validate one task bundle and its registry projection
    --strict                  Treat warnings as errors
    Exit non-zero on errors; warnings fail only in strict mode.
    Validate repository state against the project governance rules. With --task, task-bundle
    checks are scoped to that ID while the project graph and generated views remain global.

  sync
    --repo-root <path>        Repo root (default: auto-detect from cwd)
    --task <T-###>            Project only this existing task bundle
    --dry-run                 Print planned changes without writing
    --apply                   Apply changes (writes files)
    --prune                   Also remove registry task entries whose bundle no longer exists
                              in any linked worktree or at any local branch tip (verified by
                              stable task ID; unverifiable evidence refuses the prune)
    Without --task, generate missing task IDs and project this worktree's bundles into its registry.
    With --task, update only that existing task projection; scoped sync does not allocate IDs or
    prune. Both modes regenerate derived views. Provably linear cross-worktree divergence does not
    block global sync; scoped sync refuses to checkpoint a stale occurrence. Concurrent or
    unprovable divergence blocks both modes.

  query
    --repo-root <path>        Repo root (default: auto-detect from cwd)
    --id <T-###>              Filter by a specific task id
    --status <status>         Filter by status (planned|in-progress|blocked|done|archived)
    --text <substring>        Substring match against common task fields
    --json                    Output a single JSON array instead of JSON lines
    Locate tasks across every linked worktree for dedupe/triage (LLM-friendly output).

  project-query
    --repo-root <path>        Repo root (default: auto-detect from cwd)
    --json                    Output one object containing Milestones, Features, and diagnostics
    Locate the project graph across every linked worktree. Same-ID semantic conflicts preserve
    their exact values and worktree occurrences and exit non-zero.

  resume
    --repo-root <path>        Repo root (default: auto-detect from cwd)
    --task <T-###>            Task ID (default: branch task, then the active task)
    --limit <n>               Recent linked commits (default: ${RESUME_DEFAULT_COMMIT_LIMIT}; max: ${RESUME_MAX_COMMIT_LIMIT})
    --scan <n>                History scan limit (default: ${RESUME_DEFAULT_SCAN_LIMIT}; max: ${RESUME_MAX_SCAN_LIMIT})
    Output one bounded JSON context packet from dev-docs, linked commits, and the worktree.
    Resolution order: --task, branch T-###, single in-progress, then single blocked task.
    Exit codes: 0 resolved, 1 unreadable evidence, 2 ambiguous/conflicted/invalid,
                3 no such task, 4 newest state is in another linked worktree.

  map
    --repo-root <path>        Repo root (default: auto-detect from cwd)
    --task <T-###>            Task ID to map (required)
    --feature <F-###>         Existing Feature ID to map the task to (required)
    --dry-run                 Show what would change without writing
    --apply                   Apply the mapping change
    Map a task to a Feature. Its Milestone is derived from that Feature.

  milestone
    --repo-root <path>        Repo root (default: auto-detect from cwd)
    --title <text>            Exact Milestone title to find or create (required)
    --description <text>      Outcome used only when creating a Milestone
    --dry-run                 Show what would change without writing
    --apply                   Ensure the Milestone exists in the current registry
    --json                    Output the resolved Milestone as JSON
    Resolve an existing Milestone by title or allocate one across linked worktrees.

  feature
    --repo-root <path>        Repo root (default: auto-detect from cwd)
    --title <text>            Exact Feature title to find or create (required)
    --description <text>      Description used only when creating a Feature
    --dry-run                 Show what would change without writing
    --apply                   Ensure the Feature exists in the current registry
    --json                    Output the resolved Feature as JSON
    Resolve an existing Feature by title or allocate one across linked worktrees.

Examples:
  node .ai/scripts/ctl-project-governance.mjs lint
  node .ai/scripts/ctl-project-governance.mjs lint --task T-001
  node .ai/scripts/ctl-project-governance.mjs sync --dry-run
  node .ai/scripts/ctl-project-governance.mjs sync --task T-001 --dry-run
  node .ai/scripts/ctl-project-governance.mjs sync --apply
  node .ai/scripts/ctl-project-governance.mjs milestone --title "Public beta" --apply --json
  node .ai/scripts/ctl-project-governance.mjs feature --title "OAuth providers" --apply --json
  node .ai/scripts/ctl-project-governance.mjs project-query --json
  node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-002 --apply
  node .ai/scripts/ctl-project-governance.mjs resume
`.trim();

  console.log(msg);
  process.exit(exitCode);
}

const COMMAND_OPTIONS = Object.freeze({
  lint: { values: ['repo-root', 'task'], flags: ['strict'] },
  sync: {
    values: ['repo-root', 'task'],
    flags: ['dry-run', 'apply', 'prune'],
    conflicts: [['dry-run', 'apply']],
  },
  query: { values: ['repo-root', 'id', 'status', 'text'], flags: ['json'] },
  'project-query': { values: ['repo-root'], flags: ['json'] },
  resume: { values: ['repo-root', 'task', 'limit', 'scan'], flags: [] },
  map: {
    values: ['repo-root', 'task', 'feature'],
    flags: ['dry-run', 'apply'],
    conflicts: [['dry-run', 'apply']],
  },
  milestone: {
    values: ['repo-root', 'title', 'description'],
    flags: ['dry-run', 'apply', 'json'],
    conflicts: [['dry-run', 'apply']],
  },
  feature: {
    values: ['repo-root', 'title', 'description'],
    flags: ['dry-run', 'apply', 'json'],
    conflicts: [['dry-run', 'apply']],
  },
});

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') usage(0);

  const command = args.shift();
  const spec = COMMAND_OPTIONS[command];
  if (!spec) {
    console.error(`[error] Unknown command: ${command}`);
    usage(1);
  }

  const valueOptions = new Set(spec.values || []);
  const flagOptions = new Set(spec.flags || []);
  const opts = {};

  while (args.length > 0) {
    const token = args.shift();
    if (token === '-h' || token === '--help') usage(0);
    if (!token.startsWith('--')) {
      die(`[error] Unexpected positional argument for ${command}: "${token}".`);
    }

    const key = token.slice(2);
    if (!valueOptions.has(key) && !flagOptions.has(key)) {
      die(`[error] Unknown option for ${command}: --${key}.`);
    }
    if (Object.hasOwn(opts, key)) {
      die(`[error] Option --${key} was provided more than once.`);
    }

    if (flagOptions.has(key)) {
      opts[key] = true;
      continue;
    }
    if (args.length === 0 || args[0].startsWith('--')) {
      die(`[error] Option --${key} requires a value.`);
    }
    opts[key] = args.shift();
  }

  for (const [left, right] of spec.conflicts || []) {
    if (opts[left] && opts[right]) {
      die(`[error] Options --${left} and --${right} cannot be used together.`);
    }
  }

  return { command, opts };
}

function parseBoundedPositiveInt(value, fallback, maximum, optionName) {
  if (value === undefined) return { value: fallback, clamped: false };
  const raw = String(value).trim();
  if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
    die(`[error] Option --${optionName} requires a positive integer (got "${raw}").`);
  }
  const requested = Number(raw);
  return {
    value: Math.min(requested, maximum),
    clamped: requested > maximum,
  };
}

function main() {
  const { command, opts } = parseArgs(process.argv);
  const repoRoot = opts['repo-root']
    ? canonicalPath(path.resolve(opts['repo-root']))
    : findRepoRoot(process.cwd());
  if (!repoRoot) {
    die('[error] Cannot find installed task governance from cwd; pass --repo-root explicitly.');
  }

  switch (command) {
    case 'lint': {
      const strict = !!opts.strict;
      const taskId = opts.task ? String(opts.task) : null;
      if (taskId && !TASK_ID_RE.test(taskId)) {
        die(`[error] Option --task requires a task ID in T-### format (got "${taskId}").`);
      }
      const { ok: okLint } = cmdLint({ repoRoot, strict, taskId });
      process.exit(okLint ? 0 : 1);
      break;
    }
    case 'sync': {
      const dryRun = !!opts['dry-run'];
      const apply = !!opts.apply;
      const taskId = opts.task ? String(opts.task) : null;
      if (taskId && !TASK_ID_RE.test(taskId)) {
        die(`[error] Option --task requires a task ID in T-### format (got "${taskId}").`);
      }
      if (taskId && opts.prune) {
        die('[error] Options --task and --prune cannot be used together.');
      }
      if (!dryRun && !apply) {
        console.log('No mode specified; defaulting to --dry-run.');
      }
      let res;
      try {
        const runSync = () =>
          cmdSync({
            repoRoot,
            dryRun: dryRun || !apply,
            apply: apply && !dryRun,
            prune: !!opts.prune,
            taskId,
          });
        res = apply && !dryRun ? withGovernanceWriteLock(repoRoot, runSync) : runSync();
      } catch (error) {
        console.error(`[error] Sync aborted: ${error?.message || String(error)}`);
        process.exit(1);
      }
      process.exit(res.ok ? 0 : 1);
      break;
    }
    case 'query': {
      const id = opts.id ? String(opts.id).trim() : '';
      const status = opts.status ? String(opts.status).trim() : '';
      const text = opts.text ? String(opts.text) : '';
      const json = !!opts.json;
      if (id && !TASK_ID_RE.test(id)) {
        die(`[error] Invalid --id (expected T-###, got "${id}").`);
      }
      if (status && !TASK_STATUS.has(status)) {
        die(`[error] Invalid --status "${status}". Allowed: ${[...TASK_STATUS].join(', ')}.`);
      }
      const res = cmdQuery({
        repoRoot,
        id: id || null,
        status: status || null,
        text: text || null,
        json,
      });
      process.exit(res.ok ? 0 : 1);
      break;
    }
    case 'project-query': {
      const res = cmdProjectQuery({ repoRoot, json: !!opts.json });
      process.exit(res.ok ? 0 : 1);
      break;
    }
    case 'resume': {
      const taskId = opts.task ? String(opts.task).trim() : '';
      const limit = parseBoundedPositiveInt(
        opts.limit,
        RESUME_DEFAULT_COMMIT_LIMIT,
        RESUME_MAX_COMMIT_LIMIT,
        'limit'
      );
      const scan = parseBoundedPositiveInt(
        opts.scan,
        RESUME_DEFAULT_SCAN_LIMIT,
        RESUME_MAX_SCAN_LIMIT,
        'scan'
      );
      const res = cmdResume({
        repoRoot,
        taskId: taskId || null,
        limit: limit.value,
        scan: scan.value,
        limitClamped: limit.clamped,
        scanClamped: scan.clamped,
      });
      process.exit(res.exitCode);
      break;
    }
    case 'map': {
      const taskId = opts.task ? String(opts.task).trim() : '';
      const featureId = opts.feature ? String(opts.feature).trim() : '';
      const dryRun = !!opts['dry-run'];
      const apply = !!opts.apply;
      if (!dryRun && !apply) {
        console.log('No mode specified; defaulting to --dry-run.');
      }
      let res;
      try {
        const runMap = () =>
          cmdMap({
            repoRoot,
            taskId,
            featureId: featureId || null,
            dryRun: dryRun || !apply,
            apply: apply && !dryRun,
          });
        res = apply && !dryRun ? withGovernanceWriteLock(repoRoot, runMap) : runMap();
      } catch (error) {
        console.error(`[error] Mapping aborted: ${error?.message || String(error)}`);
        process.exit(1);
      }
      if (!res.ok) {
        console.log('Errors:');
        for (const e of res.errors) console.log(`- ${e}`);
      }
      process.exit(res.ok ? 0 : 1);
      break;
    }
    case 'milestone': {
      const title = opts.title ? String(opts.title) : '';
      const description = opts.description ? String(opts.description) : '';
      const dryRun = !!opts['dry-run'];
      const apply = !!opts.apply;
      if (!dryRun && !apply) console.log('No mode specified; defaulting to --dry-run.');

      let res;
      try {
        const runMilestone = () =>
          cmdMilestone({
            repoRoot,
            title,
            description,
            dryRun: dryRun || !apply,
            apply: apply && !dryRun,
            json: !!opts.json,
          });
        res = apply && !dryRun ? withGovernanceWriteLock(repoRoot, runMilestone) : runMilestone();
      } catch (error) {
        console.error(`[error] Milestone resolution aborted: ${error?.message || String(error)}`);
        process.exit(1);
      }

      if (!res.ok) {
        console.log('Errors:');
        for (const error of res.errors) console.log(`- ${error}`);
      }
      process.exit(res.ok ? 0 : 1);
      break;
    }
    case 'feature': {
      const title = opts.title ? String(opts.title) : '';
      const description = opts.description ? String(opts.description) : '';
      const dryRun = !!opts['dry-run'];
      const apply = !!opts.apply;
      if (!dryRun && !apply) console.log('No mode specified; defaulting to --dry-run.');

      let res;
      try {
        const runFeature = () =>
          cmdFeature({
            repoRoot,
            title,
            description,
            dryRun: dryRun || !apply,
            apply: apply && !dryRun,
            json: !!opts.json,
          });
        res = apply && !dryRun ? withGovernanceWriteLock(repoRoot, runFeature) : runFeature();
      } catch (error) {
        console.error(`[error] Feature resolution aborted: ${error?.message || String(error)}`);
        process.exit(1);
      }

      if (!res.ok) {
        console.log('Errors:');
        for (const error of res.errors) console.log(`- ${error}`);
      }
      process.exit(res.ok ? 0 : 1);
      break;
    }
    default:
      console.error(`[error] Unknown command: ${command}`);
      usage(1);
  }
}

try {
  main();
} catch (error) {
  console.error(`[error] Governance command aborted: ${error?.message || String(error)}`);
  process.exit(1);
}

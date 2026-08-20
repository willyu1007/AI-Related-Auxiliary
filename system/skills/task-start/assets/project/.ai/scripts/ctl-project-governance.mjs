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
 * - Ships inside the skill that provisions the hub and installs itself into the target repository,
 *   because the Git hooks call it by repository path and cannot reach the skill's own location.
 * - Task progress SoT remains in the dev-docs task bundle (`01-status.md`).
 * - Task bundles follow the semantics in `dev-docs/README.md`.
 * - Task identity SoT is anchored by `.ai-task.json` (`task_id`).
 */

import path from 'node:path';

import { cmdLint } from './lib/governance-lint.mjs';
import {
  RESUME_DEFAULT_COMMIT_LIMIT,
  RESUME_DEFAULT_SCAN_LIMIT,
  RESUME_MAX_COMMIT_LIMIT,
  RESUME_MAX_SCAN_LIMIT,
  TASK_ID_RE,
  TASK_STATUS,
  cmdQuery,
  cmdResume,
  cmdTaskExists,
  findRepoRoot,
} from './lib/governance-read.mjs';
import {
  cmdFeature,
  cmdMap,
  cmdRequirement,
  cmdSync,
  withGovernanceWriteLock,
} from './lib/governance-write.mjs';


function die(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

const info = (message) => console.log(message);
const header = (message) => console.log(message);

function usage(exitCode = 0) {
  const msg = `
Usage:
  node .ai/scripts/ctl-project-governance.mjs <command> [options]

Commands:
  lint
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --strict                  Treat warnings as errors
    Exit non-zero on errors; warnings fail only in strict mode.
    Validate repository state against the project governance rules.

  sync
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --dry-run                 Print planned changes without writing
    --apply                   Apply changes (writes files)
    Generate missing task meta IDs, upsert registry tasks, and regenerate derived views.

  query
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --id <T-###>              Filter by a specific task id
    --status <status>         Filter by status (planned|in-progress|blocked|done|archived)
    --text <substring>        Substring match against common task fields
    --json                    Output a single JSON array instead of JSON lines
    Locate tasks across every linked worktree for dedupe/triage (LLM-friendly output).

  task-exists
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --task <T-###>            Task ID to validate (required)
    Verify that a task ID is anchored by a task bundle; print the ID when found.
    Exit codes: 0 found, 4 invalid or not found.

  resume
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --task <T-###>            Task ID (default: branch task, then the active task)
    --limit <n>               Recent linked commits (default: ${RESUME_DEFAULT_COMMIT_LIMIT}; max: ${RESUME_MAX_COMMIT_LIMIT})
    --scan <n>                History scan limit (default: ${RESUME_DEFAULT_SCAN_LIMIT}; max: ${RESUME_MAX_SCAN_LIMIT})
    Output one bounded JSON context packet from dev-docs, linked commits, and the worktree.
    Resolution order: --task, branch T-###, single in-progress, then single blocked task.
    Exit codes: 0 resolved, 2 ambiguous, 3 none, 4 not found.

  map
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --task <T-###>            Task ID to map (required)
    --feature <F-###>         Feature ID to map the task to
    --requirement <R-###>     Existing Requirement ID to map the task to
    --dry-run                 Show what would change without writing
    --apply                   Apply the mapping change
    Map a task to a Feature or Requirement. Its Milestone is derived from the Feature.

  feature
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --title <text>            Exact feature title to find or create (required)
    --description <text>      Description used only when creating a feature
    --dry-run                 Show what would change without writing
    --apply                   Ensure the feature exists in the current registry
    --json                    Output the resolved feature as JSON
    Resolve an existing feature by title or allocate one across linked worktrees.

  requirement
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --title <text>            Exact requirement title to find or create (required)
    --feature <F-###>         Existing parent Feature ID (required)
    --description <text>      Description used only when creating a requirement
    --dry-run                 Show what would change without writing
    --apply                   Ensure the requirement exists in the current registry
    --json                    Output the resolved requirement as JSON
    Resolve an existing requirement by Feature/title or allocate one across linked worktrees.

Examples:
  node .ai/scripts/ctl-project-governance.mjs lint
  node .ai/scripts/ctl-project-governance.mjs sync --dry-run
  node .ai/scripts/ctl-project-governance.mjs sync --apply
  node .ai/scripts/ctl-project-governance.mjs feature --title "OAuth providers" --apply --json
  node .ai/scripts/ctl-project-governance.mjs requirement --title "Google sign-in" --feature F-002 --apply --json
  node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-002 --apply
  node .ai/scripts/ctl-project-governance.mjs resume
`.trim();

  console.log(msg);
  process.exit(exitCode);
}

const COMMAND_OPTIONS = Object.freeze({
  lint: { values: ['repo-root'], flags: ['strict'] },
  sync: { values: ['repo-root'], flags: ['dry-run', 'apply'], conflicts: [['dry-run', 'apply']] },
  query: { values: ['repo-root', 'id', 'status', 'text'], flags: ['json'] },
  'task-exists': { values: ['repo-root', 'task'], flags: [] },
  resume: { values: ['repo-root', 'task', 'limit', 'scan'], flags: [] },
  map: {
    values: ['repo-root', 'task', 'feature', 'requirement'],
    flags: ['dry-run', 'apply'],
    conflicts: [['dry-run', 'apply']],
  },
  feature: {
    values: ['repo-root', 'title', 'description'],
    flags: ['dry-run', 'apply', 'json'],
    conflicts: [['dry-run', 'apply']],
  },
  requirement: {
    values: ['repo-root', 'title', 'feature', 'description'],
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
  const repoRoot =
    opts['repo-root'] ? path.resolve(opts['repo-root']) : findRepoRoot(process.cwd()) || path.resolve(process.cwd());

  switch (command) {
    case 'lint': {
      const strict = !!opts.strict;
      const { ok: okLint } = cmdLint({ repoRoot, strict });
      process.exit(okLint ? 0 : 1);
      break;
    }
    case 'sync': {
      const dryRun = !!opts['dry-run'];
      const apply = !!opts.apply;
      if (!dryRun && !apply) {
        info('No mode specified; defaulting to --dry-run.');
      }
      let res;
      try {
        const runSync = () =>
          cmdSync({
            repoRoot,
            dryRun: dryRun || !apply,
            apply: apply && !dryRun,
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
    case 'task-exists': {
      const taskId = opts.task ? String(opts.task).trim() : '';
      const res = cmdTaskExists({ repoRoot, taskId });
      process.exit(res.exitCode);
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
      const requirementId = opts.requirement ? String(opts.requirement).trim() : '';
      const dryRun = !!opts['dry-run'];
      const apply = !!opts.apply;
      if (!dryRun && !apply) {
        info('No mode specified; defaulting to --dry-run.');
      }
      let res;
      try {
        const runMap = () =>
          cmdMap({
            repoRoot,
            taskId,
            featureId: featureId || null,
            requirementId: requirementId || null,
            dryRun: dryRun || !apply,
            apply: apply && !dryRun,
          });
        res = apply && !dryRun ? withGovernanceWriteLock(repoRoot, runMap) : runMap();
      } catch (error) {
        console.error(`[error] Mapping aborted: ${error?.message || String(error)}`);
        process.exit(1);
      }
      if (!res.ok) {
        header('Errors:');
        for (const e of res.errors) console.log(`- ${e}`);
      }
      process.exit(res.ok ? 0 : 1);
      break;
    }
    case 'requirement': {
      const title = opts.title ? String(opts.title) : '';
      const featureId = opts.feature ? String(opts.feature).trim() : '';
      const description = opts.description ? String(opts.description) : '';
      const dryRun = !!opts['dry-run'];
      const apply = !!opts.apply;
      if (!dryRun && !apply) info('No mode specified; defaulting to --dry-run.');

      let res;
      try {
        const runRequirement = () =>
          cmdRequirement({
            repoRoot,
            title,
            featureId,
            description,
            dryRun: dryRun || !apply,
            apply: apply && !dryRun,
            json: !!opts.json,
          });
        res = apply && !dryRun ? withGovernanceWriteLock(repoRoot, runRequirement) : runRequirement();
      } catch (error) {
        console.error(
          `[error] Requirement resolution aborted: ${error?.message || String(error)}`
        );
        process.exit(1);
      }

      if (!res.ok) {
        header('Errors:');
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
      if (!dryRun && !apply) info('No mode specified; defaulting to --dry-run.');

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
        header('Errors:');
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

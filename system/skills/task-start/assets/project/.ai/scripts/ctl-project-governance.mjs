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

import fs from 'node:fs';
import path from 'node:path';

import {
  DATE_RE,
  FEATURE_ID_RE,
  FEATURE_STATUS,
  MILESTONE_ID_RE,
  MILESTONE_STATUS,
  REQUIREMENT_ID_RE,
  REQUIREMENT_STATUS,
  RESUME_DEFAULT_COMMIT_LIMIT,
  RESUME_DEFAULT_SCAN_LIMIT,
  RESUME_MAX_COMMIT_LIMIT,
  RESUME_MAX_SCAN_LIMIT,
  TASK_ID_RE,
  TASK_STATUS,
  cleanMarkdownValue,
  cmdQuery,
  cmdResume,
  cmdTaskExists,
  discoverDevDocsRoots,
  exists,
  findRepoRoot,
  formatTaskRef,
  getBundleStatusFromStatusDoc,
  getCompletionCriteriaStats,
  getHubDir,
  getMarkdownSectionLines,
  getRegistryPath,
  getRoadmapKickoff,
  listGitWorktrees,
  loadRegistry,
  normalizeEol,
  parseTaskMeta,
  readText,
  resolveConfiguredRoots,
  runGit,
  scanTasks,
  statusRank,
  taskIdsFromAllBranches,
  taskIdsFromAllWorktrees,
  toPosix,
} from './lib/governance-read.mjs';


function die(message, exitCode = 1) {
  console.error(message);
  process.exit(exitCode);
}

const warn = (message) => console.warn(message);
const ok = (message) => console.log(message);
const info = (message) => console.log(message);
const header = (message) => console.log(message);

// Template substitution variables
function today() {
  // Always use YYYY-MM-DD in local time.
  const d = new Date();
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function usage(exitCode = 0) {
  const msg = `
Usage:
  node .ai/scripts/ctl-project-governance.mjs <command> [options]

Commands:
  lint
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --check                   (default) Exit non-zero only on errors (warnings do not fail)
    --strict                  Treat warnings as errors
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
  node .ai/scripts/ctl-project-governance.mjs lint --check
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
  lint: { values: ['repo-root'], flags: ['check', 'strict'], conflicts: [['check', 'strict']] },
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

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeText(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function writeTextIfChanged(filePath, content) {
  const prev = readText(filePath);
  if (prev !== null && normalizeEol(prev) === normalizeEol(content)) return false;
  writeText(filePath, content);
  return true;
}

function replaceAutoBlock(raw, blockId, content, filePath, allowFullReplace = true) {
  const start = `<!-- AUTO-GENERATED:START ${blockId} -->`;
  const end = `<!-- AUTO-GENERATED:END ${blockId} -->`;
  const sIdx = raw.indexOf(start);
  const eIdx = raw.indexOf(end);
  if (sIdx === -1 || eIdx === -1 || eIdx < sIdx) {
    const label = filePath ? toPosix(filePath) : '(unknown file)';
    if (!allowFullReplace) {
      // Existing file with missing markers: refuse to overwrite to prevent data loss.
      warn(`[warning] Missing AUTO-GENERATED markers for "${blockId}" in ${label}; skipping update to preserve manual content. Restore the markers before retrying sync.`);
      return null;
    }
    // Safe fallback for freshly created templates.
    warn(`[warning] Missing AUTO-GENERATED markers for "${blockId}" in ${label}; replacing entire file content.`);
    return content.endsWith('\n') ? content : `${content}\n`;
  }

  const before = raw.slice(0, sIdx + start.length);
  const after = raw.slice(eIdx);

  const mid = `\n${content.trimEnd()}\n`;
  return `${before}${mid}${after}`.replace(/\r\n/g, '\n');
}

function renderJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function validateRoadmap(roadmapRaw) {
  const raw = normalizeEol(roadmapRaw);
  const errors = [];
  const requiredHeadings = [
    'scope and constraints',
    'decision alignment',
    'task relationships',
    'implementation plan',
    'kickoff gate',
    'risks and recovery',
    'phase closeout',
  ];
  const headings = new Set();

  for (const line of raw.split('\n')) {
    const match = line.trim().match(/^##\s+(.+?)\s*$/);
    if (match) headings.add(String(match[1] || '').trim().toLowerCase());
  }

  const missingHeadings = requiredHeadings.filter((heading) => !headings.has(heading));
  if (missingHeadings.length > 0) {
    errors.push(`Roadmap is missing required sections: ${missingHeadings.join(', ')}.`);
  }

  if (/<!--[\s\S]*?-->/.test(raw)) {
    errors.push('Roadmap contains unfilled template placeholder comments.');
  }

  const kickoff = getRoadmapKickoff(raw);
  if (!kickoff.status) {
    errors.push('Kickoff gate must contain "- Status: pending" or "- Status: ready".');
  }
  if (kickoff.total < 4) {
    errors.push(`Kickoff gate must contain the four readiness checks (found ${kickoff.total}).`);
  } else if (kickoff.status === 'ready' && kickoff.checked !== kickoff.total) {
    errors.push(`Kickoff is ready but only ${kickoff.checked}/${kickoff.total} gate items are checked.`);
  } else if (kickoff.status === 'pending' && kickoff.checked === kickoff.total) {
    errors.push('Kickoff is pending even though every gate item is checked.');
  }

  const implementationPlan = getMarkdownSectionLines(raw, 'Implementation plan').join('\n');
  const phaseMatches = [
    ...implementationPlan.matchAll(/^###\s+Phase\s+\d+\s+[—-]\s+.+$/gim),
  ];
  if (phaseMatches.length === 0) {
    errors.push('Implementation plan must contain at least one named phase.');
    return errors;
  }

  const requiredFields = [
    'Outcome',
    'Approach',
    'Affected boundaries / entry points',
    'Dependencies',
    'Exit criteria',
    'Verification',
    'Recovery',
  ];

  for (let index = 0; index < phaseMatches.length; index++) {
    const start = phaseMatches[index].index;
    const end = phaseMatches[index + 1]?.index ?? implementationPlan.length;
    const phaseRaw = implementationPlan.slice(start, end);
    const phaseName = String(phaseMatches[index][0] || `Phase ${index + 1}`).trim();

    for (const field of requiredFields) {
      const escaped = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const match = phaseRaw.match(new RegExp(`^\\s*-\\s+${escaped}:\\s*(.+)$`, 'mi'));
      if (!match || !cleanMarkdownValue(match[1])) {
        errors.push(`${phaseName} is missing a populated "${field}" field.`);
      }
    }

    if (!/^\s*-\s+Planned changes:\s*$/im.test(phaseRaw)) {
      errors.push(`${phaseName} is missing "Planned changes".`);
    } else if (!/^\s*\d+\.\s+\S.+$/m.test(phaseRaw)) {
      errors.push(`${phaseName} needs at least one ordered planned change.`);
    }
  }

  return errors;
}

function renderTaskMetaJson(meta) {
  return renderJson({
    version: 1,
    task_id: meta.task_id,
    slug: meta.slug,
    status: meta.status,
    updated: meta.updated,
    keywords: Array.isArray(meta.keywords) ? meta.keywords : [],
  });
}

function collectRegistryIds(registry, key, label, idPattern, errors) {
  const items = registry[key];
  const ids = new Map();
  if (!Array.isArray(items)) {
    errors.push(`Registry "${key}" must be a list.`);
    return ids;
  }

  for (const item of items) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      errors.push(`${label} entry must be a mapping.`);
      continue;
    }
    const id = String(item.id || '').trim();
    if (!id) {
      errors.push(`${label} is missing required "id" field.`);
      continue;
    }
    if (!idPattern.test(id)) {
      errors.push(`${label} ID "${id}" does not match the required format.`);
      continue;
    }
    if (ids.has(id)) {
      errors.push(`Duplicate ${label} ID "${id}" in registry.`);
      continue;
    }
    ids.set(id, item);
  }
  return ids;
}

function validateRegistryGraph(registry, errors) {
  if (registry.version !== 1) {
    errors.push('Registry version must be 1.');
  }

  const milestones = collectRegistryIds(
    registry,
    'milestones',
    'Milestone',
    MILESTONE_ID_RE,
    errors
  );
  const features = collectRegistryIds(registry, 'features', 'Feature', FEATURE_ID_RE, errors);
  const requirements = collectRegistryIds(
    registry,
    'requirements',
    'Requirement',
    REQUIREMENT_ID_RE,
    errors
  );
  const tasks = collectRegistryIds(registry, 'tasks', 'Task', TASK_ID_RE, errors);
  if (registry.ideas !== undefined && !Array.isArray(registry.ideas)) {
    errors.push('Registry "ideas" must be a list when present.');
  }

  if (!milestones.has('M-000')) errors.push('Registry is missing reserved Milestone M-000.');
  if (!features.has('F-000')) errors.push('Registry is missing reserved Feature F-000.');
  if (features.has('F-000') && String(features.get('F-000').milestone_id || '') !== 'M-000') {
    errors.push('Reserved Feature F-000 must belong to Milestone M-000.');
  }

  for (const [id, feature] of features) {
    const milestoneId = String(feature.milestone_id || '').trim();
    if (!milestoneId) errors.push(`Feature ${id} is missing milestone_id.`);
    else if (!milestones.has(milestoneId)) {
      errors.push(`Feature ${id} references missing Milestone ${milestoneId}.`);
    }
  }

  for (const [id, requirement] of requirements) {
    const featureId = String(requirement.feature_id || '').trim();
    if (!featureId) errors.push(`Requirement ${id} is missing feature_id.`);
    else if (!features.has(featureId)) {
      errors.push(`Requirement ${id} references missing Feature ${featureId}.`);
    }
  }

  for (const [id, task] of tasks) {
    const featureId = String(task.feature_id || '').trim();
    if (!featureId) errors.push(`Task ${id} is missing feature_id.`);
    else if (!features.has(featureId)) errors.push(`Task ${id} references missing Feature ${featureId}.`);
    if (Object.hasOwn(task, 'milestone_id')) {
      errors.push(`Task ${id} must not store milestone_id; its Milestone is derived from Feature ${featureId || '(missing)'}.`);
    }

    if (task.requirement_ids !== undefined && !Array.isArray(task.requirement_ids)) {
      errors.push(`Task ${id} requirement_ids must be a list.`);
      continue;
    }
    for (const requirementId of task.requirement_ids || []) {
      const normalized = String(requirementId || '').trim();
      if (!requirements.has(normalized)) {
        errors.push(`Task ${id} references missing Requirement ${normalized || '(empty)'}.`);
      } else if (String(requirements.get(normalized).feature_id || '').trim() !== featureId) {
        errors.push(`Task ${id} references Requirement ${normalized} from a different Feature.`);
      }
    }
  }
}

function validateRegistryStatuses(items, label, allowed, errors, projection = false) {
  if (!Array.isArray(items)) return;
  const field = projection ? 'registry status' : 'status';
  for (const item of items) {
    if (!item || typeof item !== 'object') continue;
    const id = String(item.id || '');
    const status = String(item.status || '').trim();
    if (!status) errors.push(`${label} ${id}: Missing ${field}.`);
    else if (!allowed.has(status)) {
      errors.push(`${label} ${id}: Invalid ${field} "${status}". Allowed: ${[...allowed].join(', ')}`);
    }
  }
}

function cmdLint({ repoRoot, strict }) {
  const errors = [];
  const warnings = [];

  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const guidancePath = path.join(repoRoot, '.ai', 'project', file);
    if (!exists(guidancePath)) errors.push(`Missing .ai/project/${file} (required).`);
  }

  const { registry, error: registryParseError } = loadRegistry(repoRoot);

  let devDocsRoots = [];
  if (registryParseError) {
    errors.push(`Failed to parse registry.json: ${registryParseError}`);
  }

  if (!registry && !registryParseError) {
    warnings.push(
      'Project hub is not initialized. Run: node .ai/scripts/install-project-governance.mjs --repo-root .'
    );
    devDocsRoots = discoverDevDocsRoots(repoRoot);
  } else if (registry) {
    const REQUIRED_REGISTRY_KEYS = [
      'version',
      'milestones',
      'features',
      'requirements',
      'tasks',
    ];
    for (const key of REQUIRED_REGISTRY_KEYS) {
      if (!(key in registry) || registry[key] === undefined) {
        errors.push(`Registry missing required top-level key: "${key}".`);
      }
    }
    validateRegistryGraph(registry, errors);

    const configured = resolveConfiguredRoots(repoRoot, registry);
    errors.push(...configured.errors);
    devDocsRoots = configured.configured ? configured.roots : discoverDevDocsRoots(repoRoot);
  }

  if (devDocsRoots.length === 0) {
    warnings.push('No dev-docs roots discovered.');
  }

  const tasks = scanTasks(repoRoot, devDocsRoots);

  // Collect IDs and slug-to-ids mapping for cross-root checks
  const taskIdToTask = new Map();
  const slugToIds = new Map();

  const registryTaskById = new Map();
  if (registry && Array.isArray(registry.tasks)) {
    for (const t of registry.tasks) {
      if (!t || typeof t !== 'object') continue;
      const id = String(t.id || '').trim();
      if (id) registryTaskById.set(id, t);
    }
  }

  for (const task of tasks) {
    const metaRaw = readText(task.metaPath);
    const statusRaw = readText(task.statusPath);
    const roadmapRaw = readText(task.roadmapPath);
    const kickoff = roadmapRaw ? getRoadmapKickoff(roadmapRaw) : null;

    task.taskId = null;
    task.bundleStatus = null;
    task.effectiveStatus = task.phase === 'archive' ? 'archived' : null;

    if (task.phase === 'archive') {
      const names = fs.readdirSync(task.absPath).sort();
      const hasSummary = names.includes('summary.md');
      const hasMeta = names.includes('.ai-task.json');
      const allowed = new Set(['.ai-task.json', 'summary.md']);
      const extras = names.filter((name) => !allowed.has(name));
      if (!hasSummary || !hasMeta || extras.length > 0 || names.length !== 2) {
        const details = [];
        if (!hasMeta) details.push('missing .ai-task.json');
        if (!hasSummary) details.push('missing summary.md');
        if (extras.length > 0) details.push(`extra entries: ${extras.join(', ')}`);
        errors.push(
          `${formatTaskRef(task)}: Archived bundle must contain exactly .ai-task.json and summary.md` +
            `${details.length > 0 ? `; ${details.join('; ')}` : ''}.`
        );
      }
    }

    if (task.phase === 'active') {
      const requiredFiles = [
        '00-roadmap.md',
        '01-status.md',
        '02-architecture.md',
        'verification.md',
      ];
      const missingFiles = requiredFiles.filter((name) => !exists(path.join(task.absPath, name)));
      if (missingFiles.length > 0) {
        errors.push(
          `${formatTaskRef(task)}: Active bundle is incomplete; missing: ${missingFiles.join(', ')}.`
        );
      }

      if (roadmapRaw !== null) {
        for (const roadmapError of validateRoadmap(roadmapRaw)) {
          errors.push(`${formatTaskRef(task)}: ${roadmapError}`);
        }
      }
    }

    if (task.phase === 'active' && statusRaw !== null) {
      const { status, error: stateError } = getBundleStatusFromStatusDoc(
        statusRaw,
        path.basename(task.statusPath)
      );
      if (stateError) errors.push(`${formatTaskRef(task)}: ${stateError}`);
      task.bundleStatus = status;
      if (status) task.effectiveStatus = status;
    }

    if (task.phase === 'active' && task.effectiveStatus === 'done' && kickoff?.status !== 'ready') {
      errors.push(`${formatTaskRef(task)}: State is done but roadmap kickoff is not ready.`);
    }

    if (metaRaw === null) {
      errors.push(`${formatTaskRef(task)}: Missing .ai-task.json.`);
      continue;
    }

    const meta = parseTaskMeta(metaRaw);

    if (meta.parse_error) {
      errors.push(`${formatTaskRef(task)}: Failed to parse .ai-task.json: ${meta.parse_error}`);
      continue;
    }

    if (meta.version !== 1) {
      errors.push(`${formatTaskRef(task)}: Invalid meta version (expected 1).`);
    }

    if (!TASK_ID_RE.test(meta.task_id)) {
      errors.push(`${formatTaskRef(task)}: Invalid task_id "${meta.task_id}" (expected T-###).`);
    } else {
      task.taskId = meta.task_id;
      if (taskIdToTask.has(meta.task_id)) {
        const other = taskIdToTask.get(meta.task_id);
        errors.push(
          `Duplicate task_id "${meta.task_id}" across repo:\n  - ${toPosix(other.relPath)}\n  - ${toPosix(task.relPath)}`
        );
      } else {
        taskIdToTask.set(meta.task_id, task);
      }

      const ids = slugToIds.get(task.slug) || new Set();
      ids.add(meta.task_id);
      slugToIds.set(task.slug, ids);
    }

    if (meta.slug && meta.slug !== task.slug) {
      errors.push(`${formatTaskRef(task)}: meta.slug="${meta.slug}" does not match directory slug "${task.slug}".`);
    }

    if (meta.status && !TASK_STATUS.has(meta.status)) {
      errors.push(`${formatTaskRef(task)}: Invalid meta.status "${meta.status}".`);
    }

    if (meta.updated && !DATE_RE.test(meta.updated)) {
      errors.push(`${formatTaskRef(task)}: Invalid meta.updated "${meta.updated}" (expected YYYY-MM-DD).`);
    }

    // Special drift warning: meta status ahead of bundle status (not authoritative)
    if (meta.status && task.effectiveStatus) {
      if (statusRank(meta.status) > statusRank(task.effectiveStatus)) {
        warnings.push(
          `${formatTaskRef(task)}: meta.status="${meta.status}" is ahead of bundle status "${task.effectiveStatus}".`
        );
      }
    }

    if (task.effectiveStatus === 'done' && statusRaw !== null) {
      const ac = getCompletionCriteriaStats(statusRaw);
      if (ac.total === 0) {
        errors.push(`${formatTaskRef(task)}: State is done but no Done when checkboxes were found.`);
      } else if (ac.checked < ac.total) {
        errors.push(
          `${formatTaskRef(task)}: State is done but Done when is not fully checked (${ac.checked}/${ac.total}).`
        );
      }
    }

    // Registry consistency checks (strict for tasks with meta)
    if (registry) {
      if (!registryTaskById.has(meta.task_id)) {
        errors.push(`${formatTaskRef(task)}: Missing registry entry for task_id "${meta.task_id}".`);
      } else {
        const entry = registryTaskById.get(meta.task_id);
        const expectedPath = toPosix(task.relPath);
        const actualPath = toPosix(String(entry.dev_docs_path || ''));
        if (actualPath !== expectedPath) {
          errors.push(
            `${formatTaskRef(task)}: registry dev_docs_path mismatch (registry="${actualPath}", expected="${expectedPath}").`
          );
        }
        const expectedStatus = task.effectiveStatus;
        const actualStatus = String(entry.status || '');
        if (expectedStatus && actualStatus && expectedStatus !== actualStatus) {
          errors.push(
            `${formatTaskRef(task)}: registry status mismatch (registry="${actualStatus}", expected="${expectedStatus}").`
          );
        }
      }
    }
  }

  // Slug conflicts across roots (error only when multiple distinct IDs exist)
  for (const [slug, ids] of slugToIds.entries()) {
    if (ids.size <= 1) continue;
    errors.push(`Slug "${slug}" appears with multiple task_ids: ${[...ids].sort().join(', ')}`);
  }

  // Orphaned registry entries (task deleted from filesystem but still in registry)
  if (registry && Array.isArray(registry.tasks)) {
    for (const regTask of registry.tasks) {
      if (!regTask || typeof regTask !== 'object') continue;
      const id = String(regTask.id || '').trim();
      if (!id) continue;
      // Skip tasks that were found on disk
      if (taskIdToTask.has(id)) continue;
      const devDocsPath = String(regTask.dev_docs_path || '');
      warnings.push(
        `Registry task ${id} (slug="${regTask.slug || ''}"): dev_docs_path "${devDocsPath}" not found on disk. Consider removing from registry or re-creating the task bundle.`
      );
    }
  }

  // Validate Milestone/Feature/Requirement status enums.
  if (registry) {
    validateRegistryStatuses(registry.milestones, 'Milestone', MILESTONE_STATUS, errors);
    validateRegistryStatuses(registry.features, 'Feature', FEATURE_STATUS, errors);
    validateRegistryStatuses(registry.requirements, 'Requirement', REQUIREMENT_STATUS, errors);
    validateRegistryStatuses(registry.tasks, 'Task', TASK_STATUS, errors, true);

    const features = Array.isArray(registry.features) ? registry.features : [];
    const tasks = Array.isArray(registry.tasks) ? registry.tasks : [];
    for (const milestone of Array.isArray(registry.milestones) ? registry.milestones : []) {
      if (!milestone || typeof milestone !== 'object' || milestone.status !== 'done') continue;
      const milestoneId = String(milestone.id || '');
      const incomplete = features
        .filter((feature) => feature && String(feature.milestone_id || '') === milestoneId)
        .filter((feature) => !['done', 'cut'].includes(String(feature.status || '')))
        .map((feature) => String(feature.id || '(missing ID)'));
      if (incomplete.length > 0) {
        warnings.push(
          `Milestone ${milestoneId} is done but has non-terminal Features: ${incomplete.join(', ')}.`
        );
      }
    }

    for (const feature of features) {
      if (!feature || typeof feature !== 'object' || !['done', 'cut'].includes(feature.status)) continue;
      const featureId = String(feature.id || '');
      const activeTasks = tasks
        .filter((task) => task && String(task.feature_id || '') === featureId)
        .filter((task) => ['planned', 'in-progress', 'blocked'].includes(String(task.status || '')))
        .map((task) => String(task.id || '(missing ID)'));
      if (activeTasks.length > 0) {
        warnings.push(
          `Feature ${featureId} is ${feature.status} but has active mapped Tasks: ${activeTasks.join(', ')}.`
        );
      }
    }
  }

  if (strict && warnings.length > 0) {
    for (const warning of warnings) errors.push(`[strict] ${warning}`);
  }

  if (errors.length > 0) {
    header('Errors:');
    for (const e of errors) console.log(`- ${e}`);
  }

  if (warnings.length > 0) {
    header('Warnings:');
    for (const w of warnings) console.log(`- ${w}`);
  }

  const okExit = errors.length === 0;
  console.log(okExit ? '[ok] Lint passed.' : '[error] Lint failed.');
  return { ok: okExit, errors, warnings };
}

function withGovernanceWriteLock(repoRoot, fn) {
  const rawCommonDir = runGit(repoRoot, ['rev-parse', '--git-common-dir']);
  if (!rawCommonDir?.trim()) {
    throw new Error('Cannot resolve the Git common directory required for governance allocation.');
  }

  const commonDir = path.resolve(repoRoot, rawCommonDir.trim());
  const lockDir = path.join(commonDir, 'project-governance-write.lock');
  const waitArray = new Int32Array(new SharedArrayBuffer(4));
  const deadline = Date.now() + 10000;
  let acquired = false;

  while (!acquired && Date.now() < deadline) {
    try {
      fs.mkdirSync(lockDir);
      acquired = true;
    } catch (error) {
      if (error?.code !== 'EEXIST') throw error;
      Atomics.wait(waitArray, 0, 0, 100);
    }
  }

  if (!acquired) {
    throw new Error(
      `Timed out waiting for the shared governance write lock: ${toPosix(lockDir)}. ` +
        'Retry after the other sync completes; if no sync is running, remove the stale empty lock directory.'
    );
  }

  try {
    return fn();
  } finally {
    fs.rmdirSync(lockDir);
  }
}

function cmdSync({ repoRoot, dryRun, apply }) {
  const actions = [];
  const errors = [];
  const warnings = [];
  const pendingWrites = new Map();

  const planWrite = (filePath, content, { op, note }) => {
    const resolved = path.resolve(filePath);
    const previous = pendingWrites.get(resolved);
    const current = previous ? previous.content : readText(filePath);
    if (current === content) return false;

    pendingWrites.set(resolved, {
      path: filePath,
      content,
      op: op || (current === null ? 'write' : 'update'),
      note,
    });
    return true;
  };

  const finish = () => {
    const succeeded = errors.length === 0;
    if (!succeeded) {
      header('Errors:');
      for (const error of errors) console.log(`- ${error}`);
    }
    if (warnings.length > 0) {
      header('Warnings:');
      for (const warning of warnings) console.log(`- ${warning}`);
    }
    if (succeeded) ok('[ok] Sync complete.');
    else console.log('[error] Sync failed.');

    for (const action of actions) {
      const mode = action.mode ? ` (${action.mode})` : '';
      const note = action.note ? ` (${action.note})` : '';
      console.log(`  ${action.op}: ${toPosix(path.relative(repoRoot, action.path))}${note}${mode}`);
    }
    return { ok: succeeded, errors, warnings, actions };
  };

  const registryPath = getRegistryPath(repoRoot);
  if (!exists(registryPath)) {
    errors.push(
      'Project hub missing. Run: node .ai/scripts/install-project-governance.mjs --repo-root .'
    );
    return finish();
  }

  const loaded = loadRegistry(repoRoot);
  if (!loaded.registry) {
    errors.push(`Failed to parse registry.json: ${loaded.error || '(unknown error)'}`);
    return finish();
  }
  const reg = loaded.registry;

  const configured = resolveConfiguredRoots(repoRoot, reg);
  if (configured.errors.length > 0) {
    errors.push(...configured.errors);
    return finish();
  }
  const roots = configured.configured ? configured.roots : discoverDevDocsRoots(repoRoot);

  const tasks = scanTasks(repoRoot, roots);

  // Allocate IDs for missing meta
  const existingIds = new Set();
  for (const task of tasks) {
    const raw = readText(task.metaPath);
    if (!raw) continue;
    const meta = parseTaskMeta(raw);
    if (TASK_ID_RE.test(meta.task_id)) existingIds.add(meta.task_id);
  }

  // Also include any IDs already present in the registry to avoid reusing historical IDs.
  if (Array.isArray(reg.tasks)) {
    for (const t of reg.tasks) {
      if (!t || typeof t !== 'object') continue;
      const id = String(t.id || '').trim();
      if (TASK_ID_RE.test(id)) existingIds.add(id);
    }
  }

  // And IDs linked from any branch's history. The working tree is blind to other branches, so a
  // linked worktree would otherwise reallocate an ID a sibling worktree already committed.
  for (const id of taskIdsFromAllBranches(repoRoot)) existingIds.add(id);

  // Linked worktrees may contain valid task metadata that has not been committed yet. Include it
  // while holding the shared Git-common-dir lock so concurrent syncs cannot choose the same ID.
  for (const id of taskIdsFromAllWorktrees(repoRoot)) existingIds.add(id);

  function nextId() {
    // Allocate monotonically increasing IDs (best-effort) to avoid reusing historical task IDs.
    let max = 0;
    for (const id of existingIds) {
      const n = Number(String(id).slice(2));
      if (Number.isFinite(n) && n > max) max = n;
    }

    let candidate = max + 1;
    while (candidate <= 999) {
      const id = `T-${String(candidate).padStart(3, '0')}`;
      if (!existingIds.has(id)) {
        existingIds.add(id);
        return id;
      }
      candidate++;
    }
    throw new Error('Exhausted task IDs (T-001..T-999).');
  }

  const todayStr = today();

  // Build/refresh registry tasks
  if (!Array.isArray(reg.tasks)) reg.tasks = [];
  const tasksById = new Map();
  for (const t of reg.tasks) {
    if (!t || typeof t !== 'object') continue;
    const id = String(t.id || '').trim();
    if (id) tasksById.set(id, t);
  }

  for (const task of tasks) {
    const statusRaw = readText(task.statusPath);
    const metaRaw = readText(task.metaPath);

    let effectiveStatus = 'archived';
    if (task.phase === 'active') {
      if (statusRaw === null) {
        errors.push(`${toPosix(task.relPath)}: Missing 01-status.md.`);
        continue;
      }
      const parsedStatus = getBundleStatusFromStatusDoc(statusRaw, path.basename(task.statusPath));
      if (parsedStatus.error) {
        errors.push(`${toPosix(task.relPath)}: ${parsedStatus.error}`);
        continue;
      }
      effectiveStatus = parsedStatus.status;
    }

    if (metaRaw === null) {
      const id = nextId();
      const meta = {
        task_id: id,
        slug: task.slug,
        status: effectiveStatus || 'planned',
        updated: todayStr,
        keywords: [],
      };
      const rendered = renderTaskMetaJson(meta);
      planWrite(task.metaPath, rendered, { op: 'write', note: `allocate ${id}` });
      task.taskId = id;
    } else {
      const meta = parseTaskMeta(metaRaw);
      if (meta.parse_error) {
        errors.push(`${toPosix(task.relPath)}: Failed to parse .ai-task.json: ${meta.parse_error}`);
        continue;
      }
      if (!TASK_ID_RE.test(meta.task_id)) {
        warnings.push(`${toPosix(task.relPath)}: Invalid task_id; sync will not auto-repair without manual fix.`);
        continue;
      }
      task.taskId = meta.task_id;

      const desiredStatus = effectiveStatus || meta.status || 'planned';
      const shouldUpdate = desiredStatus !== meta.status || meta.slug !== task.slug;

      if (shouldUpdate) {
        const nextMeta = {
          task_id: meta.task_id,
          slug: task.slug,
          status: desiredStatus,
          updated: todayStr,
          keywords: meta.keywords || [],
        };
        const rendered = renderTaskMetaJson(nextMeta);
        planWrite(task.metaPath, rendered, { op: 'update', note: 'refresh derived fields' });
      }
    }

    if (!task.taskId) continue;

    const entry = tasksById.get(task.taskId) || { id: task.taskId };
    const prevStatus = entry.status;
    entry.slug = task.slug;
    entry.status = effectiveStatus || entry.status || 'planned';
    entry.dev_docs_path = toPosix(task.relPath);
    if (!entry.updated || entry.status !== prevStatus) entry.updated = todayStr;
    if (!entry.feature_id) entry.feature_id = 'F-000';
    delete entry.milestone_id;

    tasksById.set(task.taskId, entry);
  }

  reg.tasks = [...tasksById.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Ensure system nodes exist
  if (!Array.isArray(reg.milestones)) reg.milestones = [];
  if (!reg.milestones.some((m) => m && m.id === 'M-000')) {
    reg.milestones.unshift({
      id: 'M-000',
      title: 'Inbox / Triage',
      status: 'in-progress',
      description: 'Triage queue for new or unplanned work.',
    });
  }
  if (!Array.isArray(reg.features)) reg.features = [];
  if (!reg.features.some((f) => f && f.id === 'F-000')) {
    reg.features.unshift({
      id: 'F-000',
      title: 'Inbox / Untriaged',
      milestone_id: 'M-000',
      status: 'in-progress',
      description: 'Untriaged tasks live here until mapped to a real feature.',
    });
  }
  if (!Array.isArray(reg.requirements)) reg.requirements = [];
  if (reg.ideas === undefined) reg.ideas = [];
  if (!Array.isArray(reg.task_doc_roots) || reg.task_doc_roots.length === 0) {
    reg.task_doc_roots = roots.map((r) => toPosix(path.relative(repoRoot, r)));
  }

  // Write registry
  const registryOut = renderJson(reg);
  planWrite(registryPath, registryOut, { op: 'update', note: 'update registry' });

  // Derived views
  const hubDir = getHubDir(repoRoot);
  const dashboardPath = path.join(hubDir, 'dashboard.md');
  const featureMapPath = path.join(hubDir, 'feature-map.md');

  const regTasks = Array.isArray(reg.tasks) ? reg.tasks : [];
  const counts = { total: regTasks.length, planned: 0, inProgress: 0, blocked: 0, done: 0, archived: 0 };
  for (const t of regTasks) {
    const st = String(t.status || '');
    if (st === 'planned') counts.planned++;
    else if (st === 'in-progress') counts.inProgress++;
    else if (st === 'blocked') counts.blocked++;
    else if (st === 'done') counts.done++;
    else if (st === 'archived') counts.archived++;
  }
  const cell = (value) => String(value || '').replace(/\r?\n/g, ' ').replace(/\|/g, '\\|');
  const dashAutoLines = [
    '## Summary',
    '',
    `- Tasks: ${counts.total} (planned: ${counts.planned}, in-progress: ${counts.inProgress}, blocked: ${counts.blocked}, done: ${counts.done}, archived: ${counts.archived})`,
    '',
    '## Recently registered or status-changed tasks',
    '',
    '| Task | Status | Feature | Dev Docs |',
    '| --- | --- | --- | --- |',
    ...regTasks
      .slice()
      .sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')))
      .slice(0, 20)
      .map((t) => {
        const taskLabel = `${t.id} ${t.slug || ''}`.trim();
        return `| ${cell(taskLabel)} | ${cell(t.status)} | ${cell(t.feature_id)} | ${cell(t.dev_docs_path)} |`;
      }),
    '',
  ];
  const dashAuto = dashAutoLines.join('\n');

  const featureAutoLines = [];
  featureAutoLines.push('## Features');
  featureAutoLines.push('');
  const features = Array.isArray(reg.features) ? reg.features : [];
  const byFeature = new Map();
  for (const t of regTasks) {
    const fid = String(t.feature_id || 'F-000');
    const list = byFeature.get(fid) || [];
    list.push(t);
    byFeature.set(fid, list);
  }
  for (const f of features.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    if (!f || typeof f !== 'object') continue;
    const fid = String(f.id || '');
    const title = String(f.title || '');
    const list = (byFeature.get(fid) || []).slice().sort((a, b) => String(a.id).localeCompare(String(b.id)));
    featureAutoLines.push(`### ${fid} ${title}`.trim());
    featureAutoLines.push('');
    if (list.length === 0) {
      featureAutoLines.push('- (no tasks)');
      featureAutoLines.push('');
      continue;
    }
    featureAutoLines.push('| Task | Status | Dev Docs |');
    featureAutoLines.push('| --- | --- | --- |');
    for (const t of list) {
      const label = `${t.id} ${t.slug || ''}`.trim();
      featureAutoLines.push(`| ${label} | ${t.status || ''} | ${t.dev_docs_path || ''} |`);
    }
    featureAutoLines.push('');
  }
  const featureAuto = featureAutoLines.join('\n').trimEnd() + '\n';

  function updateDerived(filePath, blockId, content) {
    const base = readText(filePath);
    const existedOnDisk = base !== null;
    if (!base) {
      warnings.push(
        `Missing derived view file: ${toPosix(path.relative(repoRoot, filePath))} ` +
          '(run: node .ai/scripts/install-project-governance.mjs --repo-root .).'
      );
      return;
    }

    // For files that already existed on disk, refuse full-file replacement when markers
    // are missing (prevents destroying manual notes). Freshly created templates are safe.
    const next = replaceAutoBlock(base, blockId, content, filePath, !existedOnDisk);
    if (next === null) {
      // Markers missing in existing file; skipped to prevent data loss.
      warnings.push(
        `Skipped update of ${toPosix(path.relative(repoRoot, filePath))}: missing AUTO-GENERATED markers for "${blockId}". Restore the markers before retrying sync.`
      );
      return;
    }

    planWrite(filePath, next, { op: 'update', note: `regen ${blockId}` });
  }

  updateDerived(dashboardPath, 'dashboard', dashAuto);
  updateDerived(featureMapPath, 'feature-map', featureAuto);

  // Do not mutate the worktree until every input and derived output has been calculated.
  // This prevents a validation failure in a later bundle from leaving earlier metadata or hub
  // projections partially refreshed. Filesystem failures during the final write pass are still
  // ordinary I/O failures; this is validation atomicity, not a multi-file storage transaction.
  if (errors.length === 0) {
    for (const pending of pendingWrites.values()) {
      const { content, ...action } = pending;
      if (dryRun || !apply) {
        actions.push({ ...action, mode: 'dry-run' });
        continue;
      }

      const changed = writeTextIfChanged(pending.path, content);
      if (changed) actions.push(action);
    }
  }

  return finish();
}

function cmdMap({ repoRoot, taskId, featureId, requirementId, dryRun, apply }) {
  const errors = [];
  const actions = [];

  if (!taskId || !TASK_ID_RE.test(taskId)) {
    errors.push(`Invalid or missing --task (expected T-###, got "${taskId || ''}").`);
    return { ok: false, errors, actions };
  }

  if (!featureId && !requirementId) {
    errors.push('At least one of --feature or --requirement is required.');
    return { ok: false, errors, actions };
  }

  // Validate ID formats.
  if (featureId && !FEATURE_ID_RE.test(featureId)) {
    errors.push(`Invalid --feature ID format (expected F-###, got "${featureId}").`);
    return { ok: false, errors, actions };
  }
  if (requirementId && !REQUIREMENT_ID_RE.test(requirementId)) {
    errors.push(`Invalid --requirement ID format (expected R-###, got "${requirementId}").`);
    return { ok: false, errors, actions };
  }

  const loaded = loadRegistry(repoRoot);
  if (!loaded.registry) {
    errors.push(`Failed to load registry: ${loaded.error || 'registry not found'}`);
    return { ok: false, errors, actions };
  }

  const reg = loaded.registry;
  const registryPath = loaded.path;

  // Find the task in registry
  if (!Array.isArray(reg.tasks)) reg.tasks = [];
  const taskEntry = reg.tasks.find((t) => t && t.id === taskId);
  if (!taskEntry) {
    errors.push(`Task "${taskId}" not found in registry. Run sync first.`);
    return { ok: false, errors, actions };
  }

  // Validate feature exists
  if (featureId) {
    const featureExists = Array.isArray(reg.features) && reg.features.some((f) => f && f.id === featureId);
    if (!featureExists) {
      errors.push(`Feature "${featureId}" not found in registry.`);
      return { ok: false, errors, actions };
    }
  }

  // Validate requirement and its Feature relationship.
  if (requirementId) {
    const requirement = Array.isArray(reg.requirements)
      ? reg.requirements.find((item) => item && item.id === requirementId)
      : null;
    if (!requirement) {
      errors.push(`Requirement "${requirementId}" not found in registry. Allocate it first.`);
      return { ok: false, errors, actions };
    }
    const targetFeatureId = featureId || String(taskEntry.feature_id || '').trim();
    const requirementFeatureId = String(requirement.feature_id || '').trim();
    if (targetFeatureId !== requirementFeatureId) {
      errors.push(
        `Requirement "${requirementId}" belongs to Feature ${requirementFeatureId || '(missing)'}, ` +
          `but task ${taskId} would belong to ${targetFeatureId || '(missing)'}.`
      );
      return { ok: false, errors, actions };
    }
  }

  // Apply mappings
  const changes = [];
  if (featureId && taskEntry.feature_id !== featureId) {
    changes.push(`feature_id: ${taskEntry.feature_id || '(none)'} -> ${featureId}`);
    taskEntry.feature_id = featureId;
  }
  if (requirementId) {
    const reqIds = Array.isArray(taskEntry.requirement_ids) ? taskEntry.requirement_ids : [];
    if (!reqIds.includes(requirementId)) {
      reqIds.push(requirementId);
      taskEntry.requirement_ids = reqIds;
      changes.push(`requirement_ids: added ${requirementId}`);
    }
  }

  if (changes.length === 0) {
    ok(`[ok] Task ${taskId} already has the specified mapping. No changes needed.`);
    return { ok: true, errors, actions };
  }

  taskEntry.updated = today();
  actions.push({ op: 'update', target: 'task', id: taskId, changes });

  if (dryRun || !apply) {
    header('Planned changes:');
    for (const a of actions) {
      const changesStr = a.changes ? `: ${a.changes.join(', ')}` : '';
      const noteStr = a.note ? ` (${a.note})` : '';
      console.log(`  ${a.op} ${a.target} ${a.id}${changesStr}${noteStr}`);
    }
    info('(dry-run mode; use --apply to write changes)');
    return { ok: true, errors, actions };
  }

  // Write registry
  const registryOut = renderJson(reg);
  const changed = writeTextIfChanged(registryPath, registryOut);
  if (changed) {
    actions.push({ op: 'write', path: registryPath });
  }

  ok(`[ok] Mapped ${taskId}:`);
  for (const c of changes) console.log(`  - ${c}`);

  return { ok: true, errors, actions };
}

function normalizeFeatureTitle(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
}

function collectFeaturesFromAllWorktrees(repoRoot) {
  const rows = [];
  for (const worktree of listGitWorktrees(repoRoot)) {
    const registry = loadRegistry(worktree.path).registry;
    if (!registry || !Array.isArray(registry.features)) continue;
    for (const feature of registry.features) {
      if (!feature || typeof feature !== 'object') continue;
      const id = String(feature.id || '').trim();
      const title = String(feature.title || '').trim();
      if (!FEATURE_ID_RE.test(id)) continue;
      rows.push({
        ...feature,
        id,
        title,
        worktree_path: worktree.path,
        worktree_branch: worktree.branch,
      });
    }
  }
  return rows;
}

function cmdFeature({ repoRoot, title, description, dryRun, apply, json }) {
  const errors = [];
  const actions = [];
  const normalizedTitle = normalizeFeatureTitle(title);
  if (!normalizedTitle) {
    return { ok: false, errors: ['Missing --title for feature resolution.'], actions };
  }

  const loaded = loadRegistry(repoRoot);
  if (!loaded.registry) {
    return {
      ok: false,
      errors: [`Failed to load registry: ${loaded.error || 'registry not found'}`],
      actions,
    };
  }

  const allFeatures = collectFeaturesFromAllWorktrees(repoRoot);
  const titlesById = new Map();
  for (const feature of allFeatures) {
    const titles = titlesById.get(feature.id) || new Set();
    titles.add(normalizeFeatureTitle(feature.title));
    titlesById.set(feature.id, titles);
  }
  for (const [id, titles] of titlesById) {
    if (titles.size > 1) {
      errors.push(`Feature ID ${id} has different titles across linked worktrees.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors, actions };

  const titleMatches = allFeatures.filter(
    (feature) => normalizeFeatureTitle(feature.title) === normalizedTitle
  );
  const matchingIds = [...new Set(titleMatches.map((feature) => feature.id))];
  if (matchingIds.length > 1) {
    return {
      ok: false,
      errors: [`Feature title "${title}" maps to multiple IDs across linked worktrees: ${matchingIds.join(', ')}.`],
      actions,
    };
  }

  const registry = loaded.registry;
  if (!Array.isArray(registry.features)) registry.features = [];
  let feature = null;
  let created = false;

  if (matchingIds.length === 1) {
    const id = matchingIds[0];
    feature = registry.features.find((item) => item && item.id === id) || null;
    if (!feature) {
      const source = titleMatches[0];
      feature = {
        id,
        title: source.title,
        milestone_id: String(source.milestone_id || 'M-000'),
        status: FEATURE_STATUS.has(String(source.status || '')) ? source.status : 'planned',
        description: String(source.description || description || '').trim(),
      };
      registry.features.push(feature);
      actions.push({ op: 'copy', target: 'feature', id, note: 'found in linked worktree' });
    }
  } else {
    let max = 0;
    for (const id of titlesById.keys()) {
      const n = Number(id.slice(2));
      if (Number.isFinite(n) && n > max) max = n;
    }
    if (max >= 999) {
      return { ok: false, errors: ['Exhausted feature IDs (F-001..F-999).'], actions };
    }
    const id = `F-${String(max + 1).padStart(3, '0')}`;
    feature = {
      id,
      title: String(title).trim().replace(/\s+/g, ' '),
      milestone_id: 'M-000',
      status: 'planned',
      description: String(description || '').trim(),
    };
    registry.features.push(feature);
    actions.push({ op: 'create', target: 'feature', id });
    created = true;
  }

  registry.features.sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));

  if (apply && !dryRun && actions.length > 0) {
    writeTextIfChanged(loaded.path, renderJson(registry));
  }

  const result = {
    id: feature.id,
    title: feature.title,
    status: String(feature.status || 'planned'),
    created,
    changed: actions.length > 0,
    mode: apply && !dryRun ? 'apply' : 'dry-run',
  };

  if (json) console.log(JSON.stringify(result));
  else if (actions.length === 0) ok(`[ok] Feature ${feature.id} already exists: ${feature.title}`);
  else if (apply && !dryRun) ok(`[ok] Feature ${feature.id} is available: ${feature.title}`);
  else info(`[dry-run] Feature ${feature.id} would be available: ${feature.title}`);

  return { ok: true, errors, actions, feature: result };
}

function collectRequirementsFromAllWorktrees(repoRoot) {
  const rows = [];
  for (const worktree of listGitWorktrees(repoRoot)) {
    const registry = loadRegistry(worktree.path).registry;
    if (!registry || !Array.isArray(registry.requirements)) continue;
    for (const requirement of registry.requirements) {
      if (!requirement || typeof requirement !== 'object') continue;
      const id = String(requirement.id || '').trim();
      const title = String(requirement.title || '').trim();
      const featureId = String(requirement.feature_id || '').trim();
      if (!REQUIREMENT_ID_RE.test(id)) continue;
      rows.push({
        ...requirement,
        id,
        title,
        feature_id: featureId,
        worktree_path: worktree.path,
        worktree_branch: worktree.branch,
      });
    }
  }
  return rows;
}

function cmdRequirement({ repoRoot, title, featureId, description, dryRun, apply, json }) {
  const errors = [];
  const actions = [];
  const normalizedTitle = normalizeFeatureTitle(title);
  if (!normalizedTitle) {
    return { ok: false, errors: ['Missing --title for requirement resolution.'], actions };
  }
  if (!FEATURE_ID_RE.test(featureId || '')) {
    return {
      ok: false,
      errors: [`Invalid or missing --feature (expected F-###, got "${featureId || ''}").`],
      actions,
    };
  }

  const loaded = loadRegistry(repoRoot);
  if (!loaded.registry) {
    return {
      ok: false,
      errors: [`Failed to load registry: ${loaded.error || 'registry not found'}`],
      actions,
    };
  }

  const registry = loaded.registry;
  const parentExists =
    Array.isArray(registry.features) &&
    registry.features.some((feature) => feature && feature.id === featureId);
  if (!parentExists) {
    return { ok: false, errors: [`Feature "${featureId}" not found in registry.`], actions };
  }

  const allRequirements = collectRequirementsFromAllWorktrees(repoRoot);
  const identitiesById = new Map();
  for (const requirement of allRequirements) {
    const identities = identitiesById.get(requirement.id) || new Set();
    identities.add(`${requirement.feature_id}\u0000${normalizeFeatureTitle(requirement.title)}`);
    identitiesById.set(requirement.id, identities);
  }
  for (const [id, identities] of identitiesById) {
    if (identities.size > 1) {
      errors.push(`Requirement ID ${id} has different Feature/title identities across linked worktrees.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors, actions };

  const matches = allRequirements.filter(
    (requirement) =>
      requirement.feature_id === featureId &&
      normalizeFeatureTitle(requirement.title) === normalizedTitle
  );
  const matchingIds = [...new Set(matches.map((requirement) => requirement.id))];
  if (matchingIds.length > 1) {
    return {
      ok: false,
      errors: [
        `Requirement title "${title}" under ${featureId} maps to multiple IDs across linked worktrees: ` +
          `${matchingIds.join(', ')}.`,
      ],
      actions,
    };
  }

  if (!Array.isArray(registry.requirements)) registry.requirements = [];
  let requirement = null;
  let created = false;

  if (matchingIds.length === 1) {
    const id = matchingIds[0];
    requirement = registry.requirements.find((item) => item && item.id === id) || null;
    if (!requirement) {
      const source = matches[0];
      requirement = {
        id,
        title: source.title,
        feature_id: featureId,
        status: REQUIREMENT_STATUS.has(String(source.status || '')) ? source.status : 'planned',
        description: String(source.description || description || '').trim(),
      };
      registry.requirements.push(requirement);
      actions.push({ op: 'copy', target: 'requirement', id, note: 'found in linked worktree' });
    }
  } else {
    let max = 0;
    for (const id of identitiesById.keys()) {
      const n = Number(id.slice(2));
      if (Number.isFinite(n) && n > max) max = n;
    }
    if (max >= 999) {
      return { ok: false, errors: ['Exhausted requirement IDs (R-001..R-999).'], actions };
    }
    const id = `R-${String(max + 1).padStart(3, '0')}`;
    requirement = {
      id,
      title: String(title).trim().replace(/\s+/g, ' '),
      feature_id: featureId,
      status: 'planned',
      description: String(description || '').trim(),
    };
    registry.requirements.push(requirement);
    actions.push({ op: 'create', target: 'requirement', id });
    created = true;
  }

  registry.requirements.sort((a, b) => String(a?.id || '').localeCompare(String(b?.id || '')));

  if (apply && !dryRun && actions.length > 0) {
    writeTextIfChanged(loaded.path, renderJson(registry));
  }

  const result = {
    id: requirement.id,
    title: requirement.title,
    feature_id: requirement.feature_id,
    status: String(requirement.status || 'planned'),
    created,
    changed: actions.length > 0,
    mode: apply && !dryRun ? 'apply' : 'dry-run',
  };

  if (json) console.log(JSON.stringify(result));
  else if (actions.length === 0) {
    ok(`[ok] Requirement ${requirement.id} already exists: ${requirement.title}`);
  } else if (apply && !dryRun) {
    ok(`[ok] Requirement ${requirement.id} is available: ${requirement.title}`);
  } else {
    info(`[dry-run] Requirement ${requirement.id} would be available: ${requirement.title}`);
  }

  return { ok: true, errors, actions, requirement: result };
}

function main() {
  const { command, opts } = parseArgs(process.argv);
  const repoRoot =
    opts['repo-root'] ? path.resolve(opts['repo-root']) : findRepoRoot(process.cwd()) || path.resolve(process.cwd());

  switch (command) {
    case 'lint': {
      const strict = !!opts.strict;
      // --check is the default behavior (exit non-zero only on errors; warnings do not fail).
      // It is accepted for explicitness but does not change behavior.
      // --strict promotes every warning to an error.
      const _check = opts.check; // consumed to avoid "unknown flag" warnings
      void _check;
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

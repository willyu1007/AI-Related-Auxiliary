/**
 * Mutating project-governance operations.
 *
 * Callers choose dry-run or apply mode; all repository writes and allocation locks live here.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  FEATURE_ID_RE,
  FEATURE_STATUS,
  MILESTONE_ID_RE,
  MILESTONE_STATUS,
  REQUIREMENT_ID_RE,
  REQUIREMENT_STATUS,
  TASK_ID_RE,
  exists,
  getBundleStatusFromStatusDoc,
  getHubDir,
  getRegistryPath,
  listGitWorktrees,
  loadRegistry,
  normalizeEol,
  parseTaskMeta,
  queryTasks,
  readText,
  runGit,
  scanTasks,
  taskIdsFromAllBranches,
  taskIdsFromAllWorktrees,
  toPosix,
} from './governance-read.mjs';

const warn = (message) => console.warn(message);
const ok = (message) => console.log(message);
const info = (message) => console.log(message);
const header = (message) => console.log(message);

function getTaskConflictErrors(repoRoot, taskId = null) {
  return getTaskConflictErrorsFromRows(queryTasks({ repoRoot, id: taskId }));
}

function getTaskConflictErrorsFromRows(tasks) {
  return tasks
    .filter((task) => task.id && task.conflict)
    .map((task) => {
      const fields = task.conflicts.map((conflict) => conflict.field).join(', ');
      const occurrences = task.worktrees
        .map((worktree) => `${worktree.worktree_branch}@${worktree.worktree_path}`)
        .join('; ');
      return (
        `Cross-worktree task conflict for ${task.id} (${fields}). ` +
        `Resolve the divergent occurrences before writing: ${occurrences}.`
      );
    });
}

function getRegistryLayoutErrors(registry) {
  const errors = [];
  if (Object.hasOwn(registry, 'task_doc_roots')) {
    errors.push('Registry contains unsupported top-level key: "task_doc_roots".');
  }
  for (const task of Array.isArray(registry.tasks) ? registry.tasks : []) {
    if (!task || typeof task !== 'object') continue;
    const devDocsPath = toPosix(String(task.dev_docs_path || ''));
    if (!/^dev-docs\/(?:active|archive)\/[^/]+$/.test(devDocsPath)) {
      errors.push(
        `Registry task ${String(task.id || '(no-id)')} has unsupported dev_docs_path "${devDocsPath}"; task bundles must be immediate children of top-level dev-docs/active or dev-docs/archive.`
      );
    }
  }
  return errors;
}

function today() {
  // Always use YYYY-MM-DD in local time.
  const d = new Date();
  const yyyy = String(d.getFullYear()).padStart(4, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
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

export function withGovernanceWriteLock(repoRoot, fn) {
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

export function cmdSync({ repoRoot, dryRun, apply }) {
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

  const taskConflicts = getTaskConflictErrors(repoRoot);
  if (taskConflicts.length > 0) {
    errors.push(...taskConflicts);
    return finish();
  }

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
  errors.push(...getRegistryLayoutErrors(reg));
  if (errors.length > 0) return finish();

  const tasks = scanTasks(repoRoot);

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

export function cmdMap({ repoRoot, taskId, featureId, requirementId, dryRun, apply }) {
  const errors = [];
  const actions = [];

  if (!taskId || !TASK_ID_RE.test(taskId)) {
    errors.push(`Invalid or missing --task (expected T-###, got "${taskId || ''}").`);
    return { ok: false, errors, actions };
  }

  const taskRows = queryTasks({ repoRoot, id: taskId });
  const taskConflicts = getTaskConflictErrorsFromRows(taskRows);
  if (taskConflicts.length > 0) {
    errors.push(...taskConflicts);
    return { ok: false, errors, actions };
  }
  const logicalTask = taskRows.find((task) => task.id === taskId) || null;
  if (!logicalTask) {
    errors.push(`Task bundle "${taskId}" not found under top-level dev-docs/.`);
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
  errors.push(...getRegistryLayoutErrors(reg));
  if (errors.length > 0) return { ok: false, errors, actions };
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

  const currentRequirements = Array.isArray(taskEntry.requirement_ids)
    ? taskEntry.requirement_ids.map((value) => String(value))
    : [];
  const mappingWouldChange =
    (featureId && String(taskEntry.feature_id || '') !== featureId) ||
    (requirementId && !currentRequirements.includes(requirementId));
  if (logicalTask && logicalTask.occurrence_count > 1 && mappingWouldChange) {
    errors.push(
      `Task ${taskId} occurs in ${logicalTask.occurrence_count} linked worktrees. ` +
        'A single-worktree mapping change would create divergent task facts; resolve to one ' +
        'writable occurrence or update every occurrence as one coordinated edit.'
    );
    return { ok: false, errors, actions };
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

function collectMilestonesFromAllWorktrees(repoRoot) {
  const rows = [];
  for (const worktree of listGitWorktrees(repoRoot)) {
    const registry = loadRegistry(worktree.path).registry;
    if (!registry || !Array.isArray(registry.milestones)) continue;
    for (const milestone of registry.milestones) {
      if (!milestone || typeof milestone !== 'object') continue;
      const id = String(milestone.id || '').trim();
      const title = String(milestone.title || '').trim();
      if (!MILESTONE_ID_RE.test(id)) continue;
      rows.push({ ...milestone, id, title });
    }
  }
  return rows;
}

export function cmdMilestone({ repoRoot, title, description, dryRun, apply, json }) {
  const errors = [];
  const actions = [];
  const normalizedTitle = normalizeFeatureTitle(title);
  if (!normalizedTitle) {
    return { ok: false, errors: ['Missing --title for milestone resolution.'], actions };
  }

  const loaded = loadRegistry(repoRoot);
  if (!loaded.registry) {
    return {
      ok: false,
      errors: [`Failed to load registry: ${loaded.error || 'registry not found'}`],
      actions,
    };
  }
  errors.push(...getRegistryLayoutErrors(loaded.registry));
  if (errors.length > 0) return { ok: false, errors, actions };

  const allMilestones = collectMilestonesFromAllWorktrees(repoRoot);
  const titlesById = new Map();
  for (const milestone of allMilestones) {
    const titles = titlesById.get(milestone.id) || new Set();
    titles.add(normalizeFeatureTitle(milestone.title));
    titlesById.set(milestone.id, titles);
  }
  for (const [id, titles] of titlesById) {
    if (titles.size > 1) {
      errors.push(`Milestone ID ${id} has different titles across linked worktrees.`);
    }
  }
  if (errors.length > 0) return { ok: false, errors, actions };

  const titleMatches = allMilestones.filter(
    (milestone) => normalizeFeatureTitle(milestone.title) === normalizedTitle
  );
  const matchingIds = [...new Set(titleMatches.map((milestone) => milestone.id))];
  if (matchingIds.length > 1) {
    return {
      ok: false,
      errors: [
        `Milestone title "${title}" maps to multiple IDs across linked worktrees: ` +
          `${matchingIds.join(', ')}.`,
      ],
      actions,
    };
  }

  const registry = loaded.registry;
  if (!Array.isArray(registry.milestones)) registry.milestones = [];
  let milestone = null;
  let created = false;

  if (matchingIds.length === 1) {
    const id = matchingIds[0];
    milestone = registry.milestones.find((item) => item && item.id === id) || null;
    if (!milestone) {
      const source = titleMatches[0];
      milestone = {
        id,
        title: source.title,
        status: MILESTONE_STATUS.has(String(source.status || '')) ? source.status : 'planned',
        description: String(source.description || description || '').trim(),
      };
      registry.milestones.push(milestone);
      actions.push({ op: 'copy', target: 'milestone', id, note: 'found in linked worktree' });
    }
  } else {
    let max = 0;
    for (const id of titlesById.keys()) {
      const number = Number(id.slice(2));
      if (Number.isFinite(number) && number > max) max = number;
    }
    if (max >= 999) {
      return { ok: false, errors: ['Exhausted milestone IDs (M-001..M-999).'], actions };
    }
    const id = `M-${String(max + 1).padStart(3, '0')}`;
    milestone = {
      id,
      title: String(title).trim().replace(/\s+/g, ' '),
      status: 'planned',
      description: String(description || '').trim(),
    };
    registry.milestones.push(milestone);
    actions.push({ op: 'create', target: 'milestone', id });
    created = true;
  }

  registry.milestones.sort((left, right) =>
    String(left?.id || '').localeCompare(String(right?.id || ''))
  );
  if (apply && !dryRun && actions.length > 0) {
    writeTextIfChanged(loaded.path, renderJson(registry));
  }

  const result = {
    id: milestone.id,
    title: milestone.title,
    status: String(milestone.status || 'planned'),
    created,
    changed: actions.length > 0,
    mode: apply && !dryRun ? 'apply' : 'dry-run',
  };
  if (json) console.log(JSON.stringify(result));
  else if (actions.length === 0) ok(`[ok] Milestone ${milestone.id} already exists: ${milestone.title}`);
  else if (apply && !dryRun) ok(`[ok] Milestone ${milestone.id} is available: ${milestone.title}`);
  else info(`[dry-run] Milestone ${milestone.id} would be available: ${milestone.title}`);

  return { ok: true, errors, actions, milestone: result };
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

export function cmdFeature({ repoRoot, title, description, dryRun, apply, json }) {
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
  errors.push(...getRegistryLayoutErrors(loaded.registry));
  if (errors.length > 0) return { ok: false, errors, actions };

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

export function cmdRequirement({ repoRoot, title, featureId, description, dryRun, apply, json }) {
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
  errors.push(...getRegistryLayoutErrors(loaded.registry));
  if (errors.length > 0) return { ok: false, errors, actions };

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

/**
 * Mutating project-governance operations.
 *
 * Callers choose dry-run or apply mode; all repository writes and allocation locks live here.
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  FEATURE_ID_RE,
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
  renderDashboardProjection,
  renderFeatureMap,
  runGit,
  scanTasks,
  taskIdsFromAllBranches,
  taskIdsFromAllWorktrees,
  toPosix,
} from './governance-read.mjs';
import { getRegistryDataErrors } from './governance-lint.mjs';

const ok = (message) => console.log(message);
const info = (message) => console.log(message);
const header = (message) => console.log(message);

function getTaskRowErrors(repoRoot, taskId = null) {
  return getTaskRowErrorsFromRows(queryTasks({ repoRoot, id: taskId }));
}

function getTaskRowErrorsFromRows(tasks) {
  const errors = [];
  for (const task of tasks) {
    if (task.id && task.conflict) {
      const fields = task.conflicts.map((conflict) => conflict.field).join(', ');
      const occurrences = task.worktrees
        .map((worktree) => `${worktree.worktree_branch}@${worktree.worktree_path}`)
        .join('; ');
      errors.push(
        `Cross-worktree task conflict for ${task.id} (${fields}). ` +
          `Resolve the divergent occurrences before writing: ${occurrences}.`
      );
    }
    if (task.invalid) {
      const occurrences = task.metadata_errors
        .map((entry) => `${toPosix(entry.worktree_path)}/${toPosix(entry.dev_docs_path)}`)
        .join('; ');
      errors.push(
        `Invalid cross-worktree task metadata for ${task.id || '(unknown task ID)'}. ` +
          `Repair these occurrences before writing: ${occurrences}.`
      );
    }
  }
  return errors;
}

function getRegistryWriteErrors(registry) {
  const errors = getRegistryDataErrors(registry);
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

function getSyncTaskShapeErrors(registry) {
  const errors = [];
  if (!Array.isArray(registry.tasks)) {
    return ['Registry "tasks" must be a list.'];
  }
  const seen = new Set();
  for (const task of registry.tasks) {
    if (!task || typeof task !== 'object' || Array.isArray(task)) {
      errors.push('Task entry must be a mapping.');
      continue;
    }
    const id = String(task.id || '').trim();
    if (!TASK_ID_RE.test(id)) {
      errors.push(`Task ID "${id}" does not match the required format.`);
      continue;
    }
    if (seen.has(id)) errors.push(`Duplicate Task ID "${id}" in registry.`);
    seen.add(id);
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

function replaceAutoBlock(raw, blockId, content) {
  const start = `<!-- AUTO-GENERATED:START ${blockId} -->`;
  const end = `<!-- AUTO-GENERATED:END ${blockId} -->`;
  const sIdx = raw.indexOf(start);
  const eIdx = raw.indexOf(end);
  if (sIdx === -1 || eIdx === -1 || eIdx < sIdx) {
    return null;
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

  const taskConflicts = getTaskRowErrors(repoRoot);
  if (taskConflicts.length > 0) {
    errors.push(...taskConflicts);
    return finish();
  }

  const registryPath = getRegistryPath(repoRoot);
  if (!exists(registryPath)) {
    errors.push(
      'Project hub missing. Run the repository task-system installer from its skill source.'
    );
    return finish();
  }

  const loaded = loadRegistry(repoRoot);
  if (!loaded.registry) {
    errors.push(`Failed to parse registry.json: ${loaded.error || '(unknown error)'}`);
    return finish();
  }
  const reg = loaded.registry;
  errors.push(...getSyncTaskShapeErrors(reg));
  errors.push(...collectProjectGraphFromAllWorktrees(repoRoot, { repairingRepoRoot: repoRoot }).errors);
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
  const tasksById = new Map();
  for (const t of reg.tasks) {
    tasksById.set(t.id, t);
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
      if (meta.schema_errors.length > 0) {
        errors.push(
          ...meta.schema_errors.map(
            (error) => `${toPosix(task.relPath)}: Invalid .ai-task.json: ${error}`
          )
        );
        continue;
      }
      task.taskId = meta.task_id;

      const shouldUpdate = meta.slug !== task.slug;

      if (shouldUpdate) {
        const nextMeta = {
          task_id: meta.task_id,
          slug: task.slug,
          keywords: meta.keywords,
        };
        planWrite(task.metaPath, renderTaskMetaJson(nextMeta), { op: 'update', note: 'refresh slug' });
      }
    }

    if (!task.taskId) continue;

    const previous = tasksById.get(task.taskId) || {};
    const nextStatus = effectiveStatus;
    const entry = {
      id: task.taskId,
      slug: task.slug,
      status: nextStatus,
      updated:
        /^\d{4}-\d{2}-\d{2}$/.test(String(previous.updated || '')) && previous.status === nextStatus
          ? previous.updated
          : todayStr,
      dev_docs_path: toPosix(task.relPath),
      feature_id: previous.feature_id || 'F-000',
    };

    tasksById.set(task.taskId, entry);
  }

  reg.tasks = [...tasksById.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  errors.push(...getRegistryWriteErrors(reg));
  if (errors.length > 0) return finish();
  // Write registry
  const registryOut = renderJson(reg);
  planWrite(registryPath, registryOut, { op: 'update', note: 'update registry' });

  // Derived views
  const hubDir = getHubDir(repoRoot);
  const dashboardPath = path.join(hubDir, 'dashboard.md');
  const featureMapPath = path.join(hubDir, 'feature-map.md');

  const dashboardProjection = renderDashboardProjection(reg);

  function updateDerived(filePath, blockId, content) {
    const base = readText(filePath);
    if (base === null) {
      errors.push(
        `Missing derived view file: ${toPosix(path.relative(repoRoot, filePath))} ` +
          '(run the repository task-system installer from its skill source).'
      );
      return;
    }

    const next = replaceAutoBlock(base, blockId, content);
    if (next === null) {
      errors.push(
        `Missing AUTO-GENERATED markers for "${blockId}" in ` +
          `${toPosix(path.relative(repoRoot, filePath))}. ` +
          'Restore the file from the task-system installer before retrying sync.'
      );
      return;
    }

    planWrite(filePath, next, { op: 'update', note: `regen ${blockId}` });
  }

  updateDerived(dashboardPath, 'dashboard', dashboardProjection);
  if (readText(featureMapPath) === null) {
    errors.push(
      'Missing derived view file: .ai/project/feature-map.md ' +
        '(run the repository task-system installer from its skill source).'
    );
  } else {
    planWrite(featureMapPath, renderFeatureMap(reg), { op: 'update', note: 'regen feature-map' });
  }

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

export function cmdMap({ repoRoot, taskId, featureId, dryRun, apply }) {
  const errors = [];
  const actions = [];

  if (!taskId || !TASK_ID_RE.test(taskId)) {
    errors.push(`Invalid or missing --task (expected T-###, got "${taskId || ''}").`);
    return { ok: false, errors, actions };
  }

  const taskRows = queryTasks({ repoRoot, id: taskId });
  const taskConflicts = getTaskRowErrorsFromRows(taskRows);
  if (taskConflicts.length > 0) {
    errors.push(...taskConflicts);
    return { ok: false, errors, actions };
  }
  const logicalTask = taskRows.find((task) => task.id === taskId) || null;
  if (!logicalTask) {
    errors.push(`Task bundle "${taskId}" not found under top-level dev-docs/.`);
    return { ok: false, errors, actions };
  }

  if (!FEATURE_ID_RE.test(featureId || '')) {
    errors.push(`Invalid or missing --feature (expected F-###, got "${featureId || ''}").`);
    return { ok: false, errors, actions };
  }

  const loaded = loadRegistry(repoRoot);
  if (!loaded.registry) {
    errors.push(`Failed to load registry: ${loaded.error || 'registry not found'}`);
    return { ok: false, errors, actions };
  }

  const reg = loaded.registry;
  errors.push(...getRegistryWriteErrors(reg));
  errors.push(...collectProjectGraphFromAllWorktrees(repoRoot).errors);
  if (errors.length > 0) return { ok: false, errors, actions };
  const registryPath = loaded.path;

  // Find the task in registry
  const taskEntry = reg.tasks.find((t) => t && t.id === taskId);
  if (!taskEntry) {
    errors.push(`Task "${taskId}" not found in registry. Run sync first.`);
    return { ok: false, errors, actions };
  }

  const featureExists = reg.features.some((f) => f && f.id === featureId);
  if (!featureExists) {
    errors.push(`Feature "${featureId}" not found in registry.`);
    return { ok: false, errors, actions };
  }

  const mappingWouldChange = String(taskEntry.feature_id || '') !== featureId;
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
  if (taskEntry.feature_id !== featureId) {
    changes.push(`feature_id: ${taskEntry.feature_id || '(none)'} -> ${featureId}`);
    taskEntry.feature_id = featureId;
  }

  if (changes.length === 0) {
    ok(`[ok] Task ${taskId} already has the specified mapping. No changes needed.`);
    return { ok: true, errors, actions };
  }

  taskEntry.updated = today();
  actions.push({ op: 'update', target: 'task', id: taskId, changes });

  errors.push(...getRegistryWriteErrors(reg));
  if (errors.length > 0) return { ok: false, errors, actions: [] };

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

function normalizeProjectItemField(field, value) {
  const normalized = String(value || '').trim();
  return field === 'title' ? normalized.replace(/\s+/g, ' ') : normalized;
}

function collectProjectGraphFromAllWorktrees(repoRoot, { repairingRepoRoot = null } = {}) {
  const milestones = [];
  const features = [];
  const errors = [];
  for (const worktree of listGitWorktrees(repoRoot)) {
    const loaded = loadRegistry(worktree.path);
    if (!loaded.registry) {
      if (!loaded.error) continue;
      errors.push(
        `Cannot read project registry in linked worktree ${toPosix(worktree.path)}: ` +
          `${loaded.error}.`
      );
      continue;
    }
    const canRepairTaskProjections =
      repairingRepoRoot && path.resolve(worktree.path) === path.resolve(repairingRepoRoot);
    const registryErrors = getRegistryDataErrors(loaded.registry, {
      validateTasks: !canRepairTaskProjections,
    });
    if (registryErrors.length > 0) {
      errors.push(
        ...registryErrors.map(
          (error) => `Linked worktree ${toPosix(worktree.path)} has invalid registry data: ${error}`
        )
      );
      continue;
    }
    const registry = loaded.registry;
    for (const milestone of registry.milestones) {
      milestones.push({
        ...milestone,
        id: String(milestone.id).trim(),
        title: String(milestone.title || '').trim(),
        worktree_path: worktree.path,
        worktree_branch: worktree.branch,
      });
    }
    for (const feature of registry.features) {
      features.push({
        ...feature,
        id: String(feature.id).trim(),
        title: String(feature.title || '').trim(),
        worktree_path: worktree.path,
        worktree_branch: worktree.branch,
      });
    }
  }
  for (const [label, rows, fields] of [
    ['Milestone', milestones, ['title', 'status', 'description']],
    ['Feature', features, ['title', 'milestone_id', 'status', 'description']],
  ]) {
    const rowsById = new Map();
    for (const row of rows) {
      const grouped = rowsById.get(row.id) || [];
      grouped.push(row);
      rowsById.set(row.id, grouped);
    }
    for (const [id, grouped] of rowsById) {
      const differing = fields.filter(
        (field) =>
          new Set(grouped.map((row) => normalizeProjectItemField(field, row[field]))).size > 1
      );
      if (differing.length > 0) {
        errors.push(
          `${label} ID ${id} has different ${differing.join(', ')} values across linked worktrees.`
        );
      }
    }
  }
  return { milestones, features, errors };
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
  errors.push(...getRegistryWriteErrors(loaded.registry));
  const projectGraph = collectProjectGraphFromAllWorktrees(repoRoot);
  errors.push(...projectGraph.errors);
  if (errors.length > 0) return { ok: false, errors, actions };

  const allMilestones = projectGraph.milestones;
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
        status: source.status,
        description: String(source.description || '').trim(),
      };
      registry.milestones.push(milestone);
      actions.push({ op: 'copy', target: 'milestone', id, note: 'found in linked worktree' });
    }
  } else {
    let max = 0;
    for (const row of allMilestones) {
      const number = Number(row.id.slice(2));
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
  errors.push(...getRegistryWriteErrors(registry));
  if (errors.length > 0) return { ok: false, errors, actions: [] };
  if (apply && !dryRun && actions.length > 0) {
    writeTextIfChanged(loaded.path, renderJson(registry));
  }

  const result = {
    id: milestone.id,
    title: milestone.title,
    description: String(milestone.description || ''),
    status: milestone.status,
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
  errors.push(...getRegistryWriteErrors(loaded.registry));
  if (errors.length > 0) return { ok: false, errors, actions };

  const projectGraph = collectProjectGraphFromAllWorktrees(repoRoot);
  errors.push(...projectGraph.errors);
  if (errors.length > 0) return { ok: false, errors, actions };

  const allFeatures = projectGraph.features;
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
        milestone_id: String(source.milestone_id),
        status: source.status,
        description: String(source.description || '').trim(),
      };
      if (!registry.milestones.some((item) => item && item.id === feature.milestone_id)) {
        return {
          ok: false,
          errors: [
            `Feature ${id} belongs to Milestone ${feature.milestone_id}, which is not present in ` +
              'the current registry. Resolve that Milestone first.',
          ],
          actions: [],
        };
      }
      registry.features.push(feature);
      actions.push({ op: 'copy', target: 'feature', id, note: 'found in linked worktree' });
    }
  } else {
    let max = 0;
    for (const row of allFeatures) {
      const n = Number(row.id.slice(2));
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

  errors.push(...getRegistryWriteErrors(registry));
  if (errors.length > 0) return { ok: false, errors, actions: [] };

  if (apply && !dryRun && actions.length > 0) {
    writeTextIfChanged(loaded.path, renderJson(registry));
  }

  const result = {
    id: feature.id,
    title: feature.title,
    description: String(feature.description || ''),
    milestone_id: String(feature.milestone_id || ''),
    status: feature.status,
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

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
  canonicalPath,
  exists,
  getBundleStatusFromStatusDoc,
  getHubDir,
  getRegistryPath,
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
import { readProjectGraph } from './governance-project-read.mjs';

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

/**
 * Local branch tips whose committed tree still contains a bundle for this task ID. Identity is
 * the `.ai-task.json` task_id — never the registry path or slug, both of which can be renamed on
 * a branch nobody has checked out. Returns null when any evidence is unreadable or any candidate
 * metadata cannot be parsed, so callers stay fail-closed.
 */
function findTaskBranchTips(repoRoot, taskId) {
  if (!TASK_ID_RE.test(String(taskId || ''))) return null;
  const refsRaw = runGit(repoRoot, [
    'for-each-ref',
    'refs/heads',
    '--format=%(refname:short)%00%(objectname)',
  ]);
  if (refsRaw === null) return null;

  const tips = [];
  for (const line of normalizeEol(refsRaw).split('\n')) {
    if (!line.trim()) continue;
    const [name, sha] = line.split('\u0000');
    if (!name || !sha) return null;
    const treeRaw = runGit(repoRoot, [
      'ls-tree',
      '-r',
      sha,
      '--',
      'dev-docs/active',
      'dev-docs/archive',
    ]);
    if (treeRaw === null) return null;
    for (const entry of normalizeEol(treeRaw).split('\n')) {
      if (!entry.trim()) continue;
      const match = entry.match(
        /^\S+ \S+ (\S+)\tdev-docs\/(?:active|archive)\/([^/]+)\/\.ai-task\.json$/
      );
      if (!match) continue;
      const blobRaw = runGit(repoRoot, ['cat-file', 'blob', match[1]]);
      if (blobRaw === null) return null;
      // Branch-tip evidence must satisfy the exact metadata schema and agree with its bundle
      // directory. Schema drift is unverifiable evidence, never "this task does not exist".
      const meta = parseTaskMeta(blobRaw);
      if (meta.parse_error || meta.schema_errors.length > 0) return null;
      if (meta.slug !== match[2]) return null;
      if (meta.task_id === taskId) {
        tips.push(name);
        break;
      }
    }
  }
  return tips;
}

export function cmdSync({ repoRoot, dryRun, apply, prune = false, taskId = null }) {
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
      console.log('Errors:');
      for (const error of errors) console.log(`- ${error}`);
    }
    if (warnings.length > 0) {
      console.log('Warnings:');
      for (const warning of warnings) console.log(`- ${warning}`);
    }
    if (succeeded) console.log('[ok] Sync complete.');
    else console.log('[error] Sync failed.');

    for (const action of actions) {
      const mode = action.mode ? ` (${action.mode})` : '';
      const note = action.note ? ` (${action.note})` : '';
      console.log(`  ${action.op}: ${toPosix(path.relative(repoRoot, action.path))}${note}${mode}`);
    }
    return { ok: succeeded, errors, warnings, actions };
  };

  if (taskId && !TASK_ID_RE.test(taskId)) {
    errors.push(`Invalid --task (expected T-###, got "${taskId}").`);
    return finish();
  }
  if (taskId && prune) {
    errors.push('Scoped sync cannot prune registry tasks.');
    return finish();
  }

  const queriedTasks = queryTasks(taskId ? { repoRoot, id: taskId } : { repoRoot });
  const taskConflicts = getTaskRowErrorsFromRows(queriedTasks);
  if (taskConflicts.length > 0) {
    errors.push(...taskConflicts);
    return finish();
  }
  if (taskId) {
    const selected = queriedTasks.find((task) => task.id === taskId);
    const currentWorktree = canonicalPath(repoRoot);
    const staleHere = selected?.stale_worktrees?.some(
      (occurrence) => canonicalPath(occurrence.worktree_path) === currentWorktree
    );
    if (staleHere) {
      errors.push(
        `Task "${taskId}" has a newer occurrence in another linked worktree. ` +
          'Recover there or update this worktree before scoped sync.'
      );
      return finish();
    }
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
  const projectGraph = readProjectGraph({ repoRoot, repairingRepoRoot: repoRoot });
  errors.push(...projectGraph.errors);
  if (errors.length > 0) return finish();

  const tasks = scanTasks(repoRoot);
  let tasksToSync = tasks;
  if (taskId) {
    tasksToSync = tasks.filter((task) => {
      const raw = readText(task.metaPath);
      if (raw === null) return false;
      const meta = parseTaskMeta(raw);
      return meta.parse_error === null && meta.schema_errors.length === 0 && meta.task_id === taskId;
    });
    if (tasksToSync.length === 0) {
      errors.push(
        `Task "${taskId}" has no valid bundle in this worktree. Repair its identity before scoped sync.`
      );
      return finish();
    }
    if (tasksToSync.length > 1) {
      errors.push(`Task "${taskId}" appears in multiple bundles in this worktree.`);
      return finish();
    }
  }

  let allocateTaskId = null;
  let worktreeBundleIds = new Set();
  if (!taskId) {
    const existingIds = new Set();
    for (const task of tasks) {
      const raw = readText(task.metaPath);
      if (raw === null) continue;
      existingIds.add(parseTaskMeta(raw).task_id);
    }
    for (const task of reg.tasks) existingIds.add(task.id);
    for (const id of taskIdsFromAllBranches(repoRoot)) existingIds.add(id);

    // Include valid, uncommitted metadata from linked worktrees while holding the shared lock.
    worktreeBundleIds = new Set(taskIdsFromAllWorktrees(repoRoot));
    for (const id of worktreeBundleIds) existingIds.add(id);

    allocateTaskId = () => {
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
    };
  }

  const todayStr = today();

  // Build/refresh registry tasks
  const tasksById = new Map();
  const diskIds = new Set();
  for (const t of reg.tasks) {
    tasksById.set(t.id, t);
  }

  for (const task of tasksToSync) {
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
      if (!allocateTaskId) {
        errors.push(`${toPosix(task.relPath)}: Scoped sync cannot allocate a missing task ID.`);
        continue;
      }
      const id = allocateTaskId();
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
    diskIds.add(task.taskId);

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

  const prunedIds = [];
  if (prune) {
    for (const id of [...tasksById.keys()]) {
      if (diskIds.has(id)) continue;
      if (worktreeBundleIds.has(id)) {
        warnings.push(
          `Registry task ${id} has no bundle in this worktree but its bundle exists in a linked ` +
            'worktree; not pruned.'
        );
        continue;
      }
      // "Absent from every linked worktree" does not prove the task left the repository: the
      // bundle can still live on a branch nobody has checked out. Verify every local branch tip
      // by stable task ID and refuse to prune on surviving or unverifiable evidence.
      const branchTips = findTaskBranchTips(repoRoot, id);
      if (branchTips === null) {
        warnings.push(
          `Registry task ${id}: branch-tip evidence could not be verified; not pruned.`
        );
        continue;
      }
      if (branchTips.length > 0) {
        warnings.push(
          `Registry task ${id} has no bundle in any linked worktree but its bundle exists at ` +
            `branch tip(s): ${branchTips.join(', ')}; not pruned.`
        );
        continue;
      }
      tasksById.delete(id);
      prunedIds.push(id);
    }
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
    for (const id of prunedIds) {
      actions.push({
        op: 'prune',
        path: registryPath,
        note: `remove orphaned registry task ${id}`,
        mode: apply && !dryRun ? '' : 'dry-run',
      });
    }
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
  const projectGraph = readProjectGraph({ repoRoot });
  errors.push(...projectGraph.errors);
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

  // A mapping is a semantic decision about one task, so it stays fail-closed while the task has
  // multiple checked-out copies: a single-worktree remap would silently create divergent facts.
  const mappingWouldChange = String(taskEntry.feature_id || '') !== featureId;
  if (logicalTask.occurrence_count > 1 && mappingWouldChange) {
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
    console.log(`[ok] Task ${taskId} already has the specified mapping. No changes needed.`);
    return { ok: true, errors, actions };
  }

  taskEntry.updated = today();
  actions.push({ op: 'update', target: 'task', id: taskId, changes });

  errors.push(...getRegistryWriteErrors(reg));
  if (errors.length > 0) return { ok: false, errors, actions: [] };

  if (dryRun || !apply) {
    console.log('Planned changes:');
    for (const a of actions) {
      const changesStr = a.changes ? `: ${a.changes.join(', ')}` : '';
      const noteStr = a.note ? ` (${a.note})` : '';
      console.log(`  ${a.op} ${a.target} ${a.id}${changesStr}${noteStr}`);
    }
    console.log('(dry-run mode; use --apply to write changes)');
    return { ok: true, errors, actions };
  }

  // Write registry
  const registryOut = renderJson(reg);
  const changed = writeTextIfChanged(registryPath, registryOut);
  if (changed) {
    actions.push({ op: 'write', path: registryPath });
  }

  console.log(`[ok] Mapped ${taskId}:`);
  for (const c of changes) console.log(`  - ${c}`);

  return { ok: true, errors, actions };
}

function normalizeFeatureTitle(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();
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
  const projectGraph = readProjectGraph({ repoRoot });
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
        description: source.description,
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
  else if (actions.length === 0) console.log(`[ok] Milestone ${milestone.id} already exists: ${milestone.title}`);
  else if (apply && !dryRun) console.log(`[ok] Milestone ${milestone.id} is available: ${milestone.title}`);
  else console.log(`[dry-run] Milestone ${milestone.id} would be available: ${milestone.title}`);

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

  const projectGraph = readProjectGraph({ repoRoot });
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
        description: source.description,
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
  else if (actions.length === 0) console.log(`[ok] Feature ${feature.id} already exists: ${feature.title}`);
  else if (apply && !dryRun) console.log(`[ok] Feature ${feature.id} is available: ${feature.title}`);
  else console.log(`[dry-run] Feature ${feature.id} would be available: ${feature.title}`);

  return { ok: true, errors, actions, feature: result };
}

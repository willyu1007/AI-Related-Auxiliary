/**
 * Read-only project-governance primitives and commands.
 *
 * This module may inspect repository files, Git history, and linked worktrees,
 * but it must not create directories, acquire write locks, or modify state.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const RESUME_DEFAULT_COMMIT_LIMIT = 3;
export const RESUME_MAX_COMMIT_LIMIT = 20;
export const RESUME_DEFAULT_SCAN_LIMIT = 500;
export const RESUME_MAX_SCAN_LIMIT = 10000;

const RESUME_MAX_CANDIDATES = 20;
const RESUME_TEXT_LIMITS = Object.freeze({
  short: 256,
  text: 500,
  path: 1024,
  commitSubject: 240,
  commitMetadata: 300,
  warning: 500,
});

export const TASK_ID_RE = /^T-\d{3}$/;
export const MILESTONE_ID_RE = /^M-\d{3}$/;
export const FEATURE_ID_RE = /^F-\d{3}$/;
export const REQUIREMENT_ID_RE = /^R-\d{3}$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const TASK_STATUS = new Set(['planned', 'in-progress', 'blocked', 'done', 'archived']);
const BUNDLE_STATUS = new Set(['planned', 'in-progress', 'blocked', 'done']);
export const MILESTONE_STATUS = new Set(['planned', 'in-progress', 'blocked', 'done']);
export const FEATURE_STATUS = new Set(['planned', 'in-progress', 'blocked', 'done', 'cut']);
export const REQUIREMENT_STATUS = new Set(['planned', 'in-progress', 'blocked', 'done', 'cut']);

const IGNORE_DIRS = new Set([
  '.git',
  '.hg',
  '.svn',
  'node_modules',
  '.ai',
  '.codex',
  '.claude',
  '.cursor',
  '.next',
  'dist',
  'build',
  'coverage',
]);

export function toPosix(value) {
  return String(value).replace(/\\/g, '/');
}

export function normalizeEol(value) {
  return String(value || '').replace(/\r\n/g, '\n');
}

export function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

export function exists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

export function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    if (exists(path.join(dir, '.ai', 'project', 'AGENTS.md'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function getHubDir(repoRoot) {
  return path.join(repoRoot, '.ai', 'project');
}

export function getRegistryPath(repoRoot) {
  return path.join(getHubDir(repoRoot), 'registry.json');
}

function listImmediateChildDirs(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort((a, b) => a.localeCompare(b));
}

export function getBundleStatusFromStatusDoc(statusRaw, statusPath = '01-status.md') {
  const lines = normalizeEol(statusRaw).split('\n');
  let inProgress = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      if (/^##\s+Progress\s*$/i.test(trimmed)) {
        inProgress = true;
        continue;
      }
      if (inProgress && /^##\s+/.test(trimmed)) break;
    }
    if (!inProgress) continue;

    const match = trimmed.match(/^\-\s*State\s*:\s*(.+)\s*$/i);
    if (!match) continue;
    const value = String(match[1] || '').trim();
    if (value.includes('|')) {
      return { status: null, error: 'State must be a single value (not an enum hint).' };
    }
    if (!BUNDLE_STATUS.has(value)) {
      const hint = BUNDLE_STATUS.has(value.toLowerCase()) ? ' (status values must be lowercase)' : '';
      return {
        status: null,
        error: `Invalid State value: "${value}". Allowed: ${[...BUNDLE_STATUS].join(', ')}${hint}`,
      };
    }
    return { status: value, error: null };
  }

  return {
    status: null,
    error: `Missing "## Progress" / "- State: <status>" in ${toPosix(statusPath)}.`,
  };
}

export function getMarkdownSectionLines(markdownRaw, heading) {
  const lines = normalizeEol(markdownRaw).split('\n');
  const target = String(heading || '').trim().toLowerCase();
  const result = [];
  let inSection = false;

  for (const line of lines) {
    const match = line.trim().match(/^##\s+(.+?)\s*$/);
    if (match) {
      if (inSection) break;
      inSection = String(match[1] || '').trim().toLowerCase() === target;
      continue;
    }
    if (inSection) result.push(line);
  }
  return result;
}

export function cleanMarkdownValue(value) {
  return String(value || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .trim();
}

function createResumeTextLimiter() {
  const fields = [];

  function mark(field) {
    if (!fields.includes(field)) fields.push(field);
  }

  function text(value, maxChars, field) {
    if (value === null || value === undefined) return value;
    const raw = String(value);
    if (raw.length <= maxChars) return raw;
    mark(field);
    return `${raw.slice(0, Math.max(0, maxChars - 1))}…`;
  }

  return { fields, mark, text };
}

function getMarkdownSectionText(markdownRaw, heading) {
  return cleanMarkdownValue(getMarkdownSectionLines(markdownRaw, heading).join('\n'));
}

function getMarkdownListField(markdownRaw, heading, field) {
  const target = String(field || '').trim().toLowerCase();
  for (const line of getMarkdownSectionLines(markdownRaw, heading)) {
    const match = line.trim().match(/^\-\s*([^:]+)\s*:\s*(.*)$/);
    if (!match || String(match[1] || '').trim().toLowerCase() !== target) continue;
    return cleanMarkdownValue(match[2] || '');
  }
  return '';
}

function getPitfallTableItems(markdownRaw, limit) {
  const items = [];
  let headerSeen = false;

  for (const line of normalizeEol(markdownRaw).split('\n')) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) continue;
    const cells = trimmed
      .slice(1, -1)
      .split('|')
      .map((cell) => cleanMarkdownValue(cell));
    if (cells[0]?.toLowerCase() === 'hazard') {
      headerSeen = true;
      continue;
    }
    if (!headerSeen || cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    const hazard = cells[0];
    const prevention = cells[2];
    if (!hazard || hazard.includes('<!--')) continue;
    items.push(prevention ? `${hazard} — ${prevention}` : hazard);
    if (items.length >= limit) break;
  }
  return items;
}

function getMarkdownChecklistStats(markdownRaw, heading) {
  let total = 0;
  let checked = 0;
  for (const line of getMarkdownSectionLines(markdownRaw, heading)) {
    const match = line.trim().match(/^\-\s*\[(x|X|\s)\]\s+(.+)$/);
    if (!match) continue;
    total += 1;
    if (String(match[1]).toLowerCase() === 'x') checked += 1;
  }
  return { total, checked };
}

export function getRoadmapKickoff(roadmapRaw) {
  const status = getMarkdownListField(roadmapRaw, 'Kickoff gate', 'Status').toLowerCase();
  return {
    status: status === 'pending' || status === 'ready' ? status : '',
    rawStatus: status,
    ...getMarkdownChecklistStats(roadmapRaw, 'Kickoff gate'),
  };
}

export function getCompletionCriteriaStats(statusRaw) {
  const lines = normalizeEol(statusRaw).split('\n');
  let inCompletion = false;
  let total = 0;
  let checked = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      if (/^##\s+Done when\b/i.test(trimmed)) {
        inCompletion = true;
        continue;
      }
      if (inCompletion && /^##\s+/.test(trimmed)) break;
    }
    if (!inCompletion) continue;
    const match = trimmed.match(/^\-\s*\[(x|X|\s)\]\s+(.+)$/);
    if (!match) continue;
    total += 1;
    if (String(match[1]).toLowerCase() === 'x') checked += 1;
  }
  return { total, checked };
}

export function statusRank(status) {
  switch (status) {
    case 'planned': return 10;
    case 'in-progress':
    case 'blocked': return 20;
    case 'done': return 30;
    case 'archived': return 40;
    default: return 0;
  }
}

export function formatTaskRef(task) {
  return `${task.taskId || '(no-id)'} ${task.slug} (${task.phase}) @ ${toPosix(task.relPath)}`;
}

export function discoverDevDocsRoots(repoRoot) {
  const roots = [];
  const stack = [repoRoot];

  while (stack.length > 0) {
    const dir = stack.pop();
    const base = path.basename(dir);
    if (IGNORE_DIRS.has(base)) continue;
    if (base.startsWith('.') && dir !== repoRoot) continue;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      if (entry.name === 'dev-docs') {
        if (exists(path.join(full, 'active')) || exists(path.join(full, 'archive'))) {
          roots.push(full);
          continue;
        }
      }
      if (IGNORE_DIRS.has(entry.name) || entry.name.startsWith('.')) continue;
      stack.push(full);
    }
  }

  return [...new Set(roots.map((root) => path.resolve(root)))].sort((a, b) => a.localeCompare(b));
}

export function loadRegistry(repoRoot) {
  const registryPath = getRegistryPath(repoRoot);
  const raw = readText(registryPath);
  if (raw === null) return { path: registryPath, registry: null, error: null };
  if (!raw.trim()) return { path: registryPath, registry: null, error: 'registry.json is empty.' };

  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Registry root must be a JSON object.');
    }
    return { path: registryPath, registry: parsed, error: null };
  } catch (error) {
    return { path: registryPath, registry: null, error: error.message || String(error) };
  }
}

function isPathInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
}

export function resolveConfiguredRoots(repoRoot, registry) {
  const configured = registry?.task_doc_roots;
  if (configured === undefined) return { configured: false, roots: [], errors: [] };
  if (!Array.isArray(configured)) {
    return { configured: true, roots: [], errors: ['Registry task_doc_roots must be a list.'] };
  }
  if (configured.length === 0) return { configured: false, roots: [], errors: [] };

  const errors = [];
  const roots = [];
  let realRepoRoot = null;
  try {
    realRepoRoot = fs.realpathSync(repoRoot);
  } catch {
    // Lexical containment still protects a repository that cannot be resolved.
  }

  for (const entry of configured) {
    if (typeof entry !== 'string' || !entry.trim()) {
      errors.push('Registry task_doc_roots entries must be non-empty relative paths.');
      continue;
    }
    const value = entry.trim();
    if (path.isAbsolute(value)) {
      errors.push(`Registry task_doc_root must be relative to the repository: "${value}".`);
      continue;
    }
    const resolved = path.resolve(repoRoot, value);
    if (!isPathInside(repoRoot, resolved)) {
      errors.push(`Registry task_doc_root escapes the repository: "${value}".`);
      continue;
    }
    if (realRepoRoot && exists(resolved)) {
      try {
        if (!isPathInside(realRepoRoot, fs.realpathSync(resolved))) {
          errors.push(`Registry task_doc_root resolves outside the repository: "${value}".`);
          continue;
        }
      } catch {
        errors.push(`Registry task_doc_root cannot be resolved: "${value}".`);
        continue;
      }
    }
    roots.push(resolved);
  }

  return { configured: true, roots: [...new Set(roots)], errors };
}

function getFeatureMilestoneMap(registry) {
  return new Map(
    (Array.isArray(registry?.features) ? registry.features : [])
      .filter((feature) => feature && typeof feature === 'object')
      .map((feature) => [String(feature.id || ''), String(feature.milestone_id || '')])
  );
}

function resolveDevDocsRoots(repoRoot, registry = null) {
  const resolved = resolveConfiguredRoots(repoRoot, registry);
  if (resolved.errors.length > 0) throw new Error(resolved.errors.join(' '));
  return resolved.configured ? resolved.roots : discoverDevDocsRoots(repoRoot);
}

function resolveTaskStatusDoc(taskDir) {
  return path.join(taskDir, '01-status.md');
}

function resolveTaskRoadmapDoc(taskDir) {
  return path.join(taskDir, '00-roadmap.md');
}

function resolveTaskPitfallsDoc(taskDir) {
  return path.join(taskDir, 'pitfalls.md');
}

export function scanTasks(repoRoot, devDocsRoots) {
  const tasks = [];
  for (const root of devDocsRoots) {
    for (const phase of ['active', 'archive']) {
      const phaseDir = path.join(root, phase);
      for (const slug of listImmediateChildDirs(phaseDir)) {
        const taskDir = path.join(phaseDir, slug);
        tasks.push({
          root,
          phase,
          slug,
          absPath: taskDir,
          relPath: path.relative(repoRoot, taskDir),
          statusPath: resolveTaskStatusDoc(taskDir),
          roadmapPath: resolveTaskRoadmapDoc(taskDir),
          metaPath: path.join(taskDir, '.ai-task.json'),
        });
      }
    }
  }
  return tasks.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

export function parseTaskMeta(metaRaw) {
  let parsed;
  try {
    parsed = JSON.parse(metaRaw);
  } catch (error) {
    return {
      version: null,
      task_id: '',
      slug: '',
      status: '',
      updated: '',
      keywords: [],
      parse_error: error?.message || String(error),
    };
  }
  const map = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  return {
    version: Number.isFinite(map.version) ? map.version : null,
    task_id: String(map.task_id || map.taskId || ''),
    slug: String(map.slug || ''),
    status: String(map.status || ''),
    updated: String(map.updated || ''),
    keywords: Array.isArray(map.keywords) ? map.keywords.map((value) => String(value)) : [],
    parse_error: null,
  };
}

function formatJsonLines(rows) {
  for (const row of rows) console.log(JSON.stringify(row));
}

function collectBundleTaskRows({ repoRoot, registry = undefined }) {
  const resolvedRegistry = registry === undefined ? loadRegistry(repoRoot).registry : registry;
  const roots = resolveDevDocsRoots(repoRoot, resolvedRegistry);
  const rows = [];

  for (const task of scanTasks(repoRoot, roots)) {
    const statusRaw = readText(task.statusPath);
    const roadmapRaw = readText(task.roadmapPath);
    const metaRaw = readText(task.metaPath);
    const effectiveStatus = task.phase === 'archive'
      ? 'archived'
      : (() => {
          if (!statusRaw) return '';
          return getBundleStatusFromStatusDoc(statusRaw, path.basename(task.statusPath)).status || '';
        })();

    let taskId = '';
    let keywords = [];
    if (metaRaw) {
      const meta = parseTaskMeta(metaRaw);
      if (TASK_ID_RE.test(meta.task_id)) taskId = meta.task_id;
      keywords = Array.isArray(meta.keywords) ? meta.keywords : [];
    }

    rows.push({
      id: taskId,
      status: effectiveStatus,
      slug: task.slug,
      dev_docs_path: toPosix(task.relPath),
      updated: '',
      goal: getMarkdownSectionText(statusRaw, 'Goal'),
      keywords: keywords.map((keyword) => String(keyword)),
      meta_missing: !metaRaw,
      status_missing: !statusRaw,
      status_doc_path: toPosix(path.relative(repoRoot, task.statusPath)),
      roadmap_path: toPosix(path.relative(repoRoot, task.roadmapPath)),
      kickoff_status: getRoadmapKickoff(roadmapRaw).status || 'unknown',
    });
  }

  return rows.sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
}

function collectAllWorktreeTaskOccurrences(repoRoot) {
  const rows = [];
  for (const worktree of listGitWorktrees(repoRoot)) {
    const registry = loadRegistry(worktree.path).registry;
    const featureMilestones = getFeatureMilestoneMap(registry);
    const registryTasks = new Map(
      (Array.isArray(registry?.tasks) ? registry.tasks : [])
        .filter((task) => task && typeof task === 'object' && TASK_ID_RE.test(String(task.id || '')))
        .map((task) => [String(task.id), task])
    );

    for (const task of collectBundleTaskRows({ repoRoot: worktree.path, registry })) {
      const projection = registryTasks.get(task.id) || {};
      rows.push({
        feature_id: String(projection.feature_id || ''),
        requirement_ids: Array.isArray(projection.requirement_ids)
          ? projection.requirement_ids.map((value) => String(value))
          : [],
        milestone_id: featureMilestones.get(String(projection.feature_id || '')) || '',
        title: String(projection.title || ''),
        ...task,
        worktree_path: toPosix(worktree.path),
        worktree_branch: worktree.branch,
      });
    }
  }

  return rows.sort((a, b) => {
    const byId = String(a.id || '').localeCompare(String(b.id || ''));
    return byId || String(a.worktree_path || '').localeCompare(String(b.worktree_path || ''));
  });
}

const QUERY_FACT_FIELDS = [
  'status',
  'slug',
  'dev_docs_path',
  'feature_id',
  'requirement_ids',
  'milestone_id',
  'title',
  'updated',
  'goal',
  'keywords',
  'meta_missing',
  'status_missing',
  'status_doc_path',
  'roadmap_path',
  'kickoff_status',
];

function normalizeQueryFact(field, value) {
  if (field === 'keywords' || field === 'requirement_ids') {
    return [...new Set(Array.isArray(value) ? value.map((item) => String(item)) : [])].sort();
  }
  return value === undefined ? null : value;
}

function mergeTaskOccurrences(repoRoot, rows) {
  const groups = new Map();
  for (const row of rows) {
    const id = String(row.id || '');
    const key = TASK_ID_RE.test(id)
      ? `task:${id}`
      : `occurrence:${row.worktree_path}\u0000${row.dev_docs_path}`;
    const group = groups.get(key) || [];
    group.push(row);
    groups.set(key, group);
  }

  const currentRoot = path.resolve(repoRoot);
  const merged = [];
  for (const group of groups.values()) {
    const ordered = group.slice().sort((left, right) => {
      const leftCurrent = path.resolve(left.worktree_path) === currentRoot ? 0 : 1;
      const rightCurrent = path.resolve(right.worktree_path) === currentRoot ? 0 : 1;
      return leftCurrent - rightCurrent
        || String(left.worktree_path).localeCompare(String(right.worktree_path))
        || String(left.dev_docs_path).localeCompare(String(right.dev_docs_path));
    });
    const representative = ordered[0];
    const result = { id: String(representative.id || '') };
    const conflicts = [];

    for (const field of QUERY_FACT_FIELDS) {
      const values = new Map();
      for (const occurrence of ordered) {
        const value = normalizeQueryFact(field, occurrence[field]);
        const key = JSON.stringify(value);
        const entry = values.get(key) || { value, worktrees: [] };
        entry.worktrees.push({
          worktree_path: occurrence.worktree_path,
          worktree_branch: occurrence.worktree_branch,
          dev_docs_path: occurrence.dev_docs_path,
        });
        values.set(key, entry);
      }

      if (values.size === 1) {
        result[field] = [...values.values()][0].value;
      } else {
        result[field] = null;
        conflicts.push({ field, values: [...values.values()] });
      }
    }

    result.conflict = conflicts.length > 0;
    result.conflicts = conflicts;
    result.occurrence_count = ordered.length;
    result.worktrees = ordered.map((occurrence) => ({
      worktree_path: occurrence.worktree_path,
      worktree_branch: occurrence.worktree_branch,
      dev_docs_path: occurrence.dev_docs_path,
    }));
    result.worktree_path = result.conflict ? null : representative.worktree_path;
    result.worktree_branch = result.conflict ? null : representative.worktree_branch;
    merged.push(result);
  }

  return merged.sort((left, right) => {
    const byId = String(left.id || '').localeCompare(String(right.id || ''));
    return byId || String(left.dev_docs_path || '').localeCompare(String(right.dev_docs_path || ''));
  });
}

export function queryTasks({ repoRoot, id = null, status = null, text = null }) {
  function includesText(value, needle) {
    if (!needle) return true;
    return String(value || '').toLowerCase().includes(String(needle).toLowerCase());
  }

  function taskMatches(task) {
    if (id && String(task.id || '') !== id) return false;
    if (status && String(task.status || '').trim() !== status) {
      const conflict = (task.conflicts || []).find((item) => item.field === 'status');
      if (!conflict?.values.some((entry) => entry.value === status)) return false;
    }
    if (text) {
      const parts = [];
      for (const field of [
        'id', 'slug', 'title', 'description', 'goal', 'status', 'dev_docs_path',
        'feature_id', 'requirement_ids', 'milestone_id', 'worktree_path', 'worktree_branch',
      ]) {
        parts.push(String(task[field] || ''));
      }
      if (Array.isArray(task.keywords)) parts.push(task.keywords.join(' '));
      if (task.conflict) parts.push(JSON.stringify(task.conflicts));
      parts.push(JSON.stringify(task.worktrees || []));
      if (!includesText(parts.join('\n'), text)) return false;
    }
    return true;
  }

  return mergeTaskOccurrences(repoRoot, collectAllWorktreeTaskOccurrences(repoRoot)).filter(taskMatches);
}

export function cmdQuery({ repoRoot, id, status, text, json }) {
  const rows = queryTasks({ repoRoot, id, status, text });
  if (json) console.log(JSON.stringify(rows));
  else formatJsonLines(rows);
  return { ok: true, rows };
}

const ACTIVE_TASK_STATUS = new Set(['in-progress', 'blocked']);

function resolveTaskContext({ repoRoot, taskId }) {
  const rows = collectBundleTaskRows({ repoRoot }).filter((row) => TASK_ID_RE.test(String(row.id || '')));
  if (taskId) {
    const found = rows.find((row) => row.id === taskId);
    if (!found) return { ok: false, reason: 'not-found', candidates: [] };
    return { ok: true, task: found, candidates: [found] };
  }

  const inProgress = rows.filter((row) => row.status === 'in-progress');
  const pool = inProgress.length > 0 ? inProgress : rows.filter((row) => ACTIVE_TASK_STATUS.has(row.status));
  if (pool.length === 1) return { ok: true, task: pool[0], candidates: pool };
  if (pool.length === 0) return { ok: false, reason: 'none', candidates: [] };
  return { ok: false, reason: 'ambiguous', candidates: pool };
}

function taskIdsFromBranch(branch) {
  return [...new Set(String(branch || '').match(/T-\d{3}/g) || [])];
}

function resolveResumeTaskContext({ repoRoot, taskId, branch }) {
  if (taskId) return { ...resolveTaskContext({ repoRoot, taskId }), source: 'explicit', branch };

  const branchTaskIds = taskIdsFromBranch(branch);
  if (branchTaskIds.length > 1) {
    return { ok: false, reason: 'branch-ambiguous', source: 'branch', branch, branchTaskIds, candidates: [] };
  }
  if (branchTaskIds.length === 1) {
    const branchTask = resolveTaskContext({ repoRoot, taskId: branchTaskIds[0] });
    return {
      ...branchTask,
      reason: branchTask.ok ? undefined : 'branch-task-not-found',
      source: 'branch',
      branch,
      branchTaskIds,
    };
  }
  return { ...resolveTaskContext({ repoRoot, taskId: null }), source: 'active', branch };
}

function docsTrailerValue(devDocsPath) {
  const value = toPosix(String(devDocsPath || '')).replace(/\/+$/, '');
  return value ? `${value}/` : '';
}

export function runGit(repoRoot, args) {
  try {
    return execFileSync('git', args, {
      cwd: repoRoot,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  } catch {
    return null;
  }
}

export function listGitWorktrees(repoRoot) {
  const raw = runGit(repoRoot, ['worktree', 'list', '--porcelain']);
  if (!raw) return [{ path: path.resolve(repoRoot), branch: readCurrentBranch(repoRoot) }];

  const worktrees = [];
  let current = null;
  for (const line of normalizeEol(raw).split('\n')) {
    if (line.startsWith('worktree ')) {
      if (current) worktrees.push(current);
      current = { path: path.resolve(repoRoot, line.slice('worktree '.length)), branch: '(detached)' };
      continue;
    }
    if (current && line.startsWith('branch refs/heads/')) {
      current.branch = line.slice('branch refs/heads/'.length);
    }
  }
  if (current) worktrees.push(current);
  return worktrees.length > 0
    ? worktrees
    : [{ path: path.resolve(repoRoot), branch: readCurrentBranch(repoRoot) }];
}

export function taskIdsFromAllWorktrees(repoRoot) {
  const ids = new Set();
  for (const worktree of listGitWorktrees(repoRoot)) {
    const registry = loadRegistry(worktree.path).registry;
    const roots = resolveDevDocsRoots(worktree.path, registry);
    for (const task of scanTasks(worktree.path, roots)) {
      const metaRaw = readText(task.metaPath);
      if (!metaRaw) continue;
      const taskId = parseTaskMeta(metaRaw).task_id;
      if (TASK_ID_RE.test(taskId)) ids.add(taskId);
    }
  }
  return [...ids];
}

export function taskIdsFromAllBranches(repoRoot) {
  const raw = runGit(repoRoot, ['log', '--all', '--format=%B']);
  if (!raw) return [];
  const ids = new Set();
  for (const line of normalizeEol(raw).split('\n')) {
    const match = /^Task:[ \t]*(T-\d{3})[ \t]*$/.exec(line);
    if (match) ids.add(match[1]);
  }
  return [...ids];
}

function readCurrentBranch(repoRoot) {
  const raw = runGit(repoRoot, ['branch', '--show-current']);
  if (raw === null) return '';
  return raw.trim() || '(detached)';
}

function readHeadCommit(repoRoot) {
  const raw = runGit(repoRoot, ['rev-parse', '--short', 'HEAD']);
  return raw === null ? '' : raw.trim();
}

const COMMIT_FIELDS = [
  '%H', '%h', '%aI', '%an', '%s',
  '%(trailers:key=Task,valueonly,separator=%x2C)',
  '%(trailers:key=Phase,valueonly,separator=%x2C)',
  '%(trailers:key=Docs,valueonly,separator=%x2C)',
  '%(trailers:key=Verify,valueonly,separator=%x2C)',
];

function readCommitTimeline({ repoRoot, scan }) {
  const raw = runGit(repoRoot, ['log', `--max-count=${scan}`, `--format=${COMMIT_FIELDS.join('%x1f')}%x1e`]);
  if (raw === null) {
    const insideWorktree = runGit(repoRoot, ['rev-parse', '--is-inside-work-tree']);
    const head = runGit(repoRoot, ['rev-parse', '--verify', 'HEAD']);
    if (insideWorktree?.trim() === 'true' && head === null) return [];
    return null;
  }

  const records = [];
  for (const chunk of raw.split('\x1e')) {
    const line = chunk.replace(/^\n/, '');
    if (!line.trim()) continue;
    const [sha, short, date, author, subject, task, phase, docs, verify] = line.split('\x1f');
    records.push({
      commit: short || '',
      sha: sha || '',
      date: date || '',
      author: author || '',
      subject: subject || '',
      tasks: String(task || '').split(',').map((value) => value.trim()).filter(Boolean),
      phase: String(phase || '').trim(),
      docs: String(docs || '').trim(),
      verify: String(verify || '').trim(),
    });
  }
  return records;
}

function readWorktreeStatus(repoRoot, limit = 10) {
  const raw = runGit(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (raw === null) return null;
  const allEntries = raw.split('\n').map((line) => line.trimEnd()).filter((line) => line.trim());
  return {
    clean: allEntries.length === 0,
    count: allEntries.length,
    entries: allEntries.slice(0, limit),
    truncated: allEntries.length > limit,
  };
}

export function cmdTaskExists({ repoRoot, taskId }) {
  if (!TASK_ID_RE.test(taskId || '')) {
    console.error(`[error] Invalid task ID: ${taskId || '(missing)'}`);
    return { exitCode: 4 };
  }
  const result = resolveTaskContext({ repoRoot, taskId });
  if (!result.ok) {
    console.error(`[error] Task not found: ${taskId}`);
    return { exitCode: 4 };
  }
  console.log(result.task.id);
  return { exitCode: 0, task: result.task };
}

function resumeFailureExitCode(reason) {
  if (reason === 'ambiguous' || reason === 'branch-ambiguous') return 2;
  if (reason === 'none') return 3;
  if (reason === 'not-found' || reason === 'branch-task-not-found') return 4;
  return 1;
}

function resumeFailureMessage(result) {
  if (result.reason === 'branch-ambiguous') {
    return `Current branch contains multiple task IDs: ${result.branchTaskIds.join(', ')}`;
  }
  if (result.reason === 'branch-task-not-found') {
    return `Task from current branch was not found: ${result.branchTaskIds[0]}`;
  }
  if (result.reason === 'ambiguous') {
    return 'Multiple active tasks exist; pass --task <T-###> or use a branch containing one task ID.';
  }
  if (result.reason === 'not-found') return 'The requested task was not found.';
  if (result.reason === 'none') return 'No active task was found; pass --task <T-###>.';
  if (result.reason === 'git-unavailable') return 'Unable to read Git history for context recovery.';
  return 'Unable to resolve a task for context recovery.';
}

function renderResumeFailure(result) {
  const limiter = createResumeTextLimiter();
  const allCandidates = Array.isArray(result.candidates) ? result.candidates : [];
  const branchTaskIds = Array.isArray(result.branchTaskIds)
    ? result.branchTaskIds.slice(0, RESUME_MAX_CANDIDATES)
    : [];
  if (Array.isArray(result.branchTaskIds) && result.branchTaskIds.length > RESUME_MAX_CANDIDATES) {
    limiter.mark('error.branch_task_ids');
  }
  if (allCandidates.length > RESUME_MAX_CANDIDATES) limiter.mark('error.candidates');

  const error = {
    reason: result.reason || 'unknown',
    message: limiter.text(resumeFailureMessage(result), RESUME_TEXT_LIMITS.warning, 'error.message'),
    branch: limiter.text(result.branch || '', RESUME_TEXT_LIMITS.short, 'error.branch'),
    branch_task_ids: branchTaskIds,
    candidates: allCandidates.slice(0, RESUME_MAX_CANDIDATES).map((candidate, index) => ({
      id: candidate.id,
      slug: limiter.text(candidate.slug, RESUME_TEXT_LIMITS.short, `error.candidates[${index}].slug`),
      state: candidate.status,
      docs_path: limiter.text(candidate.dev_docs_path, RESUME_TEXT_LIMITS.path, `error.candidates[${index}].docs_path`),
    })),
    truncated_fields: limiter.fields,
  };
  console.log(JSON.stringify({ version: 3, error }));
  return resumeFailureExitCode(result.reason);
}

function readResumeStatus(repoRoot, task) {
  const statusPath = resolveTaskStatusDoc(path.join(repoRoot, task.dev_docs_path));
  const statusRaw = readText(statusPath);
  const status = statusRaw
    ? getBundleStatusFromStatusDoc(statusRaw, path.basename(statusPath))
    : { status: null, error: 'Missing 01-status.md.' };
  return {
    path: toPosix(path.relative(repoRoot, statusPath)),
    state: status.status || task.status || 'unknown',
    goal: getMarkdownSectionText(statusRaw, 'Goal') || null,
    next_step: getMarkdownListField(statusRaw, 'Progress', 'Next step') || null,
    status_error: status.error || null,
  };
}

function readResumePitfalls(repoRoot, task) {
  const pitfallsPath = resolveTaskPitfallsDoc(path.join(repoRoot, task.dev_docs_path));
  const pitfallsRaw = readText(pitfallsPath);
  return {
    path: toPosix(path.relative(repoRoot, pitfallsPath)),
    present: pitfallsRaw !== null,
    items: getPitfallTableItems(pitfallsRaw, 5),
  };
}

function readResumeRoadmap(repoRoot, task) {
  const roadmapPath = resolveTaskRoadmapDoc(path.join(repoRoot, task.dev_docs_path));
  const kickoff = getRoadmapKickoff(readText(roadmapPath));
  return {
    path: toPosix(path.relative(repoRoot, roadmapPath)),
    kickoff_status: kickoff.status || 'unknown',
    kickoff_checked: kickoff.checked,
    kickoff_total: kickoff.total,
  };
}

function buildResumeSuggestions({ task, commits, worktree, pitfalls }) {
  const taskPath = String(task.dev_docs_path || '').replace(/\/+$/, '');
  const reads = [task.roadmap_path || `${taskPath}/00-roadmap.md`];
  if (pitfalls.present) reads.push(pitfalls.path);
  const commands = [];
  if (worktree && !worktree.clean) commands.push('git status --short', 'git diff');
  const latest = commits.at(-1);
  if (latest) commands.push(`git show --stat ${latest.sha}`);
  return { reads, commands };
}

export function cmdResume({ repoRoot, taskId, limit, scan, limitClamped, scanClamped }) {
  const branch = readCurrentBranch(repoRoot);
  const resolved = resolveResumeTaskContext({ repoRoot, taskId, branch });
  if (!resolved.ok) return { exitCode: renderResumeFailure(resolved) };

  const task = resolved.task;
  const statusDoc = readResumeStatus(repoRoot, task);
  const roadmap = readResumeRoadmap(repoRoot, task);
  const pitfalls = readResumePitfalls(repoRoot, task);
  const records = readCommitTimeline({ repoRoot, scan });
  if (records === null) {
    return {
      exitCode: renderResumeFailure({
        ok: false,
        reason: 'git-unavailable',
        branch,
        branchTaskIds: taskIdsFromBranch(branch),
        candidates: [],
      }),
    };
  }

  const linked = records.filter((record) => record.tasks.includes(task.id));
  const commits = linked.slice(0, limit).reverse().map(({ commit, sha, date, author, subject, phase, verify }) => ({
    commit, sha, date, author, subject, phase, verify,
  }));
  const worktree = readWorktreeStatus(repoRoot);
  const warnings = [];
  if (limitClamped) warnings.push(`Requested commit limit exceeded the maximum; using ${limit}.`);
  if (scanClamped) warnings.push(`Requested scan limit exceeded the maximum; using ${scan}.`);
  if (statusDoc.status_error) warnings.push(statusDoc.status_error);
  if (!statusDoc.goal) warnings.push(`Goal is missing from ${statusDoc.path}.`);
  if (!statusDoc.next_step) warnings.push(`Next step is missing from ${statusDoc.path}.`);
  if (roadmap.kickoff_status === 'unknown') warnings.push(`Kickoff status is missing or invalid in ${roadmap.path}.`);
  if (linked.length === 0) warnings.push(`No commit carries "Task: ${task.id}"; linked progress is unknown, not zero.`);
  if (records.length >= scan) warnings.push(`Commit scan limit reached (${scan}); older commits were not examined.`);
  if (worktree === null) warnings.push('Worktree state is unavailable.');
  else if (!worktree.clean) warnings.push(`${worktree.count} repo-wide uncommitted change(s) may be ahead of the linked commit timeline.`);

  const suggestions = buildResumeSuggestions({ task, commits, worktree, pitfalls });
  const limiter = createResumeTextLimiter();
  const boundedCommits = commits.map((commit, index) => ({
    commit: commit.commit,
    sha: commit.sha,
    date: limiter.text(commit.date, RESUME_TEXT_LIMITS.short, `timeline.commits[${index}].date`),
    author: limiter.text(commit.author, RESUME_TEXT_LIMITS.short, `timeline.commits[${index}].author`),
    subject: limiter.text(commit.subject, RESUME_TEXT_LIMITS.commitSubject, `timeline.commits[${index}].subject`),
    phase: limiter.text(commit.phase, RESUME_TEXT_LIMITS.commitMetadata, `timeline.commits[${index}].phase`),
    verify: limiter.text(commit.verify, RESUME_TEXT_LIMITS.commitMetadata, `timeline.commits[${index}].verify`),
  }));
  const boundedWorktree = worktree === null ? null : {
    ...worktree,
    entries: worktree.entries.map((entry, index) =>
      limiter.text(entry, RESUME_TEXT_LIMITS.path, `worktree.entries[${index}]`)
    ),
  };
  const packet = {
    version: 3,
    task: {
      id: task.id,
      slug: limiter.text(task.slug, RESUME_TEXT_LIMITS.short, 'task.slug'),
      state: statusDoc.state,
      docs_path: limiter.text(docsTrailerValue(task.dev_docs_path), RESUME_TEXT_LIMITS.path, 'task.docs_path'),
      resolution: resolved.source,
    },
    status: {
      path: limiter.text(statusDoc.path, RESUME_TEXT_LIMITS.path, 'status.path'),
      goal: limiter.text(statusDoc.goal, RESUME_TEXT_LIMITS.text, 'status.goal'),
      next_step: limiter.text(statusDoc.next_step, RESUME_TEXT_LIMITS.text, 'status.next_step'),
    },
    roadmap: {
      path: limiter.text(roadmap.path, RESUME_TEXT_LIMITS.path, 'roadmap.path'),
      kickoff_status: roadmap.kickoff_status,
      kickoff_checked: roadmap.kickoff_checked,
      kickoff_total: roadmap.kickoff_total,
    },
    repository: {
      branch: limiter.text(branch, RESUME_TEXT_LIMITS.short, 'repository.branch'),
      head: readHeadCommit(repoRoot),
    },
    timeline: {
      state: linked.length > 0 ? 'linked' : 'unknown',
      linked_total: linked.length,
      scanned_commits: records.length,
      scan_limit: scan,
      limit,
      commits: boundedCommits,
    },
    worktree: boundedWorktree,
    do_not_repeat: pitfalls.items.map((item, index) =>
      limiter.text(item, RESUME_TEXT_LIMITS.text, `do_not_repeat[${index}]`)
    ),
    warnings: warnings.map((warning, index) =>
      limiter.text(warning, RESUME_TEXT_LIMITS.warning, `warnings[${index}]`)
    ),
    suggested_reads: suggestions.reads.map((value, index) =>
      limiter.text(value, RESUME_TEXT_LIMITS.path, `suggested_reads[${index}]`)
    ),
    suggested_commands: suggestions.commands.map((value, index) =>
      limiter.text(value, RESUME_TEXT_LIMITS.path, `suggested_commands[${index}]`)
    ),
  };
  packet.truncated_fields = [...limiter.fields];
  console.log(JSON.stringify(packet));
  return { exitCode: 0, packet };
}

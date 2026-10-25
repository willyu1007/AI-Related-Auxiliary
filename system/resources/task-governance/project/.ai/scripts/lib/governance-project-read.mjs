/**
 * Read-only Milestone and Feature discovery across linked worktrees. A copy that Git proves is
 * merely behind another worktree is reported stale instead of conflicting.
 */

import {
  canonicalPath,
  listGitWorktrees,
  loadRegistry,
  runGit,
  toPosix,
} from './governance-read.mjs';
import { getRegistryDataErrors } from './governance-lint.mjs';

const PROJECT_FIELDS = Object.freeze({
  milestone: ['title', 'status', 'description'],
  feature: ['title', 'milestone_id', 'status', 'description'],
});

const REGISTRY_PATH = '.ai/project/registry.json';

function rowValue(kind, row) {
  return JSON.stringify(PROJECT_FIELDS[kind].map((field) => row?.[field] ?? null));
}

function rowRef(row) {
  return { worktree_path: row.worktree_path, worktree_branch: row.worktree_branch };
}

/**
 * Lazy, cached Git evidence for stale-copy resolution. Every lookup returns null when Git cannot
 * prove the answer, and callers treat null as "changed" so unreadable evidence stays a conflict.
 */
function createGitEvidence(repoRoot) {
  const cache = new Map();
  const cached = (key, read) => {
    if (!cache.has(key)) cache.set(key, read());
    return cache.get(key);
  };
  const head = (worktreePath) =>
    cached(`head:${worktreePath}`, () => runGit(worktreePath, ['rev-parse', 'HEAD'])?.trim() || null);
  return {
    mergeBase(leftPath, rightPath) {
      const left = head(leftPath);
      const right = head(rightPath);
      if (!left || !right) return null;
      if (left === right) return left;
      return cached(`base:${[left, right].sort().join(' ')}`, () =>
        runGit(repoRoot, ['merge-base', left, right])?.trim() || null
      );
    },
    registryAt(sha) {
      return cached(`registry:${sha}`, () => {
        const raw = runGit(repoRoot, ['show', `${sha}:${REGISTRY_PATH}`]);
        try {
          return raw === null ? null : JSON.parse(raw);
        } catch {
          return null;
        }
      });
    },
  };
}

/**
 * Split same-ID copies into the newest line of evolution and stale copies, mirroring task
 * occurrences: a copy is stale when its worktree has not touched this row since its merge base
 * with a differing copy, so Git proves the other side is newer. The working-tree registry is
 * compared, so an uncommitted edit counts as a change, and the check is per row, so unrelated
 * registry edits (task projections, other rows) never block it. Without one provable leading
 * value every copy stays live and the caller reports the conflict.
 */
function splitStaleRows(kind, id, rows, git) {
  const values = rows.map((row) => rowValue(kind, row));
  if (new Set(values).size === 1) return { live: rows, stale: [] };

  const listKey = kind === 'milestone' ? 'milestones' : 'features';
  const changedSince = (index, base) => {
    const list = base ? git.registryAt(base)?.[listKey] : null;
    const baseRow = Array.isArray(list) ? list.find((item) => item?.id === id) : null;
    return !baseRow || rowValue(kind, baseRow) !== values[index];
  };
  const leading = new Set(
    values.filter((value, index) =>
      rows.every(
        (other, otherIndex) =>
          values[otherIndex] === value ||
          !changedSince(otherIndex, git.mergeBase(rows[index].worktree_path, other.worktree_path))
      )
    )
  );
  if (leading.size !== 1) return { live: rows, stale: [] };
  const [value] = leading;
  return {
    live: rows.filter((_, index) => values[index] === value),
    stale: rows.filter((_, index) => values[index] !== value),
  };
}

function mergeProjectRows(kind, rows, git) {
  const fields = PROJECT_FIELDS[kind];
  const groups = new Map();
  for (const row of rows) {
    const grouped = groups.get(row.id) || [];
    grouped.push(row);
    groups.set(row.id, grouped);
  }

  const merged = [];
  for (const [id, grouped] of groups) {
    const result = { kind, id };
    const conflicts = [];
    const { live, stale } = splitStaleRows(kind, id, grouped, git);
    for (const field of fields) {
      const values = new Map();
      for (const row of live) {
        const value = row[field];
        const key = JSON.stringify(value);
        const entry = values.get(key) || { value, worktrees: [] };
        entry.worktrees.push(rowRef(row));
        values.set(key, entry);
      }
      if (values.size === 1) result[field] = [...values.values()][0].value;
      else {
        result[field] = null;
        conflicts.push({ field, values: [...values.values()] });
      }
    }
    result.conflict = conflicts.length > 0;
    result.conflicts = conflicts;
    result.occurrence_count = grouped.length;
    result.worktrees = grouped.map(rowRef);
    result.stale_worktrees = stale.map(rowRef);
    merged.push(result);
  }

  return merged.sort((left, right) => left.id.localeCompare(right.id));
}

function getConflictErrors(rows) {
  return rows
    .filter((row) => row.conflict)
    .map((row) => {
      const label = row.kind === 'milestone' ? 'Milestone' : 'Feature';
      const fields = row.conflicts.map((conflict) => conflict.field).join(', ');
      return `${label} ID ${row.id} has different ${fields} values across linked worktrees.`;
    });
}

export function readProjectGraph({ repoRoot, repairingRepoRoot = null }) {
  const milestoneOccurrences = [];
  const featureOccurrences = [];
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
      repairingRepoRoot && canonicalPath(worktree.path) === canonicalPath(repairingRepoRoot);
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

    const source = {
      worktree_path: toPosix(worktree.path),
      worktree_branch: worktree.branch,
    };
    for (const milestone of loaded.registry.milestones) {
      milestoneOccurrences.push({ ...milestone, ...source });
    }
    for (const feature of loaded.registry.features) {
      featureOccurrences.push({ ...feature, ...source });
    }
  }

  const git = createGitEvidence(repoRoot);
  const milestones = mergeProjectRows('milestone', milestoneOccurrences, git);
  const features = mergeProjectRows('feature', featureOccurrences, git);
  errors.push(...getConflictErrors(milestones), ...getConflictErrors(features));
  return {
    ok: errors.length === 0,
    errors,
    milestones,
    features,
  };
}

export function cmdProjectQuery({ repoRoot, json }) {
  const result = readProjectGraph({ repoRoot });
  if (json) console.log(JSON.stringify(result));
  else {
    for (const row of [...result.milestones, ...result.features]) {
      console.log(JSON.stringify(row));
    }
    for (const error of result.errors) {
      console.log(JSON.stringify({ kind: 'error', error }));
    }
  }
  return result;
}

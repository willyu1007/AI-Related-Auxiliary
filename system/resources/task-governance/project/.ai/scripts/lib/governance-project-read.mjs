/**
 * Read-only Milestone and Feature discovery across linked worktrees.
 */

import {
  canonicalPath,
  listGitWorktrees,
  loadRegistry,
  toPosix,
} from './governance-read.mjs';
import { getRegistryDataErrors } from './governance-lint.mjs';

const PROJECT_FIELDS = Object.freeze({
  milestone: ['title', 'status', 'description'],
  feature: ['title', 'milestone_id', 'status', 'description'],
});

function mergeProjectRows(kind, rows) {
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
    for (const field of fields) {
      const values = new Map();
      for (const row of grouped) {
        const value = row[field];
        const key = JSON.stringify(value);
        const entry = values.get(key) || { value, worktrees: [] };
        entry.worktrees.push({
          worktree_path: row.worktree_path,
          worktree_branch: row.worktree_branch,
        });
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
    result.worktrees = grouped.map((row) => ({
      worktree_path: row.worktree_path,
      worktree_branch: row.worktree_branch,
    }));
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

  const milestones = mergeProjectRows('milestone', milestoneOccurrences);
  const features = mergeProjectRows('feature', featureOccurrences);
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

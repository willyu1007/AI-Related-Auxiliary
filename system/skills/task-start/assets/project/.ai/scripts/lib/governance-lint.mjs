/**
 * Read-only validation for the project-governance system.
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
  TASK_ID_RE,
  TASK_STATUS,
  cleanMarkdownValue,
  exists,
  formatTaskRef,
  getBundleStatusFromStatusDoc,
  getCompletionCriteriaStats,
  getMarkdownSectionLines,
  getRoadmapKickoff,
  loadRegistry,
  normalizeEol,
  parseTaskMeta,
  readText,
  scanTasks,
  statusRank,
  toPosix,
} from './governance-read.mjs';

const header = (message) => console.log(message);

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

const VERIFICATION_RESULTS = new Set(['pass', 'fail', 'blocked', 'not-run']);

function getDoneWhenItems(statusRaw) {
  const items = [];
  for (const line of getMarkdownSectionLines(statusRaw, 'Done when')) {
    const match = line.trim().match(/^\-\s*\[(x|X|\s)\]\s+(.+)$/);
    if (!match) continue;
    const condition = cleanMarkdownValue(match[2]);
    if (!condition) continue;
    items.push({ condition, checked: String(match[1]).toLowerCase() === 'x' });
  }
  return items;
}

function splitMarkdownTableRow(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed.startsWith('|') || !trimmed.endsWith('|')) return [];
  const cells = [];
  let cell = '';
  const body = trimmed.slice(1, -1);
  for (let index = 0; index < body.length; index++) {
    const char = body[index];
    const next = body[index + 1];
    if (char === '\\' && (next === '|' || next === '\\')) {
      cell += next;
      index += 1;
    } else if (char === '|') {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }
  cells.push(cell.trim());
  return cells;
}

function verificationKey(value) {
  return cleanMarkdownValue(value).replace(/\s+/g, ' ').toLowerCase();
}

function getVerificationRows(verificationRaw) {
  const rows = new Map();
  for (const line of getMarkdownSectionLines(verificationRaw, 'Completion matrix')) {
    const cells = splitMarkdownTableRow(line);
    if (cells.length < 4) continue;
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    if (verificationKey(cells[0]) === 'completion condition') continue;

    const condition = cleanMarkdownValue(cells[0]);
    if (!condition) continue;
    const key = verificationKey(condition);
    const entries = rows.get(key) || [];
    entries.push({
      condition,
      check: cleanMarkdownValue(cells[1]),
      result: cleanMarkdownValue(cells[2]).toLowerCase(),
      evidence: cleanMarkdownValue(cells[3]),
    });
    rows.set(key, entries);
  }
  return rows;
}

function validateVerificationContract({ statusRaw, roadmapRaw, verificationRaw, state }) {
  const errors = [];
  const kickoff = getRoadmapKickoff(roadmapRaw);
  const conditions = getDoneWhenItems(statusRaw);
  if (kickoff.status !== 'ready' && state !== 'done') return errors;

  if (conditions.length === 0) {
    errors.push('Kickoff is ready or State is done, but Done when has no populated completion conditions.');
    return errors;
  }

  const verificationRows = getVerificationRows(verificationRaw);
  for (const item of conditions) {
    const entries = verificationRows.get(verificationKey(item.condition)) || [];
    if (entries.length === 0) {
      errors.push(`Completion condition has no verification matrix row: "${item.condition}".`);
      continue;
    }
    if (entries.length > 1) {
      errors.push(`Completion condition has duplicate verification matrix rows: "${item.condition}".`);
      continue;
    }

    const row = entries[0];
    if (!row.check) {
      errors.push(`Verification check / procedure is missing for: "${item.condition}".`);
    }
    if (!VERIFICATION_RESULTS.has(row.result)) {
      errors.push(
        `Invalid verification result "${row.result || '(empty)'}" for "${item.condition}". ` +
          `Allowed: ${[...VERIFICATION_RESULTS].join(', ')}.`
      );
    }
    if (state === 'done') {
      if (row.result !== 'pass') {
        errors.push(`State is done but verification is not pass for: "${item.condition}".`);
      }
      if (!row.evidence) {
        errors.push(`State is done but verification evidence / limitation is empty for: "${item.condition}".`);
      }
    }
  }
  return errors;
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

export function cmdLint({ repoRoot, strict }) {
  const errors = [];
  const warnings = [];

  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    const guidancePath = path.join(repoRoot, '.ai', 'project', file);
    if (!exists(guidancePath)) errors.push(`Missing .ai/project/${file} (required).`);
  }

  const { registry, error: registryParseError } = loadRegistry(repoRoot);

  if (registryParseError) {
    errors.push(`Failed to parse registry.json: ${registryParseError}`);
  }

  if (!registry && !registryParseError) {
    warnings.push(
      'Project hub is not initialized. Run: node .ai/scripts/install-project-governance.mjs --repo-root .'
    );
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
    if (Object.hasOwn(registry, 'task_doc_roots')) {
      errors.push('Registry contains unsupported top-level key: "task_doc_roots".');
    }
    validateRegistryGraph(registry, errors);

  }

  const taskDocsDir = path.join(repoRoot, 'dev-docs');
  for (const directory of ['active', 'archive']) {
    if (!exists(path.join(taskDocsDir, directory))) {
      errors.push(`Required task-document directory dev-docs/${directory}/ is missing.`);
    }
  }
  for (const file of ['AGENTS.md', 'CLAUDE.md']) {
    if (!exists(path.join(taskDocsDir, file))) {
      errors.push(`Required task-document entry point dev-docs/${file} is missing.`);
    }
  }
  if (exists(path.join(taskDocsDir, 'README.md'))) {
    errors.push('Unsupported task-document entry point dev-docs/README.md conflicts with dev-docs/AGENTS.md.');
  }
  const claudeEntry = readText(path.join(taskDocsDir, 'CLAUDE.md'));
  const expectedClaudeEntry = '# Task documentation\n\nFollow `AGENTS.md` for task-document semantics.';
  if (claudeEntry !== null && normalizeEol(claudeEntry).trim() !== expectedClaudeEntry) {
    errors.push('dev-docs/CLAUDE.md must contain only the task-document pointer to AGENTS.md.');
  }

  const tasks = scanTasks(repoRoot);

  // Collect IDs and slug-to-ids mapping for duplicate checks.
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
    const verificationRaw = readText(path.join(task.absPath, 'verification.md'));
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

    if (
      task.phase === 'active' &&
      statusRaw !== null &&
      roadmapRaw !== null &&
      verificationRaw !== null
    ) {
      for (const verificationError of validateVerificationContract({
        statusRaw,
        roadmapRaw,
        verificationRaw,
        state: task.effectiveStatus,
      })) {
        errors.push(`${formatTaskRef(task)}: ${verificationError}`);
      }
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

  // A slug linked to multiple distinct IDs is ambiguous.
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
      if (!/^dev-docs\/(?:active|archive)\/[^/]+$/.test(toPosix(devDocsPath))) {
        errors.push(
          `Registry task ${id} has unsupported dev_docs_path "${devDocsPath}"; task bundles must be immediate children of top-level dev-docs/active or dev-docs/archive.`
        );
        continue;
      }
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
    const requirements = Array.isArray(registry.requirements) ? registry.requirements : [];
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
      if (feature.status === 'done') {
        const incompleteRequirements = requirements
          .filter((requirement) => requirement && String(requirement.feature_id || '') === featureId)
          .filter((requirement) => !['done', 'cut'].includes(String(requirement.status || '')))
          .map((requirement) => String(requirement.id || '(missing ID)'));
        if (incompleteRequirements.length > 0) {
          warnings.push(
            `Feature ${featureId} is done but has non-terminal Requirements: ` +
              `${incompleteRequirements.join(', ')}.`
          );
        }
      }
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

    for (const requirement of requirements) {
      if (
        !requirement ||
        typeof requirement !== 'object' ||
        !['done', 'cut'].includes(requirement.status)
      ) continue;
      const requirementId = String(requirement.id || '');
      const activeTasks = tasks
        .filter(
          (task) =>
            task &&
            Array.isArray(task.requirement_ids) &&
            task.requirement_ids.some((id) => String(id) === requirementId)
        )
        .filter((task) => ['planned', 'in-progress', 'blocked'].includes(String(task.status || '')))
        .map((task) => String(task.id || '(missing ID)'));
      if (activeTasks.length > 0) {
        warnings.push(
          `Requirement ${requirementId} is ${requirement.status} but has active mapped Tasks: ` +
            `${activeTasks.join(', ')}.`
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

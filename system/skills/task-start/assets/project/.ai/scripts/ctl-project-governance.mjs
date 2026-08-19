#!/usr/bin/env node
/**
 * ctl-project-governance.mjs
 *
 * Project governance control tool (install/init/lint/sync).
 *
 * @reference .ai/project/AGENTS.md
 *
 * Design notes:
 * - Dependency-free (Node built-ins only).
 * - Ships inside the skill that provisions the hub and installs itself into the target repository,
 *   because the Git hooks call it by repository path and cannot reach the skill's own location.
 * - Task progress SoT remains in the dev-docs task bundle (`01-status.md`).
 * - Task bundles follow the semantics in `dev-docs/README.md`.
 * - Task identity SoT is anchored by `.ai-task.yaml` (`task_id`).
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { colors, die, header, info, ok, warn } from './lib/colors.mjs';
import { parseYaml } from './lib/yaml-lite.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESUME_DEFAULT_COMMIT_LIMIT = 3;
const RESUME_MAX_COMMIT_LIMIT = 20;
const RESUME_DEFAULT_SCAN_LIMIT = 500;
const RESUME_MAX_SCAN_LIMIT = 10000;
const RESUME_MAX_CANDIDATES = 20;
const RESUME_TEXT_LIMITS = Object.freeze({
  short: 256,
  text: 500,
  path: 1024,
  commitSubject: 240,
  commitMetadata: 300,
  warning: 500,
});

const TASK_ID_RE = /^T-\d{3}$/;
const MILESTONE_ID_RE = /^M-\d{3}$/;
const FEATURE_ID_RE = /^F-\d{3}$/;
const REQUIREMENT_ID_RE = /^R-\d{3}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const TASK_STATUS = new Set(['planned', 'in-progress', 'blocked', 'done', 'archived']);
const BUNDLE_STATUS = new Set(['planned', 'in-progress', 'blocked', 'done']);
const MILESTONE_STATUS = new Set(['planned', 'in-progress', 'blocked', 'done']);
const FEATURE_STATUS = new Set(['planned', 'in-progress', 'blocked', 'done', 'cut']);
const REQUIREMENT_STATUS = new Set(['planned', 'in-progress', 'blocked', 'done', 'cut']);

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
  install
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --dry-run                 Show what would be copied and created
    Copy the shipped project tree (.ai/ and dev-docs/) into <repo> and then initialize.
    Idempotent: shipped material is refreshed, hub files created by init are left alone.

  init
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --dry-run                 Show what would be created
    --force                   Overwrite existing hub files (dangerous)
    Initialize the project hub at .ai/project/ (idempotent by default).

  lint
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --check                   (default) Exit non-zero only on errors (warnings do not fail)
    --strict                  Treat warnings as errors
    Validate repository state against the project governance rules.

  sync
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --dry-run                 Print planned changes without writing
    --apply                   Apply changes (writes files)
    --init-if-missing         Create missing hub files from templates before syncing
    --changelog               Append sync-detected events to hub changelog (apply-mode only)
    Generate missing task meta IDs, upsert registry tasks, and regenerate derived views.

  query
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --id <T-###>              Filter by a specific task id
    --status <status>         Filter by status (planned|in-progress|blocked|done|archived)
    --text <substring>        Substring match against common task fields
    --all-worktrees           Scan task bundles in every linked worktree, including uncommitted files
    --json                    Output a single JSON array instead of JSON lines
    Locate tasks quickly for dedupe/triage (LLM-friendly output).

  current-task
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --task <T-###>            Resolve a specific task instead of the active one
    --format <fmt>            trailers (default) | id | json
    Resolve the active task (single in-progress, else single blocked) for hooks/automation.
    Status is read from task bundles (01-status.md State), never from the registry cache.
    Exit codes: 0 resolved, 2 ambiguous, 3 none, 4 not found.

  resume
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --task <T-###>            Task ID (default: branch task, then the active task)
    --limit <n>               Recent linked commits (default: ${RESUME_DEFAULT_COMMIT_LIMIT}; max: ${RESUME_MAX_COMMIT_LIMIT})
    --scan <n>                History scan limit (default: ${RESUME_DEFAULT_SCAN_LIMIT}; max: ${RESUME_MAX_SCAN_LIMIT})
    --json                    Output one stable JSON context packet
    Build a bounded context-recovery packet from dev-docs, linked commits, and the worktree.
    Resolution order: --task, branch T-###, single in-progress, then single blocked task.
    Exit codes: 0 resolved, 2 ambiguous, 3 none, 4 not found.

  commits
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --task <T-###>            Task ID (default: the active task)
    --limit <n>               Keep the most recent <n> commits (default: 20)
    --scan <n>                Commits of history to scan (default: 500)
    --json                    Output a single JSON array instead of JSON lines
    Derive a task's commit timeline from "Task:" trailers in git log (read-only, non-SoT).
    Output is oldest -> newest: the last line is the latest progress.

  map
    --repo-root <path>        Repo root (default: auto-detect; fallback: cwd)
    --task <T-###>            Task ID to map (required)
    --feature <F-###>         Feature ID to map the task to
    --milestone <M-###>       Milestone ID to map the task to
    --requirement <R-###>     Existing Requirement ID to map the task to
    --dry-run                 Show what would change without writing
    --apply                   Apply the mapping change
    Map a task to Feature/Milestone/Requirement in the registry.

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
  node .ai/scripts/ctl-project-governance.mjs init
  node .ai/scripts/ctl-project-governance.mjs lint --check
  node .ai/scripts/ctl-project-governance.mjs sync --dry-run
  node .ai/scripts/ctl-project-governance.mjs sync --apply
  node .ai/scripts/ctl-project-governance.mjs feature --title "OAuth providers" --apply --json
  node .ai/scripts/ctl-project-governance.mjs requirement --title "Google sign-in" --feature F-002 --apply --json
  node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-002 --apply
  node .ai/scripts/ctl-project-governance.mjs resume --json
  node .ai/scripts/ctl-project-governance.mjs commits --task T-001
`.trim();

  console.log(msg);
  process.exit(exitCode);
}

function parseArgs(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') usage(0);

  const command = args.shift();
  const opts = {};

  while (args.length > 0) {
    const token = args.shift();
    if (token === '-h' || token === '--help') usage(0);
    if (!token.startsWith('--')) {
      console.error(`[warning] Ignoring unrecognized argument: "${token}" (use --${token.replace(/^-+/, '')} for flags)`);
      continue;
    }

    const key = token.slice(2);
    if (args.length > 0 && !args[0].startsWith('--')) {
      opts[key] = args.shift();
    } else {
      opts[key] = true;
    }
  }

  return { command, opts };
}

function parseBoundedPositiveInt(value, fallback, maximum) {
  const parsed = Number.parseInt(String(value ?? fallback), 10);
  const requested = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  return {
    value: Math.min(requested, maximum),
    clamped: requested > maximum,
  };
}

function toPosix(p) {
  return String(p).replace(/\\/g, '/');
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
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

function exists(p) {
  try {
    return fs.existsSync(p);
  } catch {
    return false;
  }
}

function findRepoRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    const governancePath = path.join(dir, '.ai', 'project', 'AGENTS.md');
    if (exists(governancePath)) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

function templateVars() {
  return {
    today: today(),
  };
}

function renderTemplate(raw, vars) {
  let out = String(raw || '');
  for (const [k, v] of Object.entries(vars)) {
    out = out.replaceAll(`{{${k}}}`, String(v));
  }
  return out;
}

function getHubDir(repoRoot) {
  return path.join(repoRoot, '.ai', 'project');
}

function getRegistryPath(repoRoot) {
  return path.join(getHubDir(repoRoot), 'registry.yaml');
}

function getTemplatesDir(repoRoot) {
  return path.join(repoRoot, '.ai', 'project', 'templates');
}

function listImmediateChildDirs(dirPath) {
  let entries;
  try {
    entries = fs.readdirSync(dirPath, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort((a, b) => a.localeCompare(b));
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
      warn(`[warning] Missing AUTO-GENERATED markers for "${blockId}" in ${label}; skipping update to preserve manual content. Restore markers or run init --force to recreate.`);
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

function normalizeEol(s) {
  return String(s || '').replace(/\r\n/g, '\n');
}

function needsQuote(s) {
  const t = String(s);
  if (t === '') return true;
  if (/[\s:#\[\]{}]/.test(t)) return true;
  if (t.startsWith('-')) return true;
  return false;
}

function dumpScalar(v) {
  if (v === null) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  const s = String(v);
  if (!needsQuote(s)) return s;
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function dumpYamlDoc(doc) {
  // Stable YAML serializer for the subset produced by this tool.
  const out = [];

  function pushLine(indent, text) {
    out.push(`${' '.repeat(indent)}${text}`.trimEnd());
  }

  function dumpAny(value, indent, keyHint = '') {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        pushLine(indent, `${keyHint}: []`);
        return;
      }
      pushLine(indent, `${keyHint}:`);
      for (const item of value) {
        if (item && typeof item === 'object' && !Array.isArray(item)) {
          const keys = Object.keys(item);
          if (keys.length === 0) {
            pushLine(indent + 2, '- {}');
            continue;
          }
          const orderedKeys = orderKeysForObject(item);
          const firstKey = orderedKeys[0];
          const firstVal = item[firstKey];
          if (firstVal && typeof firstVal === 'object') {
            pushLine(indent + 2, `- ${firstKey}:`);
            dumpObject(firstVal, indent + 6);
          } else {
            pushLine(indent + 2, `- ${firstKey}: ${dumpScalar(firstVal)}`);
          }
          for (const k of orderedKeys.slice(1)) {
            const v = item[k];
            if (Array.isArray(v)) {
              if (v.length === 0) {
                pushLine(indent + 4, `${k}: []`);
              } else {
                pushLine(indent + 4, `${k}:`);
                for (const li of v) {
                  pushLine(indent + 6, `- ${dumpScalar(li)}`);
                }
              }
            } else if (v && typeof v === 'object') {
              pushLine(indent + 4, `${k}:`);
              dumpObject(v, indent + 6);
            } else {
              pushLine(indent + 4, `${k}: ${dumpScalar(v)}`);
            }
          }
          continue;
        }
        pushLine(indent + 2, `- ${dumpScalar(item)}`);
      }
      return;
    }

    if (value && typeof value === 'object') {
      pushLine(indent, `${keyHint}:`);
      dumpObject(value, indent + 2);
      return;
    }

    pushLine(indent, `${keyHint}: ${dumpScalar(value)}`);
  }

  function orderKeysForObject(obj) {
    const keys = Object.keys(obj);

    const preferred = [
      'id',
      'slug',
      'title',
      'name',
      'status',
      'description',
      'milestone_id',
      'feature_id',
      'requirement_id',
      'requirement_ids',
      'dev_docs_path',
      'task_doc_roots',
      'updated',
      'keywords',
    ];

    const set = new Set(keys);
    const ordered = [];
    for (const k of preferred) if (set.has(k)) ordered.push(k);
    const rest = keys.filter((k) => !ordered.includes(k)).sort((a, b) => a.localeCompare(b));
    return [...ordered, ...rest];
  }

  function dumpObject(obj, indent) {
    const keys = orderKeysForObject(obj);
    for (const k of keys) {
      const v = obj[k];
      if (Array.isArray(v)) {
        if (v.length === 0) {
          pushLine(indent, `${k}: []`);
        } else if (v.every((x) => typeof x !== 'object' || x === null)) {
          pushLine(indent, `${k}:`);
          for (const li of v) pushLine(indent + 2, `- ${dumpScalar(li)}`);
        } else {
          // list of objects
          dumpAny(v, indent, k);
        }
      } else if (v && typeof v === 'object') {
        pushLine(indent, `${k}:`);
        dumpObject(v, indent + 2);
      } else {
        pushLine(indent, `${k}: ${dumpScalar(v)}`);
      }
    }
  }

  // Root ordering
  const rootOrder = ['version', 'task_doc_roots', 'milestones', 'features', 'requirements', 'tasks'];
  for (const k of rootOrder) {
    if (!(k in doc)) continue;
    const v = doc[k];
    if (k === 'version') {
      pushLine(0, `version: ${dumpScalar(v)}`);
      pushLine(0, '');
      continue;
    }
    if (Array.isArray(v)) {
      if (v.length === 0) {
        pushLine(0, `${k}: []`);
        pushLine(0, '');
        continue;
      }
      dumpAny(v, 0, k);
      pushLine(0, '');
      continue;
    }
    if (v && typeof v === 'object') {
      pushLine(0, `${k}:`);
      dumpObject(v, 2);
      pushLine(0, '');
      continue;
    }
    pushLine(0, `${k}: ${dumpScalar(v)}`);
    pushLine(0, '');
  }

  // Any extra keys
  const extra = Object.keys(doc)
    .filter((k) => !rootOrder.includes(k))
    .sort((a, b) => a.localeCompare(b));
  for (const k of extra) {
    dumpAny(doc[k], 0, k);
    pushLine(0, '');
  }

  return out.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd() + '\n';
}

function getBundleStatusFromStatusDoc(statusRaw, statusPath = '01-status.md') {
  const raw = normalizeEol(statusRaw);
  const lines = raw.split('\n');

  let inProgress = false;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('#')) {
      const progressHeading = /^##\s+Progress\s*$/i.test(t);
      if (progressHeading) {
        inProgress = true;
        continue;
      }
      if (inProgress && /^##\s+/.test(t)) {
        // next section
        break;
      }
    }

    if (!inProgress) continue;

    const m = t.match(/^\-\s*State\s*:\s*(.+)\s*$/i);
    if (!m) continue;

    const value = String(m[1] || '').trim();
    if (value.includes('|')) {
      return { status: null, error: 'State must be a single value (not an enum hint).' };
    }

    if (!BUNDLE_STATUS.has(value)) {
      const hint = BUNDLE_STATUS.has(value.toLowerCase()) ? ' (status values must be lowercase)' : '';
      return { status: null, error: `Invalid State value: "${value}". Allowed: ${[...BUNDLE_STATUS].join(', ')}${hint}` };
    }

    return { status: value, error: null };
  }

  return {
    status: null,
    error: `Missing "## Progress" / "- State: <status>" in ${toPosix(statusPath)}.`,
  };
}

function getMarkdownSectionLines(markdownRaw, heading) {
  const lines = normalizeEol(markdownRaw).split('\n');
  const target = String(heading || '').trim().toLowerCase();
  const out = [];
  let inSection = false;

  for (const line of lines) {
    const headingMatch = line.trim().match(/^##\s+(.+?)\s*$/);
    if (headingMatch) {
      if (inSection) break;
      inSection = String(headingMatch[1] || '').trim().toLowerCase() === target;
      continue;
    }

    if (inSection) out.push(line);
  }

  return out;
}

function cleanMarkdownValue(value) {
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

function getRoadmapKickoff(roadmapRaw) {
  const status = getMarkdownListField(roadmapRaw, 'Kickoff gate', 'Status').toLowerCase();
  const checklist = getMarkdownChecklistStats(roadmapRaw, 'Kickoff gate');
  return {
    status: status === 'pending' || status === 'ready' ? status : '',
    rawStatus: status,
    ...checklist,
  };
}

function getCompletionCriteriaStats(statusRaw) {
  const raw = normalizeEol(statusRaw);
  const lines = raw.split('\n');

  let inAc = false;
  let total = 0;
  let checked = 0;

  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith('#')) {
      const completionHeading = /^##\s+Done when\b/i.test(t);
      if (completionHeading) {
        inAc = true;
        continue;
      }
      if (inAc && /^##\s+/.test(t)) break;
    }
    if (!inAc) continue;

    const m = t.match(/^\-\s*\[(x|X|\s)\]\s+(.+)$/);
    if (!m) continue;
    total += 1;
    if (String(m[1]).toLowerCase() === 'x') checked += 1;
  }

  return { total, checked };
}

function statusRank(status) {
  switch (status) {
    case 'planned':
      return 10;
    case 'in-progress':
      return 20;
    case 'blocked':
      return 20;
    case 'done':
      return 30;
    case 'archived':
      return 40;
    default:
      return 0;
  }
}

function formatTaskRef(task) {
  const rel = toPosix(task.relPath);
  return `${task.taskId || '(no-id)'} ${task.slug} (${task.phase}) @ ${rel}`;
}

function discoverDevDocsRoots(repoRoot) {
  // Config-first is handled elsewhere; this is the fallback auto-discovery.
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

    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const full = path.join(dir, e.name);

      if (e.name === 'dev-docs') {
        const active = path.join(full, 'active');
        const archive = path.join(full, 'archive');
        if (exists(active) || exists(archive)) {
          roots.push(full);
          continue;
        }
      }

      if (IGNORE_DIRS.has(e.name)) continue;
      if (e.name.startsWith('.')) continue;
      stack.push(full);
    }
  }

  const uniq = Array.from(new Set(roots.map((p) => path.resolve(p))));
  return uniq.sort((a, b) => a.localeCompare(b));
}

function loadRegistry(repoRoot) {
  const registryPath = getRegistryPath(repoRoot);
  const raw = readText(registryPath);
  if (!raw) return { path: registryPath, registry: null, error: null };

  try {
    const parsed = parseYaml(raw);
    return { path: registryPath, registry: parsed, error: null };
  } catch (e) {
    return { path: registryPath, registry: null, error: e.message || String(e) };
  }
}

function getConfiguredRootsFromRegistry(registry) {
  const roots = registry?.task_doc_roots;
  if (!Array.isArray(roots)) return [];
  return roots.map((r) => String(r)).filter(Boolean);
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

function resolveDevDocsRoots(repoRoot, registry = null) {
  const configured = getConfiguredRootsFromRegistry(registry);
  return configured.length > 0
    ? configured.map((p) => path.resolve(repoRoot, p))
    : discoverDevDocsRoots(repoRoot);
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

function scanTasks(repoRoot, devDocsRoots) {
  const tasks = [];

  for (const root of devDocsRoots) {
    for (const phase of ['active', 'archive']) {
      const phaseDir = path.join(root, phase);
      const slugs = listImmediateChildDirs(phaseDir);
      for (const slug of slugs) {
        const taskDir = path.join(phaseDir, slug);
        const statusPath = resolveTaskStatusDoc(taskDir);
        const roadmapPath = resolveTaskRoadmapDoc(taskDir);
        const metaPath = path.join(taskDir, '.ai-task.yaml');
        tasks.push({
          root,
          phase,
          slug,
          absPath: taskDir,
          relPath: path.relative(repoRoot, taskDir),
          statusPath,
          roadmapPath,
          metaPath,
        });
      }
    }
  }

  return tasks.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

function parseTaskMeta(metaRaw) {
  const parsed = parseYaml(normalizeEol(metaRaw));
  const map = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};

  return {
    version: Number.isFinite(map.version) ? map.version : null,
    task_id: String(map.task_id || map.taskId || ''),
    slug: String(map.slug || ''),
    status: String(map.status || ''),
    updated: String(map.updated || ''),
    keywords: Array.isArray(map.keywords) ? map.keywords.map((value) => String(value)) : [],
  };
}

function renderTaskMetaYaml(meta) {
  const lines = [];
  lines.push('version: 1');
  lines.push(`task_id: ${meta.task_id}`);
  lines.push(`slug: ${meta.slug}`);
  if (meta.status) lines.push(`status: ${meta.status}`);
  lines.push(`updated: "${meta.updated}"`);
  if (Array.isArray(meta.keywords) && meta.keywords.length > 0) {
    lines.push('keywords:');
    for (const k of meta.keywords) lines.push(`  - ${k}`);
  }
  lines.push('');
  return lines.join('\n');
}

// The shipped tree sits two levels above this script's own directory, so for a skill shipping
// <skill>/assets/hub/.ai/scripts/, the root that mirrors a target repository is
// <skill>/assets/hub. The same expression resolves to
// the repository root once the script has been installed, which is what makes install a no-op copy
// when it is run from inside a repository that already has it.
const SHIPPED_ROOT = path.resolve(__dirname, '..', '..');
const RETIRED_SHIPPED_FILES = ['.ai/project/CONTRACT.md'];

/** Every file under dir, as paths relative to dir. */
function collectFiles(dir, base = dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(abs, base));
    else if (entry.isFile()) out.push(path.relative(base, abs));
  }
  return out;
}

// Install is the entry point for a repository that has nothing yet: the shipped tree is the control
// script, its lib, the governance guidance, the templates init reads, and the empty task
// directories. Shipped material is overwritten on every run so a re-install upgrades it in place;
// the hub files init creates are project data and are never touched here.
function cmdInstall({ repoRoot, dryRun }) {
  const srcRoot = SHIPPED_ROOT;
  const dstRoot = repoRoot;
  const actions = [];

  if (path.resolve(srcRoot) === path.resolve(dstRoot)) {
    info('[info] Shipped assets already live in this repository; skipping the copy.');
  } else {
    if (!exists(srcRoot)) {
      die(`[error] Shipped project assets are missing at ${toPosix(srcRoot)}`);
    }
    for (const rel of collectFiles(srcRoot)) {
      const from = path.join(srcRoot, rel);
      const to = path.join(dstRoot, rel);
      const content = readText(from);
      if (content === null) {
        die(`[error] Cannot read shipped asset: ${toPosix(from)}`);
      }
      const existed = exists(to);
      if (dryRun) {
        actions.push({ op: existed ? 'update' : 'write', path: to, mode: 'dry-run' });
        continue;
      }
      const changed = writeTextIfChanged(to, content);
      actions.push({ op: changed ? (existed ? 'update' : 'write') : 'same', path: to });
    }

    for (const rel of RETIRED_SHIPPED_FILES) {
      const retired = path.join(dstRoot, rel);
      if (!exists(retired)) continue;
      if (dryRun) {
        actions.push({ op: 'remove', path: retired, mode: 'dry-run' });
        continue;
      }
      fs.unlinkSync(retired);
      actions.push({ op: 'remove', path: retired });
    }

    ok('[ok] Project assets installed.');
    for (const a of actions) {
      const mode = a.mode ? ` (${a.mode})` : '';
      console.log(`  ${a.op}: ${toPosix(path.relative(repoRoot, a.path))}${mode}`);
    }
  }

  cmdInit({ repoRoot, dryRun, force: false });
}

function cmdInit({ repoRoot, dryRun, force }) {
  const hubDir = getHubDir(repoRoot);
  const templatesDir = getTemplatesDir(repoRoot);
  const vars = templateVars();

  if (!exists(templatesDir)) {
    die(`[error] Missing templates directory: ${toPosix(path.relative(repoRoot, templatesDir))}`);
  }

  const templateFiles = ['registry.yaml', 'dashboard.md', 'feature-map.md', 'task-index.md', 'changelog.md'];
  const actions = [];

  if (dryRun) {
    actions.push({ op: 'mkdir', path: hubDir, mode: 'dry-run' });
  } else {
    ensureDir(hubDir);
    actions.push({ op: 'mkdir', path: hubDir });
  }

  for (const file of templateFiles) {
    const src = path.join(templatesDir, file);
    const dst = path.join(hubDir, file);
    const existed = exists(dst);

    if (!exists(src)) {
      actions.push({ op: 'skip', path: dst, reason: `template missing: ${src}` });
      continue;
    }

    if (existed && !force) {
      actions.push({ op: 'skip', path: dst, reason: 'exists' });
      continue;
    }

    const raw = readText(src) || '';
    const rendered = renderTemplate(raw, vars);

    if (dryRun) {
      actions.push({ op: existed ? 'overwrite' : 'write', path: dst, from: src, mode: 'dry-run' });
      continue;
    }

    if (force) {
      writeText(dst, rendered);
      actions.push({ op: existed ? 'overwrite' : 'write', path: dst, from: src });
      continue;
    }

    // Non-force path already filtered existed files above.
    writeText(dst, rendered);
    actions.push({ op: 'write', path: dst, from: src });
  }

  ok('[ok] Project hub initialized.');
  for (const a of actions) {
    const mode = a.mode ? ` (${a.mode})` : '';
    const reason = a.reason ? ` [${a.reason}]` : '';
    const from = a.from ? ` <- ${toPosix(path.relative(repoRoot, a.from))}` : '';
    console.log(`  ${a.op}: ${toPosix(path.relative(repoRoot, a.path))}${from}${mode}${reason}`);
  }
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
    const milestoneId = String(task.milestone_id || '').trim();
    if (!featureId) errors.push(`Task ${id} is missing feature_id.`);
    else if (!features.has(featureId)) errors.push(`Task ${id} references missing Feature ${featureId}.`);
    if (!milestoneId) errors.push(`Task ${id} is missing milestone_id.`);
    else if (!milestones.has(milestoneId)) {
      errors.push(`Task ${id} references missing Milestone ${milestoneId}.`);
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
    errors.push(`Failed to parse registry.yaml: ${registryParseError}`);
  }

  if (!registry) {
    warnings.push(
      'Project hub is not initialized. Run: node .ai/scripts/ctl-project-governance.mjs init'
    );
    devDocsRoots = discoverDevDocsRoots(repoRoot);
  } else {
    const REQUIRED_REGISTRY_KEYS = ['version', 'milestones', 'features', 'requirements', 'tasks'];
    for (const key of REQUIRED_REGISTRY_KEYS) {
      if (!(key in registry) || registry[key] === undefined) {
        errors.push(`Registry missing required top-level key: "${key}".`);
      }
    }
    validateRegistryGraph(registry, errors);

    const configured = getConfiguredRootsFromRegistry(registry);
    devDocsRoots =
      configured.length > 0
        ? configured.map((p) => path.resolve(repoRoot, p))
        : discoverDevDocsRoots(repoRoot);
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
      const hasMeta = names.includes('.ai-task.yaml');
      const allowed = new Set(['.ai-task.yaml', 'summary.md']);
      const extras = names.filter((name) => !allowed.has(name));
      if (!hasSummary || !hasMeta || extras.length > 0 || names.length !== 2) {
        const details = [];
        if (!hasMeta) details.push('missing .ai-task.yaml');
        if (!hasSummary) details.push('missing summary.md');
        if (extras.length > 0) details.push(`extra entries: ${extras.join(', ')}`);
        errors.push(
          `${formatTaskRef(task)}: Archived bundle must contain exactly .ai-task.yaml and summary.md` +
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

      if (roadmapRaw) {
        for (const roadmapError of validateRoadmap(roadmapRaw)) {
          errors.push(`${formatTaskRef(task)}: ${roadmapError}`);
        }
      }
    }

    if (task.phase === 'active' && statusRaw) {
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

    if (!metaRaw) {
      errors.push(`${formatTaskRef(task)}: Missing .ai-task.yaml.`);
      continue;
    }

    const meta = parseTaskMeta(metaRaw);

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

    if (task.effectiveStatus === 'done' && statusRaw) {
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
    if (Array.isArray(registry.milestones)) {
      for (const m of registry.milestones) {
        if (!m || typeof m !== 'object') continue;
        const id = String(m.id || '');
        const st = String(m.status || '').trim();
        if (st && !MILESTONE_STATUS.has(st)) {
          errors.push(`Milestone ${id}: Invalid status "${st}". Allowed: ${[...MILESTONE_STATUS].join(', ')}`);
        }
      }
    }
    if (Array.isArray(registry.features)) {
      for (const f of registry.features) {
        if (!f || typeof f !== 'object') continue;
        const id = String(f.id || '');
        const st = String(f.status || '').trim();
        if (st && !FEATURE_STATUS.has(st)) {
          errors.push(`Feature ${id}: Invalid status "${st}". Allowed: ${[...FEATURE_STATUS].join(', ')}`);
        }
      }
    }
    if (Array.isArray(registry.requirements)) {
      for (const r of registry.requirements) {
        if (!r || typeof r !== 'object') continue;
        const id = String(r.id || '');
        const st = String(r.status || '').trim();
        if (st && !REQUIREMENT_STATUS.has(st)) {
          errors.push(`Requirement ${id}: Invalid status "${st}". Allowed: ${[...REQUIREMENT_STATUS].join(', ')}`);
        }
      }
    }
  }

  if (strict && warnings.length > 0) {
    for (const warning of warnings) errors.push(`[strict] ${warning}`);
  }

  if (errors.length > 0) {
    header('Errors:');
    for (const e of errors) console.log(colors.red(`- ${e}`));
  }

  if (warnings.length > 0) {
    header('Warnings:');
    for (const w of warnings) console.log(colors.yellow(`- ${w}`));
  }

  const okExit = errors.length === 0;
  console.log(okExit ? colors.green('[ok] Lint passed.') : colors.red('[error] Lint failed.'));
  return { ok: okExit, errors, warnings };
}

function formatJsonLines(rows) {
  for (const r of rows) console.log(JSON.stringify(r));
}

function collectTaskRows({ repoRoot, quiet = false, fromBundles = false }) {
  // Works even when the hub is not initialized (falls back to scanning dev-docs roots).
  // `fromBundles` skips registry task projections but still honors configured roots: the bundle
  // (01-status.md State) is the status SoT, while registry.status can lag until `sync`.
  const loaded = loadRegistry(repoRoot);
  const registry = loaded.registry;
  if (!registry && loaded.error && !quiet) {
    // Keep stdout clean (JSONL/JSON), but surface the issue for operators.
    console.error(colors.yellow(`[warning] Failed to parse registry.yaml; falling back to dev-docs scan: ${loaded.error}`));
  }

  if (!fromBundles && registry && Array.isArray(registry.tasks)) {
    return registry.tasks
      .filter((t) => t && typeof t === 'object')
      .map((t) => ({
        id: String(t.id || ''),
        status: String(t.status || ''),
        slug: String(t.slug || ''),
        dev_docs_path: String(t.dev_docs_path || ''),
        feature_id: String(t.feature_id || ''),
        milestone_id: String(t.milestone_id || ''),
        title: String(t.title || ''),
        updated: String(t.updated || ''),
        keywords: Array.isArray(t.keywords) ? t.keywords.map((k) => String(k)) : [],
      }))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  }

  const roots = resolveDevDocsRoots(repoRoot, registry);
  const tasks = scanTasks(repoRoot, roots);
  const rows = [];

  for (const task of tasks) {
    const statusRaw = readText(task.statusPath);
    const roadmapRaw = readText(task.roadmapPath);
    const metaRaw = readText(task.metaPath);

    const effectiveStatus =
      task.phase === 'archive'
        ? 'archived'
        : (() => {
            if (!statusRaw) return '';
            const { status } = getBundleStatusFromStatusDoc(statusRaw, path.basename(task.statusPath));
            return status || '';
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
      keywords: keywords.map((k) => String(k)),
      meta_missing: !metaRaw,
      status_missing: !statusRaw,
      status_doc_path: toPosix(path.relative(repoRoot, task.statusPath)),
      roadmap_path: toPosix(path.relative(repoRoot, task.roadmapPath)),
      kickoff_status: getRoadmapKickoff(roadmapRaw).status || 'unknown',
    });
  }

  rows.sort((a, b) => String(a.id || '').localeCompare(String(b.id || '')));
  return rows;
}

function collectAllWorktreeTaskRows(repoRoot) {
  const rows = [];
  for (const worktree of listGitWorktrees(repoRoot)) {
    const registry = loadRegistry(worktree.path).registry;
    const registryTasks = new Map(
      (Array.isArray(registry?.tasks) ? registry.tasks : [])
        .filter((task) => task && typeof task === 'object' && TASK_ID_RE.test(String(task.id || '')))
        .map((task) => [String(task.id), task])
    );
    for (const task of collectTaskRows({ repoRoot: worktree.path, quiet: true, fromBundles: true })) {
      const projection = registryTasks.get(task.id) || {};
      rows.push({
        feature_id: String(projection.feature_id || ''),
        milestone_id: String(projection.milestone_id || ''),
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

function cmdQuery({ repoRoot, id, status, text, json, allWorktrees = false }) {
  // Query is designed for LLM consumption: default is JSONL (one object per line).
  function includesText(value, needle) {
    if (!needle) return true;
    const n = String(needle).toLowerCase();
    const v = String(value || '').toLowerCase();
    return v.includes(n);
  }

  function taskMatches(t) {
    if (id && String(t.id || '') !== id) return false;
    if (status && String(t.status || '').trim() !== status) return false;
    if (text) {
      const blobParts = [];
      for (const k of [
        'id',
        'slug',
        'title',
        'description',
        'goal',
        'status',
        'dev_docs_path',
        'feature_id',
        'milestone_id',
        'worktree_path',
        'worktree_branch',
      ]) {
        blobParts.push(String(t[k] || ''));
      }
      if (Array.isArray(t.keywords)) blobParts.push(t.keywords.join(' '));
      const blob = blobParts.join('\n');
      if (!includesText(blob, text)) return false;
    }
    return true;
  }

  const sourceRows = allWorktrees ? collectAllWorktreeTaskRows(repoRoot) : collectTaskRows({ repoRoot });
  const rows = sourceRows.filter(taskMatches);

  if (json) console.log(JSON.stringify(rows));
  else formatJsonLines(rows);
  return { ok: true, rows };
}

// Task context that a commit can be attributed to. `blocked` still counts as
// active: work is paused, but the task remains the current context.
const ACTIVE_TASK_STATUS = new Set(['in-progress', 'blocked']);

function resolveTaskContext({ repoRoot, taskId }) {
  // Always read status from the bundles (SoT), never from the registry cache:
  // a commit typically happens before `sync` has refreshed registry.status.
  const rows = collectTaskRows({ repoRoot, quiet: true, fromBundles: true }).filter((r) =>
    TASK_ID_RE.test(String(r.id || ''))
  );

  if (taskId) {
    const found = rows.find((r) => r.id === taskId);
    if (!found) return { ok: false, reason: 'not-found', candidates: [] };
    return { ok: true, task: found, candidates: [found] };
  }

  const inProgress = rows.filter((r) => r.status === 'in-progress');
  const pool = inProgress.length > 0 ? inProgress : rows.filter((r) => ACTIVE_TASK_STATUS.has(r.status));

  if (pool.length === 1) return { ok: true, task: pool[0], candidates: pool };
  if (pool.length === 0) return { ok: false, reason: 'none', candidates: [] };
  return { ok: false, reason: 'ambiguous', candidates: pool };
}

function taskIdsFromBranch(branch) {
  const matches = String(branch || '').match(/T-\d{3}/g) || [];
  return [...new Set(matches)];
}

function resolveResumeTaskContext({ repoRoot, taskId, branch }) {
  if (taskId) {
    const explicit = resolveTaskContext({ repoRoot, taskId });
    return { ...explicit, source: 'explicit', branch };
  }

  const branchTaskIds = taskIdsFromBranch(branch);
  if (branchTaskIds.length > 1) {
    return {
      ok: false,
      reason: 'branch-ambiguous',
      source: 'branch',
      branch,
      branchTaskIds,
      candidates: [],
    };
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

  const active = resolveTaskContext({ repoRoot, taskId: null });
  return { ...active, source: 'active', branch };
}

function docsTrailerValue(devDocsPath) {
  const p = toPosix(String(devDocsPath || '')).replace(/\/+$/, '');
  return p ? `${p}/` : '';
}

function runGit(repoRoot, args) {
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

function listGitWorktrees(repoRoot) {
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
    if (!current) continue;
    if (line.startsWith('branch refs/heads/')) current.branch = line.slice('branch refs/heads/'.length);
  }
  if (current) worktrees.push(current);

  return worktrees.length > 0
    ? worktrees
    : [{ path: path.resolve(repoRoot), branch: readCurrentBranch(repoRoot) }];
}

function taskIdsFromAllWorktrees(repoRoot) {
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
  return Array.from(ids);
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

/**
 * Task IDs linked by a `Task:` trailer anywhere in the repository's history, across all branches.
 * Used only to avoid reallocating an ID; never as a source of task state.
 */
function taskIdsFromAllBranches(repoRoot) {
  const raw = runGit(repoRoot, ['log', '--all', '--format=%B']);
  if (!raw) return [];
  const ids = new Set();
  for (const line of normalizeEol(raw).split('\n')) {
    const m = /^Task:[ \t]*(T-\d{3})[ \t]*$/.exec(line);
    if (m) ids.add(m[1]);
  }
  return Array.from(ids);
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
  '%H',
  '%h',
  '%aI',
  '%an',
  '%s',
  '%(trailers:key=Task,valueonly,separator=%x2C)',
  '%(trailers:key=Phase,valueonly,separator=%x2C)',
  '%(trailers:key=Docs,valueonly,separator=%x2C)',
  '%(trailers:key=Verify,valueonly,separator=%x2C)',
];

function readCommitTimeline({ repoRoot, scan }) {
  // Trailers are parsed by git itself, then filtered here. Filtering in JS
  // (instead of `git log --grep`) keeps the match exact and regex-free.
  const fmt = `${COMMIT_FIELDS.join('%x1f')}%x1e`;
  const raw = runGit(repoRoot, ['log', `--max-count=${scan}`, `--format=${fmt}`]);
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
      tasks: String(task || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      phase: String(phase || '').trim(),
      docs: String(docs || '').trim(),
      verify: String(verify || '').trim(),
    });
  }
  return records;
}

function countWorktreeChanges(repoRoot) {
  const status = readWorktreeStatus(repoRoot);
  return status === null ? null : status.count;
}

function readWorktreeStatus(repoRoot, limit = 10) {
  const raw = runGit(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']);
  if (raw === null) return null;
  const allEntries = raw
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim());
  return {
    clean: allEntries.length === 0,
    count: allEntries.length,
    entries: allEntries.slice(0, limit),
    truncated: allEntries.length > limit,
  };
}

function countCommitsTouchingPath(repoRoot, relPath) {
  // Counter-evidence for an empty timeline: commits may exist without a `Task:`
  // trailer (hooks are opt-in), and "no linked commits" must not be read as "no work".
  if (!relPath) return null;
  const raw = runGit(repoRoot, ['rev-list', '--count', 'HEAD', '--', relPath]);
  if (raw === null) return null;
  const n = Number.parseInt(raw.trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function cmdCurrentTask({ repoRoot, taskId, format }) {
  const res = resolveTaskContext({ repoRoot, taskId });

  if (!res.ok) {
    if (res.reason === 'not-found') {
      console.error(colors.red(`[error] Task not found: ${taskId}`));
      return { exitCode: 4 };
    }
    if (res.reason === 'ambiguous') {
      console.error(colors.yellow('[warning] Multiple active tasks; pass --task <T-###> to disambiguate:'));
      for (const c of res.candidates) console.error(`  - ${c.id} ${c.slug} (${c.status})`);
      return { exitCode: 2 };
    }
    console.error(colors.dim('[info] No active task (no in-progress or blocked task bundle found).'));
    return { exitCode: 3 };
  }

  const task = res.task;

  if (format === 'json') {
    console.log(JSON.stringify(task));
  } else if (format === 'id') {
    console.log(task.id);
  } else {
    // `trailers` is the hook-facing format: ready to append verbatim.
    console.log(`Task: ${task.id}`);
    const docs = docsTrailerValue(task.dev_docs_path);
    if (docs) console.log(`Docs: ${docs}`);
  }

  return { exitCode: 0, task };
}

function resumeFailureExitCode(reason) {
  if (reason === 'ambiguous' || reason === 'branch-ambiguous') return 2;
  if (reason === 'none') return 3;
  if (reason === 'not-found' || reason === 'branch-task-not-found') return 4;
  return 1;
}

function resumeFailureMessage(res) {
  if (res.reason === 'branch-ambiguous') {
    return `Current branch contains multiple task IDs: ${res.branchTaskIds.join(', ')}`;
  }
  if (res.reason === 'branch-task-not-found') {
    return `Task from current branch was not found: ${res.branchTaskIds[0]}`;
  }
  if (res.reason === 'ambiguous') {
    return 'Multiple active tasks exist; pass --task <T-###> or use a branch containing one task ID.';
  }
  if (res.reason === 'not-found') return 'The requested task was not found.';
  if (res.reason === 'none') return 'No active task was found; pass --task <T-###>.';
  if (res.reason === 'git-unavailable') return 'Unable to read Git history for context recovery.';
  return 'Unable to resolve a task for context recovery.';
}

function renderResumeFailure(res, json) {
  const limiter = createResumeTextLimiter();
  const allCandidates = Array.isArray(res.candidates) ? res.candidates : [];
  const branchTaskIds = Array.isArray(res.branchTaskIds) ? res.branchTaskIds.slice(0, RESUME_MAX_CANDIDATES) : [];
  if (Array.isArray(res.branchTaskIds) && res.branchTaskIds.length > RESUME_MAX_CANDIDATES) {
    limiter.mark('error.branch_task_ids');
  }
  if (allCandidates.length > RESUME_MAX_CANDIDATES) limiter.mark('error.candidates');

  const error = {
    reason: res.reason || 'unknown',
    message: limiter.text(resumeFailureMessage(res), RESUME_TEXT_LIMITS.warning, 'error.message'),
    branch: limiter.text(res.branch || '', RESUME_TEXT_LIMITS.short, 'error.branch'),
    branch_task_ids: branchTaskIds,
    candidates: allCandidates
      .slice(0, RESUME_MAX_CANDIDATES)
      .map((candidate, index) => ({
          id: candidate.id,
          slug: limiter.text(candidate.slug, RESUME_TEXT_LIMITS.short, `error.candidates[${index}].slug`),
          state: candidate.status,
          docs_path: limiter.text(
            candidate.dev_docs_path,
            RESUME_TEXT_LIMITS.path,
            `error.candidates[${index}].docs_path`
          ),
        })),
    truncated_fields: limiter.fields,
  };

  if (json) console.log(JSON.stringify({ version: 3, error }));
  else {
    console.error(colors.yellow(`[warning] ${error.message}`));
    for (const candidate of error.candidates) {
      console.error(`  - ${candidate.id} ${candidate.slug} (${candidate.state})`);
    }
  }

  return resumeFailureExitCode(res.reason);
}

function readResumeStatus(repoRoot, task) {
  const taskDir = path.join(repoRoot, task.dev_docs_path);
  const statusPath = resolveTaskStatusDoc(taskDir);
  const statusRaw = readText(statusPath);
  const status = statusRaw
    ? getBundleStatusFromStatusDoc(statusRaw, path.basename(statusPath))
    : { status: null, error: 'Missing 01-status.md.' };
  const nextStep = getMarkdownListField(statusRaw, 'Progress', 'Next step');

  return {
    path: toPosix(path.relative(repoRoot, statusPath)),
    state: status.status || task.status || 'unknown',
    goal: getMarkdownSectionText(statusRaw, 'Goal') || null,
    next_step: nextStep || null,
    status_error: status.error || null,
  };
}

function readResumePitfalls(repoRoot, task) {
  const taskDir = path.join(repoRoot, task.dev_docs_path);
  const pitfallsPath = resolveTaskPitfallsDoc(taskDir);
  const pitfallsRaw = readText(pitfallsPath);
  return {
    path: toPosix(path.relative(repoRoot, pitfallsPath)),
    present: pitfallsRaw !== null,
    items: getPitfallTableItems(pitfallsRaw, 5),
  };
}

function readResumeRoadmap(repoRoot, task) {
  const taskDir = path.join(repoRoot, task.dev_docs_path);
  const roadmapPath = resolveTaskRoadmapDoc(taskDir);
  const roadmapRaw = readText(roadmapPath);
  const kickoff = getRoadmapKickoff(roadmapRaw);
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

  if (worktree && !worktree.clean) {
    commands.push('git status --short', 'git diff');
  }

  const latest = commits.at(-1);
  if (latest) commands.push(`git show --stat ${latest.sha}`);

  return { reads, commands };
}

function renderResumeText(packet) {
  console.log(`Task: ${packet.task.id} ${packet.task.slug}`);
  console.log(`State: ${packet.task.state}`);
  console.log(`Goal: ${packet.status.goal || 'unknown'}`);
  console.log(`Docs: ${packet.task.docs_path}`);
  console.log(`Next step: ${packet.status.next_step || 'unknown'}`);
  console.log(`Kickoff: ${packet.roadmap.kickoff_status}`);
  console.log(`Resolution: ${packet.task.resolution}`);
  console.log(`Branch: ${packet.repository.branch || 'unknown'}`);
  console.log(`HEAD: ${packet.repository.head || 'unknown'}`);
  console.log('');
  console.log('Recent checkpoints:');

  if (packet.timeline.commits.length === 0) {
    console.log('- unknown (no linked commits found)');
  } else {
    for (const commit of packet.timeline.commits) {
      console.log(`- ${commit.commit} ${commit.subject}`);
      if (commit.phase) console.log(`  Phase hint: ${commit.phase}`);
      if (commit.verify) console.log(`  Verify: ${commit.verify}`);
    }
  }

  console.log('');
  if (packet.worktree === null) {
    console.log('Worktree: unknown');
  } else if (packet.worktree.clean) {
    console.log('Worktree: clean');
  } else {
    console.log(`Worktree: dirty (${packet.worktree.count} repo-wide change(s))`);
    for (const entry of packet.worktree.entries) console.log(`- ${entry}`);
    if (packet.worktree.truncated) console.log('- ...');
  }

  if (packet.do_not_repeat.length > 0) {
    console.log('');
    console.log('Do not repeat:');
    for (const item of packet.do_not_repeat) console.log(`- ${item}`);
  }

  if (packet.warnings.length > 0) {
    console.log('');
    console.log('Warnings:');
    for (const warning of packet.warnings) console.log(`- ${warning}`);
  }

  if (packet.truncated_fields.length > 0) {
    console.log('');
    console.log('Truncated fields:');
    for (const field of packet.truncated_fields) console.log(`- ${field}`);
  }

  console.log('');
  console.log('Suggested reads:');
  for (const read of packet.suggested_reads) console.log(`- ${read}`);

  if (packet.suggested_commands.length > 0) {
    console.log('');
    console.log('Suggested commands:');
    for (const command of packet.suggested_commands) console.log(`- ${command}`);
  }
}

function cmdResume({ repoRoot, taskId, limit, scan, limitClamped, scanClamped, json }) {
  const branch = readCurrentBranch(repoRoot);
  const resolved = resolveResumeTaskContext({ repoRoot, taskId, branch });
  if (!resolved.ok) {
    return { exitCode: renderResumeFailure(resolved, json) };
  }

  const task = resolved.task;
  const statusDoc = readResumeStatus(repoRoot, task);
  const roadmap = readResumeRoadmap(repoRoot, task);
  const pitfalls = readResumePitfalls(repoRoot, task);
  const records = readCommitTimeline({ repoRoot, scan });
  if (records === null) {
    const failure = {
      ok: false,
      reason: 'git-unavailable',
      branch,
      branchTaskIds: taskIdsFromBranch(branch),
      candidates: [],
    };
    return { exitCode: renderResumeFailure(failure, json) };
  }

  const linked = records.filter((record) => record.tasks.includes(task.id));
  const commits = linked
    .slice(0, limit)
    .reverse()
    .map(({ commit, sha, date, author, subject, phase, verify }) => ({
      commit,
      sha,
      date,
      author,
      subject,
      phase,
      verify,
    }));
  const worktree = readWorktreeStatus(repoRoot);
  const warnings = [];

  if (limitClamped) warnings.push(`Requested commit limit exceeded the maximum; using ${limit}.`);
  if (scanClamped) warnings.push(`Requested scan limit exceeded the maximum; using ${scan}.`);
  if (statusDoc.status_error) warnings.push(statusDoc.status_error);
  if (!statusDoc.goal) warnings.push(`Goal is missing from ${statusDoc.path}.`);
  if (!statusDoc.next_step) warnings.push(`Next step is missing from ${statusDoc.path}.`);
  if (roadmap.kickoff_status === 'unknown') {
    warnings.push(`Kickoff status is missing or invalid in ${roadmap.path}.`);
  }
  if (linked.length === 0) {
    warnings.push(`No commit carries "Task: ${task.id}"; linked progress is unknown, not zero.`);
  }
  if (records.length >= scan) warnings.push(`Commit scan limit reached (${scan}); older commits were not examined.`);
  if (worktree === null) warnings.push('Worktree state is unavailable.');
  else if (!worktree.clean) {
    warnings.push(`${worktree.count} repo-wide uncommitted change(s) may be ahead of the linked commit timeline.`);
  }

  const suggestions = buildResumeSuggestions({ task, commits, worktree, pitfalls });
  const limiter = createResumeTextLimiter();
  const boundedCommits = commits.map((commit, index) => ({
    commit: commit.commit,
    sha: commit.sha,
    date: limiter.text(commit.date, RESUME_TEXT_LIMITS.short, `timeline.commits[${index}].date`),
    author: limiter.text(commit.author, RESUME_TEXT_LIMITS.short, `timeline.commits[${index}].author`),
    subject: limiter.text(
      commit.subject,
      RESUME_TEXT_LIMITS.commitSubject,
      `timeline.commits[${index}].subject`
    ),
    phase: limiter.text(
      commit.phase,
      RESUME_TEXT_LIMITS.commitMetadata,
      `timeline.commits[${index}].phase`
    ),
    verify: limiter.text(
      commit.verify,
      RESUME_TEXT_LIMITS.commitMetadata,
      `timeline.commits[${index}].verify`
    ),
  }));
  const boundedWorktree =
    worktree === null
      ? null
      : {
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
    suggested_reads: suggestions.reads.map((read, index) =>
      limiter.text(read, RESUME_TEXT_LIMITS.path, `suggested_reads[${index}]`)
    ),
    suggested_commands: suggestions.commands.map((command, index) =>
      limiter.text(command, RESUME_TEXT_LIMITS.path, `suggested_commands[${index}]`)
    ),
  };
  packet.truncated_fields = [...limiter.fields];

  if (json) console.log(JSON.stringify(packet));
  else renderResumeText(packet);
  return { exitCode: 0, packet };
}

function cmdCommits({ repoRoot, taskId, limit, scan, json }) {
  const res = resolveTaskContext({ repoRoot, taskId });
  if (!res.ok) {
    if (res.reason === 'not-found') console.error(colors.red(`[error] Task not found: ${taskId}`));
    else if (res.reason === 'ambiguous') {
      console.error(colors.yellow('[warning] Multiple active tasks; pass --task <T-###>:'));
      for (const c of res.candidates) console.error(`  - ${c.id} ${c.slug} (${c.status})`);
    } else {
      console.error(colors.yellow('[warning] No active task found; pass --task <T-###>.'));
    }
    return { ok: false };
  }

  const task = res.task;
  const records = readCommitTimeline({ repoRoot, scan });
  if (records === null) {
    console.error(colors.red('[error] Unable to read git history (not a git repository, or git is unavailable).'));
    return { ok: false };
  }

  const matched = records.filter((r) => r.tasks.includes(task.id));
  // Output oldest -> newest so "the last line" is unambiguously the latest commit.
  // The limit still keeps the *most recent* N commits.
  const rows = matched.slice(0, limit).reverse();

  if (json) console.log(JSON.stringify(rows));
  else formatJsonLines(rows);

  // Progress calibration hints go to stderr so stdout stays machine-readable.
  console.error(
    colors.dim(
      `[info] ${task.id} ${task.slug} (${task.status}): ${matched.length} linked commit(s), showing ${rows.length} (scanned ${scan}).`
    )
  );

  if (records.length >= scan) {
    console.error(colors.dim(`[info] Scan limit reached (${scan}); older commits were not examined. Raise --scan for full history.`));
  }

  if (matched.length === 0) {
    console.error(colors.yellow(`[warning] No commit carries "Task: ${task.id}". Treat the timeline as UNKNOWN, not as zero progress.`));
    const touched = countCommitsTouchingPath(repoRoot, task.dev_docs_path);
    if (touched) {
      console.error(
        colors.yellow(
          `[warning] ${touched} commit(s) touched ${task.dev_docs_path} without the trailer; the work is likely committed but unlinked.`
        )
      );
      console.error(colors.dim(`[info] Inspect manually: git log --oneline -- ${task.dev_docs_path}`));
    }
  }

  const dirty = countWorktreeChanges(repoRoot);
  if (dirty) {
    console.error(
      colors.yellow(
        `[warning] ${dirty} uncommitted change(s) in the worktree (repo-wide count, possibly unrelated to this task); the timeline may be behind the actual state.`
      )
    );
  }

  return { ok: true, rows };
}

function computeChangelogEntries({ prevById, nextById, todayStr }) {
  const lines = [];

  for (const [id, next] of nextById.entries()) {
    const prev = prevById.get(id);
    if (!prev) {
      lines.push(
        `- ${todayStr} task_id=${id} slug=${next.slug || ''} event=registered dev_docs_path=${next.dev_docs_path || ''}`.trimEnd()
      );
      continue;
    }
    const prevStatus = String(prev.status || '');
    const nextStatus = String(next.status || '');
    if (prevStatus && nextStatus && prevStatus !== nextStatus) {
      lines.push(
        `- ${todayStr} task_id=${id} slug=${next.slug || ''} event=status from=${prevStatus} to=${nextStatus}`.trimEnd()
      );
    }
  }

  return lines;
}

function appendChangelog({ repoRoot, changelogPath, entries, dryRun, apply, initIfMissing }) {
  if (!entries || entries.length === 0) return;

  let base = readText(changelogPath);
  if (!base && initIfMissing) {
    const templatesDir = getTemplatesDir(repoRoot);
    const tpl = path.join(templatesDir, 'changelog.md');
    const tplRaw = readText(tpl);
    if (tplRaw) base = renderTemplate(tplRaw, templateVars());
  }

  if (!base) {
    // Do not fail sync for changelog issues.
    return { ok: false, error: `Missing changelog file: ${toPosix(path.relative(repoRoot, changelogPath))}` };
  }

  const normalized = normalizeEol(base).trimEnd() + '\n';
  const hasEntries = /(^|\n)## Entries\s*\n/.test(normalized);
  const toAppend = entries.join('\n') + '\n';
  const next = hasEntries ? normalized + toAppend : normalized + '\n## Entries\n' + toAppend;

  if (dryRun || !apply) {
    return { ok: true, planned: true, next };
  }

  const changed = writeTextIfChanged(changelogPath, next);
  return { ok: true, changed };
}

function cmdSync({ repoRoot, dryRun, apply, initIfMissing, changelog }) {
  const actions = [];
  const errors = [];
  const warnings = [];

  const registryPath = getRegistryPath(repoRoot);
  let reg = null;
  let hubMissing = !exists(registryPath);

  if (!hubMissing) {
    const loaded = loadRegistry(repoRoot);
    if (!loaded.registry) {
      errors.push(`Failed to parse registry.yaml: ${loaded.error || '(unknown error)'}`);
      return { ok: false, errors, warnings, actions };
    }
    reg = loaded.registry;
  } else {
    if (!initIfMissing) {
      errors.push(
        'Project hub missing. Run: node .ai/scripts/ctl-project-governance.mjs init'
      );
      return { ok: false, errors, warnings, actions };
    }

    const templatesDir = getTemplatesDir(repoRoot);
    const tplRegistryPath = path.join(templatesDir, 'registry.yaml');
    const tplRaw = readText(tplRegistryPath);
    if (!tplRaw) {
      errors.push(`Missing registry template: ${toPosix(path.relative(repoRoot, tplRegistryPath))}`);
      return { ok: false, errors, warnings, actions };
    }

    try {
      reg = parseYaml(renderTemplate(tplRaw, templateVars()));
    } catch (e) {
      errors.push(`Failed to parse registry template: ${e.message || String(e)}`);
      return { ok: false, errors, warnings, actions };
    }

    // Plan/init hub files if missing
    const hubDir = getHubDir(repoRoot);
    const templateFiles = ['registry.yaml', 'dashboard.md', 'feature-map.md', 'task-index.md', 'changelog.md'];
    if (dryRun || !apply) {
      actions.push({ op: 'mkdir', path: hubDir, note: 'init hub', mode: 'dry-run' });
      for (const file of templateFiles) {
        actions.push({
          op: 'write',
          path: path.join(hubDir, file),
          note: 'init hub',
          mode: 'dry-run',
        });
      }
    } else {
      cmdInit({ repoRoot, dryRun: false, force: false });
      hubMissing = false;
      const loaded = loadRegistry(repoRoot);
      if (!loaded.registry) {
        errors.push(`Cannot load registry after init: ${toPosix(path.relative(repoRoot, registryPath))}`);
        return { ok: false, errors, warnings, actions };
      }
      reg = loaded.registry;
    }
  }

  // Snapshot previous registry tasks for optional changelog append.
  const prevById = new Map();
  if (reg && Array.isArray(reg.tasks)) {
    for (const t of reg.tasks) {
      if (!t || typeof t !== 'object') continue;
      const id = String(t.id || '').trim();
      if (!id) continue;
      prevById.set(id, {
        status: String(t.status || ''),
        slug: String(t.slug || ''),
        dev_docs_path: String(t.dev_docs_path || ''),
      });
    }
  }

  let roots = getConfiguredRootsFromRegistry(reg).map((p) => path.resolve(repoRoot, p));
  if (roots.length === 0) roots = discoverDevDocsRoots(repoRoot);

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

    const effectiveStatus = task.phase === 'archive' ? 'archived' : (() => {
      if (!statusRaw) return null;
      const { status } = getBundleStatusFromStatusDoc(statusRaw, path.basename(task.statusPath));
      return status;
    })();

    if (!metaRaw) {
      const id = nextId();
      const meta = {
        task_id: id,
        slug: task.slug,
        status: effectiveStatus || 'planned',
        updated: todayStr,
        keywords: [],
      };
      const rendered = renderTaskMetaYaml(meta);
      if (dryRun || !apply) {
        actions.push({ op: 'write', path: task.metaPath, note: `allocate ${id}`, mode: 'dry-run' });
      } else {
        writeText(task.metaPath, rendered);
        actions.push({ op: 'write', path: task.metaPath, note: `allocate ${id}` });
      }
      task.taskId = id;
    } else {
      const meta = parseTaskMeta(metaRaw);
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
        const rendered = renderTaskMetaYaml(nextMeta);
        if (dryRun || !apply) {
          actions.push({ op: 'update', path: task.metaPath, note: 'refresh derived fields', mode: 'dry-run' });
        } else {
          const changed = writeTextIfChanged(task.metaPath, rendered);
          if (changed) actions.push({ op: 'update', path: task.metaPath, note: 'refresh derived fields' });
        }
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
    if (!entry.milestone_id) entry.milestone_id = 'M-000';

    tasksById.set(task.taskId, entry);
  }

  reg.tasks = [...tasksById.values()].sort((a, b) => String(a.id).localeCompare(String(b.id)));

  // Optional changelog entries are derived from prev->next registry drift.
  const nextById = new Map();
  for (const t of reg.tasks) {
    if (!t || typeof t !== 'object') continue;
    const id = String(t.id || '').trim();
    if (!id) continue;
    nextById.set(id, {
      status: String(t.status || ''),
      slug: String(t.slug || ''),
      dev_docs_path: String(t.dev_docs_path || ''),
    });
  }

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
  if (!Array.isArray(reg.task_doc_roots) || reg.task_doc_roots.length === 0) {
    reg.task_doc_roots = roots.map((r) => toPosix(path.relative(repoRoot, r)));
  }

  // Write registry
  const registryOut = dumpYamlDoc(reg);
  if (dryRun || !apply) {
    actions.push({ op: 'update', path: registryPath, note: 'update registry', mode: 'dry-run' });
  } else {
    const changed = writeTextIfChanged(registryPath, registryOut);
    if (changed) actions.push({ op: 'update', path: registryPath, note: 'update registry' });
  }

  // Optional: append changelog events (apply-mode only; append-only).
  if (changelog) {
    const hubDir = getHubDir(repoRoot);
    const changelogPath = path.join(hubDir, 'changelog.md');
    const entries = computeChangelogEntries({ prevById, nextById, todayStr });
    const res = appendChangelog({
      repoRoot,
      changelogPath,
      entries,
      dryRun,
      apply,
      initIfMissing,
    });
    if (res?.ok === false) {
      warnings.push(String(res.error || 'Failed to append changelog.'));
    } else if (entries.length > 0) {
      actions.push({
        op: 'append',
        path: changelogPath,
        note: `changelog (${entries.length} entries)`,
        mode: dryRun || !apply ? 'dry-run' : undefined,
      });
    }
  }

  // Derived views
  const templatesDir = getTemplatesDir(repoRoot);
  const vars = templateVars();

  const hubDir = getHubDir(repoRoot);
  const dashboardPath = path.join(hubDir, 'dashboard.md');
  const featureMapPath = path.join(hubDir, 'feature-map.md');
  const taskIndexPath = path.join(hubDir, 'task-index.md');

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

  const dashAuto = [
    '## Summary',
    '',
    `- Tasks: ${counts.total} (planned: ${counts.planned}, in-progress: ${counts.inProgress}, blocked: ${counts.blocked}, done: ${counts.done}, archived: ${counts.archived})`,
    '',
    '## Recent tasks',
    '',
    '| Task | Status | Feature | Dev Docs |',
    '| --- | --- | --- | --- |',
    ...regTasks
      .slice()
      .sort((a, b) => String(b.updated || '').localeCompare(String(a.updated || '')))
      .slice(0, 20)
      .map((t) => {
        const taskLabel = `${t.id} ${t.slug || ''}`.trim();
        const feature = String(t.feature_id || '');
        const dev = String(t.dev_docs_path || '');
        return `| ${taskLabel} | ${t.status || ''} | ${feature} | ${dev} |`;
      }),
    '',
  ].join('\n');

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

  const taskIndexAutoLines = [];
  taskIndexAutoLines.push('## Tasks');
  taskIndexAutoLines.push('');
  taskIndexAutoLines.push('| Task | Status | Feature | Dev Docs |');
  taskIndexAutoLines.push('| --- | --- | --- | --- |');
  for (const t of regTasks.slice().sort((a, b) => String(a.id).localeCompare(String(b.id)))) {
    const label = `${t.id} ${t.slug || ''}`.trim();
    taskIndexAutoLines.push(`| ${label} | ${t.status || ''} | ${t.feature_id || ''} | ${t.dev_docs_path || ''} |`);
  }
  taskIndexAutoLines.push('');
  const taskIndexAuto = taskIndexAutoLines.join('\n');

  function updateDerived(filePath, blockId, content) {
    let base = readText(filePath);
    const existedOnDisk = base !== null;
    if (!base && initIfMissing) {
      // In init-if-missing mode, use the rendered template as the base for dry-run planning.
      const tplName = path.basename(filePath);
      const tplPath = path.join(templatesDir, tplName);
      const tplRaw = readText(tplPath);
      if (tplRaw) base = renderTemplate(tplRaw, vars);
    }

    if (!base) {
      warnings.push(`Missing derived view file: ${toPosix(path.relative(repoRoot, filePath))} (run init).`);
      return;
    }

    // For files that already existed on disk, refuse full-file replacement when markers
    // are missing (prevents destroying manual notes). Freshly created templates are safe.
    const next = replaceAutoBlock(base, blockId, content, filePath, !existedOnDisk);
    if (next === null) {
      // Markers missing in existing file; skipped to prevent data loss.
      warnings.push(
        `Skipped update of ${toPosix(path.relative(repoRoot, filePath))}: missing AUTO-GENERATED markers for "${blockId}". Restore markers or run init --force to recreate.`
      );
      return;
    }

    if (dryRun || !apply) {
      actions.push({ op: 'update', path: filePath, note: `regen ${blockId}`, mode: 'dry-run' });
      return;
    }

    const changed = writeTextIfChanged(filePath, next);
    if (changed) actions.push({ op: 'update', path: filePath, note: `regen ${blockId}` });
  }

  updateDerived(dashboardPath, 'dashboard', dashAuto);
  updateDerived(featureMapPath, 'feature-map', featureAuto);
  updateDerived(taskIndexPath, 'task-index', taskIndexAuto);

  // Summary
  const okExit = errors.length === 0;
  if (!okExit) {
    header('Errors:');
    for (const e of errors) console.log(colors.red(`- ${e}`));
  }
  if (warnings.length > 0) {
    header('Warnings:');
    for (const w of warnings) console.log(colors.yellow(`- ${w}`));
  }

  if (okExit) ok('[ok] Sync complete.');
  else console.log(colors.red('[error] Sync failed.'));

  for (const a of actions) {
    const mode = a.mode ? ` (${a.mode})` : '';
    const note = a.note ? ` (${a.note})` : '';
    console.log(`  ${a.op}: ${toPosix(path.relative(repoRoot, a.path))}${note}${mode}`);
  }

  return { ok: okExit, errors, warnings, actions };
}

function cmdMap({ repoRoot, taskId, featureId, milestoneId, requirementId, dryRun, apply }) {
  const errors = [];
  const actions = [];

  if (!taskId || !TASK_ID_RE.test(taskId)) {
    errors.push(`Invalid or missing --task (expected T-###, got "${taskId || ''}").`);
    return { ok: false, errors, actions };
  }

  if (!featureId && !milestoneId && !requirementId) {
    errors.push('At least one of --feature, --milestone, or --requirement is required.');
    return { ok: false, errors, actions };
  }

  // Validate ID formats.
  if (featureId && !FEATURE_ID_RE.test(featureId)) {
    errors.push(`Invalid --feature ID format (expected F-###, got "${featureId}").`);
    return { ok: false, errors, actions };
  }
  if (milestoneId && !MILESTONE_ID_RE.test(milestoneId)) {
    errors.push(`Invalid --milestone ID format (expected M-###, got "${milestoneId}").`);
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

  // Validate milestone exists
  if (milestoneId) {
    const milestoneExists = Array.isArray(reg.milestones) && reg.milestones.some((m) => m && m.id === milestoneId);
    if (!milestoneExists) {
      errors.push(`Milestone "${milestoneId}" not found in registry.`);
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
  if (milestoneId && taskEntry.milestone_id !== milestoneId) {
    changes.push(`milestone_id: ${taskEntry.milestone_id || '(none)'} -> ${milestoneId}`);
    taskEntry.milestone_id = milestoneId;
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
  const registryOut = dumpYamlDoc(reg);
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
    writeTextIfChanged(loaded.path, dumpYamlDoc(registry));
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
    writeTextIfChanged(loaded.path, dumpYamlDoc(registry));
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
    case 'install':
      cmdInstall({ repoRoot, dryRun: !!opts['dry-run'] });
      break;
    case 'init':
      cmdInit({ repoRoot, dryRun: !!opts['dry-run'], force: !!opts.force });
      break;
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
            initIfMissing: !!opts['init-if-missing'],
            changelog: !!opts.changelog,
          });
        res = apply && !dryRun ? withGovernanceWriteLock(repoRoot, runSync) : runSync();
      } catch (error) {
        console.error(colors.red(`[error] Sync aborted: ${error?.message || String(error)}`));
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
      const res = cmdQuery({
        repoRoot,
        id: id || null,
        status: status || null,
        text: text || null,
        json,
        allWorktrees: !!opts['all-worktrees'],
      });
      process.exit(res.ok ? 0 : 1);
      break;
    }
    case 'current-task': {
      const taskId = opts.task ? String(opts.task).trim() : '';
      const format = String(opts.format || 'trailers').trim();
      if (!['trailers', 'id', 'json'].includes(format)) {
        console.error(colors.red(`[error] Unknown --format: ${format} (expected trailers|id|json)`));
        process.exit(1);
      }
      const res = cmdCurrentTask({ repoRoot, taskId: taskId || null, format });
      process.exit(res.exitCode);
      break;
    }
    case 'resume': {
      const taskId = opts.task ? String(opts.task).trim() : '';
      const limit = parseBoundedPositiveInt(
        opts.limit,
        RESUME_DEFAULT_COMMIT_LIMIT,
        RESUME_MAX_COMMIT_LIMIT
      );
      const scan = parseBoundedPositiveInt(
        opts.scan,
        RESUME_DEFAULT_SCAN_LIMIT,
        RESUME_MAX_SCAN_LIMIT
      );
      const res = cmdResume({
        repoRoot,
        taskId: taskId || null,
        limit: limit.value,
        scan: scan.value,
        limitClamped: limit.clamped,
        scanClamped: scan.clamped,
        json: !!opts.json,
      });
      process.exit(res.exitCode);
      break;
    }
    case 'commits': {
      const taskId = opts.task ? String(opts.task).trim() : '';
      const limit = Number.parseInt(String(opts.limit || '20'), 10);
      const scan = Number.parseInt(String(opts.scan || '500'), 10);
      const res = cmdCommits({
        repoRoot,
        taskId: taskId || null,
        limit: Number.isFinite(limit) && limit > 0 ? limit : 20,
        scan: Number.isFinite(scan) && scan > 0 ? scan : 500,
        json: !!opts.json,
      });
      process.exit(res.ok ? 0 : 1);
      break;
    }
    case 'map': {
      const taskId = opts.task ? String(opts.task).trim() : '';
      const featureId = opts.feature ? String(opts.feature).trim() : '';
      const milestoneId = opts.milestone ? String(opts.milestone).trim() : '';
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
            milestoneId: milestoneId || null,
            requirementId: requirementId || null,
            dryRun: dryRun || !apply,
            apply: apply && !dryRun,
          });
        res = apply && !dryRun ? withGovernanceWriteLock(repoRoot, runMap) : runMap();
      } catch (error) {
        console.error(colors.red(`[error] Mapping aborted: ${error?.message || String(error)}`));
        process.exit(1);
      }
      if (!res.ok) {
        header('Errors:');
        for (const e of res.errors) console.log(colors.red(`- ${e}`));
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
          colors.red(`[error] Requirement resolution aborted: ${error?.message || String(error)}`)
        );
        process.exit(1);
      }

      if (!res.ok) {
        header('Errors:');
        for (const error of res.errors) console.log(colors.red(`- ${error}`));
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
        console.error(colors.red(`[error] Feature resolution aborted: ${error?.message || String(error)}`));
        process.exit(1);
      }

      if (!res.ok) {
        header('Errors:');
        for (const error of res.errors) console.log(colors.red(`- ${error}`));
      }
      process.exit(res.ok ? 0 : 1);
      break;
    }
    default:
      console.error(colors.red(`[error] Unknown command: ${command}`));
      usage(1);
  }
}

main();

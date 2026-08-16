---
name: project-orchestrator
description: The single writing entry point for project-level governance. Turns a new or ongoing request into a decision (reuse vs new task, mapping to Milestone/Feature/Requirement), operates hub sync and lint to repair drift and regenerate derived views, and captures LLM-authored semantic extraction in structured non-AUTO sections. Planning and coordination only, not product code changes. For read-only progress questions use project-status-reporter instead.
---

# Project Orchestrator

## Purpose
Provide a **single front door** for every change to project-level governance:
- Prevent duplicate work
- Keep semantic mapping clean (Feature/Requirement <-> Task)
- Advance the project mainline (milestones, priorities)
- Repair drift and regenerate derived views (sync/lint)
- Ensure feature-level semantic summaries stay current in structured docs

Project Orchestrator is **project-management oriented**. The workflow must not implement product
code changes.

## When to use
Use Project Orchestrator when the request involves any of the following:
- Starting a new development request (feature, bug fix, refactor, integration)
- Continuing work but needing to locate the right task or decide whether to create a new task
- Mapping work to Milestones/Features/Requirements
- Updating project status, milestones, priorities, scope, or archival decisions
- Writing project-level updates (`registry.yaml`, `changelog.md`) to maintain long-term continuity
- Initializing the hub, validating it, or repairing metadata drift
- Performing or refreshing semantic extraction for feature-level summaries (`feature-map.md`) and focus indexing (`dashboard.md`)

## When to avoid
- Purely local implementation inside an already-scoped task, with no scope/status/mapping change.
  Proceed with task-level execution workflows and run sync later.
- Read-only progress questions ("what is in flight?", "what is blocked?"). Use
  `project-status-reporter`, which cannot modify files.

## Inputs
- Natural-language request (new work or continuation)
- Optional: constraints (scope, deadlines, dependencies)
- Optional: pointers to existing task docs (`dev-docs/**/active/<task>/...`)

## Commands

The full command reference lives in `.ai/project/AGENTS.md`. The commands used by this workflow:

```bash
node .ai/scripts/ctl-project-governance.mjs init                    # create the hub (idempotent)
node .ai/scripts/ctl-project-governance.mjs lint --check            # validate; errors fail, warnings do not
node .ai/scripts/ctl-project-governance.mjs query --text "<words>"  # find related work
node .ai/scripts/ctl-project-governance.mjs sync --dry-run          # preview repairs
node .ai/scripts/ctl-project-governance.mjs sync --apply            # repair + regenerate derived views
node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-002 --apply
```

`sync --apply` is idempotent. Add `--changelog` to append registration/status events, and
`--init-if-missing` to create hub files before syncing.

## Process (high-level)

1. Ensure the project hub exists.
   - If missing, run `init`.
2. Load the current project state:
   - Prefer reading `.ai/project/registry.yaml`
   - Run `lint --check` for sanity if needed
3. Search for related work:
   - Prefer `query` first (LLM-friendly output): `query --text "<keywords>"`, `query --status in-progress`
   - If the hub is missing, `query` falls back to scanning `dev-docs/**`
   - Cross-check existing task bundles under `dev-docs/**` when needed
4. Extract semantic signals from current task docs (at minimum `00-overview.md`, `01-plan.md`, and `03-implementation-notes.md` when present):
   - Intent, scope-in/scope-out, decisions, dependencies, risks, success signal, next checkpoint
5. Decide: reuse an existing Task vs propose a new Task.
6. If a new Task is needed:
   - Propose a stable task slug (kebab-case)
   - Do **not** create the task bundle here
   - Instruct to create the bundle at `dev-docs/active/<slug>/` via a task-level workflow, then run `sync --apply` to register it
7. Update project hub semantics (when needed):
   - Update `registry.yaml` to map Milestone/Feature/Requirement <-> Task (complete mapping, avoid long-lived `F-000`)
   - Update semantic sections:
     - `.ai/project/feature-map.md` non-AUTO `Semantic Feature Briefs` (full semantic extraction)
     - `.ai/project/dashboard.md` `Focus` (concise index only; no full semantic body)
   - Changelog: prefer `sync --apply --changelog` for registration/status events; add manual entries only for non-status events
8. Apply: run `sync --apply`, then `lint --check`.

### Drift repair flow

When the request is specifically "the hub is out of date" rather than a triage decision:

1. `lint --check` — see what is broken
2. `sync --dry-run --init-if-missing` — preview the repairs
3. `query --status in-progress` and `query --status blocked` — review mappings for active work
4. Complete semantic extraction and update `feature-map.md`
5. `sync --apply`

## Semantic Governance Requirements

### 1) Complete task-feature records
- Active tasks MUST have a valid `task_id`, with status sourced from `00-overview.md`.
- Active tasks SHOULD be mapped to an explicit `feature_id` and `milestone_id` in `registry.yaml`.
- Tasks in `in-progress` or `blocked` MUST NOT remain on `F-000` unless intentionally triaged and
  explicitly noted in the `feature-map.md` semantic briefs section.
- Tasks tied to concrete requirements SHOULD include `requirement_ids`.

### 2) Semantic extraction (LLM-authored, structured)
- Perform extraction from current artifacts, at minimum:
  - `dev-docs/**/active/<task>/00-overview.md`
  - `dev-docs/**/active/<task>/01-plan.md`
  - `dev-docs/**/active/<task>/03-implementation-notes.md` (if present)
  - `.ai/project/registry.yaml`
- Record the result in `.ai/project/feature-map.md`, non-AUTO section (`Semantic Feature Briefs`).
- `dashboard.md` focus MAY be updated as a concise index, but MUST NOT contain the full extraction body.
- Feature briefs SHOULD cover: intent, scope in/out, decision, dependencies, risks, success signal,
  related tasks, and next checkpoint.

### 3) Structure discipline
- Keep AUTO-generated marker blocks intact.
- Treat non-AUTO sections as narrative context; treat AUTO sections as machine-generated facts.

## Outputs

Output MUST include a triage decision and an actionable command sequence.

### Output Fields

| Field | Description | Example |
|-------|-------------|---------|
| Decision | `REUSE_TASK` / `NEW_TASK` / `PROJECT_UPDATE` | `NEW_TASK` |
| Rationale | One sentence explanation | "No existing task covers OAuth2 integration" |
| Task ID | `T-xxx` or `pending assignment` | `T-005` |
| Slug | kebab-case task slug | `oauth2-provider-integration` |
| Mapping | `M-xxx > F-xxx > R-xxx > T-xxx` | `M-001 > F-002 > R-003 > T-005` |
| Semantic Summary | Structured brief fields for the feature | `Intent / Scope / Risks / Next checkpoint` |
| Next Actions | Numbered command/skill list | See below |

### Next Actions by Decision Type

| Decision | Next Actions |
|----------|--------------|
| NEW_TASK | 1. Create a dev-docs task bundle under `dev-docs/**/active/<slug>/` 2. Update `feature-map.md` semantic briefs (full) and `dashboard.md` focus (index) 3. `sync --apply` 4. `lint --check` |
| REUSE_TASK | 1. Read `dev-docs/**/active/<slug>/00-overview.md` 2. Refresh `feature-map.md` semantic brief if feature posture changed 3. (if needed) Update `State:` then `sync --apply` |
| PROJECT_UPDATE | 1. Edit `.ai/project/registry.yaml` 2. Update `feature-map.md` semantic briefs and `dashboard.md` focus index 3. `sync --apply` |

## Verification
- After updating hub files: `node .ai/scripts/ctl-project-governance.mjs lint --check`
- After a semantic intent/scope change:
  - Confirm the `feature-map.md` semantic brief was updated in the same change.
  - Confirm `dashboard.md` stays concise (focus index, no duplicated semantic body).
  - Confirm no `in-progress` or `blocked` task is parked on `F-000` without a stated reason.

## Boundaries
- Do not implement product code changes in the workflow.
- Do not create task bundles under `dev-docs/**` (delegate to task-level workflows).
- Do not hand-edit AUTO-generated sections; regenerate them with `sync --apply`.
- Do not treat AUTO-generated derived sections as semantic narrative; semantic summaries belong in the `feature-map.md` non-AUTO section.
- Do not treat `.ai-task.yaml` `status` as authoritative for task progress; `00-overview.md` `State:` wins.
- Do not add Python or third-party dependencies to governance tooling.

## Contract
Hub behavior MUST follow `.ai/project/CONTRACT.md`; task-layer behavior MUST follow
`dev-docs/AGENTS.md`.
- Do not introduce new files or rename contract files without explicit approval.
- Do not duplicate task execution details into the project hub; keep references and summaries only.

---
name: project-orchestrator
description: The single writing entry point for project-level governance — decide whether a request reuses an existing task or needs a new one, map work to Milestone/Feature/Requirement, run hub sync and lint to repair drift and regenerate derived views, and keep the feature briefs current. Use when starting a new development request, when locating the right task for continuing work, when scope, status, priorities, or archival decisions change, or when the hub is out of date. Planning and coordination only; never implements product code. For read-only progress questions use project-status-reporter instead.
---

# Project Orchestrator

The front door for anything that changes project-level governance. Its job is to stop two failures:
the same work being started twice, and the registry quietly diverging from what the task bundles say.

Skip the workflow for local implementation inside an already-scoped task that changes no scope,
status, or mapping. Run `sync --apply` later and carry on.

## Commands

Full reference: `.ai/project/AGENTS.md`. What this workflow uses:

```bash
node .ai/scripts/ctl-project-governance.mjs init                    # create the hub (idempotent)
node .ai/scripts/ctl-project-governance.mjs query --text "<words>"  # find related work
node .ai/scripts/ctl-project-governance.mjs lint --check            # errors fail, warnings do not
node .ai/scripts/ctl-project-governance.mjs sync --dry-run          # preview repairs
node .ai/scripts/ctl-project-governance.mjs sync --apply            # repair + regenerate views
node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-002 --apply
```

`sync --apply` is idempotent. Add `--changelog` to append registration and status events;
`--init-if-missing` to create hub files first.

## Workflow

1. **Ensure the hub exists.** Missing means run `init`.

2. **Find related work before proposing anything new.** Start with `query --text "<keywords>"` and
   `query --status in-progress`; cross-check bundles under `dev-docs/**` when the output is thin.
   `query` falls back to scanning `dev-docs/**` when the hub is absent.

3. **Read the semantics of what already exists** — `00-overview.md`, `01-plan.md`, and
   `03-implementation-notes.md` where present: intent, scope in/out, decisions, dependencies, risks,
   success signal, next checkpoint.

4. **Decide** — reuse an existing task, open a new one, or update the project itself.

5. **For a new task**, propose a stable kebab-case slug and hand bundle creation to
   `start-dev-docs-task`. Do not create bundles here. Once the bundle exists, `sync --apply`
   registers it.

6. **Update hub semantics** where the decision changed them: map Milestone/Feature/Requirement to
   Task in `registry.yaml`, refresh the feature brief, keep the dashboard focus a short index.

7. **Apply and verify** — `sync --apply`, then `lint --check`.

### When the request is only "the hub is stale"

`lint --check` → `sync --dry-run --init-if-missing` → review `query --status in-progress` and
`--status blocked` mappings → refresh feature briefs → `sync --apply`.

## Semantic governance

**Complete the mapping.** Active tasks need a valid `task_id` with status from `00-overview.md`,
and should carry an explicit `feature_id` and `milestone_id`. A task that is `in-progress` or
`blocked` must not sit on `F-000` unless the triage decision is stated in the feature briefs.
Tasks tied to concrete requirements should carry `requirement_ids`.

**Extract semantics from current artifacts,** at minimum `00-overview.md`, `01-plan.md`,
`03-implementation-notes.md` when present, and `registry.yaml`. Record the result in the non-AUTO
`Semantic Feature Briefs` section of `.ai/project/feature-map.md`, covering intent, scope in/out,
decision, dependencies, risks, success signal, related tasks, next checkpoint.

**Respect the AUTO boundary.** Non-AUTO sections are narrative written by an author; AUTO blocks are
machine-generated facts. Keep the markers intact, and put the semantic body in `feature-map.md`
rather than the dashboard, which holds a focus index only.

## Output

Report a decision and the commands that follow:

| Field | Example |
|-------|---------|
| Decision | `REUSE_TASK` / `NEW_TASK` / `PROJECT_UPDATE` |
| Rationale | "No existing task covers OAuth2 integration" |
| Task | `T-005` or `pending assignment` |
| Slug | `oauth2-provider-integration` |
| Mapping | `M-001 > F-002 > R-003 > T-005` |
| Semantic summary | Intent / Scope / Risks / Next checkpoint |
| Next actions | Numbered commands or skills |

Next actions by decision:

- **NEW_TASK** — `start-dev-docs-task` for the bundle → refresh feature brief and dashboard focus →
  `sync --apply` → `lint --check`
- **REUSE_TASK** — read the task's `00-overview.md` → refresh the feature brief if posture changed →
  update `State:` and `sync --apply` if needed
- **PROJECT_UPDATE** — edit `registry.yaml` → refresh feature brief and focus index → `sync --apply`

## Rules

- Never implement product code here.
- Never create task bundles under `dev-docs/**`; that belongs to `start-dev-docs-task`.
- Never hand-edit an AUTO-generated section; regenerate with `sync --apply`.
- Never treat `.ai-task.yaml` `status` as authoritative — `00-overview.md` `State:` wins.
- Never leave a semantic change unpaired: a changed intent or scope updates the feature brief in the
  same change.
- Never add Python or third-party dependencies to governance tooling.

## Contract

Hub behavior: `.ai/project/CONTRACT.md`. Task-layer behavior: `dev-docs/AGENTS.md`. Do not add or
rename contract files without approval, and keep task execution detail in the bundle rather than
copying that detail into the hub.

# Pack: project-hub

A registry that aggregates dev-docs task bundles into a Milestone / Feature / Requirement view,
with deterministic validation and regeneration.

Answers a different question from `dev-docs-continuity`: not *how do I resume this task*, but
*what is the state of everything, and does the record still match reality?*

## When the pack earns its keep

The hub exists for `lint` and `sync` — deterministic drift detection and idempotent regeneration.
Every other command is a convenience over what an agent can do by reading files.

Install the hub when several tasks run in parallel and the mapping between work and goals stops
fitting in one head. For a single active task at a time, `dev-docs-continuity` alone is the better
trade.

## Dependencies

- **`dev-docs-continuity` pack** (required). The hub aggregates task bundles; it does not create
  them, and it does not define what a task is. `dev-docs/AGENTS.md` owns the task layer.
- **Node.js** (Node built-ins only — no npm install, no third-party packages).

## Install

```bash
cp -R packs/project-hub/files/. /path/to/your/project/
cd /path/to/your/project
node .ai/scripts/ctl-project-governance.mjs init
```

`init` is idempotent and creates the five hub files under `.ai/project/`.

## Contents

| Path | Role |
|------|------|
| `.ai/project/CONTRACT.md` | Hub-layer contract: IDs, status enums, scanning, lint/sync policy |
| `.ai/project/AGENTS.md` | Entry point and the **sole command reference** |
| `.ai/project/templates/` | The 5 hub files `init` materializes |
| `.ai/scripts/ctl-project-governance.mjs` | The control script (8 commands) |
| `.ai/scripts/lib/` | `colors.mjs`, `yaml-lite.mjs` — the script's only imports |
| `.ai/skills/workflows/planning/project-orchestrator/` | The one **writing** skill: triage, mapping, sync/lint, semantic extraction |
| `.ai/skills/workflows/planning/project-status-reporter/` | The one **read-only** skill: status reporting |
| `.githooks/pre-commit` | Auto-syncs the hub when `dev-docs/` files are staged |
| `.githooks/install.mjs` | Points `core.hooksPath` at `.githooks/` (shared, idempotent) |

### Two skills, split by write access

`project-orchestrator` decides and writes. `project-status-reporter` only reads, and is bound by an
explicit `MUST NOT modify files`. Keeping them apart preserves that guarantee — a read-only
question can be answered without ever reaching for a skill that can mutate the hub.

Sync and lint used to be a third skill. Running the control script is a step inside a governance
decision rather than a decision of its own, so that content moved into the orchestrator, and the
command reference now lives once in `.ai/project/AGENTS.md`.

## Commands

```bash
node .ai/scripts/ctl-project-governance.mjs init          # create the hub
node .ai/scripts/ctl-project-governance.mjs lint --check  # validate (CI-safe; warnings do not fail)
node .ai/scripts/ctl-project-governance.mjs sync --apply  # repair drift, regenerate derived views
node .ai/scripts/ctl-project-governance.mjs query --status in-progress
node .ai/scripts/ctl-project-governance.mjs resume --json # bounded context packet
node .ai/scripts/ctl-project-governance.mjs commits --task T-001
node .ai/scripts/ctl-project-governance.mjs current-task --format id
node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-002 --apply
```

`resume` is the accelerated form of the Resume Protocol in `dev-docs/AGENTS.md`: same semantics,
one call instead of six reads, with bounded output that will not flood the context window.

## Single project by design

The hub holds exactly one project. There is no `--project` flag, no `.ai/project/<slug>/`
partitioning, and no `P-xxx` ID space. A repository that genuinely hosts several independent
projects should run several hubs — one per repository.

## Layering

`CONTRACT.md` covers the hub layer only. Task progress, task identity, and the `.ai-task.yaml`
schema are defined once in `dev-docs/AGENTS.md` and referenced here, so the two cannot drift.

| Layer | Owner | Covers |
|-------|-------|--------|
| Task | `dev-docs/AGENTS.md` (dev-docs-continuity) | `State:`, `task_id`, `.ai-task.yaml`, `Task:` trailer |
| Hub | `.ai/project/CONTRACT.md` (this pack) | `M-xxx` / `F-xxx` / `R-xxx`, registry, derived views, lint/sync |

## Boundaries

- The task bundle stays authoritative for status. The registry is a derived cache and MUST be
  regenerated, never hand-edited inside AUTO blocks.
- `sync --apply` is idempotent; safe after any task change.
- The hub does not implement product code changes.

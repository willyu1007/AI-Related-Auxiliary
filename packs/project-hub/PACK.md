# Pack: project-hub

A registry that aggregates dev-docs task bundles into a Milestone / Feature / Requirement view,
with deterministic validation and regeneration.

Answers a different question from `dev-docs-continuity`: not *how do I resume one task*, but
*what is the state of everything, and does the record still match reality?*

## When the pack earns its keep

The hub exists for `lint` and `sync` — deterministic drift detection and idempotent regeneration.
Every other command is a convenience over what an agent can do by reading files.

Install the hub when several tasks run in parallel and the mapping between work and goals stops
fitting in one head. For a single active task at a time, `dev-docs-continuity` alone is the better
trade.

## Dependencies

- **`dev-docs-continuity` pack** (required). The hub aggregates task bundles rather than creating
  them, and does not define what a task is. `dev-docs/AGENTS.md` owns the task layer.
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

### Where the skills went

The pack ships no skills. Hub work happens at the moment where each action belongs, inside the
global task skills in `system/skills/`:

| Hub work | Lives in |
|----------|----------|
| Find related work, register a new task, map to a Feature | `start-task` |
| Propagate status, repair drift, the `pre-commit` hook | `sync-task` |
| Refresh the feature brief, append the changelog, archive | `handoff-task` |
| `resume --json` fast path | `resume-task` |
| Read-only progress questions across tasks | `project-status` |

Governance used to be a layer with its own front-door skill. Splitting by moment instead means each
governance action sits in the workflow that actually triggers it, and no skill exists solely to
route between the others.

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

`resume` is the accelerated form of the protocol in the `resume-task` skill: same semantics,
one call instead of six reads, with bounded output that will not flood the context window.

## Single project by design

The hub holds exactly one project. There is no `--project` flag, no `.ai/project/<slug>/`
partitioning, and no `P-xxx` ID space. A repository genuinely hosting several independent projects
should run several hubs — one per repository.

## Layering

`CONTRACT.md` covers the hub layer only. Task progress, task identity, and the `.ai-task.yaml`
schema are defined once in `dev-docs/AGENTS.md` and referenced from here, so the two cannot drift.

| Layer | Owner | Covers |
|-------|-------|--------|
| Task | `dev-docs/AGENTS.md` (dev-docs-continuity) | `State:`, `task_id`, `.ai-task.yaml`, `Task:` trailer |
| Hub | `.ai/project/CONTRACT.md` (this pack) | `M-xxx` / `F-xxx` / `R-xxx`, registry, derived views, lint/sync |

## Boundaries

- The task bundle stays authoritative for status. The registry is a derived cache: regenerate it,
  never hand-edit inside AUTO blocks.
- `sync --apply` is idempotent and safe after any task change.
- The hub never implements product code changes.

# Project governance

`.ai/project/` is the cross-task semantic hub. It relates durable task work to project-level
Milestones, Features, and Requirements without replacing task records or repository reality.

## Authority boundaries

- Task bundles own task identity, goal, progress, decisions, design, verification, and lifecycle.
- `.ai/project/registry.yaml` owns Milestones, Features, Requirements, their relationships,
  task mappings, and task-root configuration.
- Registry task entries are projections. They never override task identity, progress, kickoff
  readiness, or completion evidence.
- Git history proves committed work; each linked worktree proves its current uncommitted state.

## Task projection interface

The hub consumes these task facts:

- `.ai-task.yaml` supplies stable `T-###` identity and optional display metadata.
- An active bundle's `01-status.md` supplies `planned | in-progress | blocked | done`, goal,
  current phase, next step, blocker, and completion conditions.
- `00-roadmap.md` supplies independent `pending | ready` kickoff readiness for queries and
  recovery context.
- Archive location supplies effective `archived` state; an archived bundle contains exactly
  `.ai-task.yaml` and `summary.md`.
- `done` requires kickoff `ready` and a non-empty, fully checked completion checklist.

## Project graph

- Milestone IDs use `M-###`; `M-000` is the Inbox / Triage Milestone.
- Feature IDs use `F-###`; `F-000` is the Inbox / Untriaged Feature and belongs to `M-000`.
- Requirement IDs use `R-###`.
- Milestone statuses are `planned | in-progress | blocked | done`.
- Feature and Requirement statuses are `planned | in-progress | blocked | done | cut`.
- Every Feature references an existing Milestone.
- Every Requirement references an existing Feature.
- Every task projection references existing Feature and Milestone objects. Any Requirement it
  references belongs to the same Feature.
- IDs are unique, stable, monotonically allocated, and never reused. `F-000` is only for an
  explicitly deferred triage decision.

## Consistency and worktrees

- Configured task roots take precedence over discovery; only immediate children of `active/`
  and `archive/` are task bundles.
- Allocation and write-mode mapping use the shared governance lock under Git's common directory.
- Task allocation considers metadata in every linked worktree, the current registry, and task
  trailers across branch history. Feature and Requirement allocation considers every linked
  worktree registry.
- Cross-worktree search surfaces possible duplicates for review. Confirmed duplicates, divergent
  copies of one task, and lock failures are stop conditions.
- Mapping accepts existing project objects only; it never invents a caller-supplied ID.
- Each valid task bundle has one registry projection with its actual path and effective status.
- Report disagreements among bundles, registry projections, Git, and worktrees instead of
  silently choosing a source.

## Derived views

- `dashboard.md`, `feature-map.md`, and `task-index.md` are derived views.
- AUTO-GENERATED sections are replaceable projections and must not be hand-edited.
- Manual Feature Briefs may summarize Feature-level intent, boundaries, dependencies, and success
  signals. They link tasks without copying mutable task facts.
- `changelog.md` is an append-only project event log, not a source of current task state.

## Change control

These semantics change only when the governance system itself is explicitly being revised. Keep
this file, the control script, templates, task workflows, and behavioral checks aligned.

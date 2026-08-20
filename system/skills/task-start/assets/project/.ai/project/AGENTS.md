# Project governance

`.ai/project/` is the cross-task semantic hub. It relates durable task work to project-level
Milestones, Features, and Requirements without replacing task records or repository reality.

## Authority boundaries

- Task bundles own task identity, goal, progress, decisions, design, verification, and lifecycle.
- `.ai/project/registry.json` owns Milestones, Features, Requirements, their relationships, task
  mappings, and a lightweight deferred-idea list.
- Registry task entries are projections. They never override task identity, progress, kickoff
  readiness, or completion evidence.
- Git history proves committed work; each linked worktree proves its current uncommitted state.

## Task projection interface

The hub consumes these task facts:

- `.ai-task.json` supplies stable `T-###` identity and optional display metadata.
- An active bundle's `01-status.md` supplies `planned | in-progress | blocked | done`, goal,
  current phase, next step, blocker, and completion conditions.
- `00-roadmap.md` supplies independent `pending | ready` kickoff readiness for queries and
  recovery context.
- Archive location supplies effective `archived` state; an archived bundle contains exactly
  `.ai-task.json` and `summary.md`.
- `done` requires kickoff `ready`, a non-empty fully checked completion checklist, and one
  matching `pass` row with decisive evidence for every completion condition.

## Project graph

- Milestone IDs use `M-###`; `M-000` is the Inbox / Triage Milestone.
- A real Milestone is a low-frequency project-stage outcome that groups the Features needed for
  that outcome. Keep work in `M-000` when no explicit stage goal has been confirmed.
- Feature IDs use `F-###`; `F-000` is the Inbox / Untriaged Feature and belongs to `M-000`.
- Requirement IDs use `R-###`.
- Milestone statuses are `planned | in-progress | blocked | done`.
- Feature and Requirement statuses are `planned | in-progress | blocked | done | cut`.
- Every Feature references an existing Milestone.
- Every Requirement references an existing Feature.
- Every task projection references an existing Feature. Its Milestone is derived only through
  that Feature; task entries never store an independent `milestone_id`. Any Requirement the task
  references belongs to the same Feature.
- Milestone and Feature statuses are project-level claims, not task-count rollups. Task states are
  progress evidence; they may reveal a contradiction or possible readiness, but never change a
  Milestone or Feature status automatically. A real Milestone is `done` only after its outcome is
  accepted and all in-scope Features are `done` or `cut`.
- IDs are unique, stable, monotonically allocated, and never reused. `F-000` is only for an
  explicitly deferred triage decision.

## Deferred ideas

- `registry.json` `ideas` is a low-frequency parking place for “worth remembering, not now” notes.
- Each item contains only `idea`, with enough context to understand it later.
- Ideas have no ID, registration, status, dashboard projection, or separate document. When one is
  selected, implement it directly if the work is bounded and low risk; create a normal dev-docs
  task bundle only when durable tracking is otherwise justified. Delete the Idea after direct
  implementation succeeds or the task bundle takes over.

## Consistency and worktrees

- The task-document root is the repository's top-level `dev-docs/` directory. Only immediate
  children of its `active/` and `archive/` directories are task bundles.
- Allocation and write-mode mapping use the shared governance lock under Git's common directory.
- Task allocation considers metadata in every linked worktree, the current registry, and task
  trailers across branch history. Milestone, Feature, and Requirement allocation considers every
  linked worktree registry.
- Cross-worktree search returns one logical row per valid task ID and preserves its occurrences in
  `worktrees`. Equal copies collapse into that row. `conflict: true` means one or more task facts
  differ; the differing top-level facts are unset and `conflicts` preserves the evidence. Do not
  select a source until the disagreement is resolved.
- Confirmed duplicate goals under distinct task IDs and lock failures are stop conditions.
- Mapping accepts existing project objects only; it never invents a caller-supplied ID.
- Each valid task bundle has one registry projection with its actual path and effective status.
- Report disagreements among bundles, registry projections, Git, and worktrees instead of
  silently choosing a source.

## Derived views

- `dashboard.md` and `feature-map.md` are derived views with bounded manual sections.
- AUTO-GENERATED sections are replaceable projections and must not be hand-edited.
- Manual Feature Briefs may summarize Feature-level intent, boundaries, dependencies, and success
  signals. They link tasks without copying mutable task facts.

## Change control

These semantics change only when the governance system itself is explicitly being revised. Keep
this file, the control script, templates, task workflows, and behavioral checks aligned.

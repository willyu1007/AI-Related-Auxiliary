# Project governance

`.ai/project/` is the cross-task semantic hub. It relates durable task work to project-level
Milestones and Features without replacing task records or repository reality.

## Authority boundaries

- Task bundles own task identity, goal, progress, decisions, design, verification, and lifecycle.
- `.ai/project/registry.json` owns Milestones, Features, their relationships, task mappings, and a
  lightweight deferred-idea list. A Feature's `title` and `description` are its semantic authority.
- Registry task entries are projections. They never override task identity, progress, kickoff
  readiness, or completion evidence.
- Git history proves committed work; each linked worktree proves its current uncommitted state.

## Task projection interface

The hub consumes these task facts:

- `.ai-task.json` supplies stable `T-###` identity, directory slug, and optional search keywords;
  it does not duplicate status, dates, or other lifecycle facts.
- An active bundle's `01-status.md` supplies `planned | in-progress | blocked | done`, goal,
  current phase, next step, blocker, and the current `Done when` acceptance references.
- `00-roadmap.md` supplies independent `pending | ready` kickoff readiness for queries and
  recovery context.
- Archive location supplies effective `archived` state; an archived bundle contains exactly
  `.ai-task.json` and `summary.md`.
- `done` requires kickoff `ready` and remains a task-bundle claim grounded in repository reality,
  decisive verification, and required acceptance under `dev-docs/AGENTS.md`. The hub never derives
  completion from `Done when` or roadmap phase criteria.

## Project graph

- Milestone IDs use `M-###`; `M-000` is the Inbox / Triage Milestone.
- A real Milestone is a low-frequency project-stage outcome that groups the Features needed for
  that outcome. Keep work in `M-000` when no explicit stage goal has been confirmed.
- Feature IDs use `F-###`; `F-000` is the Inbox / Untriaged Feature and belongs to `M-000`.
- Milestone statuses are `planned | in-progress | blocked | done`.
- Feature statuses are `planned | in-progress | blocked | done | cut`.
- Every Feature references an existing Milestone.
- Every task projection references an existing Feature. Its Milestone is derived only through
  that Feature; task entries never store an independent `milestone_id`.
- Registry records use one exact shape: Milestones contain `id`, `title`, `status`, and
  `description`; Features add `milestone_id`; task projections contain `id`, `slug`, `status`,
  `updated`, `dev_docs_path`, and `feature_id`; Ideas contain only `idea`. Extra fields are not a
  secondary extension mechanism.
- Milestone and Feature statuses are project-level claims, not task-count rollups. Task states are
  progress evidence; they may reveal a contradiction or possible readiness, but never change a
  Milestone or Feature status automatically. A real Milestone is `done` only after its outcome is
  accepted and all in-scope Features are `done` or `cut`.
- IDs are unique, stable, monotonically allocated, and never reused. `F-000` is only for an
  explicitly deferred triage decision.

## Deferred ideas

- `registry.json` `ideas` is a low-frequency parking place for “worth remembering, not now” notes.
- Each item contains only `idea`, with enough context to understand it later.
- Ideas have no ID, registration, status, dashboard projection, or separate document. Selecting an
  Idea grants no implementation authorization and adds no tracking requirement of its own: apply
  the same task-creation gate as any other incoming work — an explicit tracking request, a record
  that must survive sessions or handoff, risk or cross-cutting impact needing durable decisions,
  or an outcome that belongs in the project hub. Work that triggers none of these may be
  implemented directly; work that triggers any of them opens a normal dev-docs task bundle even
  when it is not a new capability. Delete the Idea after direct implementation succeeds or the
  task bundle takes over.

## Consistency and worktrees

- The task-document root is the repository's top-level `dev-docs/` directory. Only immediate
  children of its `active/` and `archive/` directories are task bundles.
- Allocation and write-mode mapping use the shared governance lock under Git's common directory.
- Task allocation considers metadata in every linked worktree, the current registry, and task
  trailers across branch history. Milestone and Feature allocation considers every linked
  worktree registry.
- Cross-worktree search returns one logical row per valid task ID and preserves its occurrences in
  `worktrees`. Freshness is judged on full bundle content plus the registry projection, not only
  on query facts: an evolution that lives only in roadmap, architecture, verification, or
  supporting documents still counts. Content-equal copies collapse into one row. When copies
  differ but Git proves linear evolution — since the merge base only one side changed, counting
  uncommitted edits — the newest occurrence supplies the row's facts and strictly older copies are
  listed in `stale_worktrees`; equally newest copies are interchangeable and never stale.
  `conflict: true` remains for concurrent divergence and for any unprovable or unreadable
  evidence, including divergence only in non-query documents; the differing top-level facts are
  unset and `conflicts` preserves what was seen. A `documents` conflict carries a `reason`
  (`concurrent-divergence`, `unrelated-history`, `missing-lineage`, `unreadable-evidence`), the
  content-equivalence groups of worktrees in `values`, and the occurrence and stage that failed
  in `evidence`. Do not select a source for a conflicted row until the disagreement is resolved.
- Evidence enumeration itself is fail-closed: when linked worktrees, branch history, or a task
  root cannot be enumerated — including a registered worktree whose directory is missing — every
  governance command stops instead of degrading to "empty" or "only the current worktree". Only
  a directory that verifiably does not exist yet (governance not installed) is an empty state.
- Branch-tip task evidence is interpreted under the exact metadata schema, and the metadata slug
  must match the bundle directory; schema drift or slug mismatch makes the evidence unverifiable
  rather than silently compatible or absent.
- In a worktree listed as stale, sync only records that worktree's local reality; never copy the
  newest occurrence's facts into a stale bundle. Recovery and implementation belong in the newest
  occurrence, or bring the stale worktree level through Git first.
- Registry Milestone and Feature values are project-level semantic decisions, so they do not use
  the task rule: any same-ID divergence across linked worktree registries is a stop condition
  until the registries are reconciled.
- `project-query --json` returns the Milestone and Feature union across linked worktrees. Each
  logical row preserves its worktree occurrences and exact same-ID semantic conflicts; conflicted
  values remain unset until reconciled.
- Changing a task-to-Feature mapping stays fail-closed while the task has multiple checked-out
  copies; resolve to one writable occurrence or coordinate every occurrence as one edit.
- `invalid: true` means at least one occurrence has invalid task metadata. `metadata_errors`
  preserves those diagnostics; do not use that row as task evidence until the metadata is fixed.
- Confirmed duplicate goals under distinct task IDs and lock failures are stop conditions.
- Mapping accepts existing project objects only; it never invents a caller-supplied ID.
- Each valid task bundle has one registry projection with its actual path and effective status.
- A registry task entry whose bundle no longer exists in any linked worktree or at any local
  branch tip is removed only through `sync --prune`. Branch-tip evidence is verified by stable
  task ID — never by the recorded path or slug, which can be renamed on other branches; surviving
  or unverifiable evidence refuses the prune, and projection entries are never hand-deleted.
- Report disagreements among bundles, registry projections, Git, and worktrees instead of
  silently choosing a source.

## Derived views

- `dashboard.md` and `feature-map.md` are derived views.
- AUTO-GENERATED sections are replaceable projections and must not be hand-edited.

## Change control

These semantics change only when the governance system itself is explicitly being revised. Keep
the installer, this file, the control script, templates, and task workflows aligned. Replacing an
installed fixed asset requires an explicit resource refresh.

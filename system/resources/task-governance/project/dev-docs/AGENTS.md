# Task documentation

`dev-docs/` is the repository record for durable task intent, progress, design, verification,
recovery, and history. This file defines the stable meaning of a task bundle. The workflow active
at a particular moment defines how to create, plan, synchronize, resume, hand off, inspect, or
archive it.

Only the repository's top-level `dev-docs/` directory is governed as the task-document root.

## Bundle shapes

Each immediate child of `dev-docs/active/` is one active task:

```text
dev-docs/active/<slug>/
├── .ai-task.json
├── 00-roadmap.md
├── 01-status.md
├── 02-architecture.md
└── verification.md
```

These five files are required. The task may also contain the common optional entries described
below or other supporting documents and directories when the actual work benefits from them. Give
each addition a distinct, durable purpose and do not use one to duplicate the goal, status, plan,
decisions, architecture, or verification authorities.

Templates are starting shapes, not a request for filler. Preserve headings and fields consumed by
governance tooling, adapt the depth to the task, remove authoring prompts, and record uncertainty
instead of inventing facts. Omit irrelevant optional detail where the contract allows it.

Each immediate child of `dev-docs/archive/` is one archived task and contains exactly:

```text
dev-docs/archive/<slug>/
├── .ai-task.json
└── summary.md
```

Archive location makes the effective state `archived`. `summary.md` preserves the durable outcome
and evidence; the active working files do not survive the archive transition.

When behavior, interfaces, or implementation paths described in task records are removed or
replaced, identify the affected active bundles and archived summaries and reconcile them in the
same checkpoint. Preserve historical outcomes, but mark superseded content so it cannot be
mistaken for the live system.

## Document responsibilities

- **`.ai-task.json`** — Stable task identity and lookup metadata. It contains exactly schema
  version, `task_id`, directory `slug`, and `keywords`; progress and timestamps live elsewhere.
- **`00-roadmap.md`** — Decision alignment and rationale, working assumptions, relationships
  touching this task, the implementation kickoff gate, phased route, phase closeout, and recovery
  strategy.
- **`01-status.md`** — Current goal, progress state, phase, next step, blocker, and the current
  `Done when` acceptance references.
- **`02-architecture.md`** — Current settled technical design and contracts, without alternatives
  or decision history.
- **`verification.md`** — Planned checks and the latest decisive evidence for relevant claims,
  acceptance references, phase outcomes, and material limitations.
- **`implementation.md`** *(optional)* — Current realization map when architecture alone is not
  enough to resume safely.
- **`pitfalls.md`** *(optional)* — Current anti-error register for recurring, evidenced hazards.
- **`requirement.md`** *(optional)* — Requirements-alignment input; it does not override the
  current status or roadmap.
- **`artifacts/` and other supporting entries** *(optional)* — Task-specific evidence or context
  with a stated purpose and no competing authority.

Update these as current snapshots. Git history retains superseded states; avoid chronological
journals and repeated raw logs in the main documents.

`Done when` holds the task's current acceptance references. They help planning, review, and
verification, but do not independently prove completion or override confirmed requirements,
repository reality, verification evidence, or required user acceptance. Revise them when the
understood outcome changes. Roadmap phase outcomes and exit criteria guide execution only; they do
not define task acceptance.

## Lifecycle model

Progress lives in `01-status.md` under `## Progress` as exactly one `State:` value:

- **`planned`** — The task is opened but no later alignment, discovery, or implementation
  checkpoint has landed.
- **`in-progress`** — Work is actively advancing.
- **`blocked`** — External input or a dependency prevents meaningful progress.
- **`done`** — The task-level completion contract below holds.

### Completion contract

Mark a task `done` only when all three claims hold at the task boundary:

- **Outcome closure** — Repository reality supports the goal as an end-to-end outcome, and no
  known in-scope roadmap work remains unresolved.
- **Implementation or artifact quality** — Relevant review and checks are complete, and no known
  material defect, unresolved review finding, temporary instrumentation, or residue contradicts
  the accepted outcome or repository conventions.
- **Semantic convergence** — Code, interfaces, configuration, documentation, the task bundle, and
  the project hub agree on the accepted result; no unintended parallel old/new paths, duplicated
  behavior, or competing authority remains.

Ground each claim in decisive evidence and obtain any required user acceptance. For non-code
tasks, apply the quality claim to the delivered artifacts. An explicit transitional dual track may
remain while work is in progress only when its purpose, recovery boundary, and exit are recorded.
Before completion, remove the superseded path unless permanent compatibility is part of the
confirmed outcome.

Implementation readiness lives separately in the roadmap kickoff gate:

- Every new task starts `pending`.
- While `pending`, alignment and independent discovery may continue, but implementation that
  depends on the unresolved route may not.
- `ready` means the roadmap gate is fully satisfied and the first implementation action is
  executable.
- Kickoff is `pending` whenever evidence invalidates a gating premise or route; route-dependent
  implementation remains paused until alignment is restored.
- A `done` task must have kickoff `ready`.

Checking every `Done when` item does not make a task `done`, and an outdated item must be revised
rather than used to block or justify completion mechanically.

A completed task remains active with `State: done` until an authorized archive transition is
performed.

## Authorities and repository reality

Use each source only for what it proves:

- The task bundle owns its task-level identity, intent, progress, design, verification, and
  lifecycle according to the document responsibilities above.
- The project hub provides the cross-task semantic map. `.ai/project/registry.json` owns
  Milestones, Features, and their task mappings; its task entries are projections of task bundles.
- Generated hub views are derived and may be rebuilt. Neither registry task entries nor generated
  views override a task bundle.
- Git history proves committed work; a task commit carries exactly one `Task: T-###` trailer.
- The worktree proves current uncommitted work.

Report disagreements instead of silently choosing one source. Never describe uncommitted or
missing work as landed.

## Using a bundle

1. Read `01-status.md` for the task head.
2. Read current `pitfalls.md` when present, reconcile linked commits and worktree changes, and
   check roadmap kickoff before implementation.
3. Expand to roadmap decisions and phases, architecture, implementation context, verification, or
   other supporting documents only for the current question.
4. When reality changes, update only the documents whose responsibility changed and keep status
   pointed at the first unfinished action.

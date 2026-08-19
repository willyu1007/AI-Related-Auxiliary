# Task documentation

This directory is the repository authority for durable task planning, progress, recovery, and archive records. Read this file before deciding whether work needs a tracked task and before creating, updating, resuming, handing off, or archiving one.

## Creation gate

Create a tracked task when any of these holds:

- The user explicitly asks to open or track a task, or to persist a repository roadmap.
- The work introduces a product or system capability that should appear in the project hub.
- The work must survive a session boundary, pause, or handoff.
- The work is high-risk or cross-cutting and needs durable decisions, verification, or recovery context, such as a schema migration, auth change, CI/CD or infrastructure change, or a service or API boundary change.

Otherwise, plan in the conversation and do not create a task bundle. File count, folder count, step count, and estimated duration alone do not justify one.

## Task model

One task is one resumable unit of work: one bundle, one active state, and one logical `Task:`-trailer timeline. Tasks are flat; never nest task bundles.

- Keep work as phases of one task when every phase serves the same completion goal, advances sequentially, shares completion conditions, and needs no independent pause, handoff, verification, or archive.
- Split an independent task when work has its own observable outcome or completion conditions, can progress or block independently, needs a separate worktree or owner, or exchanges a defined interface with the current task.
- Do not split merely because work spans frontend/backend, several modules, many steps, or a new version.

Independent tasks for one capability usually map to the same Feature. Map them separately when semantic ownership differs and record the cross-Feature boundary in each affected roadmap. The registry and Semantic Feature Briefs own global grouping; a task roadmap records only relationships touching that task.

## Active bundle

Every immediate child of `dev-docs/active/` is one task bundle:

```text
dev-docs/active/<slug>/
├── .ai-task.yaml
├── 00-roadmap.md
├── 01-status.md
├── 02-architecture.md
└── verification.md
```

Required files:

| File | Sole responsibility |
|---|---|
| `.ai-task.yaml` | Stable task identity and non-authoritative display metadata |
| `00-roadmap.md` | Top-level decision alignment, task relationships, kickoff readiness, and the phased implementation route |
| `01-status.md` | Current goal, state, phase, next step, blocker, and high-level completion conditions |
| `02-architecture.md` | Current settled design, interfaces, boundaries, and migration implications |
| `verification.md` | Current completion-condition matrix and latest decisive evidence |

Conditional files:

| File | Create only when |
|---|---|
| `implementation.md` | Non-obvious, cross-module, migration, integration, or operational facts need a durable current map |
| `pitfalls.md` | An evidence-backed recurring hazard remains useful to prevent |
| `requirement.md` | Requirements need a separate alignment pass before planning |
| `artifacts/` | Bulky or raw evidence would obscure the current record |

Do not create a second plan, status, goal, decision log, verification authority, or chronological implementation journal. Update current snapshots; Git history retains superseded states. Put bulky repeated logs under `artifacts/`.

## Roadmap responsibilities

`00-roadmap.md` is the working surface for converging the task's direction and turning it into an executable route. It has three jobs and one explicit readiness gate.

### Decision alignment

Keep each material top-level question in one decision table from open discussion through resolution. Record the relevant options and tradeoffs, current recommended direction, status, decision owner or required confirmation, closure evidence, and consequences.

Use `open` when no direction is ready, `proposed` when a direction awaits confirmation or evidence, `decided` when the closure condition is satisfied, and `superseded` only for a replaced decision whose rationale remains useful.

When no material decision or assumption is known, write `None`; never invent one to fill the structure.

- A user-owned choice about the goal, scope, product behavior, or acceptance boundary remains `open` or `proposed` until the user confirms it.
- A technical choice within the approved task boundary may become `decided` when repository or experimental evidence supports it.
- Keep rejected or replaced directions only when their concise rationale prevents the same path from being replayed; mark them `superseded`.
- When a decision settles design or interfaces, reflect the current conclusion in `02-architecture.md`. When it changes the goal or completion conditions, update `01-status.md` too.
- If an `open` or `proposed` user-owned choice gates the current phase, present its options and tradeoffs to the user and close it before dependent implementation. Independent discovery may continue.

Update the table when a material question appears, the recommendation changes, a decision closes or is superseded, or evidence invalidates its closure. Do not rewrite it after every conversational turn.

### Task relationships

Read relationships from the current task toward the listed work:

- `depends-on`: this task needs the listed work.
- `blocks`: this task gates the listed work.
- `sibling`: both tasks coordinate around a shared boundary.
- `follow-up`: the listed work follows this task.
- `derived-from`: this task was derived from the listed work.
- `supersedes`: this task replaces the listed work.

Record only evidence-backed relationships. Write `None` when none is known. Use an existing `T-###` when available; use `proposed:<slug>` only for a concrete outcome with a creation trigger. Record owned boundaries and coordination conditions, never another task's mutable state. If a dependency blocks this task, update its status blocker too.

Before archive, every unresolved proposal becomes a task, is explicitly canceled or descoped, or receives a durable destination in the relevant Feature Brief.

### Implementation plan

Plan sequential, independently verifiable phases that all serve this task's goal. Each recorded phase states its outcome, approach, ordered planned changes, affected boundaries or entry points, dependencies, exit criteria, verification, and recovery path.

While kickoff is `pending`, the first phase may align decisions or gather evidence, and downstream implementation phases may remain absent rather than invented. When kickoff becomes `ready`, the first implementation phase must be concrete enough to begin without replanning the task.

`01-status.md` points to the current phase and the first unfinished action; it does not duplicate the whole plan. Update the roadmap when evidence changes the route. Work that needs its own outcome, state, handoff, verification, or archive becomes another task rather than another phase.

### Kickoff gate

Every new bundle starts with `Status: pending`. Change it to `ready` only when all roadmap checklist items are satisfied:

- every user-owned choice that blocks implementation is `decided`;
- settled design and interfaces are reflected in `02-architecture.md`;
- the first implementation phase is executable, with exit, verification, and recovery criteria;
- every current completion condition has a decisive planned check in `verification.md`.

`ready` is valid only when every gate item is checked. If implementation evidence invalidates a gating premise or route, immediately return the gate to `pending`, record why, and stop dependent implementation until the route is aligned again. While pending, independent alignment and discovery may continue.

Kickoff readiness is independent from task progress: both `planned` and `in-progress` may be `pending`; a `done` task must be `ready`.

## Progress

`01-status.md` under `## Progress` contains exactly one state bullet:

```markdown
## Progress
- State: planned
```

Allowed active states are `planned | in-progress | blocked | done`.

- The first alignment, discovery, or implementation checkpoint after the opening commit changes `planned` to `in-progress`.
- Use `blocked` only when unresolved external input or a dependency prevents progress; record the blocker and first action after unblock.
- Use `done` only when every current `Done when` item is satisfied and `verification.md` contains decisive evidence.
- A roadmap decision that changes the goal or completion conditions is not effective until `01-status.md` reflects the current conclusion.

The active status file owns intended progress. Git history owns committed work. The worktree owns uncommitted work. Report disagreements instead of silently selecting one source.

## Identity and commits

`.ai-task.yaml` has this required identity:

```yaml
version: 1
task_id: T-007
slug: oauth-provider-integration
```

`task_id` matches `^T-\d{3}$`, is repository-wide unique, monotonically allocated, stable, and never reused. `slug`, when present, equals the bundle directory name. Optional `status`, `updated`, and `keywords` are display fields.

Only the governance control script allocates task IDs. A commit belonging to the task carries exactly one `Task: T-###` trailer. Never attach a task trailer to unrelated work or claim uncommitted work landed.

## Reading and lifecycle

For recovery, read `01-status.md` first, then current `pitfalls.md` when present. Reconcile the exact task-trailer commit timeline and worktree diff, then read the roadmap kickoff gate before resuming implementation. Expand to decision alignment, the implementation plan, `implementation.md`, or `verification.md` only for a specific unresolved question.

A completed task remains active with `State: done` until an approved archive transition. A new archived bundle is an immediate child of `dev-docs/archive/` and contains exactly:

```text
dev-docs/archive/<slug>/
├── .ai-task.yaml
└── summary.md
```

Archive location makes its effective state `archived`. The summary preserves the outcome, durable decisions, decisive verification, useful pitfalls, related-task disposition, and the task-trailer history pointer.

# Task documentation

`dev-docs/` is the repository record for durable task intent, progress, design, verification, recovery, and history. This README defines the stable meaning of a task bundle. The workflow active at a particular moment defines how to create, plan, synchronize, resume, hand off, inspect, or archive it.

## Bundle shapes

Each immediate child of `dev-docs/active/` is one active task:

```text
dev-docs/active/<slug>/
├── .ai-task.yaml
├── 00-roadmap.md
├── 01-status.md
├── 02-architecture.md
└── verification.md
```

These five files are required. The task may also contain the common optional entries described below or other supporting documents and directories when the actual work benefits from them. Give each addition a distinct, durable purpose and do not use one to duplicate the goal, status, plan, decisions, architecture, or verification authorities.

Each immediate child of `dev-docs/archive/` is one archived task and contains exactly:

```text
dev-docs/archive/<slug>/
├── .ai-task.yaml
└── summary.md
```

Archive location makes the effective state `archived`. `summary.md` preserves the durable outcome and evidence; the active working files do not survive the archive transition.

## Document responsibilities

| File | Sole responsibility |
|---|---|
| `.ai-task.yaml` | Stable task identity and non-authoritative display metadata |
| `00-roadmap.md` | Decision alignment and rationale, working assumptions, relationships touching this task, kickoff readiness, phased route, and recovery strategy |
| `01-status.md` | Current goal, progress state, phase, next step, blocker, and high-level completion conditions |
| `02-architecture.md` | Current settled technical design and contracts, without alternatives or decision history |
| `verification.md` | Current completion-condition matrix, latest decisive evidence, outstanding checks, and material limitations |
| `implementation.md` | Optional current realization map when architecture alone is not enough to resume safely |
| `pitfalls.md` | Optional current anti-error register for recurring, evidenced hazards |
| `requirement.md` | Optional requirements-alignment input; it does not override the current status or roadmap |
| `artifacts/` and other supporting entries | Task-specific evidence or context with a stated purpose and no competing authority |

Update these as current snapshots. Git history retains superseded states; avoid chronological journals and repeated raw logs in the main documents.

## Lifecycle model

Progress lives in `01-status.md` under `## Progress` as exactly one `State:` value:

| State | Meaning |
|---|---|
| `planned` | The task is opened but no later alignment, discovery, or implementation checkpoint has landed |
| `in-progress` | Work is actively advancing |
| `blocked` | External input or a dependency prevents meaningful progress |
| `done` | Every current completion condition is satisfied with decisive verification evidence |

Implementation readiness lives separately in the roadmap kickoff gate:

- Every new task starts `pending`.
- While `pending`, alignment and independent discovery may continue, but implementation that depends on the unresolved route may not.
- `ready` means the roadmap gate is fully satisfied and the first implementation action is executable.
- If evidence invalidates a gating premise or route, return to `pending` immediately and stop dependent implementation until the route is aligned again.
- A `done` task must have kickoff `ready`.

A completed task remains active with `State: done` until its separately approved archive transition.

## Authorities and repository reality

Use each source only for what it proves:

- The task documents own the intent described in the responsibility table above; one document never overrides another document's responsibility.
- Git history proves committed work; a task commit carries exactly one `Task: T-###` trailer.
- The worktree proves current uncommitted work.
- `.ai-task.yaml`, the registry, and generated hub views must not override the task documents or repository reality.

Report disagreements instead of silently choosing one source. Never describe uncommitted or missing work as landed.

## Using a bundle

1. Read `01-status.md` for the task head.
2. Read current `pitfalls.md` when present, reconcile linked commits and worktree changes, and check roadmap kickoff before implementation.
3. Expand to roadmap decisions and phases, architecture, implementation context, verification, or other supporting documents only for the current question.
4. When reality changes, update only the documents whose responsibility changed and keep status pointed at the first unfinished action.
5. Preserve the verified unit in Git with its exact task trailer before relying on it as landed progress.

## Invariants

- One task is one flat, resumable outcome with one bundle, one active state, and one logical task-trailer timeline. Never nest bundles or duplicate an outcome already tracked elsewhere.
- Keep sequential work serving the same goal as phases. Work needing its own outcome, state, owner, handoff, verification, archive, or independently managed boundary is another task.
- Do not create a second plan, status, goal, decision log, architecture authority, or verification authority.
- Never put secrets, credentials, or tokens in task or hub artifacts.

# Task documentation

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

Use templates as starting shapes: preserve the headings and fields governance tooling consumes,
adapt the depth to the task, remove authoring prompts, and record uncertainty instead of inventing
facts.

Each immediate child of `dev-docs/archive/` is one archived task and contains exactly:

```text
dev-docs/archive/<slug>/
├── .ai-task.json
└── summary.md
```

Archive location makes the effective state `archived`. `summary.md` preserves the durable outcome
and evidence.

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
- **`verification.md`** — The latest decisive results, with their baselines, for relevant claims,
  acceptance references, phase outcomes, and material limitations; the checks still open; and the
  task's deployment changes: build configuration and switches, secret references and their injection
  path, migrations and initialization steps, contract pairing and required client upgrades, and
  rollback limits.
- **`implementation.md`** *(optional)* — Current realization map when architecture alone is not
  enough to resume safely.
- **`pitfalls.md`** *(optional)* — Current anti-error register for recurring, evidenced hazards.
- **`requirement.md`** *(optional)* — Requirements-alignment input; it does not override the
  current status or roadmap.
- **`artifacts/` and other supporting entries** *(optional)* — Task-specific evidence or context
  with a stated purpose and no competing authority.

Update these as current snapshots: remove superseded content unless it still constrains the active
route, transition, or recovery, and avoid chronological journals and repeated raw logs in the main
documents.

Evidence holds results. A result holds for its recorded baseline: commit or build, configuration,
platform, and sample. Count it for a newer baseline only after rerunning the check there or showing
that the changes since cannot reach it; changes to task records alone (`dev-docs/`, `.ai/`) never
reach it.

Every required check without a passing result that holds for the current baseline, including one
that needs a rerun, is an Outstanding verification item with:

- a short label, which phases and campaign rows cite;
- the behavior to prove and the evidence qualification it needs (platform, build, identity);
- its condition to run: business-time gates, another task's work it waits on, and how it reaches
  a shared environment;
- one owner task, named with its repository when it lives in another one;
- for a check only a later environment can run, the task expected to take it over: its ID once
  that task is opened, otherwise the work that will take the check over.

A check several tasks need belongs to one of them; the others record a depends-on relationship to
that task in the roadmap instead of an item. Another task takes an item over by listing it with
itself as owner, and its result closes the item. The taker may restate the item; it records any
part it cannot meet as a limitation and keeps that part as an Outstanding verification item. When
the task has deployment changes, keep one confirmation item per target environment named in
Deployment changes, owned by this task until a task that deploys them there takes it over. A shared
test environment is not a target environment.

A phase's Verification names by label the items the phase must close, including an item another
task owns through a depends-on relationship; that task's result closes it, and the phase waits on
that result, never on the owner's planning. Schedule each item in the first phase where its
condition can hold: a check waiting on another task's work goes in the first phase after that work
can be available, and a check only a later environment can run goes in no phase. A phase closes
when each item it names has a passing result; move an item that turns out to need a later
environment out of the phase. Begin the next phase only after the current one closes.

Mark a later phase `(provisional)` in its heading while current evidence does not support its
detail. When it becomes current, remove the label in the next checkpoint if its named items and
planned changes still hold; otherwise replan it before implementing it.

`Done when` holds the task's current acceptance references; revise an item when the understood
outcome changes. Neither `Done when` nor roadmap exit criteria prove completion or override
confirmed requirements, repository reality, verification evidence, or required user acceptance.

## Lifecycle model

Progress lives in `01-status.md` under `## Progress` as exactly one `State:` value:

- **`planned`** — The task is opened but no later alignment, discovery, or implementation
  checkpoint has landed. The first such checkpoint, a planning checkpoint included, lands with
  `State: in-progress`.
- **`in-progress`** — Work is actively advancing.
- **`blocked`** — External input or a dependency prevents meaningful progress. Waiting on a user
  decision is not `blocked`; name the decision as the next step.
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
remain while work is in progress only when its purpose and recovery boundary are recorded in
`02-architecture.md` and its exit condition is an Outstanding verification item: a fact the task
can establish, or a fact outside the repository that a later environment shows, never an
intention such as "later". Before completion, remove the superseded path unless permanent
compatibility is part of the confirmed outcome or another task has taken over its exit condition.

A later environment is one this task cannot use yet: an environment, release channel, device, or
data set that does not exist or is not available to it, including a target environment this task
does not deploy to. An existing shared test environment is not later, even when a campaign holds
it, and neither is a build with the shipping configuration that this task can produce; only its
distribution channel is. This task keeps the checks that run in environments that are not later
and completes them before `done`. A check that only a later environment can run, including such an
exit condition and a deployment confirmation, does not block completion once another task has
taken it over. Without such a task, the check stays and blocks completion.

Run a check that needs an existing shared test environment as soon as its condition holds. When
the environment's runbook names no campaign holding it, run the check from this task through the
runbook's change procedure: close the environment, load the candidate heads, run the smoke check,
run the check, restore and reopen it, and record the result with the loaded baseline. When a
campaign holds it, hand the item to that campaign; its write-back records the result.

A task that deploys other tasks' work takes over their confirmation items for the environments it
deploys to, and the later-environment checks that name it by ID as the expected taker.

Implementation readiness lives separately in the roadmap kickoff gate:

- Every new task starts `pending`.
- While `pending`, alignment and independent discovery may continue, but implementation that
  depends on the unresolved route may not.
- `ready` means every gate item is checked and the first implementation action can begin without
  reopening the route.
- In the roadmap's decision table, `proposed` awaits its named confirmation or evidence and
  `decided` has it. Only the user's answer to a user-owned decision, given in advance or in reply,
  decides it; approving a planning checkpoint, in advance or after review, answers none of the
  decisions it lists as needing confirmation. Write each status as it stands when its checkpoint
  lands.
- When evidence invalidates a gating premise or route, set kickoff to `pending` at once, uncheck
  the invalidated gate items, and pause route-dependent implementation until alignment is restored.
- The gate's `Authorized boundary` line records how far the user has authorized implementation:
  `none`, a phase boundary such as `through phase 2`, or `complete task`. Write a new
  authorization into the next checkpoint that lands after the user gives it; an authorization
  alone does not warrant a checkpoint. The boundary limits implementation and does not request it:
  implementation begins only when the current request or an enclosing workflow asks for it.
- Reset `Authorized boundary` to `none` when the route materially changes: a phase is added,
  removed, or reordered, its outcome changes, or it takes on scope the authorized route did not
  include, such as a new entry point. Keep it when planning only refines how a phase reaches its
  authorized outcome and scope.
- A `done` task must have kickoff `ready`.

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
- Git history proves committed work; a task commit carries exactly one `Task: T-###` trailer, in
  its final paragraph together with any other trailers. Commit verified code before recording
  evidence that names its commit, then record that evidence in a following checkpoint.
- The worktree proves current uncommitted work.

Report disagreements instead of silently choosing one source. Never describe uncommitted or
missing work as landed.

## Using a bundle

1. Read `01-status.md` for the task head.
2. Read current `pitfalls.md` when present, reconcile linked commits and worktree changes, and
   check roadmap kickoff before implementation.
3. Read the records of the tasks in Task relationships that changed since this task's last
   checkpoint, and reconcile what affects this task.
4. Expand to roadmap decisions and phases, architecture, implementation context, verification, or
   other supporting documents only for the current question.
5. When reality changes, update only the documents whose responsibility changed and keep status
   pointed at the first unfinished action.

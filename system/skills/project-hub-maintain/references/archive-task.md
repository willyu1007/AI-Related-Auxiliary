# Archive task

Archive one completed task from its active working bundle into a compact historical record. This
is a destructive transition, not a status rollup or a way to repair an incomplete task.

## Audit completion

Resolve one valid task and its worktree. Prefer an exact task ID carried by the request or enclosing
workflow; otherwise query by identifying terms:

```bash
node .ai/scripts/ctl-project-governance.mjs query --text "<identifying terms>" --json
```

Continue only on one valid match. Present plausible candidates for the user to choose when several
match, and stop when none do.

Gather the selected task's current packet and full task history:

```bash
node .ai/scripts/ctl-project-governance.mjs query --id T-### --json
node .ai/scripts/ctl-project-governance.mjs resume --repo-root <worktree> --task T-###
git -C <worktree> log --grep="^Task: T-###"
```

Use the task bundle to establish the accepted goal and scope, then inspect the task commits, their
diffs, the current implementation, and affected entry points, integrations, interfaces,
configuration, failure paths, and formal documentation. Trace the accepted outcome through current
behavior, run decisive verification, obtain any required user acceptance, and apply the completion
contract in `dev-docs/AGENTS.md` against repository reality rather than relying on recorded state,
roadmap criteria, or historical evidence alone.

Reconcile the task record with the audit. If reality is incomplete, update its progress and affected
task snapshots to the actual state, checkpoint the reconciliation, and stop the archive. Unresolved
evidence also blocks archive. When completion holds, bring a stale bundle or hub to an aligned
`done` state before continuing.

Before the final closeout, move live product, interface, operational, or migration knowledge into
its code or formal documentation. Remove all task-owned test code, artifacts, and test-only content
while preserving unrelated existing tests, and resolve new tasks, Ideas, or Feature semantics
separately. Synchronize and commit these changes as one aligned closeout. Archive only when that
checkpoint has no task-owned uncommitted work and the task has one checked-out occurrence.

## Distill the archive record

Inspect every task-local entry and write a compact `summary.md` that preserves only durable task
context:

- the task goal, necessary background, and actual outcome, including material boundaries or
  descoped parts;
- the delivered behavior or capability;
- key decisions that still constrain behavior, design, compatibility, migration, or maintenance,
  together with the decisive reasons, evidence, or constraints behind them;
- project and task relationships, including confirmed follow-up work;
- known limitations only when they remain useful.

Keep a rejected alternative only when its rationale prevents a likely harmful reversal. Do not
retain phase plans, implementation chronology, discussion history, temporary assumptions,
duplicated implementation detail, raw verification logs, resolved pitfalls, session material, or
intermediate artifacts. The summary is historical context, not a replacement for live product or
technical documentation.

## Execute and close

Write `summary.md`, delete every other task-local entry except `.ai-task.json`, and move the bundle
from `dev-docs/active/<slug>/` to `dev-docs/archive/<slug>/` as one recoverable change. The archived
bundle must contain exactly `.ai-task.json` and `summary.md`; archive location supplies its
effective state. Preview the complete governance update:

```bash
node .ai/scripts/ctl-project-governance.mjs sync --dry-run
```

Continue only when every planned change belongs to the archive transition; otherwise restore the
active layout from its closeout checkpoint. Then apply and validate:

```bash
node .ai/scripts/ctl-project-governance.mjs sync --apply
node .ai/scripts/ctl-project-governance.mjs lint
```

Inspect the complete diff and worktree. On validation failure, correct only the mechanical archive
transition or restore the active layout from its closeout checkpoint; never leave a partial
archive. Stage only the archive move, registry task projection, and generated hub views, then
commit one task per archive:

```bash
git commit -m "chore(archive): archive T-### <slug>" -m "Task: T-###"
```

Report the archive path, durable information retained, formal documentation updated, validation,
commit, and related work in the user's preferred language. If repository policy cannot provide the
recoverable checkpoints required above, leave the active bundle intact and report the blocker.

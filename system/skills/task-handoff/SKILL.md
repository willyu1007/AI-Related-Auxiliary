---
name: task-handoff
description: >-
  Use when the user asks to transfer an active tracked task to a fresh session,
  or when degraded context makes continuing the task unreliable.
---

**Do not use this skill while a host Goal is active.**

## Stabilize the task

Run a full recovery pass across the task bundle, linked commits, and worktree so a fresh session can
continue from repository state alone. Reconcile changed facts in their owning task documents and
create a checkpoint when safely authorized. Finish the current atomic action only when it remains
safe to complete and verify. Preserve incomplete, unverified, or foreign work instead of forcing a
clean checkpoint. If stabilization stops, carry its exact failure as the first recovery action.

## Build the handoff

Build from the synchronized task bundle, linked commits, and relevant worktree state. If a compact
final index is still needed, read one with the exact task ID:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --task T-###
```

Use the packet as a bounded read, then inspect the relevant diff for details it cannot explain. The
repository remains authoritative; if the handoff conflicts with it or is explicitly incomplete,
the destination recovers from the repository.

Render one pasteable block in the user's preferred language. Keep the current task action and any
incomplete stabilization explicit; omit empty optional sections. Populate `Landed` only from linked
commits, and keep task work separate from foreign changes. Include only work this session planned
but did not implement, not the task's full remaining roadmap. Put unresolved proposals in `Open`;
carry forward only established context needed for that session plan:

````markdown
## Handoff · T-### · <slug>
Worktree: <current worktree root>
Branch / HEAD: <branch> · <short SHA>
Checkpoint: <what synchronized, or the exact incomplete step and failure>
State / phase / kickoff / blocker: <current values>
Goal: <current task outcome>

### Continue
1. Open the worktree above.
2. Inspect the listed task paths and current diff.
3. Continue with: <first task action>.

### Landed
- <committed result and short SHA>

### Uncommitted task work
- <path, current state, and why it was not landed>

### Planned but not implemented in this session
- <planned action, intended outcome, and relevant paths>

### Carry forward
- <established finding, constraint, or non-obvious fact needed for that plan>

### Preserved foreign work
- <path and ownership>

### Do not repeat
- <failed path and the evidence that ruled it out>

### Open
- <unresolved decision, blocker, or required human input, and who can resolve it>
````

If kickoff is `pending`, the first task action is alignment or replanning, never decision-dependent
implementation. Durable route changes and settled task cognition belong in the task bundle; do not
write the handoff block into the repository.

## Delivery

Tell the user why handoff is preferable; keep this feedback outside the handoff prompt. Then choose
one:

- If task/thread creation is available but not authorized, show the complete prompt and ask whether
  to trigger it.
- If unavailable, provide the prompt in one fenced `markdown` block.
- If authorized, create or message the task, preserve its source link when supported, and report
  completion without repeating the prompt.

When uncommitted task work exists, continue in the same worktree. Host lifecycle signals such as
`SessionStart(compact)` may inform the handoff decision.

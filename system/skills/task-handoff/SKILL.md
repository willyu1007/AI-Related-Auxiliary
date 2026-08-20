---
name: task-handoff
description: >-
  Use when the user asks to transfer an active tracked task to a fresh session,
  or when degraded context makes continuing the task unreliable.
---

## Stabilize the checkpoint

Read `dev-docs/AGENTS.md`. Do not begin new work once handoff is chosen. Finish the current atomic action if that is safe, then run the checkpoint-sync workflow:

- update the task bundle to match the repository;
- verify and commit every coherent part that is safe to land with its `Task: T-###` trailer;
- leave broken, incomplete, or unverified changes uncommitted and describe them precisely;
- preserve changes belonging to other tasks and name them separately.

A handoff does not require finishing the whole task. It requires a truthful, recoverable boundary. If context degradation prompted the handoff, stabilizing the current action outranks attempting the rest of the request with unreliable context.

## Build the handoff

Read the final values from the repository after synchronization:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --task T-###
```

Use this JSON packet as the bounded starting point, then inspect the relevant diff for any uncommitted detail the packet cannot explain.

- `01-status.md`: goal, state, current phase, next step, blocker, and completion conditions
- `00-roadmap.md` kickoff gate: whether implementation may continue
- linked commits: what landed
- `git status --short` and relevant diffs: what remains uncommitted
- `pitfalls.md`, when present: paths the next session must not repeat
- the rest of `00-roadmap.md`: unresolved top-level choices, relevant task relationships, and the near-term implementation route, only as needed
- other task-local supporting entries, only when their stated purpose materially affects the next session

Render one pasteable block:

````markdown
## T-012 · oauth-provider-integration
State: in-progress · HEAD: a3f9c21
Kickoff: pending / ready
> Stale check: if `git rev-parse --short HEAD` is not `a3f9c21`, discard this
> block and recover from the repository.

### Goal
One sentence describing the completed outcome.

### Landed
- Committed result and short SHA.

### Uncommitted
- Path, current state, and why it was not landed. Use "Clean" when none.

### Next
1. First concrete action, including the command or path.
2. Second action.
3. Verification or decision point.

### Do not repeat
- Failed path and the evidence that ruled it out.

### Open
- Unresolved decision, blocker, or required human input; say who can resolve it.
````

The stale check validates the block against repository movement. The receiving session should use repository recovery when the check fails.

## Delivery

Default to returning the block in the conversation. If the environment can create the destination session and set its first message, send the same block there and report the destination instead. Produce one block for one destination, never both.

## Rules

- Never claim uncommitted work landed.
- Never commit broken or unverified work merely to make the handoff look clean.
- Never omit foreign worktree changes, unresolved blockers, or a known failed path.
- Never hand off decision-dependent implementation as runnable when kickoff is `pending`; make alignment or replanning the first action.
- Never write the handoff block into the repository; durable task facts belong in the bundle, and the transfer block belongs in the session channel.
- If bundle synchronization or verification cannot complete, say exactly what failed and make that the first recovery action.

## Contract

For an active task, progress is `01-status.md` `## Progress` → `State:`. `00-roadmap.md` owns decision alignment, task relationships, and the implementation plan; it does not override the current status head.

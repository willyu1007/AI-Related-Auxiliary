---
name: task-resume
description: >-
  Use when the user asks to continue, pick up, or recover context for an existing
  tracked task, or when the current branch identifies the task being resumed.
---

## Fast path

Read `dev-docs/README.md` before interpreting a task bundle.

Resolve a named task ID directly:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --task T-###
```

When the request names work but not an ID, search the goal, slug, keywords, and linked worktrees first:

```bash
node .ai/scripts/ctl-project-governance.mjs query --text "<request terms>" --json
```

- One relevant candidate in the current worktree: pass its ID to `resume`.
- One relevant candidate in another worktree: do not create a duplicate task. Read it there; continue there only when the execution environment can safely target that worktree and the request clearly refers to it. Otherwise report its path and ask before changing worktrees.
- Multiple plausible candidates: show the compact candidates and ask which one.
- No candidate: report that no tracked task matches. Use the task-opening workflow only if the user wants to open one.

When neither the request nor the branch identifies a task, this command may resolve the sole `in-progress` task, then the sole `blocked` task:

```bash
node .ai/scripts/ctl-project-governance.mjs resume
```

A non-zero exit means absent or ambiguous. Do not guess.

## Recovery order

The packet is the bounded first read. Verify or reconstruct it manually in this order when the command is unavailable or a field conflicts with repository reality:

1. Resolve the task from an explicit `T-###`, a unique request-text match, the branch ID, the sole `in-progress` bundle, then the sole `blocked` bundle.
2. Read `01-status.md` for the goal, `State:`, current phase, next step, blocker, and `Done when`.
3. Read the roadmap kickoff gate. If it is `pending`, do not resume decision-dependent implementation; recover the open decisions and current alignment or discovery action instead.
4. If `pitfalls.md` exists, read its current hazards.
5. Rebuild the committed timeline from exact `Task: T-###` trailers. An empty timeline means unknown progress, not zero progress.
6. Inspect `git status --short` and the relevant diff. Uncommitted changes may be newer than every record.
7. Read further only to answer an unresolved question: `00-roadmap.md` for decision alignment, task relationships, and the remaining implementation route; optional `implementation.md` for the current realized implementation map; `verification.md` for current decisive evidence; and any other task-local supporting document only for its stated distinct purpose.

## Reconciliation

Use each source only for what it can prove:

- `01-status.md` owns the intended goal, current state, and next action.
- Git history owns what was committed.
- The worktree owns what is currently uncommitted.
- `00-roadmap.md` owns top-level decision alignment, current-task relationships, and the phased implementation route. Another task's own status file, not a relationship row, owns that task's state.

Report disagreements instead of silently selecting one source. If the user asked only for status, stop after the report. If the user asked to continue the work, resolve pending decision alignment or replanning before implementation; once work proceeds, synchronize a checkpoint whenever a phase lands or a check runs.

## Output

- Task ID, slug, docs path, and how it was resolved
- Current goal, `State:`, and next step
- Kickoff status and any gate that prevents implementation
- What the linked commits prove landed
- Relevant uncommitted changes and any disagreement with the record
- Relevant do-not-repeat warnings, when any are recorded
- The next concrete actions

## Rules

- Never let a branch ID trigger recovery for an unrelated request.
- Never guess between plausible tasks or duplicate a task already open in another worktree.
- Context recovery is read-only. Modify code or records only when the user's request also asks to continue or change the task.
- Never resume decision-dependent implementation while kickoff is `pending`.
- Do not read the whole bundle by default; expand from status only when the next decision needs it.

## Contract

For an active task, progress is `01-status.md` `## Progress` → `State:`. A bundle under `dev-docs/archive/` is `archived` by location.

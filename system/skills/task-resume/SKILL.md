---
name: task-resume
description: >-
  Use when continuing, picking up, or recovering an active tracked task
  requires reconstructing its working context from repository state.
---

## Resolve and load the task

Resolve the Git top-level and run the rest of this workflow there. Read `dev-docs/AGENTS.md`, then resolve one active task through the first applicable branch:

- With a reliable task ID, run:

  ```bash
  node .ai/scripts/ctl-project-governance.mjs resume --task T-###
  ```

- When the request identifies work but not an ID, query with distinctive request terms. Continue only from one relevant, valid active candidate, then resume it by exact ID:

  ```bash
  node .ai/scripts/ctl-project-governance.mjs query --text "<request terms>" --json
  ```

- Without reliable task identity, let the runner use the branch identity, then the sole `in-progress` task or, when none exists, the sole `blocked` task:

  ```bash
  node .ai/scripts/ctl-project-governance.mjs resume
  ```

On ambiguity or no match, report the compact result and stop instead of guessing. Preserve runner evidence for invalid metadata, conflicting occurrences, stale worktrees, or a task owned by another worktree. Recover in the authoritative worktree only when the request and environment already permit it; otherwise report the path and ask before changing worktrees. Read `.ai/project/AGENTS.md` only when cross-worktree diagnosis is needed.

An archived bundle is historical evidence, not an active resume target. A non-zero exit stops recovery. On success, use the returned packet as the bounded first read and carry its `warnings` and `truncated_fields` into context reconstruction.

## Reconstruct the working context

Use the packet first. Treat its `warnings` and `truncated_fields` as signals for selective expansion, then follow the document responsibilities and bundle-reading order in `dev-docs/AGENTS.md`.

Read `02-architecture.md` when settled design, boundaries, or contracts constrain the next action. Read optional `implementation.md` only when architecture is not enough to locate the realized behavior and operational entry points.

An empty linked commit timeline means progress is unknown, not zero.

## Reconcile and continue

Reconcile the packet under the authority model in `dev-docs/AGENTS.md`. Surface disagreements instead of silently choosing one source.

Context reconstruction is read-only. When the enclosing request authorizes continuing or changing the task, return to the current execution workflow from the recovered next action.

## Communicate when needed

When the user explicitly asks to recover, review, or resume the task, summarize the recovered task, goal and state, landed and uncommitted evidence, relevant blocker or uncertainty, and next action in the user's preferred language. If recovery happens internally during continuous work, continue without a standalone status report.

If recovery needs the user to choose a task or worktree, or to resolve conflicting evidence, report only the evidence and decision needed to proceed.

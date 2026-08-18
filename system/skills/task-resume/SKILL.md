---
name: task-resume
description: >-
  Use when the user asks to continue, pick up, or recover context for an existing
  tracked task, or when the current branch identifies the task being resumed.
---

## Fast path

Resolve a named task ID directly:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --task T-### --json
```

When the request names work but not an ID, search the goal, slug, keywords, and linked worktrees first:

```bash
node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --text "<request terms>" --json
```

- One relevant candidate in the current worktree: pass its ID to `resume`.
- One relevant candidate in another worktree: do not create a duplicate task. Read it there; continue there only when the execution environment can safely target that worktree and the request clearly refers to it. Otherwise report its path and ask before changing worktrees.
- Multiple plausible candidates: show the compact candidates and ask which one.
- No candidate: report that no tracked task matches. Use the task-opening workflow only if the user wants to open one.

When neither the request nor the branch identifies a task, this command may resolve the sole `in-progress` task, then the sole `blocked` task:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --json
```

A non-zero exit means absent or ambiguous. Do not guess.

## Recovery order

The packet is the bounded first read. Verify or reconstruct it manually in this order when the command is unavailable or a field conflicts with repository reality:

1. Resolve the task from an explicit `T-###`, a unique request-text match, the branch ID, the sole `in-progress` bundle, then the sole `blocked` bundle.
2. Read `01-status.md` for the canonical goal, `State:`, current phase, next step, blocker, and `Done when`. For a legacy bundle only, fall back to `00-overview.md` when `01-status.md` is absent.
3. If `pitfalls.md` exists, read its current hazards. For a legacy bundle only, fall back to `05-pitfalls.md` when the canonical file is absent.
4. Rebuild the committed timeline from exact `Task: T-###` trailers. An empty timeline means unknown progress, not zero progress.
5. Inspect `git status --short` and the relevant diff. Uncommitted changes may be newer than every record.
6. Read further only to answer an unresolved question: `00-roadmap.md` for decisions, task relationships, and remaining phases; optional `implementation.md` for the current realized implementation map; and `verification.md` for current decisive evidence. Legacy fallback order is `roadmap.md`, then `01-plan.md`; `03-implementation-notes.md`, `04-verification.md`, and `05-pitfalls.md` are also read-only fallbacks when their canonical counterparts are absent.

## Reconciliation

Use each source only for what it can prove:

- `01-status.md` owns the intended goal, current state, and next action.
- Git history owns what was committed.
- The worktree owns what is currently uncommitted.
- `00-roadmap.md` owns unresolved questions, decisions, current-task relationships, and the phased route. Another task's own status file, not a relationship row, owns that task's state.

Report disagreements instead of silently selecting one source. If the user asked only for status, stop after the report. If the user asked to continue the work, proceed from the reconciled next action and use the checkpoint-sync workflow whenever a phase lands, a decision changes, or a check runs.

## Output

- Task ID, slug, docs path, and how it was resolved
- Canonical goal, `State:`, and next step
- What the linked commits prove landed
- Relevant uncommitted changes and any disagreement with the record
- Relevant do-not-repeat warnings, when any are recorded
- The next concrete actions

## Rules

- Never let a branch ID trigger recovery for an unrelated request.
- Never guess between plausible tasks or duplicate a task already open in another worktree.
- Context recovery is read-only. Modify code or records only when the user's request also asks to continue or change the task.
- Do not read the whole bundle by default; expand from status only when the next decision needs it.

## Contract

For an active task, progress is `01-status.md` `## Progress` → `State:`. A bundle under `dev-docs/archive/` is `archived` regardless of a legacy state field. Legacy files are fallback inputs, never new write targets.

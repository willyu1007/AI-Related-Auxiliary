---
name: resume-task
description: Rebuild context for a dev-docs task already in flight, before touching any code: resolve which task is meant, read its state, reconstruct the commit timeline from Task trailers, and check the worktree. Use for "continue the auth work", "where were we", "pick up T-012", a session starting on an existing branch, or accepting a handoff. Reports where the documents and Git history disagree instead of trusting either.
---

# Resume Task

Reconstruct what happened before you arrived, then say what is next. Nothing else.

Resuming is the moment with the least context and the highest cost of guessing: the code has moved
since the documents were written, and the previous session's reasoning is gone. Read the record and
the repository, and reconcile them explicitly — never open implementation files first and infer.

## Fast path

When `.ai/scripts/ctl-project-governance.mjs` exists, one command produces the whole packet,
bounded so it will not flood the context window:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --json
```

Pass `--task T-###` when the request names a task. Then go to Interpretation.

## Manual path

Without the script, the same steps in order:

1. **Resolve the task.** Take the first match:
   1. a `T-###` named in the request
   2. a `T-###` in the current branch name (`git branch --show-current`)
   3. the single `dev-docs/**/active/*/` bundle whose `State:` is `in-progress`
   4. the single bundle whose `State:` is `blocked`

   More than one candidate at a step means stop and ask. Resuming the wrong task is worse than
   asking one question.

2. **Read the task head** — from `00-overview.md`: `State:`, the goal, and the next concrete step.

3. **Rebuild the commit timeline.**

   ```bash
   git log --grep="^Task: T-###" --extended-regexp --format="%h %ad %s" --date=short -n 20
   ```

4. **Check the worktree** — `git status --short`. Uncommitted changes may be ahead of the timeline.

5. **Read the do-not-repeat summary** at the top of `05-pitfalls.md`, so you do not walk back into
   a dead end the last session already mapped.

6. **Read further only as needed** — `01-plan.md` for remaining phases, `03-implementation-notes.md`
   for open TODOs, `04-verification.md` for what has already been checked.

## Interpretation

Both paths end here.

- **A dirty worktree outranks the documents.** Inspect `git status --short` and `git diff` before
  writing code; someone stopped mid-change.
- **An empty timeline means progress is unknown, not zero.** The work may predate the trailer
  convention, or may sit uncommitted.
- **Git history wins ties.** When the record and the history disagree about what landed, believe the
  history, then fix the document with `sync-task`.
- **Report the reconciliation.** Say what the documents claim, what the repository shows, and where
  the two disagree — do not silently pick one.

## Rules

- Never run task recovery for work unrelated to the request. A task id in the branch name is
  relevant only when the request concerns that task.
- Never guess between ambiguous candidates.
- Never start implementing in the same turn as the resume unless the user asked you to. Report
  state and the next three actions first.
- Never modify the bundle here; that belongs to `sync-task`.

## Output

- Which task, and how it was resolved (named, branch, or sole active)
- Current `State:` and the documented next step
- What landed, from the commit timeline
- Worktree state, and any disagreement with the record
- The next three concrete actions

## Contract

Task layer: `dev-docs/AGENTS.md`.

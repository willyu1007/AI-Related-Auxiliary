---
name: resume-task
description: Picking up work already underway with nothing carried over from the previous session. Use for "continue the auth work", "where were we", "pick up T-012", or when a session starts on a branch that names a task.
---

# Resume Task

Reconstruct what happened before you arrived, then say what is next. Nothing else.

This is the cold start: the repository is the main witness. Read the record and the repository, reconcile them explicitly, and never open implementation files first to infer.

## Fast path

The command produces the whole packet:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --json
```

Pass `--task T-###` when the request names a task. A non-zero exit reports ambiguity or absence — stop and ask, exactly as in the manual path. Otherwise go to Interpretation.

## Manual path

The same steps the packet performs, in order. Follow them directly when the packet is unavailable or when its answer needs checking:

1. **Resolve the task.** Take the first match:
   1. a `T-###` named in the request
   2. a `T-###` in the current branch name (`git branch --show-current`)
   3. the single `dev-docs/**/active/*/` bundle whose `State:` is `in-progress`
   4. the single bundle whose `State:` is `blocked`

   More than one candidate at a step means stop and ask. Resuming the wrong task is worse than asking one question.

2. **Read the task head** — from `00-overview.md`: `State:`, the goal, and the next concrete step.

3. **Rebuild the commit timeline.**

   ```bash
   git log --grep="^Task: T-###" --extended-regexp --format="%h %ad %s" --date=short -n 20
   ```

4. **Check the worktree** — `git status --short`. Uncommitted changes may be ahead of the timeline.

5. **Read the do-not-repeat summary** at the top of `05-pitfalls.md`, so you do not walk back into a dead end the last session already mapped.

6. **Read further only as needed** — `01-plan.md` for remaining phases, `03-implementation-notes.md` for open TODOs, `04-verification.md` for what has already been checked.

## Interpretation

Both paths end here.

- **A dirty worktree outranks the documents.** Inspect `git status --short` and `git diff` before writing code; someone stopped mid-change.
- **An empty timeline means progress is unknown, not zero.** The work may predate the trailer convention, or may sit uncommitted.
- **Git history wins ties.** When the record and the history disagree about what landed, believe the history; correcting the document is a separate operation, not part of the resume.
- **Report the reconciliation.** Say what the documents claim, what the repository shows, and where the two disagree — do not silently pick one.

## Rules

- Never run task recovery for work unrelated to the request. A task id in the branch name is relevant only when the request concerns that task.
- Never guess between ambiguous candidates.
- Never start implementing in the same turn as the resume unless the user asked you to. Report state and the next few actions first.
- Never modify the bundle here; recording is a separate operation.

## Output

- Which task, and how it was resolved (named, branch, or sole active)
- Current `State:` and the documented next step
- What landed, from the commit timeline
- Worktree state, and any disagreement with the record
- The next few concrete actions
- The recording obligation from here on: whenever a phase lands, a decision is made, or a check runs, update `00-overview.md`, `03-implementation-notes.md`, and `04-verification.md`, and commit the verified part with its `Task:` trailer

## Contract

Progress is `00-overview.md` `State:` and nothing else; a bundle under `dev-docs/archive/` is `archived` whatever it says.

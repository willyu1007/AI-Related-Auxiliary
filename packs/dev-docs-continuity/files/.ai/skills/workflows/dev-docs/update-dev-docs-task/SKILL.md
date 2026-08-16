---
name: update-dev-docs-task
description: Bring an existing dev-docs task bundle back in line with what the repository actually contains — progress, decisions, pitfalls, verification evidence — and archive it once the task is done. Use at a checkpoint mid-implementation (a phase finished, a decision made, a check run), and again when the user pauses, hands off, hits a blocker, changes the plan, or finishes. Separates what landed from what is still uncommitted, and never marks work complete without recorded verification. If no bundle exists yet use start-dev-docs-task; to pick up a task you have no context on, use resume-dev-docs-task first.
---

# Update Dev Docs Task

Close the gap between what the repository now contains and what the task bundle claims, so the next
session — or the next person — can continue without reconstructing your reasoning.

Run it at checkpoints, not only at the end. The failure this prevents is a bundle that describes
intent from three days ago while the code has moved on, and a stale bundle is worse than no bundle
because a stale bundle is confidently wrong. Waiting for a handoff to catch up on three days of
notes is how bundles rot.

## When to run

| Moment | Depth |
|--------|-------|
| A phase completed, a decision made, a check run | Touch the files the change affected. Minutes, not a full pass. |
| Pausing, handing off, or blocked | Full pass. Someone else picks up from here. |
| Task finished and verified | Full pass, then archive. |

## Workflow

1. **Establish what actually landed.** Read `git log --grep="^Task: T-###"` and `git status
   --short` before editing any document. Git history wins over the bundle when they disagree;
   correct the bundle, not the history.

2. **Update `00-overview.md`.** Set `- State:` to `planned | in-progress | blocked | done` and
   write the next concrete step. Record any scope change here.

3. **Update the rest, only where reality moved:**

   | File | Record |
   |------|--------|
   | `01-plan.md` | Completed phases; re-sequence what remains |
   | `02-architecture.md` | New interfaces, decisions, migration or rollout implications |
   | `03-implementation-notes.md` | What changed and why; open TODOs that still need action |
   | `04-verification.md` | Commands run and their outcomes — pass and fail both |
   | `05-pitfalls.md` | Append resolved failures and dead ends; refresh the do-not-repeat summary |

   `05-pitfalls.md` is append-only. Mark an entry resolved or superseded; never delete one. A useful
   entry names the symptom, the root cause, what was tried, the fix, and how to avoid a repeat.

4. **Preserve repository state honestly.** Commit verified, revertible work with a `Task: T-###`
   trailer. When remaining work cannot be committed safely, say so and record the dirty worktree
   plus the next action. Never force broken or unverified work into a commit to get a clean status.

5. **Archive when done.** If `State:` is `done` and verification passes, propose moving
   `dev-docs/active/<slug>/` to `dev-docs/archive/<slug>/` and wait for approval before moving.
   Archiving changes the task's effective status, so archiving is not a filing decision.

## Rules

- Never describe uncommitted work as landed.
- Never mark a task `done` without verification evidence in `04-verification.md`.
- Never delete a prior decision or pitfall; supersede with an explanation.
- Never move or archive a directory without approval.
- No secrets, credentials, or tokens in any artifact.

## Reader test

A full pass is done when a fresh reader can answer, from the bundle alone: what changed, what state
the work is in, what the next three actions are (with commands and paths), and how to verify
success. Anything still requiring tribal knowledge goes into `03-implementation-notes.md` before you
stop.

## Assets

- `./templates/handoff-checklist.md`
- `./examples/sample-handoff-update.md`

---
name: sync-task
description: Bringing the task record level with what the repository contains. Use at a checkpoint — a phase lands, a decision is made, a check runs — when stopping for the day, or when setting up commit-to-task linking. Not for moving a finished bundle into archive or for project-hub drift repair.
---

# Sync Task

Close the gap between what the repository contains and what the task bundle claims. The bundle is the durable channel: anything not written into it is gone when the session ends. A record that lags is not a slow record but a wrong one, and confidently wrong is worse than absent.

## Depth by moment

The same action throughout; only the depth changes.

| Moment | Depth |
|--------|-------|
| Checkpoint mid-work | Touch the files the change affected. Minutes. |
| Stopping for the day | Full pass. Tomorrow starts from what is written now. |

When the task is complete, run a **full pass** here (including verification in `04-verification.md` and `State: done` if appropriate), then hand off to hub maintenance for the archive move and registry finalization.

## Workflow

1. **See what actually landed** before editing any document.

   ```bash
   git status --short
   git log --grep="^Task: T-###" --extended-regexp --format="%h %ad %s" --date=short -n 10
   ```

   Git history wins when it disagrees with the bundle. Correct the bundle, never the history.

2. **Update the files reality moved:**

   | File | Record |
   |------|--------|
   | `00-overview.md` | `- State:` and the next concrete step; any scope change |
   | `01-plan.md` | Phases now complete; re-sequence what remains |
   | `02-architecture.md` | New interfaces, decisions, migration implications |
   | `03-implementation-notes.md` | What changed and why; open TODOs |
   | `04-verification.md` | Commands run and outcomes — pass and fail both |
   | `05-pitfalls.md` | Resolved failures and dead ends; refresh the do-not-repeat summary |

   `05-pitfalls.md` is append-only. Mark an entry resolved or superseded, never delete one. A useful entry names the symptom, the root cause, what was tried, the fix, and how to avoid a repeat.

   If the task still reads `State: planned`, the first checkpoint flips it to `in-progress`. Automatic resume resolution finds only `in-progress` and `blocked` bundles, so a task left on `planned` can be picked up again only by explicit id or branch name.

3. **Commit the verified part** with a `Task: T-###` trailer:

   ```bash
   git commit -m "feat(scope): subject" -m "Task: T-012"
   ```

   The trailer is the only thing linking a commit to a task, and the only input a later session has for rebuilding a timeline. Work that cannot be committed safely stays uncommitted and gets written down — never force broken or unverified changes in for a clean status.

4. **Propagate status to the project hub:**

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   node .ai/scripts/ctl-project-governance.mjs lint --check
   ```

   This copies the bundle's `State:` into the registry after a context sync. It is not a substitute for archive moves or dedicated drift repair.

   `sync --apply` is idempotent. The bundle stays authoritative; the registry is a derived cache. With the hooks installed, the commit in step 3 already ran the sync via `pre-commit` — keep the `lint --check`, skip the manual sync.

## Stopping for the day

A full pass, plus the question a checkpoint skips: **could a stranger continue from this?** Answer, from the bundle alone — what changed, what state the work is in, what the next three actions are with their commands and paths, and how to verify success. Whatever still lives only in your head goes into `03-implementation-notes.md` or `05-pitfalls.md` before you stop.

Write the next step as an instruction to someone else, not a reminder to yourself.

`./templates/full-pass-checklist.md` is the short form to paste into the bundle; a worked example is in `./examples/sample-full-pass.md`.

## Git hooks

`./assets/githooks/` holds the hooks that automate commit-to-task linking. Install once per repository:

```bash
cp -R <this-skill>/assets/githooks/. .githooks/
node .githooks/install.mjs
```

| Hook | Does |
|------|------|
| `prepare-commit-msg` | Injects `Task:` when the branch name carries exactly one valid task id |
| `commit-msg` | Validates conventional format and any `Task: T-###` trailer |
| `pre-commit` | Runs hub `sync --apply` when `dev-docs/` files are staged, and stages the result |

The trailer hooks warn by default; `git config hooks.requireTaskTrailer true` makes them block. Skip once with `SKIP_TASK_TRAILER=1 git commit …`. `prepare-commit-msg` and `commit-msg` use the control script when it is there and fall back to scanning `.ai-task.yaml` directly, so installing them into a repository that has never opened a task still works.

Hooks are optional. Without them the trailer convention still holds — you write the trailer by hand. Details live under `./assets/githooks/`; this section is only the install entry.

The trailer is what links a commit to a task, and the only mechanism a later session has for rebuilding a timeline. Never attach one to unrelated work.

## Rules

- Never describe uncommitted work as landed.
- Never mark a task `done` without verification evidence in `04-verification.md`.
- Never move a bundle into `archive/` from this skill; that is hub-maintenance work after the record is ready.
- Never attach a `Task:` trailer to work unrelated to that task. On a task branch doing unrelated work, set `SKIP_TASK_TRAILER=1` for that commit.
- Never delete a prior decision or pitfall; supersede with an explanation.
- Never hand-edit AUTO-generated hub sections; regenerate with `sync --apply`.
- Never treat `.ai-task.yaml` `status` as authoritative — `00-overview.md` `State:` wins.
- No secrets, credentials, or tokens in any artifact.

## Contract

Progress is `00-overview.md` `State:` and nothing else. Hub layer: `.ai/project/CONTRACT.md`.

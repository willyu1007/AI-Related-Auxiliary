---
name: sync-task
description: Updating the record while work continues. Use when a phase lands, a decision is made, a check runs, or a blocker appears and the work goes on; when the user asks to sync or repair the project hub; or when setting up commit-to-task linking for a repository.
---

# Sync Task

Keep the record level with reality while the work is still moving. Small and frequent beats one
catch-up pass at the end: a bundle that lags three days is not a slow record, it is a wrong one, and
a wrong record is worse than none.

A checkpoint touches only what changed. The full reader-facing pass belongs to `handoff-task`.

## Workflow

1. **See what actually landed** before editing any document.

   ```bash
   git status --short
   git log --grep="^Task: T-###" --extended-regexp --format="%h %ad %s" --date=short -n 10
   ```

   Git history wins when it disagrees with the bundle. Correct the bundle, never the history.

2. **Update only the files reality moved:**

   | File | Record |
   |------|--------|
   | `00-overview.md` | `- State:` and the next concrete step; any scope change |
   | `01-plan.md` | Phases now complete; re-sequence what remains |
   | `02-architecture.md` | New interfaces, decisions, migration implications |
   | `03-implementation-notes.md` | What changed and why; open TODOs |
   | `04-verification.md` | Commands run and outcomes — pass and fail both |
   | `05-pitfalls.md` | Resolved failures and dead ends; refresh the do-not-repeat summary |

   `05-pitfalls.md` is append-only. Mark an entry resolved or superseded, never delete one. A useful
   entry names the symptom, the root cause, what was tried, the fix, and how to avoid a repeat.

3. **Commit the verified part** with a `Task: T-###` trailer:

   ```bash
   git commit -m "feat(scope): subject" -m "Task: T-012"
   ```

   The trailer is the only thing linking a commit to a task, and the only input `resume-task` has
   for rebuilding a timeline. Work that cannot be committed safely stays uncommitted and gets
   written down — never force broken or unverified changes in for a clean status.

4. **Propagate to the project hub**, when `.ai/project/registry.yaml` exists:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   node .ai/scripts/ctl-project-governance.mjs lint --check
   ```

   `sync --apply` is idempotent and copies the bundle's `State:` into the registry. The bundle stays
   authoritative; the registry is a derived cache.

## Repairing hub drift

When the request is "the hub is out of date" rather than "I finished a phase":

```bash
node .ai/scripts/ctl-project-governance.mjs lint --check                    # what is broken
node .ai/scripts/ctl-project-governance.mjs sync --dry-run --init-if-missing  # preview repairs
node .ai/scripts/ctl-project-governance.mjs query --status in-progress      # review mappings
node .ai/scripts/ctl-project-governance.mjs query --status blocked
node .ai/scripts/ctl-project-governance.mjs sync --apply
```

A task that is `in-progress` or `blocked` must not sit on `F-000` unless the triage decision is
stated in the `feature-map.md` briefs. Never hand-edit an AUTO-generated block — regenerate.

## Git hooks

`./assets/githooks/` holds the hooks that automate the linking above. Install once per repository:

```bash
cp -R <this-skill>/assets/githooks/. .githooks/
node .githooks/install.mjs
```

| Hook | Does |
|------|------|
| `prepare-commit-msg` | Injects `Task:` when the branch name carries exactly one valid task id |
| `commit-msg` | Validates conventional format and any `Task: T-###` trailer |
| `pre-commit` | Runs hub `sync --apply` when `dev-docs/` files are staged, and stages the result |

The trailer hooks warn by default; `git config hooks.requireTaskTrailer true` makes them block.
Skip once with `SKIP_TASK_TRAILER=1 git commit …`. `prepare-commit-msg` and `commit-msg` use the
control script when present and fall back to scanning `.ai-task.yaml` directly, so they work with
or without the hub.

Hooks are optional. Without them the trailer convention still holds — you write the trailer by
hand.

## Rules

- Never describe uncommitted work as landed.
- Never attach a `Task:` trailer to work unrelated to that task. On a task branch doing unrelated
  work, set `SKIP_TASK_TRAILER=1` for that commit.
- Never delete a prior decision or pitfall; supersede with an explanation.
- Never hand-edit AUTO-generated hub sections; regenerate with `sync --apply`.
- Never treat `.ai-task.yaml` `status` as authoritative — `00-overview.md` `State:` wins.
- No secrets, credentials, or tokens in any artifact.

## Contract

Task layer: `dev-docs/AGENTS.md`. Hub layer: `.ai/project/CONTRACT.md`.

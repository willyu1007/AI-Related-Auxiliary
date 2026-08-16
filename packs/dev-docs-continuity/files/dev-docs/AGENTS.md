# Dev Docs

Persistent task documentation for context preservation across sessions.

## Trigger Conditions

| Condition | Action |
|-----------|--------|
| Complex task (multi-module, multi-session, >2 hours) | Create task bundle |
| Existing task continued by user intent or a related task branch | Follow the Resume Protocol |
| User requests a pause or handoff | Update docs via `update-dev-docs-for-handoff` |
| Task completed and verified | Archive via `update-dev-docs-for-handoff` with status=done |

## Decision Gate (MUST)

The gate below is the **single definition**. `start-dev-docs-task` references the gate and MUST NOT
restate the criteria.

Create a dev-docs task bundle under `dev-docs/active/<task-slug>/` only when the task is **complex** and benefits from context preservation.

### Skip Conditions (fast path)

Do NOT create dev-docs when **any** is true:
- Single-file change (including adjacent tests/docs)
- Trivial fix (`< 30 min`)
- Simple refactor with clear scope (even if the change touches multiple folders)

### Create Conditions

Create a dev-docs task bundle when **any** is true:
- Expected duration is `> 2 hours`, or likely to span multiple sessions
- The work will be paused/handed off, archived, or otherwise needs context recovery artifacts
- The change is high-risk or cross-cutting (examples: DB/schema migration, auth/security, CI/CD/infra, multi-service/API boundary changes)

Notes:
- Touching multiple folders (e.g., `src/` + `tests/` + docs) is **not** a sufficient trigger by itself.
- ">= 3 sequential steps with verification" is too common; the pattern is **not** a trigger for dev-docs.

If the user asks for a roadmap/plan before coding:
- If the task meets the Create Conditions above, use `start-dev-docs-task`, which writes `roadmap.md` and the bundle.
- Otherwise, provide an in-chat plan and do NOT write under `dev-docs/`.

## Task Contract (MUST)

The rules in the section are the **single definition** of task identity and progress. Any
project-level governance layer MUST derive from the rules here rather than restate them.

### Task progress (source of truth)

**Authoritative file:** `dev-docs/**/active/<task-slug>/00-overview.md`

Under the `## Status` heading there MUST be a bullet:

```markdown
## Status
- State: in-progress
```

- `State:` MUST carry a single value from `planned | in-progress | blocked | done`.
- A task directory under `dev-docs/**/archive/<task-slug>/` has the effective status `archived`,
  whatever `State:` says.

### Task identity (source of truth)

**Authoritative file:** `dev-docs/**/<active|archive>/<task-slug>/.ai-task.yaml`

Minimal schema:

```yaml
version: 1
task_id: T-012
```

Optional fields:

```yaml
slug: my-task-slug
status: in-progress
updated: "YYYY-MM-DD"
keywords:
  - keyword1
```

Validation rules:
- `version` MUST be `1`.
- `task_id` MUST match `^T-\d{3}$` and MUST be unique across the whole repository.
- Task IDs are stable and MUST NOT be reused.
- If `slug` is present, the value MUST equal the task directory name.
- If `status` is present, the value MUST be a valid task status. The field is for display only and
  is **not** authoritative — `00-overview.md` `State:` wins.
- If `updated` is present, the value MUST match `YYYY-MM-DD`.

A missing `.ai-task.yaml` is tolerated (the task is simply unlinked from commits), but an existing
file MUST be valid.

## Coding Gate (MUST)

Before making any code/config changes for a task that meets the Decision Gate:
1. Ensure the task bundle exists under `dev-docs/active/<task-slug>/`. If it is missing, or the work
   is ambiguous, or the user asked for a plan/roadmap, run `start-dev-docs-task` first.
2. During implementation, keep the bundle current:
   - update `00-overview.md` when status changes
   - append to `03-implementation-notes.md` after each phase
   - record every verification run in `04-verification.md` (commands + outcomes)
3. Before an explicit pause, handoff, or task completion, run `update-dev-docs-for-handoff`.

## Commit Gate (MUST)

Task docs describe intent and current state; commits record what landed.

- SHOULD commit after completing and verifying a revertible work unit.
- MAY commit a known-green rollback point before risky changes.
- MUST add a `Task: T-###` trailer when the commit belongs to that task.
- MUST NOT attach a task to unrelated work.
- MUST NOT force broken or unverified work into a commit. Preserve and report any remaining
  worktree changes accurately.

The trailer is what links a commit to a task bundle, and is the only mechanism the Resume Protocol
uses to reconstruct a timeline.

When hooks are installed (`node .githooks/install.mjs`), `prepare-commit-msg` injects `Task:`
only from a branch containing one valid task ID.

## File Purposes

| File | Contains | Update Frequency |
|------|----------|------------------|
| `roadmap.md` | Macro-level planning: milestones, scope, risks, rollback | On initial planning |
| `00-overview.md` | Goal, non-goals, current status | On status change |
| `01-plan.md` | Phases, steps, acceptance criteria | On scope/phase change |
| `02-architecture.md` | Boundaries, interfaces, key risks | On design decision |
| `03-implementation-notes.md` | What changed, why, and open issues (actionable TODOs) | After each phase |
| `04-verification.md` | Checks run and results | After each check |
| `05-pitfalls.md` | Resolved failures, dead ends, historical lessons (not current issues) | After issue is resolved |

## AI Instructions

### Resume Protocol

For a request that continues an existing task, reconstruct context **before** reading
implementation files.

**Fast path.** If `.ai/scripts/ctl-project-governance.mjs` exists (the `project-hub` pack is
installed), one command produces the whole packet:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --json
```

Pass `--task T-###` when the request names a task. Then skip to the Interpretation rules.

**Manual path.** Without the script, perform the same steps in order:

1. **Resolve the task.** Take the first match:
   1. a `T-###` named in the request
   2. a `T-###` found in the current branch name (`git branch --show-current`)
   3. the single `dev-docs/**/active/*/` bundle whose `State:` is `in-progress`
   4. the single bundle whose `State:` is `blocked`

   If a step yields more than one candidate, stop and ask. Do not guess.

2. **Read the task head.** From `00-overview.md`: `State:`, the next concrete step, and the goal.

3. **Rebuild the commit timeline.**

   ```bash
   git log --grep="^Task: T-###" --extended-regexp --format="%h %ad %s" --date=short -n 20
   ```

4. **Check the worktree.** `git status --short`. Uncommitted changes may be ahead of the timeline.

5. **Read the do-not-repeat summary** at the top of `05-pitfalls.md`.

6. **Read further only as needed** — `01-plan.md` for the remaining phases, `03-implementation-notes.md`
   for open TODOs, `04-verification.md` for what has been checked.

**Interpretation rules** (both paths):
- A dirty worktree means inspect `git status --short` and `git diff` before writing code.
- An empty commit timeline means progress is **unknown**, not zero.
- When Git history and the task document disagree about what landed, Git history wins; then correct
  the document.
- Do not run task recovery for unrelated work.

### During Work

- Update `00-overview.md` status field on state change
- Append to `03-implementation-notes.md` after each phase
- Record all verification runs in `04-verification.md`
- Record pitfalls in `05-pitfalls.md` after resolving a significant error/bug/dead-end (historical lessons, not current issues):
  - MUST include: symptom, root cause, what was tried, fix/workaround, and a prevention note

### Workflows

| Workflow | Use When |
|----------|----------|
| `start-dev-docs-task` | Opening a task: roadmap, bundle, or both |
| `update-dev-docs-for-handoff` | Pausing, handing off, unblocking, or completing |

### Archive Rules

When task status changes to "done" and all verification passes:
1. Move `dev-docs/active/<task-slug>/` to `dev-docs/archive/<task-slug>/`
2. `update-dev-docs-for-handoff` handles the move when status=done

### Project Hub Integration (optional)

The section applies **only** when the `project-hub` pack is installed (`.ai/project/registry.yaml`
exists). Without the hub, dev-docs is self-sufficient and the hub steps are not required.

| Event | Action |
|-------|--------|
| Task bundle created | Run `node .ai/scripts/ctl-project-governance.mjs sync --apply` to register the task |
| Task status changed | Run `sync --apply` to propagate the new status to the registry |
| Task archived | Run `sync --apply` to update the registry (status becomes `archived`) |

Notes:
- `sync --apply` is idempotent; safe to run after any task change.
- The task bundle stays authoritative for status; the registry is a derived cache.
- For full hub details, see `.ai/project/AGENTS.md`.

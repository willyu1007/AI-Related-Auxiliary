# Dev Docs

Persistent task documentation for context preservation across sessions.

## Trigger Conditions

| Condition | Action |
|-----------|--------|
| Complex task (multi-module, multi-session, >2 hours) | Open a bundle via `start-dev-docs-task` |
| Work already in flight is continued, or a handoff is accepted | Rebuild context via `resume-dev-docs-task` |
| A phase completes, a decision is made, or a check is run | Checkpoint via `update-dev-docs-task` |
| User requests a pause or handoff | Full pass via `update-dev-docs-task` |
| Task completed and verified | Archive via `update-dev-docs-task` with status=done |

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

### Task granularity

**One task is one resumable unit of work: one bundle, one `State:`, one stream of commits.**

- Tasks MUST be flat. No parent tasks, no subtasks, no nested bundle directories.
- Structure *inside* a task belongs in `01-plan.md` as phases. Phases need no id, no bundle, and
  no separate status.
- Work that genuinely advances in parallel becomes **sibling tasks**, each with a full bundle. Group
  them with `feature_id` in the registry when `project-hub` is installed.

Two mechanisms make flatness a rule rather than a preference:

- Task discovery scans only the immediate children of `active/` and `archive/`. A bundle nested one
  level deeper is invisible, and the enclosing directory is mistaken for a task.
- Task resolution returns exactly one task. A parent and a child both `in-progress` is an ambiguous
  resolution, so every resume stops to ask which one — and running several strands at once is the
  reason to split in the first place.

A third reason is quieter: `Task: T-###` is single-valued, so commits attach to the child. A parent
task ends up with no commits, no verification, and no evidence — a status field nobody can check.

When a bundle grows unmanageable, the correct reading is that the work was several sibling tasks
from the start, not that the task needs children.

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

A missing `.ai-task.yaml` is tolerated, but the task is then unlinked from commits: no `Task:`
trailer can be validated, so no commit timeline can be rebuilt. An existing file MUST be valid.

### Allocating a task ID

Every task bundle gets its ID when the bundle is created, not later.

```bash
{ grep -rh '^task_id:' --include='.ai-task.yaml' . 2>/dev/null
  git log --all --format=%B 2>/dev/null | grep -E '^Task: T-[0-9]{3}'
} | grep -oE 'T-[0-9]{3}' | sort -u | tail -1
```

Take the highest ID and add one, zero-padded to three digits; `T-001` when the scan returns
nothing. Because IDs are never reused, the highest is always the correct base even when lower ones
were archived or deleted.

The scan reads Git history as well as the working tree because the working tree alone is blind to
other branches. In a linked worktree, a sibling worktree's committed task is invisible to `grep`,
so both would allocate the same number and the collision would only surface at merge. `--all`
closes that gap. Two worktrees allocating simultaneously with neither committed can still collide;
lint reports the duplicate, and the fix is to renumber the newer task before merging.

If the `project-hub` pack is installed, `ctl-project-governance.mjs sync --apply` applies the same
rule and fills in a missing file — but do not depend on that. Allocation belongs to the task layer,
and a repository without the hub still needs working commit links.

### Task IDs carry no meaning

`T-###` is an opaque key. It records identity and nothing else.

- MUST NOT encode meaning in the number — no reserved ranges for mainline versus side work, for
  validation tasks, for parallel branches, or for anything else.
- MUST NOT infer meaning from a number when reading one.
- MUST NOT skip ahead to reach a "better" number. Allocation is always highest + 1.

Encoding a scheme in the ID leaves the scheme in one head. Anyone reading `T-901` later — human
or agent — has no rule for decoding, so they either ignore the convention or invent a conflicting
one.

Categorize with fields that have names:

| Need | Use |
|------|-----|
| Tag a task (validation, spike, chore) | `keywords:` in `.ai-task.yaml` |
| Group tasks under one deliverable | `feature_id` / `milestone_id` in the registry (`project-hub`) |
| Separate lines of work | The branch name |

## Coding Gate (MUST)

Before making any code/config changes for a task that meets the Decision Gate:
1. Ensure the task bundle exists under `dev-docs/active/<task-slug>/`. If it is missing, or the work
   is ambiguous, or the user asked for a plan/roadmap, run `start-dev-docs-task` first.
2. During implementation, keep the bundle current:
   - update `00-overview.md` when status changes
   - append to `03-implementation-notes.md` after each phase
   - record every verification run in `04-verification.md` (commands + outcomes)
3. At each checkpoint, and before any pause, handoff, or completion, run `update-dev-docs-task`.

## Commit Gate (MUST)

Task docs describe intent and current state; commits record what landed.

- SHOULD commit after completing and verifying a revertible work unit.
- MAY commit a known-green rollback point before risky changes.
- MUST add a `Task: T-###` trailer when the commit belongs to that task.
- MUST NOT attach a task to unrelated work.
- MUST NOT force broken or unverified work into a commit. Preserve and report any remaining
  worktree changes accurately.

The trailer is what links a commit to a task bundle, and is the only mechanism `resume-dev-docs-task`
has to reconstruct a timeline.

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

### Resuming Existing Work

For a request that continues work already in flight, run `resume-dev-docs-task` **before** reading
implementation files. The skill owns the full protocol — task resolution order, the commit-timeline
reconstruction, and the rules for reconciling the documents against Git history.

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
| `resume-dev-docs-task` | Picking up work already in flight; accepting a handoff |
| `update-dev-docs-task` | Checkpointing mid-work, pausing, handing off, or completing |

### Archive Rules

When task status changes to "done" and all verification passes:
1. Move `dev-docs/active/<task-slug>/` to `dev-docs/archive/<task-slug>/`
2. `update-dev-docs-task` handles the move when status=done

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

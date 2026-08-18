---
name: task-sync
description: >-
  Use when an active tracked task reaches a checkpoint: a phase lands, a
  decision changes, a verification runs, work is about to stop, or task-linked
  commits and records need to be brought level with repository reality.
---

## Depth

| Moment | Required depth |
|---|---|
| Mid-task checkpoint | Update only the records affected by the checkpoint. |
| Before handoff or stopping | Run a full pass so a fresh session can continue from the bundle. |
| Task complete | Run a full pass, record decisive verification, and set `State: done`; archiving remains a separate workflow. |

## Workflow

1. **Resolve and inspect reality.** Identify the task, then inspect linked commits, `git status --short`, and relevant diffs before editing its record. Git history proves committed work; the worktree proves uncommitted work.

2. **Attribute every changed path.** Split changes into this task and foreign work. Use environment session-attribution when available, but still inspect the whole worktree. Never modify, stage, or commit the foreign set. Report it in the handback.

3. **Update only the authorities reality changed.**

   | File | Authority |
   |---|---|
   | `01-status.md` | Canonical goal, `State:`, current phase, next step, blocker, and `Done when` |
   | `00-roadmap.md` | Open questions, assumptions, decisions, scope, current-task relationships, phase order, risks, and closeout |
   | `02-architecture.md` | Settled interfaces, design, and migration implications |
   | `verification.md` | Current completion-condition matrix, latest decisive evidence, outstanding checks, and material limitations |
   | `implementation.md` (optional) | Current map of non-obvious implementation, integration, migration, or operational facts |
   | `pitfalls.md` (optional) | Current evidence-backed recurring hazards and their prevention |

   A decision that changes the goal or completion conditions updates both `00-roadmap.md` and the current conclusion in `01-status.md`. A relationship row records only an edge touching this task and never copies the other task's mutable state. When a dependency blocks this task, update the blocker in `01-status.md` too. Do not create another plan, goal, status, or verification authority.

   Create `implementation.md` only when its durable map would help a fresh agent understand the realized design. Create `pitfalls.md` only after a recurring hazard has evidence. Update both as current snapshots: do not append routine history, ordinary TODOs, or repeated test logs. Remove obsolete pitfalls after prevention is encoded and the warning is no longer useful; Git history retains the old entry. Put bulky raw evidence in `artifacts/`.

   For a legacy bundle, read old paths only when the canonical counterpart is absent. During a full pass, migrate the current task head from `00-overview.md` to `01-status.md`, merge useful planning context from `roadmap.md` or `01-plan.md` into `00-roadmap.md`, and move useful current detail into `implementation.md`, `verification.md`, or `pitfalls.md` as appropriate. Create any missing mandatory canonical file from its template and mark genuinely unknown content as unknown instead of inventing it. Remove each obsolete path after its durable meaning is preserved; do not retain old logs merely because they exist.

   The first real checkpoint changes `planned` to `in-progress`. Set `blocked` only when progress requires unresolved external input or a dependency; state the blocker and the first action after unblock. Set `done` only when every current `Done when` item is satisfied and decisive evidence is recorded in `verification.md`.

4. **Refresh governance before staging.**

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   node .ai/scripts/ctl-project-governance.mjs lint --check
   ```

   This allocates missing task IDs under a cross-worktree lock, refreshes `.ai-task.yaml`, registry entries, and derived views, then validates the result. Inspect the generated diff. If it exposes unrelated pre-existing hub drift that cannot be separated safely from this checkpoint, do not attach that drift to the task commit; report it for the hub-maintenance workflow.

5. **Commit the verified checkpoint.** Stage this task's implementation and bundle paths plus the governance changes caused by this task. Stage by explicit path; never use a worktree-wide catch-all when foreign changes exist.

   ```bash
   git add <this task's paths>
   git commit -m "feat(scope): subject" -m "Task: T-012"
   ```

   The exact `Task:` trailer is the durable commit link. Leave incomplete or unverified code uncommitted and record its state; a truthful dirty checkpoint is safer than a false landed claim. Re-check `git status --short` after the commit and report remaining changes.

## Full-pass test

A fresh session reading `01-status.md` must be able to state the task's goal, state, blocker, and first action. Reading `00-roadmap.md` next must reveal unresolved decisions, why the current direction was chosen, relevant cross-task boundaries, remaining phases, risks, and verification direction. Anything required to answer those questions that exists only in session memory must be recorded before stopping.

Use `./templates/full-pass-checklist.md` for the compact checklist and `./examples/sample-full-pass.md` for a worked example.

## Git hooks

`./assets/githooks/` contains optional automation:

```bash
cp -R <this-skill>/assets/githooks/. .githooks/
node .githooks/install.mjs
```

| Hook | Effect |
|---|---|
| `prepare-commit-msg` | Injects `Task:` only when the branch contains exactly one valid task ID |
| `commit-msg` | Validates the conventional subject and task trailer |
| `pre-commit` | Runs `sync --apply` when task docs are staged and stages the derived result |

Hooks do not change the workflow's authority or attribution rules. A manual pre-stage sync is safe because it is idempotent; the hook should then be a no-op. On a task branch carrying unrelated work, skip automatic trailer injection for that commit with `SKIP_TASK_TRAILER=1`.

## Rules

- Never describe uncommitted work as landed or mark `done` without recorded evidence.
- Never attach a task trailer to foreign work or hide foreign changes from the handback.
- Never erase why a decision changed; mark it superseded with evidence. Pitfalls are different: curate them as a current warning set and remove an item when encoded prevention makes it obsolete.
- Never move a bundle into `archive/` here.
- Never hand-edit AUTO-generated hub blocks or treat registry/meta status as authoritative.
- Never guess or manually allocate a task ID; `sync --apply` owns allocation across linked worktrees.
- Do not put secrets, credentials, or tokens in task artifacts.

## Contract

For an active task, progress is `01-status.md` `## Progress` → `State:`. The registry and `.ai-task.yaml` status are derived projections. Hub behavior follows `.ai/project/CONTRACT.md`.

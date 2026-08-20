---
name: task-sync
description: >-
  Use when an active tracked task reaches a checkpoint: a phase lands, a
  verification runs, work is about to stop, or task-linked commits and records
  need to be brought level with repository reality, including repair of that
  task's invalid identity metadata. Do not use to discuss
  unresolved top-level choices, prepare implementation kickoff, or revise a
  route before the underlying decision is settled.
---

## Depth

| Moment | Required depth |
|---|---|
| Mid-task checkpoint | Update only the records affected by the checkpoint. |
| Before handoff or stopping | Run a full pass so a fresh session can continue from the bundle. |
| Task complete | Run a full pass, record decisive verification, and set `State: done`; archiving remains a separate workflow. |

## Workflow

1. **Resolve and inspect reality.** Read `dev-docs/AGENTS.md`, identify the task, then inspect linked commits, `git status --short`, and relevant diffs before editing its record. Git history proves committed work; the worktree proves uncommitted work.

   If query reports `invalid: true`, repair `.ai-task.json` before the checkpoint. It contains
   exactly `version: 1`, `task_id`, directory `slug`, and `keywords`. Preserve a valid `task_id` only when
   the bundle path, registry projection, and task trailers do not disagree; preserve only valid,
   unique, non-empty keyword strings and remove every other field. For malformed metadata, recover
   an existing ID automatically only when those durable sources identify exactly one ID. Otherwise
   stop and request identity evidence. If those sources prove the bundle has never received an ID,
   remove the invalid metadata file and let sync allocate it. Absence of one source alone is not
   that proof. This is identity repair, never manual allocation.

   If query shows the task's newest occurrence in another worktree — this copy appears in
   `stale_worktrees` — a checkpoint here may only synchronize this worktree's local reality.
   Never copy the newest occurrence's facts into this bundle; recover in the newest worktree or
   bring this one level through Git instead. `conflict: true` — concurrent or unprovable
   divergence — stops the checkpoint until the disagreement is resolved.

2. **Attribute every changed path.** Split changes into this task and foreign work. Use environment session-attribution when available, but still inspect the whole worktree. Never modify, stage, or commit the foreign set. Report it in the handback.

3. **Update only the authorities reality changed.**

   | File | Authority |
   |---|---|
   | `01-status.md` | Current goal, `State:`, current phase, next step, blocker, and `Done when` |
   | `00-roadmap.md` | Top-level decision alignment, current-task relationships, phased implementation plan, risks, and closeout |
   | `02-architecture.md` | Settled interfaces, design, and migration implications |
   | `verification.md` | Current completion-condition matrix, latest decisive evidence, outstanding checks, and material limitations |
   | `implementation.md` (optional) | Current map of non-obvious implementation, integration, migration, or operational facts |
   | `pitfalls.md` (optional) | Current evidence-backed recurring hazards and their prevention |

   A relationship row records only an edge touching this task and never copies the other task's mutable state. When a dependency blocks this task, update the blocker in `01-status.md` too. If repository or verification evidence invalidates a decision or route that implementation depends on, set the kickoff gate to `pending`, uncheck the invalidated gate items (lint rejects a pending gate whose items are all checked), record the evidence, and stop dependent implementation; do not improvise a replacement route during factual synchronization. Keep `01-status.md` pointed at the truthful current phase and next action. Do not create another plan, goal, status, or verification authority.

   Create `implementation.md` from `./templates/implementation.md` only when its durable map would help a fresh agent understand the realized design. Create `pitfalls.md` from `./templates/pitfalls.md` only after a recurring hazard has evidence. Update both as current snapshots: do not append routine history, ordinary TODOs, or repeated test logs. Remove obsolete pitfalls after prevention is encoded and the warning is no longer useful; Git history retains the old entry. Put bulky raw evidence in `artifacts/`.

   Create or update any other task-local supporting document only when the actual work needs its stated, distinct purpose. Such documents may preserve useful domain-specific context, but must not become a second goal, status, plan, decision, architecture, or verification authority.

   The first alignment, discovery, or implementation checkpoint after opening changes `planned` to `in-progress`. Set `blocked` only when progress requires unresolved external input or a dependency; state the blocker and the first action after unblock. Set `done` only when kickoff is `ready`, every current `Done when` item is satisfied, and decisive evidence is recorded in `verification.md`.

4. **Refresh governance before staging.**

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   node .ai/scripts/ctl-project-governance.mjs lint
   ```

   Sync calculates and validates its complete governance change set before writing, then allocates missing task IDs under a cross-worktree lock, validates task metadata, and refreshes registry projections and derived views. A validation error leaves that planned change set unapplied. Lint validates the resulting cross-document semantics. Inspect the generated diff. If it exposes unrelated pre-existing hub drift that cannot be separated safely from this checkpoint, do not attach that drift to the task commit; report it for the hub-maintenance workflow.

5. **Commit the verified checkpoint.** Before staging implementation, verify that the roadmap kickoff gate is `ready`. When it is `pending`, commit only coherent planning, discovery evidence, or record synchronization and do not land decision-dependent implementation. Stage this task's allowed implementation and bundle paths plus the governance changes caused by this task. Stage by explicit path; never use a worktree-wide catch-all when foreign changes exist.

   ```bash
   git add <this task's paths>
   git commit -m "feat(scope): subject" -m "Task: T-012"
   ```

   The exact `Task:` trailer is the durable commit link. Leave incomplete or unverified code uncommitted and record its state; a truthful dirty checkpoint is safer than a false landed claim. Re-check `git status --short` after the commit and report remaining changes.

## Full-pass test

A fresh session reading `01-status.md` must be able to state the task's goal, state, blocker, and first action. Reading `00-roadmap.md` next must reveal kickoff readiness, unresolved top-level choices, why the current direction was chosen, relevant cross-task boundaries, and the remaining route. Anything required to answer those questions that exists only in session memory must be recorded before stopping.

Use `./templates/full-pass-checklist.md` for the compact checklist.

## Rules

- Never describe uncommitted work as landed or mark `done` without recorded evidence.
- Never land decision-dependent implementation while the kickoff gate is `pending`.
- Never attach a task trailer to foreign work or hide foreign changes from the handback.
- Never erase why a decision changed; mark it superseded with evidence. Pitfalls are different: curate them as a current warning set and remove an item when encoded prevention makes it obsolete.
- Never move a bundle into `archive/` here.
- Never hand-edit AUTO-generated hub blocks or treat registry/meta status as authoritative.
- Never guess or manually allocate a new task ID; `sync --apply` owns allocation across linked worktrees. Repair may only preserve or recover an existing ID proved by durable repository evidence.
- Do not put secrets, credentials, or tokens in task artifacts.

## Authority

For an active task, progress is `01-status.md` `## Progress` → `State:`. Registry task status is a derived projection; `.ai-task.json` contains identity and search metadata only. Hub semantics follow `.ai/project/AGENTS.md`.

---
name: task-plan
description: >-
  Use when a tracked task exists or has just been opened and needs top-level
  decisions discussed and resolved, its roadmap made ready for implementation
  kickoff, or its current route revised because new evidence changes scope,
  design, sequencing, task relationships, risk, or verification. Do not use to
  open a new task or merely synchronize completed work with repository reality.
---

Converge one living roadmap without creating a second planning authority.

## Workflow

1. **Recover the task and evidence.** Read `dev-docs/AGENTS.md`, then resolve exactly one existing
   task across linked worktrees with an exact ID query or request-text query. A result with
   `conflict: true` is a stop condition: show its occurrences and differing facts instead of
   choosing a source. `invalid: true` also stops planning until the reported task metadata is
   repaired. Continue in another worktree only when the environment can target it safely
   and the request clearly identifies it. Inspect the resolved status, roadmap, settled
   architecture, linked commits, relevant worktree changes, and repository evidence. If no
   tracked task exists, stop; this workflow does not create one.

2. **Classify the planning moment.** Use the same roadmap for all three cases:

   | Moment | Outcome |
   |---|---|
   | Alignment | Material top-level choices move from `open` through a supported recommendation to `decided`. |
   | Kickoff | The gate becomes `ready` and the first implementation phase is executable. |
   | Replan | Invalidated assumptions or decisions are replaced, affected phases are rewritten, and readiness is re-established. |

   When evidence invalidates a decision or route that implementation depends on, set the kickoff gate to `pending` immediately, uncheck the gate items the evidence invalidated (lint rejects a pending gate whose items are all checked), and stop dependent implementation while replanning. Independent evidence gathering may continue.

3. **Drive decision convergence.** Work from the `Decision alignment` table rather than a temporary plan document.

   - For a user-owned choice about goal, scope, product behavior, or acceptance, present the viable options, material tradeoffs, recommendation, and consequence. Mark it `decided` only after user confirmation.
   - For a technical choice inside the approved boundary, gather repository or experimental evidence and decide it when the recorded closure condition is satisfied.
   - Ask only about choices that need user ownership or materially block the route. Do not outsource ordinary technical discovery.
   - Update the roadmap after a semantic event: a material question appears, the recommended direction changes, a decision closes or is superseded, a task relationship changes, or evidence changes sequencing, risk, recovery, or verification. Do not rewrite it after every conversational turn.

4. **Propagate each conclusion once.** Keep the decision question, status, closure evidence, concise rationale, consequences, and working assumptions in `00-roadmap.md`. Put only the resulting current technical design and contracts in `02-architecture.md`; do not copy alternatives, decision ownership, closure status, or rationale history there. If a premise is invalidated, remove or revise any architecture conclusion that no longer remains settled. If the goal, completion conditions, current phase, next action, or blocker changed, update `01-status.md`. The first alignment or discovery checkpoint after opening changes `State: planned` to `State: in-progress`; kickoff readiness remains a separate dimension. Keep relationship rows directional and never copy another task's mutable state.

5. **Build or revise the executable route.** While kickoff is `pending`, the first phase may be alignment or discovery and later implementation phases may remain absent rather than invented. Keep work as phases only while it shares this task's outcome, state, completion conditions, and lifecycle. If new evidence reveals work needing an independent outcome, owner, pause, verification, archive, worktree, or managed interface, record the relationship and creation trigger instead of expanding this roadmap to own it. Before changing the gate to `ready`, verify all of the following in the roadmap:

   - every user-owned choice that blocks implementation is `decided`;
   - current settled design and interfaces are reflected in `02-architecture.md`;
   - the first implementation phase has an outcome, approach, ordered changes, affected boundaries, dependencies, exit criteria, verification, and recovery;
   - every current completion condition has a decisive planned check in `verification.md`.

   Check all kickoff items, set `Status: ready`, and make `01-status.md` point to the first unfinished implementation action. Never use `ready` to mean merely that a discussion occurred.

6. **Checkpoint the semantic change.** Refresh and validate governance, inspect the entire
   worktree, and separate this task's paths from foreign changes. Stage only the planning bundle
   and governance paths caused by this task, using explicit paths; never absorb an unrelated
   staged or dirty change. Commit the coherent planning checkpoint with the task trailer. Batch
   tightly related decisions; do not create a commit for wording-only churn.

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   node .ai/scripts/ctl-project-governance.mjs lint
   git commit -m "docs(task): plan T-### <slug>" -m "Task: T-###"
   ```

7. **Hand back or implement.** Report kickoff status, resolved and unresolved decisions, the changed route, affected task relationships, and the first executable action. If the request also authorizes implementation, begin or resume it only when kickoff is `ready`; a planning-only request stops after the checkpoint and handback. When the user asks for an HTML explanation, create it after the checkpoint from the current bundle and keep it outside the repository as a non-authoritative communication artifact.

## Rules

- Never create a temporary alignment, kickoff, or replan document beside the roadmap.
- Never leave kickoff `ready` after a gating premise or route is invalidated.
- Never start or continue decision-dependent implementation while kickoff is `pending`.
- Never mark a user-owned choice `decided` without confirmation or a technical choice `decided` without its recorded evidence.
- Never turn implementation detail that does not change the route into roadmap churn.
- Never let an HTML brief, host plan, or conversation become a second task authority.

---
name: task-plan
description: >-
  Use when the user wants to plan or replan a tracked task, including when they
  choose to continue after task creation.
---

Converge one task bundle into a coherent current plan without creating a second planning authority.

## Workflow

1. **Locate the task and recover its context.** Resolve the Git top-level and run the rest of this
   workflow there. Read `dev-docs/AGENTS.md`. Prefer the task ID already established by the
   current request or preceding task creation; otherwise query by request terms:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs query --id T-### --json
   node .ai/scripts/ctl-project-governance.mjs query --text "<request terms>" --json
   ```

   Continue only after the query identifies exactly one valid matching task. A result with
   `conflict: true` is a stop condition: show its occurrences and differing facts instead of
   choosing a source. `invalid: true` also stops planning until the reported task metadata is
   repaired. Show multiple plausible candidates and ask the user which one to plan; if none
   matches, report that and stop. Continue in another worktree only when the environment can
   target it safely and the request clearly identifies it; otherwise report its path and stop.

   After selecting the task, pass its exact ID to context recovery rather than relying on an
   implicit fallback:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs resume --task T-###
   ```

   Use the packet as a starting index, then inspect `01-status.md`, `00-roadmap.md`,
   `02-architecture.md`, `requirement.md` when present, `verification.md`, linked commits,
   relevant worktree changes, and repository evidence. Read `pitfalls.md` or other supporting
   material when its stated purpose can affect the route.

2. **Converge on the planning direction.** Work from the user's direction, the task bundle, and
   repository evidence.

   - If the user has proposed a solution, use it as the current direction. Otherwise, form a proposal from the user's goal, constraints, preferences, and the available evidence.
   - Identify only top-level decisions that can materially change the solution or its overall route. Where the direction is not already clear, lead with a recommendation for the user to confirm or revise; resolve ordinary implementation details directly.
   - Incorporate confirmed decisions and user corrections back into the proposal until it forms one coherent direction. Do not reopen settled choices unless new evidence invalidates them.
   - If evidence invalidates a settled decision, assumption, or dependent route, immediately set kickoff to `pending`, uncheck the affected gate items, stop dependent implementation, and revise the affected decisions and phases. Independent evidence gathering may continue.

3. **Reconcile the task bundle into the current plan.** Use the current direction, top-level
   decisions, user feedback, and repository evidence to decide what must be added, revised,
   retained, or removed so the bundle expresses one coherent current plan. Apply each fact
   according to the document responsibilities in `dev-docs/AGENTS.md`; preserve required
   structure, not stale content.

   - Keep the task outcome, boundaries, and acceptance references aligned with the current direction. Leave unresolved material changes as decisions rather than recording them as settled facts.
   - Add, revise, or remove decisions, assumptions, relationships, risks, settled design, verification, and supporting context according to their current relevance. Retain superseded content only while it still constrains the active route, transition, or recovery.
   - Build or revise phases at the level supported by current evidence. They should collectively reach the task outcome and completion contract, express coherent results rather than technical layers, make the first unfinished phase executable, and keep unsupported later detail provisional. Keep work in this task only while it serves the same outcome and lifecycle; represent independent outcomes as related tasks.
   - Re-evaluate progress, the next action, and the recorded kickoff gate after each material reconciliation. If the route exposes a missing top-level decision or contradiction, return to Step 2. Keep kickoff `pending` until every recorded gate item holds and the first implementation action can begin without reopening the overall route; only then set it to `ready`.

   Treat the conversation as working context and the bundle as the current planning snapshot. Do
   not preserve the transcript, duplicate facts across authorities, or retain obsolete content for
   history. The first post-opening planning checkpoint changes `State: planned` to
   `State: in-progress`; kickoff readiness remains a separate dimension. Repeat Steps 2 and 3 as
   feedback or evidence materially changes the direction.

4. **Confirm the planning checkpoint with the user.** Keep planning changes uncommitted and
   present the current result in the user's preferred language and a compact, decision-oriented
   structure. Always include the outcome, current solution, top-level decisions, readiness, and
   confirmation; omit only empty optional sections rather than sending the user to the full bundle:

   ```markdown
   ### Planning checkpoint review — T-###

   **Outcome**
   - Goal:
   - In scope:
   - Out of scope:
   - Acceptance references:

   **Current solution**
   - ...

   **Top-level decisions**
   - Confirmed: ...
   - Needs confirmation: ... / None

   **Route**
   1. **Phase** — expected outcome

   **Readiness**
   - Kickoff: `ready` / `pending`
   - Reason:
   - First action:

   **Material risks or relationships**
   - ...

   **Confirmation**
   - Approve this planning checkpoint or provide corrections.
   ```

   After feedback, return to Steps 2 and 3, then present only the changed direction and its effects
   on decisions, phases, and readiness unless the plan changed enough to require a new full
   checkpoint. End with one explicit request to approve the checkpoint or provide corrections.
   Proceed only after the user confirms that no further planning changes are needed; confirmation
   does not close choices still recorded as unresolved.

5. **Create the planning checkpoint.** After user confirmation, synchronize and validate
   governance, then inspect the resulting task bundle, final diff, and entire worktree. Confirm
   that the checkpoint still matches the approved plan and separate this task's paths from foreign
   changes. Scoped sync keeps other bundles' drift out of this checkpoint; inspect its preview and
   continue only when every planned change belongs to this planning checkpoint.

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --task T-### --dry-run
   node .ai/scripts/ctl-project-governance.mjs sync --task T-### --apply
   node .ai/scripts/ctl-project-governance.mjs lint --task T-###
   ```

   If validation or the final diff reveals a material planning change, return to Steps 2–4 before
   committing. If no semantic planning change exists, do not create a checkpoint commit.
   Otherwise, stage only the task bundle and governance paths caused by this task, using explicit
   paths; never absorb an unrelated staged or dirty change. Commit the coherent checkpoint with
   the task trailer:

   ```bash
   git commit -m "docs(task): plan T-### <slug>" -m "Task: T-###"
   ```

   If the user or repository policy rules out a commit, leave the validated checkpoint coherent
   and uncommitted.

6. **Hand back or continue.** In the user's preferred language, report the actual result without
   repeating the confirmed planning brief. Omit immaterial fields:

   ```markdown
   ### Planning checkpoint result — T-###

   - Kickoff:
   - Checkpoint:
   - Remaining decisions or blockers:
   - Next action:
   - Material task relationships or preserved foreign changes:
   ```

   If kickoff is `ready` and implementation scope is not already clear, recommend an execution
   boundary and list the current phases as cumulative stopping points, using outcomes rather than
   implementation detail. Mark provisional boundaries honestly and let the user choose how far to
   proceed. Existing implementation authorization takes precedence; do not ask again when the user
   has already selected a boundary or authorized the complete task.

   Planning approval alone does not authorize implementation. Begin or resume implementation only
   within the authorized boundary and while kickoff remains `ready`; any selected scope remains
   subject to newly discovered top-level decisions and required external approvals. Otherwise stop
   after the handback.

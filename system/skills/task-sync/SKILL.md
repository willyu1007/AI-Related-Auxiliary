---
name: task-sync
description: >-
  Use when work associated with one or more active tracked tasks needs a
  repository checkpoint after a coherent implementation unit or decisive
  verification result, before stopping or handoff, at completion, or to
  reconcile task records or identity metadata with repository reality.
---

## Reconciliation depth

Use the deepest applicable level.

- **Ordinary checkpoint:** Reconcile the coherent unit being checkpointed, its evidence, and only the task authorities whose facts changed.
- **Before stopping or handoff:** Run a full recovery pass across the task bundle, linked commits, and worktree so a fresh session can continue from repository state alone.
- **Task completion:** Run a full completion pass against the completion contract in `dev-docs/AGENTS.md`, record the decisive evidence and required acceptance, and set `State: done` only when that contract holds.

## Workflow

1. **Identify affected tasks and checkpoint boundaries.** Resolve the Git top-level and read
   `dev-docs/AGENTS.md`. Form the affected task set from exact task IDs already carried by the
   current workflow, changed task-bundle paths, task trailers in relevant commits, and current
   worktree or session evidence. Validate and recover each identified task through the applicable
   branch:

   - With a reliable task ID, run
     `node .ai/scripts/ctl-project-governance.mjs query --id T-### --json`.
   - Without a reliable task ID, run
     `node .ai/scripts/ctl-project-governance.mjs query --text "<exact bundle slug>" --json`; when it
     returns one valid task, use its returned ID.
   - If either query reports `invalid: true`, do not resume; follow
     [identity repair](references/identity-repair.md) before continuing.

   Only after validation, recover the task by exact ID with
   `node .ai/scripts/ctl-project-governance.mjs resume --task T-###`.

   Do not use the user's goal as the primary attribution signal. Multiple valid tasks are not an
   ambiguity: order them and process them one at a time. Give each checkpoint one owning task, one
   coherent unit, and the deepest applicable reconciliation level. Ask the user only when a
   task ownership depends on a user decision; stop when different tasks cannot be separated safely.

   For a task using the stopping, handoff, or completion level, read the
   [full-pass checklist](references/full-pass-checklist.md) now and satisfy it across Steps 2–5,
   confirming it again after the checkpoint.

   If query shows the task's newest occurrence in another worktree — this copy appears in
   `stale_worktrees` — stop this checkpoint. Recover in the newest worktree, or bring this occurrence
   level through Git and query again. Never copy the newest occurrence's facts into this bundle.
   `conflict: true` also stops the checkpoint until the disagreement is resolved.

2. **Inspect and attribute repository reality.** Inspect linked commits, `git status --short`, the
   worktree diff, and the staged diff before editing task records. Partition changed paths and
   evidence among the affected tasks and foreign work. Use environment session attribution when
   available, but still inspect the whole worktree. Never modify, stage, or commit the foreign set. If a
   change cannot be isolated without modifying or mixing another task's or foreign work, stop and
   report the boundary instead of forcing a checkpoint.

3. **Reconcile one task at a time.** Read the selected bundle and update only the authorities whose
   facts changed, following the document responsibilities in `dev-docs/AGENTS.md`.

   A relationship row records only an edge touching this task and never copies the other task's mutable state. When a dependency blocks this task, update the blocker in `01-status.md` too. If repository or verification evidence invalidates a decision or route that implementation depends on, apply the kickoff and `Authorized boundary` rules in `dev-docs/AGENTS.md` and record the evidence; do not improvise a replacement route during factual synchronization. Return control to the enclosing workflow for replanning before dependent implementation resumes; if synchronization is user-facing, report replanning as the next action. Keep `01-status.md` pointed at the truthful current phase and next action.

   Record each decisive result in Evidence with its baseline, and remove the Outstanding
   verification item it passes. When the checkpoint changes what earlier evidence of this task
   covers, rerun the check or return it to Outstanding verification. When it adds behavior that a
   check must cover, add the check there and name it in the first unfinished phase where its
   condition can hold. When it adds or changes deployment, update Deployment changes and their
   confirmation items. At a phase boundary, apply the phase-closing rule in `dev-docs/AGENTS.md`;
   otherwise leave the phase open. At completion, when no other task has taken over a
   later-environment check or exit condition, ask the user to open one; never create it yourself.

   Create `implementation.md` from `<repo-root>/dev-docs/templates/implementation.md` only when its durable map would help a fresh agent understand the realized design. Create `pitfalls.md` from `<repo-root>/dev-docs/templates/pitfalls.md` only after a recurring hazard has evidence. Do not append routine history, ordinary TODOs, or repeated test logs to either. Remove obsolete pitfalls after prevention is encoded and the warning is no longer useful. Put bulky raw evidence in `artifacts/`.

   Apply state changes under the lifecycle model in `dev-docs/AGENTS.md`.

4. **Preview and validate this task** with the selected ID:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --task T-### --dry-run
   ```

   Inspect the preview before any write. Continue only when every planned change is attributable to
   the selected task and the global views derived from the registry. Keep missing or invalid
   identity on the separate repair path from Step 1.

   Only after the preview passes that boundary, apply and validate it:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --task T-### --apply
   node .ai/scripts/ctl-project-governance.mjs lint --task T-###
   ```

   Inspect the selected bundle and generated diff before staging. If lint fails, keep the applied
   changes uncommitted and resolve or report the failure.

5. **Commit one isolated checkpoint.** Before staging implementation, verify that the roadmap
   kickoff gate is `ready`. When it is `pending`, commit only coherent planning, discovery
   evidence, or record synchronization and do not land decision-dependent implementation.

   Inspect the existing index before staging. If it contains another task's or foreign staged
   work, do not commit or alter that staging without authorization. Otherwise stage only this
   task's implementation, bundle, and derived governance changes by explicit path or separable
   hunk, then inspect the complete staged diff and confirm that it has exactly one task owner.

   ```bash
   git add <this task's paths>
   git diff --cached
   ```

   ```bash
   git commit -m "<type>(<scope>): <subject>" -m "Task: T-###"
   ```

   Commit only when the current
   authorization includes creating the checkpoint; otherwise leave the validated state
   uncommitted and preserve that fact for the enclosing workflow. Leave incomplete or unverified
   code uncommitted and record its state. Re-check `git status --short` whether committed or not,
   then return to Steps 2–5 for the next affected task.

   After every affected task has completed this loop, run a final global
   `sync --dry-run` and `lint`. If the preview reveals another affected task, add it to the loop.
   Preserve and report unrelated pre-existing drift or validation failures rather than absorbing
   them into a completed task checkpoint.

6. **Return control or hand back.** When task-sync runs as an internal checkpoint, return to the
   enclosing workflow without a standalone user report. Surface only a condition that requires user
   input, changes the authorized boundary, or prevents safe continuation.

   When synchronization itself is the user-facing request, report in the user's preferred language
   after all affected tasks have been processed or a boundary stops the loop. Keep the result compact
   and omit empty fields:

   ```markdown
   ### Task checkpoints

   #### T-### — <checkpoint summary>
   - State / phase:
   - Depth:
   - Checkpoint:
   - Decisive verification:
   - Remaining task changes:
   - Next action:

   **Preserved or ambiguous changes**
   - ...
   ```

Never hand-edit generated hub views or allocate task IDs manually; `sync --apply` owns both.

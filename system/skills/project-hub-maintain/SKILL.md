---
name: project-hub-maintain
description: >-
  Use when the user asks to archive or close a verified task, apply selected
  archive transitions, apply a confirmed project-stage mapping, or repair
  project-hub registry, mapping, or derived-view drift. Not for choosing a
  stage goal or for read-only status, audit, or archive-readiness questions.
---

## Route

| Intent | Workflow |
|---|---|
| Close or archive a selected verified task | Archive task |
| Record a confirmed Milestone or change which Features it owns | Maintain project stage |
| Repair registry, mapping, or generated-view drift | Repair hub drift |

The task bundle owns execution truth. The hub is a semantic map and derived projection; it does not replace checkpoint synchronization.

Read `dev-docs/README.md` before auditing or changing a task bundle.

## Archive task

Archiving is an approved destructive transition from a working record to a compact historical record. Use `./templates/archive-checklist.md`.

### Gates

1. **Clean, aligned checkpoint.** The closeout checkpoint is committed, the active bundle matches repository reality, and unrelated worktree changes are identified. If not, run the task checkpoint synchronization workflow first.

2. **Completion audit.** Treat `State: done` as a claim. Require roadmap kickoff `ready`, read the goal and every `Done when` item from `01-status.md`, inspect the task's exact trailer-linked commit timeline and delivered code, and rerun the cheapest decisive verification from `verification.md` when it is still runnable. Environmental inability to run a check must be explicit; it is not a pass.

   Stop when either side disagrees: reality incomplete means finish the work; reality complete but the record stale means synchronize the task. Archiving itself never repairs the claim.

3. **Resolve proposed follow-ups.** Every unresolved `proposed:<slug>` must first become an opened task, be explicitly canceled or descoped in the roadmap, or receive a durable transfer destination in the Feature Brief. Opening a follow-up is a separate task-opening checkpoint; archive approval does not authorize it. If the disposition requires user judgment, stop and ask before drafting the archive transition.

4. **Distillation proposal.** Inspect every additional task-local supporting entry before deleting it; preserve its durable meaning in the authorities above or the archive summary, and omit only material that is intentionally ephemeral or superseded. Draft `summary.md` containing only:

   - task ID, slug, goal, and actual outcome, including descoped parts;
   - durable decisions and migration consequences;
   - verification evidence and any environmental limitation;
   - pitfalls worth carrying forward;
   - related tasks and the disposition of every unresolved `proposed:<slug>` follow-up;
   - `git log --grep="^Task: T-###"` as the full-history pointer.

   Show the exact move, the proposed summary, and the deletion list. The deletion list is every bundle entry except `.ai-task.json` and the new `summary.md`, including roadmap, status, architecture, verification, optional files, requirements, and artifacts.

   Roadmap deletion must not erase future work.

5. **Explicit approval.** One approval covers the shown summary, deletions, and move from `dev-docs/active/<slug>/` to `dev-docs/archive/<slug>/`. Without approval, change nothing.

### Execute as one recoverable change

6. Write `summary.md`, remove the approved source files, and move the bundle. The archived bundle must contain exactly `.ai-task.json` and `summary.md`; its location makes its effective state `archived`.

7. If the task changed feature intent, scope, constraints, or risk posture, update the manual Semantic Feature Brief in `.ai/project/feature-map.md` now. Never edit its AUTO block.

8. Refresh and validate the hub before committing:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   node .ai/scripts/ctl-project-governance.mjs lint
   ```

   A failure stops the commit. Restore the clean active layout from the pre-archive checkpoint or correct the approved transition; never leave a half-archived bundle.

9. Stage the archive move, `.ai-task.json` status refresh, affected feature brief, registry, and derived views. Commit one task per archive so its transition remains on its own timeline:

   ```bash
   git commit -m "chore(archive): archive T-### <slug>" -m "Task: T-###"
   ```

10. Report the archive path, retained summary, deleted material, verification run, hub/feature changes, commit, and deferred follow-ups.

### Stop conditions

- Completion audit fails: report the unmet condition; do not archive.
- Bundle is stale or dirty: return it to checkpoint synchronization.
- Approval is absent or differs from the proposed scope: leave the active bundle intact.
- Hub refresh or lint fails: do not commit a partial transition.

## Maintain project stage

Use this only after the stage outcome and affected Features are confirmed. The hub records the
decision; it does not decide product scope.

1. Inspect `.ai/project/registry.json` in every linked worktree. Stop on an uncommitted semantic
   edit or conflicting meaning for the same ID.
2. For a new stage, allocate the next unused monotonic `M-###` across those registries; `M-000` is
   reserved. Add only `id`, `title`, `status: planned`, and a concise outcome in `description`.
3. Show the exact Milestone record and Feature `milestone_id` changes. Apply only the confirmed
   scope. Do not add Milestone fields to task entries or create a separate Milestone document.
4. For a status change to `done`, require the outcome to be accepted and every in-scope Feature to
   be `done` or `cut`. Active or blocked mapped tasks are conflicting evidence to resolve first.
5. Regenerate derived views and validate:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   node .ai/scripts/ctl-project-governance.mjs lint
   ```

Report the stage outcome, affected Features, progress contradictions, and exact files changed.

## Repair hub drift

Inspect first, apply second:

```bash
node .ai/scripts/ctl-project-governance.mjs lint
node .ai/scripts/ctl-project-governance.mjs sync --dry-run
node .ai/scripts/ctl-project-governance.mjs query --json
node .ai/scripts/ctl-project-governance.mjs sync --apply
node .ai/scripts/ctl-project-governance.mjs lint
```

- Active `in-progress` or `blocked` work remains on `F-000` only when the triage choice is explicit in the Semantic Feature Brief.
- For a confirmed task-to-Feature or task-to-Requirement correction, preview and then apply the supported mapping instead of expecting sync to choose semantic ownership:

  ```bash
  node .ai/scripts/ctl-project-governance.mjs map --task T-### --feature F-### --requirement R-### --dry-run
  node .ai/scripts/ctl-project-governance.mjs map --task T-### --feature F-### --requirement R-### --apply
  ```

  Omit `--requirement` when only the Feature mapping changes. When a repair must remove or reparent an existing relationship, show the exact targeted registry edit and obtain confirmation before applying it; sync preserves existing semantic mappings.
- To change a task's Milestone, change its Feature mapping or the owning Feature's confirmed `milestone_id`; never add `milestone_id` to a task entry.
- Regenerate AUTO sections; never hand-edit them.
- Do not alter an active task's goal or `State:` as part of hub repair.
- If drift originates from another worktree's uncommitted bundle, report its worktree and coordinate there instead of overwriting it here.

## Boundaries

- Never archive without completion evidence and explicit approval of the exact destructive scope.
- Never delete source content before its durable meaning appears in the proposed `summary.md`.
- Never distill an active bundle that will remain active.
- Never combine multiple task archives in one commit.
- Never put secrets in hub files, task bundles, or summaries.

## Authority

For active tasks, `01-status.md` owns progress. For archived tasks, path owns effective state and the bundle contains exactly `.ai-task.json` plus `summary.md`. Hub semantics follow `.ai/project/AGENTS.md`.

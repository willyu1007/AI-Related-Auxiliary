---
name: project-hub-maintain
description: >-
  Use when the user asks to archive or close a verified task, apply selected
  archive transitions, or repair project-hub registry, mapping, or
  derived-view drift. Not for read-only status, audit, or archive-readiness
  questions.
---

## Route

| Intent | Workflow |
|---|---|
| Close or archive a selected verified task | Archive task |
| Repair registry, mapping, or generated-view drift | Repair hub drift |

The task bundle owns execution truth. The hub is a semantic map and derived projection; it does not replace checkpoint synchronization.

## Archive task

Archiving is an approved destructive transition from a working record to a compact historical record. Use `./templates/archive-checklist.md`.

### Gates

1. **Clean, aligned checkpoint.** The closeout checkpoint is committed, the active bundle matches repository reality, and unrelated worktree changes are identified. If not, run the task checkpoint synchronization workflow first.

2. **Completion audit.** Treat `State: done` as a claim. Read the goal and every `Done when` item from `01-status.md`, inspect the task's exact trailer-linked commit timeline and delivered code, and rerun the cheapest decisive verification from `verification.md` when it is still runnable. For a legacy bundle only, fall back to `04-verification.md` when the canonical file is absent. Environmental inability to run a check must be explicit; it is not a pass.

   Stop when either side disagrees: reality incomplete means finish the work; reality complete but the record stale means synchronize the task. Archiving itself never repairs the claim.

3. **Resolve proposed follow-ups.** Every unresolved `proposed:<slug>` must first become an opened task, be explicitly canceled or descoped in the roadmap, or receive a durable transfer destination in the Feature Brief. Opening a follow-up is a separate task-opening checkpoint; archive approval does not authorize it. If the disposition requires user judgment, stop and ask before drafting the archive transition.

4. **Distillation proposal.** Draft `summary.md` containing only:

   - task ID, slug, goal, and actual outcome, including descoped parts;
   - durable decisions and migration consequences;
   - verification evidence and any environmental limitation;
   - pitfalls worth carrying forward;
   - related tasks and the disposition of every unresolved `proposed:<slug>` follow-up;
   - `git log --grep="^Task: T-###"` as the full-history pointer.

   Show the exact move, the proposed summary, and the deletion list. The deletion list is every bundle entry except `.ai-task.yaml` and the new `summary.md`, including roadmap, status, architecture, verification, optional files, requirements, artifacts, and legacy filenames.

   Roadmap deletion must not erase future work.

5. **Explicit approval.** One approval covers the shown summary, deletions, and move from `dev-docs/active/<slug>/` to `dev-docs/archive/<slug>/`. Without approval, change nothing.

### Execute as one recoverable change

6. Write `summary.md`, remove the approved source files, and move the bundle. The archived bundle must contain exactly `.ai-task.yaml` and `summary.md`; its location makes its effective state `archived`.

7. If the task changed feature intent, scope, constraints, or risk posture, update the manual Semantic Feature Brief in `.ai/project/feature-map.md` now. Never edit its AUTO block.

8. Refresh and validate the hub before committing:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   node .ai/scripts/ctl-project-governance.mjs lint --check
   ```

   A failure stops the commit. Restore the clean active layout from the pre-archive checkpoint or correct the approved transition; never leave a half-archived bundle.

9. Stage the archive move, `.ai-task.yaml` status refresh, affected feature brief, registry, and derived views. Commit one task per archive so its transition remains on its own timeline:

   ```bash
   git commit -m "chore(archive): archive T-### <slug>" -m "Task: T-###"
   ```

10. Report the archive path, retained summary, deleted material, verification run, hub/feature changes, commit, and deferred follow-ups.

### Stop conditions

- Completion audit fails: report the unmet condition; do not archive.
- Bundle is stale or dirty: return it to checkpoint synchronization.
- Approval is absent or differs from the proposed scope: leave the active bundle intact.
- Hub refresh or lint fails: do not commit a partial transition.

## Repair hub drift

Inspect first, apply second:

```bash
node .ai/scripts/ctl-project-governance.mjs lint --check
node .ai/scripts/ctl-project-governance.mjs sync --dry-run
node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --json
node .ai/scripts/ctl-project-governance.mjs sync --apply
node .ai/scripts/ctl-project-governance.mjs lint --check
```

- Active `in-progress` or `blocked` work remains on `F-000` only when the triage choice is explicit in the Semantic Feature Brief.
- Regenerate AUTO sections; never hand-edit them.
- Do not alter an active task's goal or `State:` as part of hub repair.
- If drift originates from another worktree's uncommitted bundle, report its worktree and coordinate there instead of overwriting it here.

## Boundaries

- Never archive without completion evidence and explicit approval of the exact destructive scope.
- Never delete source content before its durable meaning appears in the proposed `summary.md`.
- Never distill an active bundle that will remain active.
- Never combine multiple task archives in one commit.
- Never put secrets in hub files, task bundles, or summaries.

## Contract

For active tasks, `01-status.md` owns progress. For archived tasks, path owns effective state and the bundle contains exactly `.ai-task.yaml` plus `summary.md`. Hub behavior follows `.ai/project/CONTRACT.md`.

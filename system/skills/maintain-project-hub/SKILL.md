---
name: maintain-project-hub
description: >-
  Project-hub governance for finished tasks and registry hygiene. Use when a
  verified task is ready to move from active to archive, when the user asks to
  archive or close out a task, when the user asks which tasks can be archived
  or for a global archive-readiness check, or when the project hub/registry is
  out of date, drifting, or needs lint/repair (including stale feature
  mappings). Not for routine checkpoint or end-of-day task-record updates, and
  not for read-only progress questions.
---

# Maintain Project Hub

Govern the project hub and the task lifecycle endpoints that are **not** routine context sync: audit what is actually finished, distill and archive it, and repair hub/registry drift.

Task-record alignment (what landed vs what the bundle claims) belongs to the checkpoint / end-of-day sync workflow. This skill assumes that work is already done — or stops and requires it — before archiving.

## When to use

| Intent | Workflow |
|--------|----------|
| One task verified and ready to seal | **A — Archive task** |
| "Which tasks can be archived?" / global readiness check | **B — Archive sweep** |
| Hub/registry wrong, stale, or inconsistent | **C — Repair hub drift** |

## When not to use

- Mid-work checkpoints or stopping for the day (update the bundle first via the sync workflow)
- Opening a new task or cold-start resume
- Read-only "what is in progress?" questions

## Preconditions

- A task bundle under `dev-docs/active/<slug>/` whose record is already aligned
- `.ai/project/CONTRACT.md` and `.ai/scripts/ctl-project-governance.mjs`, both installed when the first task was opened

---

## Workflow A — Archive task

Archiving is a **state transition plus a distillation**, not filing. The full bundle survives forever in git history — one `git log` away — so the archived tree carries only what a future reader needs, and every surviving byte is a cost to every future grep. Use `./templates/archive-checklist.md` as the working list.

### Gates (all required, in order)

1. **Record aligned** — A full sync pass already ran for this close-out. The bundle matches git reality (history wins over stale docs).

2. **Completion audit** — `State: done` is a claim, not proof. Audit it against reality, by default, every time:
   - Read the goal and acceptance criteria from `00-overview.md`.
   - Check that the commit timeline (`git log --grep="^Task: T-###"`) and the code itself actually deliver them.
   - Re-run the cheapest decisive verification command recorded in `04-verification.md`, when runnable — not runnable means the command or its targets no longer exist; expensive still counts as runnable.

   Documents saying done while reality disagrees is a stop: send the task back to record what is actually missing. Do not archive on hope.

   The favorable direction stops too: a task that is complete in reality while its record still says `in-progress` is not archivable — the record goes back through the sync workflow first. Never rewrite another session's `State:` as part of archiving; the audit reads reality, it does not edit the claim.

3. **No false "landed" claims** — Uncommitted or unverified work is documented as open, not implied complete.

4. **Distillation proposed** — Rewrite `00-overview.md` as the sealed record. It carries, and nothing else:
   - the goal and the outcome — met, partially met, or descoped, and what actually shipped
   - key decisions worth knowing later, distilled from `02-architecture.md` / `03-implementation-notes.md`
   - a verification summary distilled from `04-verification.md`: what was run, what it proved
   - the do-not-repeat pitfalls worth carrying forward, from `05-pitfalls.md`
   - the pointer to the full trail: `git log --grep="^Task: T-###"`

   Everything else is then deleted: `01-plan.md`, `02-architecture.md`, `03-implementation-notes.md`, `04-verification.md`, `05-pitfalls.md`, `roadmap.md`, `requirement.md`, and any `artifacts/`. The archived bundle is exactly two files: the sealed `00-overview.md` and `.ai-task.yaml` — identity must survive, for ID-uniqueness scans and commit-timeline lookups.

   Nothing is lost, only relocated: content moves into the sealed record before its source file dies, and the full originals stay in git history.

5. **User approval** — One proposal, one approval, covering both halves: the move `dev-docs/active/<slug>/` → `dev-docs/archive/<slug>/`, and the distillation — show the sealed record and the list of files to delete. Wait for explicit approval before touching anything.

6. **Execute** — Write the sealed record, delete the distilled files, move the directory. Location sets effective status (`archived`), whatever `State:` says. Leave `.ai-task.yaml` alone — the sync in the next gate rewrites its display `status` itself. Commit the archive as its own commit, one per task, with the task's trailer, so the seal appears on the task's own timeline:

   ```bash
   git commit -m "chore(archive): archive T-### <slug>" -m "Task: T-###"
   ```

7. **Hub propagate** — After the move, so the registry sees the final state:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   node .ai/scripts/ctl-project-governance.mjs lint --check
   ```

8. **Feature brief** — If intent, scope, or risk posture changed over the task's life, refresh the Semantic Feature Brief in `.ai/project/feature-map.md` in the same change. `dashboard.md` stays a short index only — never the brief body.

9. **Handoff** — Report the archived path, what the sealed record retains, what was deleted, and any deferred follow-ups.

### Stop conditions

- Completion audit fails → do not archive; report exactly which criterion reality does not meet.
- Bundle not aligned with git → do not archive; complete a full sync pass first.
- User declines → leave the bundle under `active/` untouched — no move, no distillation, no deletions.

---

## Workflow B — Archive sweep

When the user asks which tasks are ready to archive, or for a global archive-readiness check.

1. List every bundle under `dev-docs/active/`:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs query --status done
   grep -r "^- State:" --include=00-overview.md dev-docs/active
   ```

2. For each bundle — whatever its `State:` says — run a light completion audit: goal and acceptance criteria from `00-overview.md`, against the commit timeline and the code. This is the point of the sweep: a task sitting on `in-progress` may be finished in reality, and a task claiming `done` may not be. Both divergences report as **not ready** — the first needs its record aligned through the sync workflow, the second needs the missing work — the sweep just makes each visible.

3. Report a table: task, claimed state, audited state, ready / not ready, and the missing gate for every not-ready entry.

4. Tasks the user then picks go through **Workflow A** one at a time — the sweep grants no approvals.

---

## Workflow C — Repair hub drift

When the request is hub/registry hygiene rather than sealing tasks:

```bash
node .ai/scripts/ctl-project-governance.mjs lint --check
node .ai/scripts/ctl-project-governance.mjs sync --dry-run
node .ai/scripts/ctl-project-governance.mjs query --status in-progress
node .ai/scripts/ctl-project-governance.mjs query --status blocked
node .ai/scripts/ctl-project-governance.mjs sync --apply
```

Rules:

- A task that is `in-progress` or `blocked` must not sit on `F-000` unless that triage decision is stated in the `feature-map.md` briefs.
- Never hand-edit AUTO-generated hub sections — regenerate with `sync --apply`.
- The task bundle remains authoritative for status; the registry is a derived cache.

After apply, re-run `lint --check` and summarize what changed.

---

## Boundaries

- Never archive without the completion audit and explicit user approval.
- Never lose information in distillation: content lands in the sealed record before its source file is deleted, and the deletion happens only inside an approved archive — never as loose cleanup.
- Never distill or delete anything in a bundle that stays under `active/`.
- Never mark done as part of a casual hub lint; done belongs to the task record.
- Never hand-edit AUTO blocks in hub files.
- No secrets in hub files, task bundles, or sealed records.

## Assets

| Path | Role |
|------|------|
| `templates/archive-checklist.md` | Required gates before/during archive |

## Contract

Progress is `00-overview.md` `State:`; the archive path is what makes a task `archived`. Hub layer: `.ai/project/CONTRACT.md`.

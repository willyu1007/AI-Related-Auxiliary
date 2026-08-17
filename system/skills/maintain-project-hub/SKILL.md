---
name: maintain-project-hub
description: >-
  Project-hub governance for finished tasks and registry hygiene. Use when a
  verified task is ready to move from active to archive, when the user asks to
  archive or close out a task, or when the project hub/registry is out of date,
  drifting, or needs lint/repair (including stale feature mappings). Not for
  routine checkpoint or end-of-day task-record updates, and not for read-only
  progress questions.
---

# Maintain Project Hub

Govern the project hub and task lifecycle endpoints that are **not** routine context sync: archive a finished task, and repair hub/registry drift.

Task-record alignment (what landed vs what the bundle claims) belongs to the checkpoint / end-of-day sync workflow. This skill assumes that work is already done—or stops and requires it—before archiving.

## When to use

| Intent | Workflow |
|--------|----------|
| Task verified and ready to seal | **Archive task** |
| Hub/registry wrong, stale, or inconsistent | **Repair hub drift** |

## When not to use

- Mid-work checkpoints or stopping for the day (update the bundle first via the sync workflow)
- Opening a new task or cold-start resume
- Read-only “what is in progress?” questions

## Preconditions

- A task bundle under `dev-docs/active/<slug>/` whose record is already aligned
- `.ai/project/CONTRACT.md` and `.ai/scripts/ctl-project-governance.mjs`, both installed when the first task was opened

---

## Workflow A — Archive task

Archiving is a **state transition**, not filing. Complete every gate below. Use `./templates/archive-checklist.md` as the working list.

### Gates (all required)

1. **Record aligned** — A full sync pass already ran for this close-out. The bundle matches git reality (history wins over stale docs).
2. **Verification present** — `04-verification.md` has evidence that the Definition of Done was met. Do not mark done on hope.
3. **`State: done`** — Written in `00-overview.md` (authoritative). Do not treat `.ai-task.yaml` `status` as source of truth.
4. **No false “landed” claims** — Uncommitted or unverified work is documented as open, not implied complete.
5. **User approval to move** — Propose `dev-docs/active/<slug>/` → `dev-docs/archive/<slug>/` and **wait for explicit approval** before moving. Location sets effective status (`archived`).
6. **Hub propagate:**

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   ```

   Registry status becomes `archived` from the archive path.
7. **Feature brief** — If intent, scope, or risk posture changed over the task’s life, refresh the Semantic Feature Brief in `.ai/project/feature-map.md` in the same change (intent, scope in/out, decision, dependencies, risks, success signal, related tasks, next checkpoint). `dashboard.md` stays a short index only—never the brief body.
8. **Handoff** — Confirm the checklist is complete; report archived path and any deferred follow-ups.

### Stop conditions

- Missing verification → do not archive; send back to record the checks.
- Bundle not aligned with git → do not archive; complete a full sync pass first.
- User declines the move → leave the bundle under `active/` with `State: done` (or the state they choose); do not move.

---

## Workflow B — Repair hub drift

When the request is hub/registry hygiene rather than sealing one task:

```bash
node .ai/scripts/ctl-project-governance.mjs lint --check
node .ai/scripts/ctl-project-governance.mjs sync --dry-run
node .ai/scripts/ctl-project-governance.mjs query --status in-progress
node .ai/scripts/ctl-project-governance.mjs query --status blocked
node .ai/scripts/ctl-project-governance.mjs sync --apply
```

Rules:

- A task that is `in-progress` or `blocked` must not sit on `F-000` unless that triage decision is stated in the `feature-map.md` briefs.
- Never hand-edit AUTO-generated hub sections—regenerate with `sync --apply`.
- The task bundle remains authoritative for status; the registry is a derived cache.

After apply, re-run `lint --check` and summarize what changed.

---

## Boundaries

- Never archive without verification evidence and user approval for the move.
- Never mark done as part of a casual hub lint; done belongs to the task record.
- Never hand-edit AUTO blocks in hub files.
- Never delete prior decisions or pitfalls in a bundle while archiving; supersede if needed during the preceding sync pass.
- No secrets in hub files or task bundles.

## Assets

| Path | Role |
|------|------|
| `templates/archive-checklist.md` | Required gates before/during archive |

## Contract

Progress is `00-overview.md` `State:`; the archive path is what makes a task `archived`. Hub layer: `.ai/project/CONTRACT.md`.

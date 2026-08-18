# Archive checklist

Task: `T-###` · slug: `<slug>`

## Before proposing

- [ ] Full sync pass completed; bundle matches `git status` / task commit timeline
- [ ] Completion audit passed: goal and every `Done when` item from `01-status.md` hold against the commit timeline and delivered code — not just against `State: done`
- [ ] Cheapest decisive verification command from `verification.md` re-run, when runnable (legacy fallback: `04-verification.md`)
- [ ] Uncommitted or unfinished work is not described as landed
- [ ] Every unresolved `proposed:<slug>` is opened as a task, canceled/descoped, or transferred to the Feature Brief and summary
- [ ] `summary.md` drafted: ID + goal + actual outcome, durable decisions, verification evidence, do-not-repeat pitfalls, related/follow-up task disposition, `git log --grep="^Task: T-###"` pointer
- [ ] Deletion list drafted: every bundle entry except `.ai-task.yaml` and new `summary.md`, including canonical and legacy planning/status files

## Approval

- [ ] Proposed as one package: move `dev-docs/active/<slug>/` → `dev-docs/archive/<slug>/` + `summary.md` + deletion list
- [ ] User explicitly approved

## After execution

- [ ] Archived bundle is exactly `.ai-task.yaml` + `summary.md`
- [ ] Semantic Feature Brief refreshed before hub generation if intent, scope, constraints, or risk changed
- [ ] Hub `sync --apply` run after the move; `lint --check` passed
- [ ] Registry shows `archived`
- [ ] `dashboard.md` not used as the brief body
- [ ] Archive, metadata, feature brief, registry, and derived views committed together with `Task: T-###`

## Done when

- [ ] All boxes above are checked or explicitly N/A with reason

# Archive checklist

Task: `T-###` · slug: `<slug>`

## Before proposing (gates 1–4)

- [ ] Full sync pass completed; bundle matches `git status` / task commit timeline
- [ ] Completion audit passed: goal and acceptance criteria from `00-overview.md` hold against the commit timeline and the code — not just against `State: done`
- [ ] Cheapest decisive verification command from `04-verification.md` re-run, when runnable
- [ ] Uncommitted or unfinished work is not described as landed
- [ ] Sealed record drafted: goal + outcome, key decisions, verification summary, do-not-repeat pitfalls, `git log --grep="^Task: T-###"` pointer
- [ ] Deletion list drafted: `01-plan.md`, `02-architecture.md`, `03-implementation-notes.md`, `04-verification.md`, `05-pitfalls.md`, `roadmap.md`, `requirement.md`, `artifacts/` (as present)

## Approval (gate 5)

- [ ] Proposed as one package: move `dev-docs/active/<slug>/` → `dev-docs/archive/<slug>/` + sealed record + deletion list
- [ ] User explicitly approved

## After execution (gates 6–8)

- [ ] Archived bundle is exactly two files: sealed `00-overview.md` + `.ai-task.yaml`
- [ ] Hub `sync --apply` run after the move; `lint --check` green
- [ ] Registry shows `archived`
- [ ] Semantic Feature Brief refreshed if intent/scope/risk changed
- [ ] `dashboard.md` not used as the brief body

## Done when

- [ ] All boxes above are checked or explicitly N/A with reason

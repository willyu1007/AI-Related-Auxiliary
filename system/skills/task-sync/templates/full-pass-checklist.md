# Full-pass checklist

- [ ] Every changed path is attributed to this task or named as foreign work.
- [ ] `01-status.md` states the canonical goal, state, current phase, next action, blocker, and current `Done when` conditions.
- [ ] `00-roadmap.md` records open questions, current decisions, relationships touching this task, remaining phases, risks, and verification direction without duplicating task state.
- [ ] `verification.md` contains the latest decisive evidence for each completion condition; superseded or bulky logs are absent or moved to `artifacts/`.
- [ ] Optional `implementation.md` exists only when non-obvious current implementation context warrants it, and contains no status, decision history, routine TODOs, or verification.
- [ ] Optional `pitfalls.md` contains only current evidence-backed recurring hazards; obsolete entries are removed.
- [ ] Useful content from legacy detail paths is migrated and the obsolete paths are removed during a full pass.
- [ ] `sync --apply` and `lint --check` completed; generated changes were inspected for unrelated drift.
- [ ] The verified unit is committed with the exact `Task: T-###` trailer; remaining dirty paths are reported.

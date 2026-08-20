# Full-pass checklist

- [ ] Every changed path is attributed to this task or named as foreign work.
- [ ] `01-status.md` states the current goal, state, current phase, next action, blocker, and current `Done when` conditions.
- [ ] `00-roadmap.md` states truthful kickoff readiness and preserves top-level decision status and rationale, relationships touching this task, and the remaining implementation route without duplicating task state.
- [ ] Decision-dependent implementation is staged only when kickoff is `ready`; invalidated routes have returned to `pending`.
- [ ] `verification.md` contains the latest decisive evidence for each completion condition; superseded or bulky logs are absent or moved to `artifacts/`.
- [ ] Optional `implementation.md` exists only when non-obvious current implementation context warrants it, and contains no status, decision history, routine TODOs, or verification.
- [ ] Optional `pitfalls.md` contains only current evidence-backed recurring hazards; obsolete entries are removed.
- [ ] `sync --apply` and `lint` completed; generated changes were inspected for unrelated drift.
- [ ] The verified unit is committed with the exact `Task: T-###` trailer; remaining dirty paths are reported.

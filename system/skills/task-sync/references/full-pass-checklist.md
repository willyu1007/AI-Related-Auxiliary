# Full-pass checklist

- [ ] Every changed path is attributed to this task or named as foreign work; shared or ambiguous changes have an explicit boundary.
- [ ] `01-status.md` states the current goal, state, phase, next action, blocker, and acceptance references.
- [ ] `00-roadmap.md` preserves truthful decisions, relationships, kickoff readiness, and the remaining route toward the completion contract.
- [ ] `02-architecture.md` agrees with the current settled design, interfaces, implementation, and material migration or operational facts.
- [ ] Decision-dependent implementation is included only when kickoff is `ready`; an invalidated route has returned to `pending`.
- [ ] `verification.md` contains the latest decisive evidence, outstanding checks, and material limitations without repeated or bulky logs.
- [ ] Optional and supporting entries remain current, have distinct purposes, and do not compete with bundle authorities; `implementation.md` and `pitfalls.md` exist only when their conditions hold.
- [ ] If `State: done`, decisive evidence and any required acceptance support outcome closure, quality, and semantic convergence.
- [ ] Scoped `sync --task T-### --dry-run`, `sync --task T-### --apply`, and `lint --task T-###` completed; generated changes were inspected for unrelated drift.
- [ ] The checkpoint is isolated in the index and committed with one `Task: T-###` trailer when authorized, or its validated uncommitted state and all remaining changes are preserved for the enclosing workflow and any required handback.

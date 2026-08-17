# Archive checklist

Task: `T-###` · slug: `<slug>`

## Before proposing the move

- [ ] Full sync pass completed; bundle matches `git status` / task commit timeline
- [ ] `04-verification.md` records passing evidence for the Definition of Done
- [ ] `00-overview.md` has `State: done`
- [ ] Uncommitted or unfinished work is not described as landed
- [ ] Pitfalls/decisions retained (append-only; no silent deletes)

## Approval

- [ ] Proposed path: `dev-docs/active/<slug>/` → `dev-docs/archive/<slug>/`
- [ ] User explicitly approved the directory move

## After the move

- [ ] Directory is under `dev-docs/archive/<slug>/`
- [ ] Hub `sync --apply` run (if `.ai/scripts/ctl-project-governance.mjs` exists)
- [ ] Registry shows archived (when hub present)
- [ ] Semantic Feature Brief refreshed if intent/scope/risk changed
- [ ] `dashboard.md` not used as the brief body

## Done when

- [ ] All boxes above are checked or explicitly N/A with reason

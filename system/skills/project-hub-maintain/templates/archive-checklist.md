# Archive checklist

Task: `T-###` · slug: `<slug>`

## Before proposing

- [ ] Full sync pass completed; bundle matches `git status` / task commit timeline
- [ ] Roadmap kickoff is `ready`; no invalidated route remains pending
- [ ] Completion contract in `dev-docs/AGENTS.md` is supported by decisive evidence; `Done when` was reviewed only as an acceptance reference
- [ ] Cheapest decisive verification command from `verification.md` re-run, when runnable
- [ ] Uncommitted or unfinished work is not described as landed
- [ ] Every material deferred outcome has an explicit task, proposed Idea, canceled, or descoped disposition
- [ ] Any Idea addition exists only in the exact archive transition awaiting approval
- [ ] Every additional task-local supporting entry was reviewed; durable meaning is preserved before deletion
- [ ] `summary.md` drafted: ID + goal + actual outcome, durable decisions, verification evidence, do-not-repeat pitfalls, related/follow-up task disposition, `git log --grep="^Task: T-###"` pointer
- [ ] Deletion list drafted: every bundle entry except `.ai-task.json` and new `summary.md`

## Approval

- [ ] Proposed as one package: move `dev-docs/active/<slug>/` → `dev-docs/archive/<slug>/` + `summary.md` + deletion list
- [ ] User explicitly approved

## After execution

- [ ] Archived bundle is exactly `.ai-task.json` + `summary.md`
- [ ] Approved Idea additions applied; no unapproved registry change was made
- [ ] Approved registry Feature title/description change applied when Feature meaning changed
- [ ] Hub `sync --apply` run after the move; `lint` passed
- [ ] Registry shows `archived`
- [ ] Archive, metadata, Feature record, registry, and derived views committed together with `Task: T-###`

## Final check

- [ ] All boxes above are checked or explicitly N/A with reason

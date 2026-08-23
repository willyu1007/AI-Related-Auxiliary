---
name: project-status
description: >-
  Use when a user or workflow needs a read-only view of tracked tasks,
  Features, Milestones, or the project hub for status, progress, blockers,
  evidence-backed next actions, archive readiness, or consistency.
---

## Working model

- **Task** — one durable work outcome recorded in a task bundle.
- **Feature** — a project capability that tasks map to.
- **Milestone** — a project-stage outcome that groups Features.
- **Project hub** — connects these records; this skill reads them with repository evidence without changing them.

## Status views

Load only the views relevant to the request; combine them when the request spans more than one:

- **Task inventory, overall progress, or blocked work** — [task-overview.md](references/task-overview.md)
- **Next actions** — [next-action.md](references/next-action.md)
- **Milestone progress** — [milestone-progress.md](references/milestone-progress.md)
- **Semantic or project focus** — [semantic-focus.md](references/semantic-focus.md)
- **Archive readiness** — [archive-readiness.md](references/archive-readiness.md)
- **Hub consistency** — [hub-drift.md](references/hub-drift.md)

## Workflow

1. **Resolve the scope and views.**
   - Resolve the Git top-level and run the workflow there.
   - Determine whether the request concerns one task, selected work, or the project as a whole.
   - Read `dev-docs/AGENTS.md` and only the relevant status views. Read `.ai/project/AGENTS.md`
     when project-hub semantics or consistency are in scope.

2. **Gather the baseline evidence.**
   - Run the selected views' data-source commands.
   - Treat query results as cross-worktree logical task rows; expand returned task documents only
     when the requested view needs more detail.
   - Preserve conflicts, invalid or missing identity, and missing required active records as
     diagnostics rather than task facts.

3. **Deepen the evidence where the answer depends on it.**
   - Use `resume` for relevant active tasks when making claims about actual progress, landed work,
     worktree state, or the next executable action.
   - Use `lint` or dry-run evidence when consistency could change the answer.
   - Use the project graph query for Feature or Milestone meaning.

4. **Reconcile and present the view.**
   - Apply the authority model in `dev-docs/AGENTS.md`; surface disagreements and leave unsupported
     facts unknown.
   - Combine related views without repeating evidence.
   - Match the output to the caller: use the user's preferred language for a user-facing answer,
     or return only the needed facts to an enclosing workflow.

## Boundaries

- Remain read-only: do not edit governance records or run commands that write.
- Preserve source disagreements and evidence gaps; do not turn unsupported or conflicted values
  into task facts.

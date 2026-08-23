# Milestone progress

Use this view for a stage outcome, Milestone progress, or the Features contributing to a stage.

## Data sources

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
node .ai/scripts/ctl-project-governance.mjs project-query --json
```

Use the project graph query for declared Milestone and Feature meaning and status, and the task
query for mapped task evidence. A conflicted project row preserves its worktree-specific values but
has no selected semantic source.

## Interpretation

- Report the requested Milestone. If none is named, use explicit project focus or show all relevant
  current Milestones rather than choosing arbitrarily. Treat `M-000` as an untriaged queue, not a
  stage goal.
- Group each task under its derived Milestone and Feature. Keep declared Feature/Milestone status
  separate from observed task state.
- Counts are evidence, not weighted completion percentages. Do not infer effort or scope coverage
  from the number of tasks.
- A Milestone marked `done` while any Feature is not `done` or `cut` is inconsistent.
- A Feature marked `done` or `cut` while it has `planned`, `in-progress`, or `blocked` tasks is
  inconsistent. Re-map, finish, or otherwise resolve those tasks before accepting the Feature status.
- When a non-empty Milestone has only `done` or `cut` Features and no active mapped tasks, report
  it as possibly ready for acceptance. Do not mark it `done`; the stage outcome still needs human
  confirmation.
- Surface blockers and cross-worktree disagreement before recommending new work.

## Include

- Each relevant Milestone's title, declared status, and stage outcome.
- Its Features, their declared statuses, and the mapped task-state signals that matter to the view.
- Blockers, inconsistencies, or possible acceptance readiness without converting task counts into
  project-level status.
- A next step only when requested or supported by documented selection evidence.

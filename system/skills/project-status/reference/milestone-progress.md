# Milestone Progress Report

Use when the user asks about a stage goal, Milestone progress, or which Features remain in the
current stage.

## Data Source

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
node .ai/scripts/ctl-project-governance.mjs lint
cat .ai/project/registry.json
```

Use `registry.json` for the declared Milestone and Feature meaning and status. Use query results
for task evidence across linked worktrees.

## Output Template

```markdown
## Stage Progress

**Milestone**: M-xxx <title>
**Declared status**: <status>
**Stage outcome**: <description or unknown>

| Feature | Declared status | Planned | In progress | Blocked | Done/archived | Signal |
|---------|-----------------|---------|-------------|---------|---------------|--------|
| F-xxx <title> | <status> | N | N | N | N | <evidence or inconsistency> |

**Stage signal**: <active, blocked, possibly ready for acceptance, inconsistent, or unknown>
**Recommended next step**: <one concrete action>
```

## Rules

- Report the requested Milestone. If none is named, prefer real Milestones with `in-progress` or
  `blocked` status; treat `M-000` as an untriaged queue, not a stage goal.
- Group each task under its derived Milestone and Feature. Keep declared Feature/Milestone status
  separate from observed task state.
- Do not use a conflicted logical task row as stage-progress evidence until its differing facts are
  reconciled; list the conflict separately.
- Do not use an invalid task row as stage-progress evidence; list its metadata diagnostics separately.
- Counts are evidence, not weighted completion percentages. Do not infer effort or scope coverage
  from the number of tasks.
- A Milestone marked `done` while any Feature is not `done` or `cut` is inconsistent.
- A Feature marked `done` or `cut` while it has `planned`, `in-progress`, or `blocked` tasks is
  inconsistent. Re-map, finish, or otherwise resolve those tasks before accepting the Feature status.
- When a non-empty Milestone has only `done` or `cut` Features and no active mapped tasks, report
  it as possibly ready for acceptance. Do not mark it `done`; the stage outcome still needs human
  confirmation.
- Surface blockers and cross-worktree disagreement before recommending new work.

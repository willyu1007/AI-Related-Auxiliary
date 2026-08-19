# Next Action Report

Use when user asks what to do next, needs guidance on priorities, or is picking up work.

## Data Source

```bash
node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --json
```

For the selected task, read its bounded recovery packet:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --repo-root <worktree_path> --task T-xxx --json
```

## Priority Rules

| Priority | Condition |
|----------|-----------|
| 1 | Has `in-progress` task with kickoff `pending` → continue alignment or replanning, not implementation |
| 2 | Has `in-progress` task with kickoff `ready` → continue that task's implementation |
| 3 | Has `blocked` task → attempt to unblock |
| 4 | Has `planned` task → continue planning toward kickoff |
| 5 | All `done` → report completion or suggest new work |

## Output Template

```markdown
## Recommended Next Steps

**Priority 1**: <action>
- Task: T-xxx <slug>
- Current status: <status>
- Action: <what to do>
- Command: `<executable command>`

**Priority 2** (optional): <action>
- ...

**Alternatives**:
- Start new task: <if any planned tasks>
- Unblock: <if any blocked tasks>
```

## Rules
- Always provide at least one actionable command
- If continuing an in-progress task, suggest reading its current status head first
- For blocked tasks, suggest investigation steps
- Use `timeline.commits` for landed work and `status` for the task goal and next step.
- Use `roadmap.kickoff_status` to distinguish alignment/replanning from runnable implementation.
- Never recommend decision-dependent implementation while kickoff is `pending`.
- Report an empty timeline as unknown progress, not zero progress.
- If `worktree.clean` is false, inspect the returned `suggested_commands` first.
- Surface packet warnings instead of silently overriding task documentation.

# Task List Report

Use when user asks about current tasks, task inventory, or what's being tracked.

## Data Source

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
```

## Output Template

```markdown
## Tasks

| Task ID | Name | Status | Kickoff | Feature | Worktree | Path |
|---------|------|--------|---------|---------|----------|------|
| <T-###> | <slug> | <status> | pending / ready | <F-###> | <worktree> | dev-docs/active/<slug>/ |

**Quick actions**:
- View details: open the row's `status_doc_path` under its `worktree_path`
- Filter by status: `node .ai/scripts/ctl-project-governance.mjs query --status in-progress`
```

## Rules
- List all tasks from query results
- Sort by status for readability: in-progress, blocked, planned, done, archived
- For `conflict: true`, show the occurrence paths and differing facts instead of one worktree/path
- For `invalid: true`, show `metadata_errors` and do not present the row as a task fact
- Report `kickoff_status` for active tasks; use `—` for archived tasks

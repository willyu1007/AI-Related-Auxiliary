# Task List Report

Use when user asks about current tasks, task inventory, or what's being tracked.

## Data Source

```bash
node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --json
```

## Output Template

```markdown
## Tasks

| Task ID | Name | Status | Feature | Worktree | Path |
|---------|------|--------|---------|----------|------|
| T-001 | <slug> | <status> | F-xxx | <worktree> | dev-docs/active/<slug>/ |

**Quick actions**:
- View details: open the row's `status_doc_path` under its `worktree_path`
- Filter by status: `node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --status in-progress`
```

## Rules
- List all tasks from query results
- Sort by status priority: in-progress > blocked > planned > done
- Include worktree and path for quick navigation; do not collapse divergent checkouts silently

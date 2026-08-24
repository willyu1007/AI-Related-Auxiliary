# Task overview

Use this view for task inventory, state summaries, or blocked work.

## Data sources

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
```

Use `--status <status>` when the requested scope is already explicit. Open a returned
`status_doc_path` only when the view needs more detail from the task head, such as its current
phase, next step, or blocker. Returned document paths are relative to the row's `worktree_path`;
resolve them from that worktree, not the current one.

## Interpretation

- Query returns one logical row per task ID across linked worktrees. Count that row once; report
  `stale_worktrees` when an older checked-out copy matters to the requested view.
- Treat a conflict, invalid or missing metadata, or `status_doc_state: missing` as diagnostic
  evidence rather than a task fact. Archived rows report `not-required` for both
  `status_doc_state` and `kickoff_status`.
- Counts describe the tracked inventory, not effort, quality, scope coverage, or completion
  percentage.
- Keep kickoff readiness separate from task state. Read a blocked task's documented `Blocker:`;
  leave the reason unknown when none is recorded.

## Include

- Only the task fields, counts, or blocked details needed by the requested scope.
- Conflicting, invalid, or incomplete rows separately from task facts and counts.
- A comparison table when several tasks benefit from the same fields; otherwise use the clearest
  compact form for the caller.

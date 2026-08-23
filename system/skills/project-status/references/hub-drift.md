# Hub drift audit

Use this view to diagnose disagreement among task bundles, registry mappings, and generated hub
views without repairing it.

## Data sources

```bash
node .ai/scripts/ctl-project-governance.mjs lint
node .ai/scripts/ctl-project-governance.mjs sync --dry-run
node .ai/scripts/ctl-project-governance.mjs query --json
node .ai/scripts/ctl-project-governance.mjs project-query --json
```

## Interpretation

- Summarize each distinct issue once across the command results.
- When linked worktrees give the same Feature or Milestone ID different meaning, show the versions
  as an unresolved semantic conflict; neither current copy becomes authoritative automatically.
- Separate current-worktree generated drift from another worktree's uncommitted task record. Do not
  recommend overwriting the latter from the current worktree.
- If no issue appears, state which evidence was checked rather than inferring broader consistency.

## Include

Use a comparison table when several issues are present:

| Issue | Evidence / authority boundary | Affected worktree / path | Impact | Suggested repair |
|---|---|---|---|---|

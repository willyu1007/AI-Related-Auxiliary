# Hub drift audit

Use this response when the user asks whether task bundles, registry mappings, or generated hub views disagree. This workflow diagnoses drift without repairing it.

## Data source

```bash
node .ai/scripts/ctl-project-governance.mjs lint --check
node .ai/scripts/ctl-project-governance.mjs sync --dry-run
node .ai/scripts/ctl-project-governance.mjs query --json
```

## Output

Summarize each distinct issue once:

| Issue | Authoritative source | Affected worktree / path | Impact | Suggested repair |
|---|---|---|---|---|
| <!-- lint or dry-run finding --> | <!-- task bundle / registry / manual Feature Brief --> | <!-- exact location --> | <!-- stale status, mapping, derived view, or conflict --> | <!-- specific maintenance action --> |

Separate current-worktree generated drift from another worktree's uncommitted task record. Do not recommend overwriting the latter from the current worktree. If no issue appears, report that the checked state is consistent and name the commands used.

## Rules

- `lint --check`, `sync --dry-run`, and queries are read-only here.
- Never run `sync --apply`, edit an AUTO block, change task state, or repair a mapping.
- A task bundle owns progress and identity; registry task entries and generated views are projections.

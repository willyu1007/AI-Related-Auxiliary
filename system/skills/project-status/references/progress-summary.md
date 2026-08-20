# Progress Summary Report

Use when user asks about overall progress, project status, or completion state.

## Data Source

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
```

## Output Template

```markdown
## Progress Overview

| Status | Count | Ratio |
|--------|-------|-------|
| done | N | X% |
| in-progress | N | X% |
| blocked | N | X% |
| planned | N | X% |
| archived | N | X% |

**In Progress**:
- <T-###> <slug> - <kickoff status> - <brief description or current phase>

**Blocked** (if any):
- <T-###> <slug> - <blocking reason if known>

**Recommended Next Step**: <prioritized recommendation>
```

## Rules
- Calculate percentages from every valid, non-conflicting logical row returned by query, including archived tasks
- Exclude conflicted or invalid logical rows from status percentages and report them separately as unresolved evidence
- Only show "Blocked" section if blockers exist
- Next step follows documented selection evidence and action rules (see next-action.md)
- Separate kickoff-pending alignment/replanning from kickoff-ready implementation

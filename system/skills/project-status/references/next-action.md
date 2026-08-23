# Next action

Use this view to identify evidence-backed next work or present the available choices.

## Data sources

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
```

For a selected active task, read its bounded packet when the recommendation depends on actual
progress, worktree state, or an executable next step:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --repo-root <worktree_path> --task <T-###>
```

Use packet warnings and `truncated_fields` to decide whether the underlying Git or task evidence
needs selective expansion.

## Interpretation

| Condition | Action type |
|----------|-----------|
| `in-progress` with kickoff `pending` | Continue alignment or replanning, not implementation |
| `in-progress` with kickoff `ready` | Continue that task's implementation |
| `blocked` | Investigate the named blocker or required external input |
| `planned` | Continue planning toward kickoff |
| All tasks terminal | Report completion or suggest selecting new work |

- When several tasks are eligible, rank them only from documented deadlines, dependencies, blockers,
  project focus, or an explicit user priority. If no evidence distinguishes them, present the choices
  without inventing a project priority.
- Use `roadmap.kickoff_status` to distinguish alignment/replanning from runnable implementation.
- Never recommend decision-dependent implementation while kickoff is `pending`.
- Treat `timeline.commits` as bounded task-trailer evidence. An empty or scan-limited timeline leaves
  progress unknown beyond its evidence boundary.
- Reconcile relevant worktree changes and packet warnings before relying on the documented next step.
- Base a blocked action on its recorded blocker or required external input; leave unsupported causes
  unknown.

## Include

- The task, its current state, and the evidence that makes the action appropriate.
- One next action, or unranked choices when the records do not establish a priority.
- Relevant alternatives, commands, or verification only when they help the user or enclosing
  workflow act.

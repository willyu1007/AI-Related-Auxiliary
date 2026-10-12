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
needs selective expansion. Read each active task's Outstanding verification in `verification.md`,
and when an item names a task in another repository, run the same query there and read that task
too. Take kickoff from `roadmap.kickoff_status`; for a task with kickoff `ready`, read the
`Authorized boundary` and the current phase's heading in its `00-roadmap.md`.

## Interpretation

For each task, take the first row that matches; the last row applies to the project.

| Condition | Action type |
|----------|-----------|
| An Outstanding verification item whose recorded condition evidence shows to hold | Run that check by the route its condition names |
| `in-progress` with kickoff `pending` | Obtain the user decision the next step names, or continue alignment or replanning; not implementation |
| `in-progress` with kickoff `ready` and a current phase marked `(provisional)` | Replan that phase, not implementation |
| `in-progress` with kickoff `ready`, a non-provisional current phase, and an `Authorized boundary` that does not cover it | Ask the user how far implementation may proceed |
| `in-progress` with kickoff `ready`, a non-provisional current phase, and an `Authorized boundary` that covers it | Continue that task's implementation |
| `blocked` | Investigate the named blocker or required external input |
| `planned` | Continue planning toward kickoff |
| All tasks `done` or archived and no Outstanding verification item runnable | Report completion or suggest selecting new work |

- When several tasks are eligible, rank them only from documented deadlines, dependencies, blockers,
  project focus, or an explicit user priority. If no evidence distinguishes them, present the choices
  without inventing a project priority.
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

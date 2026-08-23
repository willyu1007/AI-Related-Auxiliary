# Semantic focus

Use this view for Feature meaning, mapping context, or the project's recorded cross-task focus.

## Data sources

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
node .ai/scripts/ctl-project-governance.mjs project-query --json
cat .ai/project/dashboard.md
```

Use the project graph query for project-wide Feature and Milestone semantics. If a logical row is
conflicted, report its worktree-specific values instead of selecting one as truth. The current
dashboard supplies only its local, optional coordination focus.

## Interpretation

- Only report Feature semantics explicitly documented in its registry `title` and `description`.
- Treat generated views as index context only; do not use them as semantic body sources.
- Treat dashboard manual focus fields as project coordination context, not as Feature meaning.
- If the description is missing, report `unknown` and identify the Feature record that needs confirmation.
- Keep status facts and semantic statements separate.

## Include

- The selected Feature's title, description, Milestone, and mapped task signals.
- Recorded project focus only when the dashboard's manual fields contain it.
- The project graph evidence, plus dashboard coordination context when relevant.

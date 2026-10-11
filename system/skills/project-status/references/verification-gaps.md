# Verification gaps

Use this view for what remains to verify across tasks, the deployment changes a release must carry,
or whether implemented work is accepted in the target environment.

## Data sources

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
```

For each active task in scope, read `verification.md` under its selected `worktree_path` and
`dev_docs_path`.

## Interpretation

- Take outstanding checks with their conditions and owners, and deployment changes, only from
  `verification.md`. Report a missing condition or owner as unassigned; never fill it in.
- Report implemented and accepted in the target environment as separate facts. A `done` task whose
  target-environment check another task took over is implemented, not accepted.
- Judge each result against its baseline under `dev-docs/AGENTS.md`; never present an older result
  as holding for a newer build or configuration.
- Group deployment changes by the release task or candidate the request names; otherwise by task.

## Include

- Outstanding checks per task, with condition, owner, and the acceptance references they cover.
- Deployment changes in scope.
- Unassigned: checks without a condition or owner, and target-environment checks no task has taken
  over.

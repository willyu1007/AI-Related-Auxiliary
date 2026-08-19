# Archive readiness

Use this response when the user asks which tasks can be closed or archived. This is a read-only audit, not authorization to mutate a bundle.

## Data source

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
node .ai/scripts/ctl-project-governance.mjs lint --check
```

For each plausible candidate, open its returned `status_doc_path` and run:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --repo-root <worktree_path> --task <T-###>
```

Read the goal and every `Done when` condition from `01-status.md`. Inspect delivered code and the exact task-trailer commit timeline. Read `verification.md` for the latest decisive evidence. Check that roadmap kickoff is `ready`, then inspect unresolved decisions and `proposed:<slug>` follow-ups whose disposition would be lost on archive.

## Audit result

Report one row per candidate:

| Task | Worktree | Claimed state | Audited state | Archive-ready | First missing gate |
|---|---|---|---|---|---|
| `T-###` | `<path>` | done / other | complete / incomplete / unknown | yes / no | `<condition, evidence, clean-checkpoint, follow-up disposition, or approval>` |

`State: done` is only a claim. Mark a task ready only when kickoff is `ready`, its completion conditions hold against repository reality, decisive evidence exists, its checkpoint is aligned, and every unresolved proposed follow-up has a durable disposition. Report environmental limitations as missing evidence, not as a pass. An archive still requires a separate approved destructive transition.

## Next command

Provide the most useful read-only command for confirming the first missing gate. Never run `sync --apply`, edit records, or archive from this workflow.

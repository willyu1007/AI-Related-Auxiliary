# Archive readiness

Use this response when the user asks which tasks can be closed or archived. This is a read-only audit, not authorization to mutate a bundle.

## Data source

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
node .ai/scripts/ctl-project-governance.mjs lint
```

For each plausible candidate, open its returned `status_doc_path` and run:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --repo-root <worktree_path> --task <T-###>
```

Read the goal and use `Done when` from `01-status.md` only as an audit reference. Inspect delivered code and the exact task-trailer commit timeline. Read `verification.md` for the latest decisive evidence. Check that roadmap kickoff is `ready`, then inspect unresolved in-scope work, required acceptance, decisions, and material deferred outcomes whose disposition would be lost on archive.

## Audit result

Report one row per candidate:

| Task | Worktree | Claimed state | Audited state | Archive-ready | First missing gate |
|---|---|---|---|---|---|
| `T-###` | `<path>` | done / other | complete / incomplete / unknown | yes / no | `<condition, evidence, clean-checkpoint, or follow-up disposition>` |

`State: done` is only a claim. Mark a task ready only when kickoff is `ready`, the completion contract in `dev-docs/AGENTS.md` holds, its checkpoint is aligned, and every material deferred outcome has a durable disposition. Do not derive readiness from checked `Done when` items or roadmap phase criteria. Report environmental limitations as missing evidence, not as a pass. An archive still requires a separate approved destructive transition.

## Next command

Provide the most useful read-only command for confirming the first missing gate. Never run `sync --apply`, edit records, or archive from this workflow.

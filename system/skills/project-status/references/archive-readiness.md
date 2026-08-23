# Archive readiness

Use this view to audit which tasks may be ready to close or archive. It does not authorize the
archive transition.

## Data sources

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
```

For each plausible candidate, work from its selected `worktree_path` and run:

```bash
node .ai/scripts/ctl-project-governance.mjs resume --repo-root <worktree_path> --task <T-###>
node .ai/scripts/ctl-project-governance.mjs lint --repo-root <worktree_path>
node .ai/scripts/ctl-project-governance.mjs sync --repo-root <worktree_path> --dry-run
git -C <worktree_path> log --grep="^Task: T-###"
```

## Evidence

- Read the goal and use `Done when` from `01-status.md` only as an audit reference.
- Inspect delivered code, the exact task-trailer commit timeline, and the latest decisive evidence
  in `verification.md`.
- Check roadmap kickoff, unresolved in-scope work, required acceptance, decisions, and material
  deferred outcomes whose disposition would be lost on archive.

## Interpretation

- `State: done` is a claim. Archive readiness requires kickoff `ready` and decisive support for the
  completion contract in `dev-docs/AGENTS.md`; checked `Done when` items and roadmap phase criteria
  are only references.
- A clean, aligned closeout means the checkpoint is committed, the active bundle matches repository
  reality and the project hub, and unrelated worktree changes are identified.
- Every material deferred outcome needs a durable disposition that will survive archive.
- Environmental limitations are missing evidence, not a pass. Use `unknown` when the available
  evidence cannot establish readiness.

## Include

Report one row per candidate when comparing several:

| Task | Worktree | Claimed state | Audited state | Archive-ready | First missing gate |
|---|---|---|---|---|---|
| `T-###` | `<path>` | done / other | complete / incomplete / unknown | yes / no / unknown | `<condition, evidence, checkpoint, or follow-up disposition>` |

Include the most useful read-only confirmation when it helps resolve the first missing gate.

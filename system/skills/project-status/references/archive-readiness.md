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

- Read the goal and `Done when` from `01-status.md`.
- Inspect delivered code, the exact task-trailer commit timeline, and the latest decisive evidence
  in `verification.md`.
- Check roadmap kickoff, unresolved in-scope work, required acceptance, decisions, and material
  deferred outcomes whose disposition would be lost on archive.

## Interpretation

- Archive readiness requires decisive support for `State: done` under the lifecycle model in
  `dev-docs/AGENTS.md`.
- A clean, aligned closeout means the checkpoint is committed, the active bundle matches repository
  reality and the project hub, and unrelated worktree changes are identified.
- Every material deferred outcome needs a durable disposition that will survive archive.
- Environmental limitations are missing evidence, not a pass, unless another task has taken over
  the check under the completion contract. Use `unknown` when the available evidence cannot
  establish readiness.

## Include

Report one row per candidate when comparing several:

| Task | Worktree | Claimed state | Audited state | Archive-ready | First missing gate |
|---|---|---|---|---|---|
| `T-###` | `<path>` | done / other | complete / incomplete / unknown | yes / no / unknown | `<condition, evidence, checkpoint, or follow-up disposition>` |

Include the most useful read-only confirmation when it helps resolve the first missing gate.

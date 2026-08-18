# AGENTS (Project Governance)

Entry point for AI agents working with **project-level** governance in the repository.

## Prerequisite

The hub aggregates dev-docs task bundles; it does not create them. `dev-docs/active/` and
`dev-docs/archive/` arrive with the same install that placed this file, and the task skills are what
write bundles into them.

## Quick start

1) Initialize the project hub (idempotent; creates `.ai/project/` from templates):
```bash
node .ai/scripts/ctl-project-governance.mjs init
```

2) Query tasks (LLM-friendly JSON lines; works even if hub is missing):
```bash
node .ai/scripts/ctl-project-governance.mjs query --text "sync"
node .ai/scripts/ctl-project-governance.mjs query --status in-progress
node .ai/scripts/ctl-project-governance.mjs query --id T-001
node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --text "sync"
```

3) Run lint (CI-friendly; warnings do not fail the job):
```bash
node .ai/scripts/ctl-project-governance.mjs lint --check
```

4) Sync/fix drift (manual):
```bash
node .ai/scripts/ctl-project-governance.mjs sync --dry-run   # preview
node .ai/scripts/ctl-project-governance.mjs sync --apply     # write
```

Flags: `--changelog` appends sync-detected events (append-only, apply-mode only);
`--init-if-missing` creates hub files from templates before syncing.

5) Map a task to the semantic graph:
```bash
node .ai/scripts/ctl-project-governance.mjs feature --title "OAuth providers" --apply --json
node .ai/scripts/ctl-project-governance.mjs map --task T-001 --feature F-002 --apply
node .ai/scripts/ctl-project-governance.mjs sync --apply
```

The `feature` command reuses an exact title or allocates a new ID across linked worktrees. `--milestone M-###`
and `--requirement R-###` work with `map`; `--requirement` creates the requirement when missing.
Omit `--apply` to preview.

6) Resume existing task work (read-only):
```bash
node .ai/scripts/ctl-project-governance.mjs resume --json
```

Pass `--task T-###` when the request identifies a task. The JSON packet contains bounded task,
commit, branch, and worktree state plus progressive-read suggestions. For lower-level inspection:

```bash
node .ai/scripts/ctl-project-governance.mjs current-task --format id
node .ai/scripts/ctl-project-governance.mjs commits --task T-001
```

7) (Optional) Install Git hooks for automatic sync and commit/task linking. The hooks ship with the
task skills; copy them into `.githooks/` first, then:
```bash
node .githooks/install.mjs
```

Installed hooks:
- `pre-commit`: Auto-runs governance `sync` when `dev-docs/` files are staged
- `prepare-commit-msg`: Injects `Task:` when the branch contains one valid task ID
- `commit-msg`: Validates conventional commit format and any `Task: T-###` trailer

The trailer check warns by default. To block instead: `git config hooks.requireTaskTrailer true`.
To skip the trailer hooks once:
- sh/bash: `SKIP_TASK_TRAILER=1 git commit -m "..."`
- PowerShell: `$env:SKIP_TASK_TRAILER="1"; git commit -m "..."; Remove-Item Env:SKIP_TASK_TRAILER`

To check status or uninstall:
```bash
node .githooks/install.mjs --check
node .githooks/install.mjs --uninstall
```

## Key principles
- Task execution progress is maintained in `dev-docs/**/01-status.md` (task bundle is the SoT for status).
- Task decisions, phased planning, and relationships touching the current task are maintained in `dev-docs/**/00-roadmap.md`; another task's own status file owns its state.
- Current completion evidence is maintained in `dev-docs/**/verification.md`; replace superseded runs and keep bulky logs in `artifacts/`.
- `implementation.md` and `pitfalls.md` are optional current-context files, never mandatory append-only journals.
- Task identity is anchored by `.ai-task.yaml` (`task_id`); see `CONTRACT.md` section 4 for the schema.
- Project semantic mapping lives in `.ai/project/registry.yaml`.
- Derived views are not authoritative; regenerate them instead of editing AUTO sections.

## Migration note
Missing `.ai-task.yaml` is allowed (warning) during migration, but any existing meta file must be valid, unique, and consistent with the registry. Legacy `00-overview.md`, `roadmap.md`, `01-plan.md`, `03-implementation-notes.md`, `04-verification.md`, and `05-pitfalls.md` may be read only when their canonical replacements are absent. A full synchronization migrates useful current content and removes obsolete paths; new writes use canonical names only.

## Contract
All behavior MUST follow `.ai/project/CONTRACT.md`.

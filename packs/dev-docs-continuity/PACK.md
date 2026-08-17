# Pack: dev-docs-continuity

The project-side scaffolding the task skills operate on: the Task Contract and the directories a task bundle lives in.

The skills themselves are global — see `system/skills/` for `start-task`, `sync-task`, `maintain-project-hub`, `handoff-task`, and `resume-task`. This pack is what a *repository* needs so those skills have something to write to and a contract to follow.

## Dependencies

None. Markdown and two empty directories; nothing to run.

## Install

```bash
cp -R packs/dev-docs-continuity/files/. /path/to/your/project/
```

The Git hooks that link commits to tasks ship with `sync-task` rather than here, because the skill is what explains and installs them. See that skill's `assets/githooks/`.

## Contents

| Path | Role |
|------|------|
| `dev-docs/AGENTS.md` | Entry point. Owns the Decision Gate and the **Task Contract**: granularity, progress, identity, id allocation, id opacity. |
| `dev-docs/active/` | Where open task bundles live |
| `dev-docs/archive/` | Where finished bundles move; the location itself sets the effective status |

## What the contract fixes

`dev-docs/AGENTS.md` is the single definition of the task layer. Every skill that touches a task reads the contract rather than restating it, so the rules cannot drift apart:

- **Granularity** — one task is one resumable unit: one bundle, one `State:`, one commit stream. Parent/child task structures break resume, and the reasons are mechanical.
- **Progress** — `00-overview.md` `## Status` → `- State:` is authoritative, nothing else.
- **Identity** — `.ai-task.yaml` `task_id`, unique repository-wide, allocated at creation.
- **Allocation** — highest existing id + 1, scanning the working tree *and* `git log --all` so parallel worktrees do not collide.
- **Opacity** — `T-###` carries no meaning; categorize with `keywords` or the registry instead.

## Composing with the project hub

The pack is self-sufficient. The hub — the registry that aggregates tasks into a Milestone / Feature / Requirement view — is no longer a pack: it ships under `system/skills/start-task/assets/hub/` and that skill installs it into `.ai/` on its own. Its presence gives the same skills a faster path and a cross-task rollup, never a different one:

| Capability | This pack alone | With the hub |
|------------|-----------------|--------------|
| Cold-start a task | Manual read protocol in `resume-task` | Same skill, `ctl-project-governance.mjs resume --json` fast path |
| Allocate an id | Scan rule in the Task Contract | `sync --apply` applies the same rule |
| Validate a `Task:` trailer | Hooks scan `.ai-task.yaml` files | Hooks call the control script |
| Cross-task rollup | Not available | `registry.yaml` and derived views |

The hooks detect `.ai/scripts/ctl-project-governance.mjs` at runtime and use it when present, so installing the hub upgrades them in place — there is no second copy of any hook to maintain.

## Boundaries

- Owns the **task layer**: granularity, progress, identity, `.ai-task.yaml`, the `Task:` trailer.
- Does **not** own Milestones, Features, Requirements, or any cross-task rollup — that is the hub's job.
- Ships no skills. Those are global, in `system/skills/`.

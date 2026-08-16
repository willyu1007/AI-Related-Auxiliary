# Pack: dev-docs-continuity

Task documentation and context recovery for work that spans sessions.

Answers one question: *a session ended mid-task — how does the next agent pick up exactly where
the last one stopped?*

## What you get

- A **decision gate** that keeps dev-docs off trivial work (the common failure mode is writing
  bundles for 20-minute fixes until nobody reads them).
- A **6-file task bundle** with templates: overview, plan, architecture, notes, verification, pitfalls.
- A **resume protocol**: a fixed read order that reconstructs task state from the bundle, the
  commit timeline, and the worktree.
- **Commit-to-task linking** via a `Task: T-###` trailer, so the timeline is reconstructible from
  `git log` alone.

## Dependencies

None. Everything is Markdown plus two POSIX shell hooks. No Node, no build step, nothing to run.

## Install

```bash
cp -R packs/dev-docs-continuity/files/. /path/to/your/project/
```

Then, optionally, enable the Git hooks:

```bash
cd /path/to/your/project && node .githooks/install.mjs
```

The hooks are optional. Without them the trailer convention still works — the hooks only automate
injection and validation.

## Contents

| Path | Role |
|------|------|
| `dev-docs/AGENTS.md` | Entry point. Owns the Decision Gate, the **Task Contract**, and the Resume Protocol. |
| `.ai/skills/workflows/dev-docs/start-dev-docs-task/` | Opens a task: roadmap and/or bundle (+ 8 templates) |
| `.ai/skills/workflows/dev-docs/update-dev-docs-for-handoff/` | Updates / archives a bundle |
| `.githooks/prepare-commit-msg` | Injects `Task:` from a task branch |
| `.githooks/commit-msg` | Validates conventional format + the `Task:` trailer |
| `.githooks/install.mjs` | Points `core.hooksPath` at `.githooks/` (shared, idempotent) |

## Skill placement

`files/` mirrors the layout of the AI-friendly repository template, where `.ai/skills/` is the
single source of truth and provider wrappers are generated from it.

If your project has no such SSOT mechanism, put the two skill directories directly where your
agent reads them instead — for example `.claude/skills/start-dev-docs-task/`. The skill bodies do
not depend on their own location.

## Composing with project-hub

`dev-docs-continuity` is self-sufficient. Installing the `project-hub` pack on top adds a registry
that aggregates bundles into Milestone/Feature/Requirement views.

The two layers are wired so the fast path is additive, never required:

| Capability | dev-docs-continuity alone | with project-hub |
|------------|---------------------------|------------------|
| Resume a task | Manual read protocol in `dev-docs/AGENTS.md` | `ctl-project-governance.mjs resume --json` (one bounded packet) |
| Validate a `Task:` trailer | Hooks scan `.ai-task.yaml` files | Hooks call the control script |
| Cross-task rollup | Not available | `registry.yaml` + derived views |

Both hooks detect `.ai/scripts/ctl-project-governance.mjs` at runtime and use it when present, so
installing the hub upgrades them in place — there is no second copy of either hook to maintain.

## Boundaries

- Owns the **task layer**: task progress, task identity, `.ai-task.yaml`, the `Task:` trailer.
- Does **not** own Milestones, Features, Requirements, or any cross-task rollup — that is `project-hub`.
- Does not produce interactive plan artifacts — that is `plan-visualizer`.

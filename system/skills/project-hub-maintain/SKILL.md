---
name: project-hub-maintain
description: >-
  Use when a tracked task is being archived, confirmed changes to Milestones,
  Features, Ideas, or task-to-Feature mappings need to be applied, or
  project-hub drift needs repair. Not for read-only status or deciding project
  scope.
---

## Route

- **Archive one tracked task** — read [archive-task.md](references/archive-task.md).
- **Apply confirmed Milestone, Feature, Idea, or task-to-Feature changes** — read
  [Project records and relationships](references/hub-maintenance.md#project-records-and-relationships).
- **Repair registry, mapping, or generated-view drift** — read
  [Repair drift](references/hub-maintenance.md#repair-drift).

Resolve the Git top-level before following the selected route. Read `.ai/project/AGENTS.md` for
hub semantics; also read `dev-docs/AGENTS.md` when a task bundle is being inspected or changed.

## Working boundaries

- The task bundle owns task intent, progress, design, verification, and lifecycle. The hub owns
  Milestones, Features, their relationships, and task mappings; generated views are projections.
- If a confirmed hub change requires active task intent or progress to change, return control to
  the task workflow instead of rewriting it here.
- Apply exact changes already confirmed by the user or enclosing workflow; loading this skill adds
  no authorization. Unresolved scope, meaning, or destructive targets remain open.
- Task states and counts are evidence, not project decisions. Preserve task and project-graph
  conflicts until their sources are reconciled.
- Governance commands own generated hub views and task projections. Direct registry edits are
  limited to confirmed semantic records without a supported operation. Preserve unrelated work;
  stop when it overlaps the change or makes the evidence unreliable.

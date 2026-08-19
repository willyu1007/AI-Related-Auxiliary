# Project governance

This directory is the project-level view of durable task work. It connects task bundles to
Milestones, Features, and Requirements without replacing the task records themselves.

## Read first

- `dev-docs/README.md` defines task-bundle meaning, document responsibilities, and lifecycle.
- `.ai/project/CONTRACT.md` defines the project hub, registry graph, projections, and validation
  rules.

## Mental model

- `.ai/project/registry.yaml` owns Milestones, Features, Requirements, their relationships, and
  task mappings.
- Registry task entries project identity and progress from task bundles; they do not override
  `.ai-task.yaml` or `01-status.md`.
- `dashboard.md`, `feature-map.md`, and `task-index.md` are views. AUTO-GENERATED sections are
  replaceable projections; any allowed manual sections remain supporting context.
- Git history and each linked worktree are repository reality. Project records cannot make
  missing or uncommitted implementation real.

Use the repository's current task-governance workflow for queries, transitions, repair, and
validation. Preserve these authority boundaries instead of copying mutable task facts between
the bundle, registry, and views.

---
name: task-start
description: >-
  Use when the user asks to open a tracked task or persist a repository
  roadmap, when work introduces a new product or system capability that should
  be represented in the project hub, or when upcoming repository work needs
  durable planning and progress records because it will span sessions, require
  handoff, or carry high-risk or cross-cutting impact. Do not use for ordinary
  in-chat planning or bounded, low-risk work that can be completed in one
  session.
---

Create a durable task bundle whose roadmap preserves decision context and whose status file gives every later session a reliable task head.

## Decision Gate

Open a tracked task when any of these holds:

- The user explicitly asks to open or track a task, or to persist a roadmap in the repository.
- The work introduces a new product or system capability that should appear as a Feature in the project hub.
- The work must survive a session boundary, pause, or handoff.
- The work is high-risk or cross-cutting and needs durable decisions, verification, or recovery context, such as a schema migration, auth change, CI/CD or infrastructure change, or a service or API boundary change.

Otherwise, keep planning in the conversation and write nothing under `dev-docs/`. File count, folder count, step count, and estimated duration alone do not justify a tracked task.

Every tracked task gets the mandatory bundle and a stable ID. `requirement.md` remains optional and is created only when requirements need a separate alignment pass.

## Task Contract

### Granularity

One task is one resumable unit of work: one bundle, one `State:`, and one stream of commits. Tasks are flat. Put sequential structure in `00-roadmap.md` as phases; work that genuinely advances independently becomes sibling tasks mapped to the same Feature. The roadmap records only relationships that touch the current task; the registry and Feature Briefs own the global grouping.

Never create parent/child or nested task bundles. Discovery scans only the immediate children of `active/` and `archive/`, task resolution returns one task, and a commit carries one `Task:` trailer.

### Bundle

An active bundle contains:

```text
dev-docs/active/<slug>/
├── .ai-task.yaml
├── 00-roadmap.md
├── 01-status.md
├── 02-architecture.md
└── verification.md
```

`implementation.md`, `pitfalls.md`, `requirement.md`, and `artifacts/` are optional.

- `00-roadmap.md` owns open questions, assumptions, decision history, scope, current-task relationships, phases, risks, and phase closeout.
- `01-status.md` owns the current one-sentence goal, `State:`, current phase, next step, blocker, and high-level completion conditions.
- `02-architecture.md` owns the current settled design, interfaces, and migration implications.
- `verification.md` owns the current verification matrix and latest decisive evidence for each completion condition.
- `implementation.md` is created only when non-obvious, cross-module, migration, or operational implementation context needs a durable current map.
- `pitfalls.md` is created only after an evidence-backed recurring hazard is found and remains only while that warning is useful.
- A roadmap decision that changes the goal or completion conditions is not effective until `01-status.md` reflects the new current conclusion.
- Do not maintain a second plan or goal in another bundle file.

### Progress

`01-status.md` under `## Progress` MUST carry exactly one state bullet:

```markdown
## Progress
- State: planned
```

The value is one of `planned | in-progress | blocked | done` and is the only authority on active-task progress. A bundle under `dev-docs/archive/` has the effective status `archived` regardless of its former state.

### Identity and allocation

`.ai-task.yaml` anchors identity:

```yaml
version: 1
task_id: T-007
slug: oauth-provider-integration
```

`version` is `1`; `task_id` matches `^T-\d{3}$` and is repository-wide unique; `slug`, when present, equals the directory name. Optional `status`, `updated`, and `keywords` are display fields. IDs are stable, opaque, monotonically allocated, and never reused.

Do not choose or write an ID manually. `sync --apply` allocates it while holding the shared governance lock in Git's common directory and considers IDs in every linked worktree, the registry, and all branch history. If another process holds the lock, wait for the command or retry after it exits; never guess a replacement ID.

## Workflow

1. **Provision the repository.** Run the idempotent installer before using the hub:

   ```bash
   node <this-skill>/assets/project/.ai/scripts/ctl-project-governance.mjs install --repo-root .
   ```

   `<this-skill>` is the directory containing this `SKILL.md`. Re-running refreshes shipped governance code, contract, and templates while preserving project-owned hub data.

2. **Search before creating.** Inspect active work in every linked worktree, including uncommitted bundles:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --text "<goal keywords>"
   node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --status in-progress
   node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --status blocked
   ```

   Read the goal of plausible matches. If one already covers the requested outcome, continue it instead of creating a duplicate. Multiple checkouts of the same task ID are one task; divergent uncommitted work on that task is a conflict to resolve before proceeding.

3. **Define the task head.** Infer a one-sentence goal, high-level completion conditions, and a kebab-case slug. Ask only when an unresolved choice would materially change the goal, boundaries, or success conditions. Otherwise state the inferred values and proceed.

4. **Align requirements when needed.** If the user requests requirements alignment or provides a requirements document, create `requirement.md` from `./templates/requirement.md` before the roadmap. Merge sources using this precedence:

   1. Latest user-confirmed instruction
   2. `requirement.md`
   3. A host plan artifact, when available
   4. Model inference

   Record unresolved conflicts in `00-roadmap.md`; never drop one silently.

5. **Scaffold the bundle.** Create `dev-docs/active/<slug>/` from the mandatory templates: `00-roadmap.md`, `01-status.md`, `02-architecture.md`, and `verification.md`. Populate `01-status.md` with the current goal and `State: planned`; populate `00-roadmap.md` with known constraints, open questions, decisions, relationships, phases, and verification direction. Create `implementation.md` or `pitfalls.md` only when its creation condition applies. Do not leave a second `roadmap.md`, `00-overview.md`, `01-plan.md`, or numbered legacy detail file in a new bundle.

   In `Task relationships`, record only edges that affect this task. Use an existing `T-###` when available or `proposed:<slug>` for follow-up work not yet opened. Record the exchanged boundary and coordination condition, but never copy another task's mutable state. If a dependency blocks current progress, also set this task's blocker in `01-status.md`.

6. **Allocate and register atomically.** Let the control script create `.ai-task.yaml`, update the registry, and regenerate derived views:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   ```

   Read the allocated ID from `.ai-task.yaml`. For a new project capability, first inspect the registry and Semantic Feature Briefs for the same intent. Reuse that Feature ID when the capability already belongs there. Otherwise allocate a concrete Feature under the same cross-worktree lock:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs feature --title "<feature title>" --description "<intent>" --apply --json
   ```

   Map the task to the resolved Feature ID, add or refresh that Feature's manual brief in `.ai/project/feature-map.md`, then regenerate the derived views:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs map --task T-### --feature F-### --apply
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   ```

   Use `F-000` only when triage is genuinely deferred and record that decision in the Feature brief. Never hand-edit the AUTO block.

7. **Verify uniqueness and validity.** Re-query the exact slug across worktrees, then lint:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --text "<slug>"
   node .ai/scripts/ctl-project-governance.mjs lint --check
   ```

   Stop if distinct task IDs represent the same goal, if the same ID has divergent uncommitted bundles, or if lint reports an error.

8. **Create the initial checkpoint.** Stage only the new task and hub files, then commit the verified record with its task trailer. Include installed governance assets when this is the repository's first task. If repository policy or the user forbids commits, leave the files uncommitted and report that explicitly.

   ```bash
   git commit -m "docs(task): open T-### <slug>" -m "Task: T-###"
   ```

9. **Hand back or continue.** Report the task ID, goal, bundle path, Feature mapping, relevant task relationships, and next three actions. Continue into implementation in the same turn when the user asked for implementation; otherwise stop after the durable checkpoint.

From this point, every landed phase, resolved decision, or completed check updates the affected bundle files and ends in a verified commit with the task trailer. `00-roadmap.md` contains the phase-closeout rule that carries this obligation across sessions.

## Rules

- Never create task files when the Decision Gate does not pass.
- Never create a second task for an outcome already covered in any linked worktree.
- Never nest task bundles or encode meaning in `T-###`.
- Never assign `T-###` outside the governance script.
- Do not modify application code, configuration, or database state while scaffolding.
- Do not invent project-specific facts; use a discovery phase for missing evidence.
- No secrets, credentials, or tokens in task or hub artifacts.
- A host plan artifact is input; `00-roadmap.md` is the repository planning record.
- The mandatory bundle and initial checkpoint precede implementation.

## Reader Test

Before proceeding, verify that a fresh agent can read `01-status.md` and answer what the task is, its current state, and the next action; then read `00-roadmap.md` and answer what remains unresolved, why the current direction was chosen, which other tasks constrain or receive work from it, and how completion will be verified.

## Assets

- `./templates/` — mandatory and conditional bundle templates
- `./examples/sample-roadmap.md`, `./examples/sample-task-bundle.md`
- `./reference/detailed-docs-convention.md` — concise file responsibilities and legacy names
- `./assets/project/` — governance code and hub assets installed into a repository; do not use it as runtime task context

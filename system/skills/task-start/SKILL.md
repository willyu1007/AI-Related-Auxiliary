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

Open and register a durable task bundle before implementation begins.

## Workflow

1. **Apply the creation gate.** Open a tracked task when the user explicitly asks to track work or persist a repository roadmap, when the work introduces a product or system capability that belongs in the project hub, when the record must survive a pause or handoff, or when high-risk or cross-cutting work needs durable decisions, verification, or recovery context. Otherwise keep planning in the conversation and create no bundle. File count, step count, and estimated duration alone do not justify a tracked task.

2. **Provision and read the task system.** When the gate passes, run the idempotent installer before using task docs:

   ```bash
   node <this-skill>/assets/project/.ai/scripts/ctl-project-governance.mjs install --repo-root .
   ```

   `<this-skill>` is the directory containing this `SKILL.md`. The installer creates or refreshes `dev-docs/README.md`, `dev-docs/CLAUDE.md`, `dev-docs/AGENTS.md`, `dev-docs/active/`, `dev-docs/archive/`, and the project-governance assets. It preserves project-owned hub data. Read `dev-docs/README.md` completely before creating the bundle.

3. **Search before creating.** Inspect active work in every linked worktree, including uncommitted bundles:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --text "<goal keywords>"
   node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --status in-progress
   node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --status blocked
   ```

   Read the goal of plausible matches. If one already covers the requested outcome, continue it instead of creating a duplicate. Multiple checkouts of the same task ID are one task; divergent uncommitted work on that task is a conflict to resolve before proceeding.

4. **Define the task head.** Infer a one-sentence goal, high-level completion conditions, and a kebab-case slug. Ask only when an unresolved choice would materially change the goal, boundaries, or success conditions. Otherwise state the inferred values and proceed. Keep sequential work as phases when it serves the same goal and completion conditions. Split work only when it needs its own observable outcome, state, owner, handoff, verification, archive, separate worktree, or independently managed interface.

5. **Align requirements when needed.** If the user requests requirements alignment or provides a requirements document, create `requirement.md` from `./templates/requirement.md` before the roadmap. Merge sources using this precedence:

   1. Latest user-confirmed instruction
   2. `requirement.md`
   3. A host plan artifact, when available
   4. Model inference

   Record unresolved conflicts in `00-roadmap.md`; never drop one silently.

6. **Seed the bundle from the contract.** Create `dev-docs/active/<slug>/` from `./templates/` according to `dev-docs/README.md`. Populate the current goal and `State: planned`. Write a roadmap seed containing confirmed scope, known constraints and relationships, material open decisions, risks, and one concrete alignment or discovery phase. Set the kickoff gate to `pending`; do not invent downstream implementation phases or close decisions merely to make the task look ready. Do not leave required sections as unfilled template placeholders; express missing evidence as a discovery action. Create the common optional entries only when their documented condition applies. Other task-local supporting documents or directories are allowed when the actual work needs distinct durable context; state their purpose and never use them as a second goal, status, plan, decision, architecture, or verification authority.

7. **Allocate and register atomically.** Let the control script create `.ai-task.yaml`, update the registry, and regenerate derived views:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   ```

   Read the allocated ID from `.ai-task.yaml`; never choose one manually. For a new project capability, inspect the registry and Semantic Feature Briefs for the same intent. Reuse the existing Feature when appropriate; otherwise allocate one under the shared cross-worktree lock:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs feature --title "<feature title>" --description "<intent>" --apply --json
   ```

   Map the task, refresh the Feature's manual brief in `.ai/project/feature-map.md`, and regenerate derived views:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs map --task T-### --feature F-### --apply
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   ```

   Use `F-000` only when triage is genuinely deferred and record that choice in the Feature brief. Never hand-edit an AUTO block.

8. **Verify uniqueness and validity.** Re-query the exact slug across worktrees, then lint:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs query --all-worktrees --text "<slug>"
   node .ai/scripts/ctl-project-governance.mjs lint --check
   ```

   Stop if distinct task IDs represent the same goal, the same ID has divergent uncommitted bundles, or lint reports an error.

9. **Create the initial checkpoint.** Stage only the new task and hub files, then commit the verified record with its task trailer. Include installed governance assets when this is the repository's first task. If repository policy or the user forbids commits, leave the files uncommitted and report that explicitly.

   ```bash
   git commit -m "docs(task): open T-### <slug>" -m "Task: T-###"
   ```

10. **Hand back or continue.** Report the task ID, goal, bundle path, Feature mapping, kickoff status, relevant task relationships, and next three actions. When the user also requested implementation, continue into decision alignment and kickoff; do not change application code until the roadmap gate becomes `ready`. Otherwise stop after the durable checkpoint.

## Rules

- Never create a duplicate task for an outcome already covered in any linked worktree.
- Do not modify application code, configuration, or database state while scaffolding.
- Do not invent project-specific facts; use a discovery phase for missing evidence.
- Never put secrets, credentials, or tokens in task or hub artifacts.
- A host plan artifact is input; the task roadmap is the repository planning record.
- The mandatory bundle and initial checkpoint precede implementation.

## Reader test

Before proceeding, verify that a fresh agent can read `01-status.md` and answer what the task is, its current state, and the next action; then read `00-roadmap.md` and answer which top-level choices remain open, which other tasks constrain or receive work from it, why kickoff is pending, and what alignment or discovery action comes first.

## Assets

- `./templates/` — mandatory and conditional bundle templates
- `./examples/sample-roadmap.md` — a worked roadmap
- `./assets/project/` — repository contract, governance code, and hub assets installed into a project

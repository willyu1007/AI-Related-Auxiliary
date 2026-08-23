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

Open one user-approved, non-duplicate tracked task with a clear outcome, project placement, and preliminary roadmap. Leave implementation readiness to later planning.

## Workflow

1. **Confirm durable tracking.** Open a task when any of these is true:

   - The user explicitly requests a tracked task or durable roadmap.
   - The work introduces a new product or system capability that belongs in the project hub.
   - The record must survive a session boundary or handoff.
   - Risk or cross-cutting impact requires durable decisions, verification, or recovery context.

   Otherwise keep bounded, low-risk work in conversation. File count, step count, and estimated duration alone do not justify a task.

2. **Protect the worktree and ensure governance.** Resolve the Git top-level and run the rest of this workflow from there. Record `git status --short`. Resolve the shared task-governance resource at `<this-skill>/../../resources/task-governance`; stop and report an incomplete system installation when it is missing. Preview its installer, then apply only the shown initialization or repair of missing files:

   ```bash
   node <task-governance-resource>/install.mjs --dry-run
   node <task-governance-resource>/install.mjs
   ```

   The default installer never replaces an existing fixed asset. If it reports a difference, stop and show the affected paths; governance refresh is a separate, explicitly approved operation using `--dry-run --refresh` and then `--refresh`. Do not perform it as part of opening a task.

   After governance is available, read `dev-docs/AGENTS.md` and `.ai/project/AGENTS.md` completely, then validate before interpreting or creating task data:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs lint
   ```

   Stop on validation failure. Preserve all pre-existing changes throughout the workflow.

3. **Search before creating.** Query several short domain and outcome terms; search covers linked worktrees and uncommitted bundles:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs query --text "<domain term>" --json
   node .ai/scripts/ctl-project-governance.mjs query --text "<outcome term>" --json
   ```

   Read plausible goals. Stop on `conflict` or `invalid`. Use the newest occurrence when only `stale_worktrees` is reported. Continue an existing active task instead of duplicating it; verify a `done` outcome before opening follow-up work, and use archived tasks only as prior evidence.

4. **Synthesize and seed one outcome.** Distill the relevant user conversation and repository evidence into one coherent task. Later user corrections supersede earlier wording; preserve unresolved material conflicts instead of turning the discussion transcript into scope. Shape a clear goal, boundaries, current `Done when` acceptance references, and a kebab-case slug. Ask only when a user-owned choice would materially change the outcome. Split work only when part of it needs an independent outcome or lifecycle.

   Create `requirement.md` only when requirements alignment is requested or a requirements source is supplied. Resolve sources in this order: latest confirmed user instruction, confirmed `requirement.md`, host plan artifact, then model inference. Keep unresolved conflicts open.

   Create `dev-docs/active/<slug>/` from the required [status](../../resources/task-governance/templates/01-status.md), [roadmap](../../resources/task-governance/templates/00-roadmap.md), [architecture](../../resources/task-governance/templates/02-architecture.md), and [verification](../../resources/task-governance/templates/verification.md) templates according to `dev-docs/AGENTS.md`. When selected above, instantiate the [requirements template](../../resources/task-governance/templates/requirement.md) in the same directory. Preserve contract-required structure, adapt the detail, and remove authoring comments. Leave `.ai-task.json` absent; the next sync owns its ID and initial metadata.

   Create the smallest truthful bundle that lets a fresh agent understand why the task exists, what is decided or still unknown, and the route currently proposed. A new task starts at `State: planned` with kickoff `pending`. Draft the major phases far enough for the user to judge the whole direction: make the first phase concrete and mark later phases provisional when evidence does not yet support their detail. Do not add effort estimates, quality scores, or speculative file-level steps. Read the [roadmap seed example](examples/sample-roadmap-seed.md) only when that initial shape is unclear.

5. **Allocate identity and propose project placement.** Preview the worktree-wide projection and
   continue only when every planned change belongs to this opening. Then sync to allocate the task
   ID and its initial registry projection, and add a small set of distinctive search keywords to
   `.ai-task.json`:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --dry-run
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   ```

   Inspect registry Features and identify the one that owns the capability. Propose a new Feature only for a distinct, confirmed project capability; otherwise propose the existing owner or leave genuinely unresolved ownership on `F-000`. Keep the initial projection on `F-000` until the user reviews this placement. Never choose an ID manually or hand-edit task projections and generated views.

6. **Verify the opening.** Re-query the ID and slug, then lint:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs query --id T-### --json
   node .ai/scripts/ctl-project-governance.mjs query --text "<slug>" --json
   node .ai/scripts/ctl-project-governance.mjs lint
   ```

   Require one valid task ID, no duplicate outcome, an explicit project-placement proposal, valid keywords, and clean lint. Confirm that a fresh agent can recover the goal, state, acceptance references, open choices, preliminary route, next action, and kickoff reason from `01-status.md` and `00-roadmap.md`.

7. **Review the opening with the user.** Keep the generated bundle uncommitted. Present a compact brief with the goal, scope and boundaries, current acceptance references, items needing confirmation, preliminary roadmap, known risks or unknowns, and project placement. Summarize each phase by purpose, expected outcome, and evidence or feedback point; do not ask the user to review the full generated documents.

   Incorporate the user's feedback into the bundle. After the user confirms project placement,
   apply exactly that existing Feature mapping or create the confirmed Feature and map the task.
   The task now has its ID, so checkpoint it with scoped sync; inspect the preview before applying
   it and stop if it includes a change outside this opening:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs feature --title "<confirmed feature title>" --description "<confirmed intent>" --apply --json
   node .ai/scripts/ctl-project-governance.mjs map --task T-### --feature F-### --apply
   node .ai/scripts/ctl-project-governance.mjs sync --task T-### --dry-run
   node .ai/scripts/ctl-project-governance.mjs sync --task T-### --apply
   node .ai/scripts/ctl-project-governance.mjs lint --task T-###
   ```

   Skip Feature creation when an existing Feature was confirmed, and skip mapping when placement remains `F-000`. Repeat the brief only for materially changed parts. Do not commit until the user explicitly approves the opening or says there are no further changes. Open implementation choices may remain when they are recorded honestly and do not change the task's goal or boundary.

8. **Create the opening checkpoint.** After approval, compare the full diff with the initial worktree state. Stage only the new bundle, its governance projection, and any first-install governance paths created by this workflow; use explicit paths and preserve foreign work. Commit the opening with its task trailer. If repository policy or the user forbids commits, leave the coherent bundle uncommitted and report that explicitly:

   ```bash
   git commit -m "docs(task): open T-### <slug>" -m "Task: T-###"
   ```

   Report the task ID, path, Feature placement, kickoff status, checkpoint state, preserved foreign changes, and next action. If planning or implementation was requested, continue into planning. Otherwise, ask whether the user wants to plan the task now. Do not change application code until kickoff is `ready`. Never put secrets, credentials, or tokens in task or hub artifacts.

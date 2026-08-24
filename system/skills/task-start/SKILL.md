---
name: task-start
description: >-
  Use when the user asks to open a tracked task or persist a repository
  roadmap, when work delivers a project-level capability that belongs in the
  project hub's feature map, or when work known to span sessions cannot be
  recovered from git history and code alone. Do not use for maintenance of
  existing capabilities or work that completes within the session.
---

Open one user-approved, non-duplicate tracked task with a clear outcome, project placement, and preliminary roadmap. Leave implementation readiness to later planning.

## Workflow

1. **Confirm durable tracking.** Open a task only through one of these paths:

   - The user explicitly requests a tracked task or durable roadmap, or an execution flow the user initiated requires the bundle: open without asking.
   - The work delivers a project-level capability: a new hub Feature or a material advance of an existing one. Fixes, tuning, refactors, and tooling chores are maintenance, not capabilities.
   - The work is known to continue beyond this session or hand off, and git history and code alone cannot recover the context needed to continue — open decisions, route position, verification obligations.

   On the model-identified paths, propose in one compact message and create nothing until the user confirms. Otherwise keep the work in conversation; size, risk, and cross-cutting impact do not justify a task. Work covered by an active task continues there.

2. **Protect the worktree and ensure governance.** Work from `<repo-root>`:

   - Record `git status --short`
   - Need `<repo-root>/.ai/`, `<repo-root>/dev-docs/`, `<repo-root>/dev-docs/templates/`
   - If missing, get `system/resources/task-governance/project/` from https://github.com/willyu1007/AI-Related-Auxiliary and copy it into `<repo-root>`
   - Fill gaps only; `--refresh` needs explicit approval, not during open
   - Read `dev-docs/AGENTS.md` and `.ai/project/AGENTS.md`, then `node .ai/scripts/ctl-project-governance.mjs lint`
   - Stop on lint failure; keep existing worktree changes

3. **Search before creating.** Query several short domain and outcome terms; search covers linked worktrees and uncommitted bundles:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs query --text "<domain term>" --json
   node .ai/scripts/ctl-project-governance.mjs query --text "<outcome term>" --json
   ```

   Read plausible goals. Stop on `conflict` or `invalid`. Use the newest occurrence when only `stale_worktrees` is reported. Continue an existing active task instead of duplicating it; verify a `done` outcome before opening follow-up work, and use archived tasks only as prior evidence.

4. **Synthesize and seed one outcome.** Distill the relevant user conversation and repository evidence into one coherent task. Later user corrections supersede earlier wording; preserve unresolved material conflicts instead of turning the discussion transcript into scope. Shape a clear goal, boundaries, current `Done when` acceptance references, and a kebab-case slug. Ask only when a user-owned choice would materially change the outcome. Split work only when part of it needs an independent outcome or lifecycle.

   Create `requirement.md` only when requirements alignment is requested or a requirements source is supplied. Resolve sources in this order: latest confirmed user instruction, confirmed `requirement.md`, host plan artifact, then model inference. Keep unresolved conflicts open.

   Create `dev-docs/active/<slug>/` from the required templates at `<repo-root>/dev-docs/templates/`: `01-status.md`, `00-roadmap.md`, `02-architecture.md`, and `verification.md`, according to `dev-docs/AGENTS.md`. When selected above, instantiate `<repo-root>/dev-docs/templates/requirement.md` in the same directory. Preserve contract-required structure, adapt the detail, and remove authoring comments. Leave `.ai-task.json` absent; the next sync owns its ID and initial metadata.

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

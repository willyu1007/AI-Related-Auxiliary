---
name: start-dev-docs-task
description: Open a task under dev-docs/active/<slug>/ — clarify the goal, optionally write a macro-level roadmap, and scaffold the documentation bundle (overview, plan, architecture, notes, verification, pitfalls). Use when the user asks for a plan, roadmap, milestones, or an implementation plan before coding, or when work is about to start that will run long, span sessions, or need handoff. Apply the Decision Gate in dev-docs/AGENTS.md first; for a trivial change answer with an in-chat plan and write nothing. To update or archive a bundle that already exists, use update-dev-docs-for-handoff instead.
---

# Start Dev Docs Task

Set up the artifacts a task needs to survive a session boundary: a roadmap for direction, and a
bundle for execution detail.

Both are optional and gated. Writing a bundle for a 20-minute fix is the common failure: the bundle
costs more to maintain than the task returns, and trains everyone to stop reading bundles at all.

## Decision Gate

Apply the gate in `dev-docs/AGENTS.md` ("Decision Gate (MUST)"). The criteria live there and are
not restated here so the two cannot drift.

The gate produces one of three outcomes:

| Outcome | Do this |
|---------|---------|
| Trivial change | Answer with an in-chat plan. Write nothing under `dev-docs/`. |
| Gate met, direction unclear or user asked for a plan | Write `roadmap.md`, then continue to the bundle. |
| Gate met, direction already clear | Write the bundle. A roadmap is optional. |

## Workflow

1. **Restate the goal in one sentence** and get confirmation.

2. **Ask what you cannot infer.** Scope, non-goals, target environment, success criteria, hard
   constraints. Ask only what changes the plan. If the user cannot answer now, record the
   assumption in the artifact and name the risk — do not silently guess.

3. **Confirm a slug.** Kebab-case, derived from the goal, no dates unless asked. The slug names the
   directory and is hard to change later.

4. **Write `roadmap.md`** (when the gate calls for one) from `./templates/roadmap.md`. Keep the roadmap
   macro: phases, milestones, deliverables, verification, risks, rollback. Include the
   "Project structure change preview" section — directory-level paths by default, `(none)` or
   `<TBD>` plus a discovery step when you have not inspected the repo. Never invent file paths,
   APIs, or schemas you have not seen.

5. **Scaffold the bundle** at `dev-docs/active/<slug>/` from `./templates/`:

   | File | Must contain |
   |------|--------------|
   | `00-overview.md` | Problem, goal, non-goals, acceptance criteria, and a `## Status` section with `- State: planned` |
   | `01-plan.md` | Phases with per-phase acceptance criteria |
   | `02-architecture.md` | Boundaries, interfaces/contracts, data migrations |
   | `03-implementation-notes.md` | Decisions, deviations with rationale, open TODOs |
   | `04-verification.md` | Concrete commands and their expected results |
   | `05-pitfalls.md` | A do-not-repeat summary, then an append-only log |

   `00-overview.md` `State:` is the source of truth for task progress — see the Task Contract in
   `dev-docs/AGENTS.md`. Get the section right or the whole continuity chain breaks.

6. **Hand back** the confirmed goal, where the artifacts live, and the next three concrete actions.
   Do not start implementing in the same turn unless the user asked you to.

## Requirements alignment (optional)

When the user says "align on requirements first", "clarify direction first", or supplies an
existing requirements document, write `dev-docs/active/<slug>/requirement.md` from
`./templates/requirement.md` before the roadmap, and confirm the document before continuing.

With several sources in play, merge by union and resolve conflicts in this order:

1. Latest user-confirmed instruction
2. `requirement.md`
3. A host plan-mode artifact, if the runtime provides one
4. Model inference

Conflicts you cannot resolve go into the roadmap's open questions. Never drop one silently.

## Rules

- Write nothing under `dev-docs/` for a change that fails the gate.
- Do not modify application code, configuration, or database state while scaffolding.
- Do not invent project-specific facts. No evidence means a discovery step, not a guess.
- No secrets, credentials, or tokens in any artifact.
- `roadmap.md` is the repository's planning source of truth; a host plan-mode artifact is seed
  input, never the record.
- The bundle must exist before implementation starts, not after.

## Reader test

Before handing back, check that a fresh agent reading only these files can answer: what is the
goal, what is explicitly out of scope, what are the next three actions, and how do we know when it
worked. Anything that needs tribal knowledge belongs in `03-implementation-notes.md`.

## Assets

- `./templates/` — the 6 bundle files, plus `roadmap.md` and `requirement.md`
- `./examples/sample-roadmap.md`, `./examples/sample-task-bundle.md`
- `./reference/detailed-docs-convention.md` — optional deeper file layout
- To present a finished roadmap as an interactive artifact, hand it to `plan-html-visualizer`

---
name: start-task
description: Opening a new tracked task. Use when the user asks for a plan, roadmap, or milestones before coding, or when substantial new work is about to start. Not for a trivial change — answer that in chat and write no files.
---

# Start Task

Set up the artifacts a task needs to survive a session boundary: a roadmap for direction, a bundle for execution detail, and an id that links future commits back to both.

Both artifacts are gated. Writing a bundle for a 30-minute fix is the common failure: the bundle costs more to maintain than the task returns, and trains everyone to stop reading bundles at all.

## Decision Gate

Decide before writing anything. The gate is about the *work*, not about how many folders it touches.

**Skip** — answer with an in-chat plan and write nothing under `dev-docs/` — when any of these holds:

- a single-file change, including its adjacent tests and docs
- a trivial fix, under about 30 minutes
- a refactor with clear scope, even across several folders

**Open a task** when any of these holds:

- expected to run past a couple of hours, or across sessions
- the work will be paused, handed off, or needs context recovery later
- high-risk or cross-cutting: schema migration, auth, CI/CD or infra, a service or API boundary

Touching `src/` + `tests/` + docs is not a trigger by itself, and neither is "three sequential steps with verification" — that describes most work.

| Outcome | Do this |
|---------|---------|
| Gate not met | Answer with an in-chat plan. Write nothing under `dev-docs/`. |
| Gate met, direction unclear or user asked for a plan | Write `roadmap.md`, then continue to the bundle. |
| Gate met, direction already clear | Write the bundle. A roadmap is optional. |

## Task contract

What every bundle has to satisfy. The rest of this skill is workflow; these are the invariants every later session depends on, and `lint` enforces them mechanically.

**Granularity.** One task is one resumable unit of work: one bundle, one `State:`, one stream of commits. Tasks are flat — no parent tasks, no subtasks, no nested bundle directories. Structure *inside* a task belongs in `01-plan.md` as phases, which need no id, no bundle, and no separate status. Work that genuinely advances in parallel becomes sibling tasks, each with a full bundle, grouped by `feature_id` in the registry.

Flatness is mechanical rather than stylistic. Discovery scans only the immediate children of `active/` and `archive/`, so a bundle one level deeper is invisible and its enclosing directory is mistaken for a task. Resolution returns exactly one task, so a parent and a child both `in-progress` makes every resume stop to ask. And `Task: T-###` is single-valued, so commits attach to the child — the parent ends up with no commits, no verification, and a status nobody can check. When a bundle grows unmanageable, the reading is that the work was several sibling tasks from the start, not that it needs children.

**Progress.** `00-overview.md` under `## Status` MUST carry one bullet:

```markdown
## Status
- State: planned
```

`State:` holds a single value from `planned | in-progress | blocked | done`, and that bullet is the only authority on progress. A bundle under `dev-docs/archive/` has the effective status `archived` whatever `State:` says.

**Identity.** `dev-docs/active/<slug>/.ai-task.yaml` anchors the task:

```yaml
version: 1
task_id: T-007
slug: oauth-provider-integration
```

`version` MUST be `1`; `task_id` MUST match `^T-\d{3}$` and be unique repository-wide; `slug`, when present, MUST equal the directory name. Optional `status`, `updated` (`YYYY-MM-DD`), and `keywords` are display fields — `status` in particular is never authoritative. IDs are stable and are never reused.

**Allocation.** Take the highest existing ID and add one, zero-padded to three digits; `T-001` when the scan finds nothing:

```bash
{ grep -rh '^task_id:' --include='.ai-task.yaml' . 2>/dev/null
  git log --all --format=%B 2>/dev/null | grep -E '^Task: T-[0-9]{3}'
} | grep -oE 'T-[0-9]{3}' | sort -u | tail -1
```

The scan reads Git history as well as the working tree, because the working tree alone is blind to other branches: in a linked worktree a sibling's committed task is invisible to `grep`, so both would allocate the same number and the collision would surface only at merge. Two worktrees allocating at the same moment with neither committed can still collide; `lint` reports the duplicate, and the fix is to renumber the newer task before merging.

**Opacity.** `T-###` records identity and nothing else. Never encode meaning in the number — no reserved ranges for mainline versus side work, for validation tasks, for parallel branches. Never infer meaning from one when reading. Never skip ahead to a "better" number. A scheme in the ID lives in one head; anyone reading `T-901` later has no rule for decoding it. Categorize with `keywords:` in `.ai-task.yaml`, with `feature_id` / `milestone_id` in the registry, or with the branch name.

## Workflow

1. **Provision the repository.** One idempotent command, run before anything else needs it — it copies the control script, contract, hub templates, and the `dev-docs/` directories into place, then creates the hub files it does not already find:

   ```bash
   node <this-skill>/assets/project/.ai/scripts/ctl-project-governance.mjs install --repo-root .
   ```

   `<this-skill>` is the directory holding this `SKILL.md`. Re-running refreshes the shipped assets and leaves every file the repository already has alone, so there is never a reason to check first.

2. **Look for the task before creating one.** Duplicate tasks are the expensive mistake here — two bundles for one piece of work split the commit timeline and neither resumes correctly.

   ```bash
   node .ai/scripts/ctl-project-governance.mjs query --text "<keywords>"
   node .ai/scripts/ctl-project-governance.mjs query --status in-progress
   ```

   Open the goal of anything active. If existing work covers the request, stop and continue that task instead of opening a second bundle.

3. **Restate the goal in one sentence** and get confirmation.

4. **Ask what you cannot infer.** Scope, non-goals, target environment, success criteria, hard constraints.

   Ask only what changes the plan. If the user cannot answer now, record the assumption in the artifact and name the risk — do not silently guess.

5. **Confirm a slug.** Kebab-case, derived from the goal, no dates unless asked. The slug names the directory and is hard to change later.

6. **Write `dev-docs/active/<slug>/roadmap.md`** from `./templates/roadmap.md`, when the gate calls for one.

7. **Scaffold the bundle** at `dev-docs/active/<slug>/` from `./templates/`. Get the `## Status` section right or the whole continuity chain breaks.

8. **Allocate the task ID** and write `.ai-task.yaml`, following the contract above. Skipping this leaves the task unlinked from commits: no `Task:` trailer, no timeline to resume from — the bundle exists but continuity does not.

9. **Register the task:**

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply
   node .ai/scripts/ctl-project-governance.mjs map --task T-### --feature F-### --apply
   ```

   `sync` adds the task to the registry. Mapping it to a real Feature is what keeps the task off the `F-000` triage bucket; leave it on `F-000` only when triage is genuinely deferred, and say so in the feature brief.

   When no existing Feature fits, add one to `registry.yaml` first — a fresh hub contains only the `F-000` inbox. An entry needs `id` (next `F-###`), `title`, `milestone_id`, and `status`; `map --requirement` creates missing requirements, but `--feature` only links existing ones.

10. **Hand back** the confirmed goal, where the artifacts live, and the next three concrete actions. Do not start implementing in the same turn unless the user asked you to.

    Close the handback with the obligation that outlives this skill: from here on, whenever a phase lands, a decision is made, or a check runs, update `00-overview.md`, `03-implementation-notes.md`, and `04-verification.md`, and commit the verified part with its `Task:` trailer. Nobody prompts for that later — the instruction has to travel with the handback.

## Requirements alignment (optional)

When the user says "align on requirements first", "clarify direction first", or supplies an existing requirements document, write `dev-docs/active/<slug>/requirement.md` from `./templates/requirement.md` before the roadmap, and confirm the document before continuing.

With several sources in play, merge by union and resolve conflicts in this order:

1. Latest user-confirmed instruction
2. `requirement.md`
3. A host plan-mode artifact, if the runtime provides one
4. Model inference

Conflicts you cannot resolve go into the roadmap's open questions. Never drop one silently.

## Rules

- Write nothing under `dev-docs/` for a change that fails the gate.
- Never open a second bundle for work an existing task already covers.
- Never nest a bundle inside another, and never split work into a parent plus children.
- Do not modify application code, configuration, or database state while scaffolding.
- Do not invent project-specific facts. No evidence means a discovery step, not a guess.
- No secrets, credentials, or tokens in any artifact.
- `roadmap.md` is the repository's planning source of truth; a host plan-mode artifact is seed input, never the record.
- The bundle must exist before implementation starts, not after.

## Reader test

Before handing back, check that a fresh agent reading only these files can answer: what is the goal, what is explicitly out of scope, what are the next three actions, and how do we know when the work succeeded. Anything needing tribal knowledge belongs in `03-implementation-notes.md`.

## Assets

- `./templates/` — the 6 bundle files, plus `roadmap.md` and `requirement.md`
- `./examples/sample-roadmap.md`, `./examples/sample-task-bundle.md`
- `./reference/detailed-docs-convention.md` — optional deeper file layout
- `./assets/project/` — what step 1 installs, laid out as it lands in a repository: `.ai/` (control script, contract, hub templates) and the `dev-docs/` directories. Never read from here at runtime.

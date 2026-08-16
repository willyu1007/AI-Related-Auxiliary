---
name: handoff-task
description: Ending a session with the task still open, or closing the task for good. Use when the user asks to pause, stop, hand off, or archive; or when context has degraded enough to risk the quality of the next work.
---

# Handoff Task

Leave the task in a state someone else can walk into cold. Not a status update — a transfer of
everything you know that is not already in the code.

The bar is concrete: a fresh reader, with no memory of the session, can answer what changed, what
state the work is in, what the next three actions are, and how to verify success. Anything still
living only in your head is the thing to write down.

## Finish the work first

Complete the instruction in hand before starting a handoff. A handoff produced by abandoning the
requested work is a worse outcome than no handoff — the user asked for something and receives
documentation about the absence of it.

That applies most sharply to the context trigger, which is the one that can occur to you
mid-request. Running short of context is not a reason to stop early, but a reason to stop
*cleanly*, once the current piece is finished.

### Judging context

The signal is degraded work, not a percentage. Watch for:

- Re-reading files already read earlier on
- Uncertainty about decisions made earlier in the same session
- Losing the thread of the plan and needing to reconstruct the whole thing

Those mean quality is already slipping. Plenty of context consumed while every decision is still
clear is not a trigger — keep working.

## Workflow

1. **Bring the bundle current first.** Run the `sync-task` workflow — establish what landed, update
   the six files, commit the verified part with its `Task:` trailer. Everything below assumes that
   pass is complete, and is not repeated here.

2. **Set the closing state.** In `00-overview.md`, `- State:` becomes `blocked` or `done`, or stays
   `in-progress` for a plain pause. Write the next concrete step as an instruction to a stranger,
   with commands and paths — not a note to yourself.

3. **Separate landed from pending, explicitly.** The single most useful sentence in a handoff is
   which changes are committed and which are sitting in the worktree. Record the dirty state rather
   than forcing a commit to make `git status` look clean.

4. **Fill the gaps a reader will hit.** Walk `03-implementation-notes.md` and `05-pitfalls.md`
   against the reader test. Dead ends already explored belong in the pitfalls log — a successor
   repeating them is the most expensive failure a handoff can cause.

5. **Refresh the project hub**, when `.ai/project/registry.yaml` exists:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply --changelog
   node .ai/scripts/ctl-project-governance.mjs lint --check
   ```

   If the task's intent, scope, or risk posture changed, update the `Semantic Feature Brief` in
   `.ai/project/feature-map.md` in the same change — intent, scope in/out, decision, dependencies,
   risks, success signal, related tasks, next checkpoint. `dashboard.md` keeps a short focus index
   only, never the brief body itself.

6. **Archive when done.** With `State: done` and verification passing, propose moving
   `dev-docs/active/<slug>/` to `dev-docs/archive/<slug>/`, and wait for approval before moving.
   Archiving changes the task's effective status — a state transition rather than filing.

   ```bash
   node .ai/scripts/ctl-project-governance.mjs sync --apply   # registry status becomes archived
   ```

## When the budget is short

A full pass abandoned halfway is worse than a small honest one: the bundle ends up part new and
part stale, and the next reader cannot tell which is which. So write in descending order of value
and stop at a clean point.

| Budget | Write |
|--------|-------|
| Comfortable | The full pass above |
| Tight | Three things only: `State:` and the next concrete step in `00-overview.md`; the list of uncommitted changes; any pitfall hit this session |
| Nearly gone | One commit with a `Task: T-###` trailer whose message states what landed and what is still pending |

The next step and the uncommitted list are what a successor needs first. Architecture notes and
verification history can wait for the next session; those two cannot.

## Handoff checklist

`./templates/handoff-checklist.md` is the short form to paste into the bundle. A worked example is
in `./examples/sample-handoff-update.md`.

## Rules

- Never mark a task `done` without verification evidence recorded in `04-verification.md`.
- Never describe uncommitted work as landed.
- Never force broken or unverified work into a commit to obtain a clean worktree.
- Never move or archive a directory without approval.
- Never delete a prior decision or pitfall; supersede with an explanation.
- Never leave tribal knowledge unwritten — whatever the next person needs, the bundle needs.
- Never break off a request part-way to write a handoff; finish what was asked, then hand off.
- Never leave a full pass half-applied. Under pressure, write less and finish the smaller thing.
- No secrets, credentials, or tokens in any artifact.

## Contract

Task layer: `dev-docs/AGENTS.md`. Hub layer: `.ai/project/CONTRACT.md`.

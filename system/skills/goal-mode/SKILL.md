---
name: goal-mode
description: >-
  Use when a task or goal is expected to span multiple work sessions or days,
  requires unattended long-running operations or external waits, must survive
  automatic continuations or context compaction, or when the user explicitly
  asks to use goal mode.
---

# Goal Mode

Coordinate one durable repository goal through one task bundle in the same active goal run.

**Do not defer review, repair, or simplification until the goal is otherwise
complete: close each phase on evidence of correct behavior and a coherent
implementation before work advances.**

## Framework

- Take the continuing objective and stopping condition from the host Goal. Keep the goal, route,
  status, settled design, and verification evidence in the task bundle; do not create a parallel
  roadmap, phase list, status record, or evidence log.
- Within the kickoff gate's `Authorized boundary`, do phase closeout without
  asking: review fixes, residue removal, checkpoint commits. Ask only for work
  beyond the boundary, destructive changes to pre-existing content, goal or
  scope changes, or external side effects.
- Change the route or phase shape only through `task-plan`; drive one roadmap
  phase at a time through its closeout gate.
- Follow each referenced skill's own procedure, then return to this flow.

## Flow

```text
task-start / task-resume
-> task-plan until kickoff is ready
-> execute the current roadmap phase
-> establish the closeout claims
-> review, correct, and simplify
-> clean up
-> verify the final result
-> task-sync
-> next phase / done
```

1. **Bind the goal.** Enter goal mode for a new goal when the user names it or
   asks for unattended execution to a stopping condition, or when the work
   clearly exceeds one attended session — phased work spanning multiple
   sessions or days, long unattended runs, external waits. Confirm
   model-identified entry in one line; hours of ordinary attended work do not
   qualify. Resuming an active goal run needs no re-confirmation. Use
   `task-start` when no active bundle represents it and `task-resume` when an
   existing bundle's context must be rebuilt from repository state. Honor any
   identity or recovery stop condition instead of choosing or duplicating a
   task.
2. **Prepare the route.** Use `task-plan` until kickoff is `ready` and the current
   phase is executable.
3. **Execute the phase.** Complete its defined outcome through the relevant
   domain workflow. Keep long-running operations and external waits inside the
   current phase until they produce a decisive result or a recorded blocker.
4. **Close the phase in order.** Do not advance until all five actions complete:
   1. Establish what the closeout must prove from the phase outcome and exit
      criteria, its contribution to the task goal, accepted requirements and
      design, and affected behavior, interfaces, failure, and recovery paths.
      Turn these into concrete behavior and quality claims.
   2. Use `review-code` on the phase's session delta or semantic scope and fix
      authorized, evidence-backed issues against those claims. Also simplify
      avoidable complexity, duplicate responsibility, temporary paths, or
      compounding coupling introduced or exposed by the phase. Do not expand
      closeout into speculative refactoring or unmeasured performance work.
   3. Use `cleanup-project-residue` when the phase created, superseded, or
      exposed residue. Skip it when no residue exists, while still removing
      ordinary temporary instrumentation and scratch artifacts.
   4. Run decisive checks on the final result. Each must directly support a
      closeout claim; resolve or record any remaining failed or inconclusive
      check, finding, residue, or blocker without advancing the phase, except as
      the phase-closing rule in `dev-docs/AGENTS.md` allows.
   5. Use `task-sync` to checkpoint repository reality and move to the next
      phase only after the closeout is verified.
5. **Route and recover.** Repeat from the next phase; if evidence changes the route, return to
   `task-plan`. Use `task-sync` after decisive mid-phase evidence and before a stop, external wait,
   or long operation when repository state would otherwise be hard to recover. After automatic
   continuation or compaction, recover the exact bundle with `task-resume` when context is
   incomplete, then continue the same active Goal. Do not move Goal-mode execution to a fresh
   session or chat.
6. **Finish.** Use `task-sync` to mark the goal done only after the final phase
   closes and the completion contract in `dev-docs/AGENTS.md` holds.

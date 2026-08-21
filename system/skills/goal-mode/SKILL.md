---
name: goal-mode
description: >-
  Use when a task or goal is expected to span hours, days, long-running
  operations, external waits, or multiple sessions, or when the user explicitly
  asks to use goal mode.
---

# Goal Mode

Coordinate one durable repository goal through one task bundle.

**Do not defer phase quality work until the goal is otherwise complete: late
review, repair, and simplification can cost more than the implementation itself,
so each phase must close on evidence of correct behavior and a coherent
implementation before work advances.**

## Framework

- The task bundle is the sole durable authority for the goal, route, status,
  settled design, and verification evidence. Do not create a parallel roadmap,
  phase list, status record, or evidence log.
- Each roadmap phase is one execution checkpoint. `task-plan` owns the route and
  phase shape; this skill drives the current phase through its closeout gate.
- Roadmap kickoff must be `ready` before implementation begins. New evidence
  that invalidates the route returns control to planning before dependent work
  continues.
- Referenced skills own their operations and return control to this flow. This
  skill sequences them without restating their internal procedures.

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
-> next phase / task-handoff / done
```

1. **Bind the goal.** Use `task-start` when no active bundle represents it and
   `task-resume` when the bundle already exists or work crosses a session
   boundary. Honor any identity or recovery stop condition instead of choosing
   or duplicating a task.
2. **Prepare the route.** Use `task-plan` until kickoff is `ready` and the current
   phase is executable.
3. **Execute the phase.** Complete its defined outcome through the relevant
   domain workflow. Keep long-running operations and external waits inside the
   current phase until they produce a decisive result or a recorded blocker.
4. **Close the phase in order.** Do not advance until all five actions complete:
   1. Establish what the closeout must prove from the phase outcome and exit
      criteria, its contribution to the task goal, accepted requirements and
      design, and affected behavior, interfaces, failure, and recovery paths.
      Turn these into concrete behavior and quality claims; planned checks are
      evidence candidates, not proof.
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
      check, finding, residue, or blocker without advancing the phase.
   5. Use `task-sync` to checkpoint repository reality and move to the next
      phase only after the closeout is verified.
5. **Route the transition.** Repeat from the next phase. If evidence changes the
   route, return to `task-plan`. Before stopping or waiting, use `task-sync`; if
   execution transfers to a fresh session, follow it with `task-handoff` and
   later recover through `task-resume`.
6. **Finish.** Use `task-sync` to mark the goal done only after the final phase
   closes and the completion contract in `dev-docs/AGENTS.md` holds. Archiving
   is a separate operation.

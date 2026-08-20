# Roadmap

`01-status.md` is the current task head. This file is the living surface for decision alignment, task relationships, kickoff readiness, and the implementation route that lead to it.

## Scope and constraints

### In scope
- <!-- capability or outcome -->

### Out of scope
- <!-- explicit boundary -->

### Constraints and dependencies
- <!-- technical, product, environment, or sequencing constraint -->

## Decision alignment

| Decision question | Options / tradeoffs | Current direction | Status | Owner / required confirmation | Closure evidence | Consequences |
|---|---|---|---|---|---|---|
| <!-- material top-level question --> | <!-- viable choices and material tradeoffs --> | <!-- recommendation or settled choice --> | open / proposed / decided / superseded | <!-- user, role, or evidence owner --> | <!-- confirmation or evidence that closes it --> | <!-- effect on scope, design, plan, or verification --> |

Keep a material question here from discussion through resolution. Use `open` when no direction is ready, `proposed` when a direction awaits confirmation or evidence, `decided` when its closure condition is satisfied, and `superseded` only for a replaced decision whose rationale prevents replay. A user-owned choice about the goal, scope, product behavior, or acceptance boundary remains `open` or `proposed` until the user confirms it. A technical choice within the approved boundary may become `decided` from repository or experimental evidence. If a user-owned choice gates the current phase, close it before dependent implementation; independent discovery may continue. Reflect settled design in `02-architecture.md`; a decision that changes the goal or completion conditions must also update `01-status.md`. If no material decision is known, replace the placeholder with one `None` row rather than inventing a choice.

### Assumptions

| Assumption | Risk if wrong | Validation |
|---|---|---|
| <!-- current working assumption --> | <!-- consequence --> | <!-- evidence or discovery action --> |

Use one `None` row when no assumption is currently needed.

## Task relationships

| Task | Relationship from this task | Owned boundary / exchanged contract | Coordination condition |
|---|---|---|---|
| <!-- T-### --> | <!-- depends-on / blocks / sibling / follow-up / derived-from / supersedes --> | <!-- what each task owns or passes across the boundary --> | <!-- event, decision, or interface that requires coordination --> |

Interpret the relationship from the current task: `depends-on` means this task needs the listed work, `blocks` means this task gates it, `follow-up` means the listed work follows this task, and `derived-from` or `supersedes` also use this-task-first direction. Record only evidence-backed relationships to opened tasks. If none is known, replace the placeholder with `| None | — | — | — |`; do not infer a relationship from shared files or domain alone. Do not copy another task's state here; resolve current state from that task's own status file. If a dependency blocks this task, also update `01-status.md`. A deferred possibility that does not justify a task belongs only in the project Idea list.

## Implementation plan

### Phase 1 — <!-- name -->
- Outcome:
- Approach:
- Planned changes:
  1. <!-- first executable change -->
- Affected boundaries / entry points:
- Dependencies:
- Exit criteria:
- Verification:
- Recovery:

While kickoff is `pending`, this may be an alignment or discovery phase and downstream implementation phases may remain absent rather than invented. When kickoff becomes `ready`, the first implementation phase must be concrete enough to begin without replanning the task. `01-status.md` points to the first unfinished action. Repeat this block only for another sequential, independently verifiable checkpoint that serves the same task goal and completion conditions. Work needing its own outcome, state, handoff, verification, or archive is a separate task instead.

## Kickoff gate

- Status: pending
- [ ] Every user-owned choice that blocks implementation is decided.
- [ ] Settled design and interfaces are reflected in `02-architecture.md`.
- [ ] The first implementation phase is executable with exit, verification, and recovery criteria.
- [ ] Every current completion condition has a decisive planned check in `verification.md`.

Set `Status: ready` only when every item is checked. If evidence invalidates a gating premise or route, return to `pending` immediately and stop dependent implementation while replanning.

## Risks and recovery

| Risk | Detection | Mitigation | Recovery / rollback |
|---|---|---|---|
| <!-- risk --> | <!-- signal --> | <!-- prevention --> | <!-- response --> |

Use one `None` row when no material risk is currently known.

## Phase closeout

A phase is complete only after all of the following:

1. Review the phase changes and resolve or record every substantive finding.
2. Remove leftovers and update affected comments, docs, and interfaces.
3. Update `01-status.md` and every other bundle file changed by reality, including relationships, decisions, verification, and pitfalls.
4. Commit the verified unit with its `Task: T-###` trailer before starting the next phase.

# Roadmap

<!-- Keep the choices and route that shape this task. `01-status.md` remains the current task head. Remove authoring comments from the created bundle. -->

## Scope and constraints

### In scope
- <!-- outcome or capability owned by this task -->

### Out of scope
- <!-- explicit boundary -->

### Constraints and dependencies
- <!-- only constraints that can change the route or outcome -->

## Decision alignment

| Decision question | Options / tradeoffs | Current direction | Status | Owner / required confirmation | Closure evidence | Consequences |
|---|---|---|---|---|---|---|
| <!-- material top-level question --> | <!-- viable choices and material tradeoffs --> | <!-- recommendation or settled choice --> | open / proposed / decided / superseded | <!-- user, role, or evidence owner --> | <!-- confirmation or evidence that closes it --> | <!-- effect on scope, design, plan, or verification --> |

<!-- Track only choices that can change scope, design, sequencing, or verification. `proposed` awaits its named confirmation or evidence; `decided` has it. Use one `None` row when no material choice exists. -->

### Assumptions

| Assumption | Risk if wrong | Validation |
|---|---|---|
| <!-- current working assumption --> | <!-- consequence --> | <!-- evidence or discovery action --> |

<!-- Keep only assumptions that matter to the route. Use one `None` row when none is needed. -->

## Task relationships

| Task | Relationship from this task | Owned boundary / exchanged contract | Coordination condition |
|---|---|---|---|
| <!-- T-### --> | <!-- depends-on / blocks / sibling / follow-up / derived-from / supersedes --> | <!-- what each task owns or passes across the boundary --> | <!-- event, decision, or interface that requires coordination --> |

<!-- Describe the relationship from this task and only for an opened, evidence-backed task. Do not copy another task's state. Use `| None | — | — | — |` when none is known. -->

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

<!-- Derive one route from the Goal in `01-status.md`: phases should collectively reach that goal and the completion contract in `dev-docs/AGENTS.md`, without restating a second goal here. Show the major route far enough to judge its direction. Make the first phase concrete; keep later phases at the useful level supported by current evidence and mark uncertainty instead of inventing detail. -->

## Kickoff gate

- Status: pending
- [ ] Decisions: every user-owned choice that blocks implementation is decided.
- [ ] Design: settled design and interfaces are reflected in `02-architecture.md`.
- [ ] Route: the major route connects the current Goal to the completion contract, and the first implementation phase is executable with exit, verification, and recovery criteria.
- [ ] Verification: verification needed for the proposed route is identified in `verification.md`.

<!-- Keep the four category prefixes; adapt the wording after each colon to the task. `ready` means every item is checked and the first implementation action can start without reopening the route. -->

## Risks and recovery

| Risk | Detection | Mitigation | Recovery / rollback |
|---|---|---|---|
| <!-- risk --> | <!-- signal --> | <!-- prevention --> | <!-- response --> |

<!-- Keep material risks only. Use one `None` row when none is known. -->

## Phase closeout

- Review: <!-- what must be reviewed when the phase exits -->
- Record update: <!-- task facts that may need synchronization -->
- Checkpoint: <!-- recoverable boundary, including verification and task-linked commit when appropriate -->

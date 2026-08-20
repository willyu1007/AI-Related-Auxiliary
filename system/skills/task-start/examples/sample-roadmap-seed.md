# Roadmap

`01-status.md` owns the current goal and state for this example task.

## Scope and constraints

### In scope
- Add a feature flag that gates the new checkout at the frontend and backend entry points.
- Preserve the existing checkout as the default and rollback path.

### Out of scope
- Rewriting checkout architecture or changing payment providers.

### Constraints and dependencies
- Confirm that the existing flag provider supports both entry points before implementation.
- A global flag disable must restore the old checkout without a deploy.

## Decision alignment

| Decision question | Options / tradeoffs | Current direction | Status | Owner / required confirmation | Closure evidence | Consequences |
|---|---|---|---|---|---|---|
| How should frontend and backend evaluate the checkout flag? | Duplicate evaluation is locally simple but risks cohort drift; a shared boundary adds one dependency but keeps behavior coherent | Prefer the existing shared flag client because one evaluation boundary prevents cohort drift, provided Phase 1 confirms support at both entry points | proposed | Technical owner | Repository evidence from Phase 1 | Determines the later integration boundary |
| What gates rollout increases? | Faster rollout shortens delivery; conservative thresholds reduce exposure | Propose a 1% start with conversion, error-rate, and latency gates because limited exposure makes rollback safer | proposed | Product owner confirmation | Confirmed thresholds and rollback owner | Defines later rollout exit criteria and safety |

### Assumptions

| Assumption | Risk if wrong | Validation |
|---|---|---|
| The repository already has a flag provider supported by both entry points | A new integration boundary or separate task may be required | Inspect current clients and run a focused evaluation check in Phase 1 |

## Task relationships

| Task | Relationship from this task | Owned boundary / exchanged contract | Coordination condition |
|---|---|---|---|
| T-021 | depends-on | Owns the shared flag client contract consumed here | Confirm the stable evaluation API before implementation kickoff |

## Implementation plan

### Phase 1 — Discover the flag boundary
- Outcome: the supported provider and evaluation owner are confirmed.
- Approach: inspect existing frontend and backend flag clients, then prove one evaluation contract with the smallest runnable check.
- Planned changes:
  1. Locate the current checkout entry points and supported flag clients.
  2. Validate whether both entry points can consume one evaluation contract.
  3. Close or revise the shared-boundary decision from the resulting evidence.
- Affected boundaries / entry points: checkout frontend entry, checkout backend entry, shared flag client.
- Dependencies: repository inspection and the T-021 client contract.
- Exit criteria: both entry points can evaluate the same flag safely, or the roadmap records the evidenced boundary change.
- Verification: focused provider smoke check.
- Recovery: keep checkout behavior unchanged and return the unresolved boundary to decision alignment.

## Kickoff gate

- Status: pending
- [ ] Every user-owned choice that blocks implementation is decided.
- [ ] Settled design and interfaces are reflected in `02-architecture.md`.
- [ ] The first implementation phase is executable with exit, verification, and recovery criteria.
- [ ] Every current completion condition has a decisive planned check in `verification.md`.

## Risks and recovery

| Risk | Detection | Mitigation | Recovery / rollback |
|---|---|---|---|
| The existing provider cannot keep frontend and backend cohorts aligned | Phase 1 cannot prove a shared evaluation contract | Keep discovery isolated from checkout behavior | Leave kickoff pending and revise the integration boundary before implementation |

## Phase closeout

End the discovery phase with reviewed evidence, synchronized decisions and task relationships, updated verification plans, and a commit carrying the task trailer.

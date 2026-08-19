# Roadmap

`01-status.md` owns the current goal and state for this example task.

## Scope and constraints

### In scope
- Add a feature flag that gates the new checkout in frontend and backend entry points.
- Preserve the existing checkout as the default and rollback path.

### Out of scope
- Rewriting checkout architecture or changing payment providers.

### Constraints and dependencies
- Confirm the existing flag provider works in both frontend and backend before implementation.
- A global flag disable must restore the old checkout without a deploy.

## Decision alignment

| Decision question | Options / tradeoffs | Current direction | Status | Owner / required confirmation | Closure evidence | Consequences |
|---|---|---|---|---|---|---|
| How should frontend and backend evaluate the checkout flag? | Duplicate evaluation is locally simple but risks cohort drift; a shared boundary adds one dependency but keeps behavior coherent | Use the existing shared flag client if discovery confirms both entry points support it | proposed | Technical owner | Repository evidence from Phase 1 | Determines the integration boundary in Phase 2 |
| What gates rollout increases? | Faster rollout shortens delivery; conservative thresholds reduce exposure | Start at 1% and require conversion, error-rate, and latency gates before each increase | open | Product owner confirmation | Confirmed thresholds and rollback owner | Defines Phase 3 exit criteria and rollout safety |

### Assumptions

| Assumption | Risk if wrong | Validation |
|---|---|---|
| The repository already has a flag provider supported by both entry points | A new integration boundary or separate task may be required | Inspect current clients and run a focused evaluation check in Phase 1 |

## Task relationships

| Task / proposed work | Relationship from this task | Owned boundary / exchanged contract | Coordination condition |
|---|---|---|---|
| T-021 | depends-on | Owns the shared flag client contract consumed here | Confirm the stable evaluation API before Phase 2 |
| T-023 | sibling | Owns checkout regression coverage for the same Feature | Exchange final flag-off and flag-on scenarios before rollout |
| proposed:physical-device-qualification | follow-up | Would own device-specific rollout evidence | Open only if Phase 3 reveals a device-only gap |

## Implementation plan

### Phase 1 — Discovery and flag boundary
- Outcome: supported provider and evaluation owner are confirmed.
- Approach: inspect existing frontend and backend flag clients, then prove one evaluation contract with the smallest runnable check.
- Planned changes:
  1. Locate current checkout entry points and supported flag clients.
  2. Validate whether both entry points can consume one evaluation contract.
  3. Close or revise the shared-boundary decision from the resulting evidence.
- Affected boundaries / entry points: checkout frontend entry, checkout backend entry, shared flag client.
- Dependencies: repository inspection.
- Exit criteria: frontend and backend can evaluate the same flag safely, or the roadmap records the evidenced boundary change.
- Verification: focused provider smoke check.
- Recovery: keep checkout behavior unchanged and return the unresolved boundary to decision alignment.

### Phase 2 — Gated checkout
- Outcome: old and new checkout paths are selected exclusively by the flag.
- Approach: add one gating boundary at each confirmed entry point while preserving flag-off behavior as the rollback path.
- Planned changes:
  1. Implement backend selection at the confirmed boundary.
  2. Implement frontend selection against the same cohort contract.
  3. Add focused flag-off and flag-on coverage.
- Affected boundaries / entry points: confirmed checkout entry points and cohort contract.
- Dependencies: Phase 1 decision.
- Exit criteria: flag off preserves current behavior and flag on reaches the new flow without mixed cohorts.
- Verification: unit checks plus both manual checkout paths.
- Recovery: disable the flag and revert the isolated gating change if the old path is not preserved.

### Phase 3 — Rollout controls
- Outcome: thresholds, monitoring, and rollback ownership are documented.
- Approach: convert the confirmed rollout decision into observable go/no-go gates and a rehearsed rollback.
- Planned changes:
  1. Record confirmed conversion, error-rate, and latency thresholds.
  2. Assign monitoring and rollback ownership.
  3. Dry-run the disable path before rollout.
- Affected boundaries / entry points: rollout configuration, dashboards, and operational runbook.
- Dependencies: production metrics and owner confirmation.
- Exit criteria: every rollout step has a go/no-go rule and immediate rollback.
- Verification: dry-run the rollback procedure.
- Recovery: hold at the current rollout percentage or disable the flag globally.

## Kickoff gate

- Status: pending
- [ ] Every user-owned choice that blocks implementation is decided.
- [ ] Settled design and interfaces are reflected in `02-architecture.md`.
- [ ] The first implementation phase is executable with exit, verification, and recovery criteria.
- [ ] Every current completion condition has a decisive planned check in `verification.md`.

## Risks and recovery

| Risk | Detection | Mitigation | Recovery / rollback |
|---|---|---|---|
| Partial gating | frontend/backend cohort mismatch | one shared evaluation boundary | disable flag and revert gating commit |
| Regression during rollout | conversion, error, or latency threshold breach | staged rollout | disable flag globally |

## Phase closeout

Each phase ends with review, cleanup, relationship and bundle synchronization, verification, and a commit carrying the task trailer.

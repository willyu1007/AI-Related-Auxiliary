# Roadmap

> One possible pending roadmap seed. Adapt the judgment, not the wording or domain.

## Scope and constraints

### In scope
- Gate the new checkout at its frontend and backend entry points.
- Preserve the existing checkout as the rollback path.

### Out of scope
- Rewriting checkout architecture or changing payment providers.

### Constraints and dependencies
- The existing flag provider must support both entry points before implementation begins.

## Decision alignment

| Decision question | Options / tradeoffs | Current direction | Status | Owner / required confirmation | Closure evidence | Consequences |
|---|---|---|---|---|---|---|
| Where should checkout flag evaluation live? | Separate evaluation is simple but can split cohorts; one shared boundary keeps behavior coherent but adds a dependency | Prefer the existing shared client if repository evidence confirms both entry points can use it | proposed | Technical owner | Phase 1 repository evidence | Determines the integration boundary |

### Assumptions

| Assumption | Risk if wrong | Validation |
|---|---|---|
| A suitable shared flag client already exists | The integration boundary must be revised | Inspect the current clients in Phase 1 |

## Task relationships

| Task | Relationship from this task | Owned boundary / exchanged contract | Coordination condition |
|---|---|---|---|
| None | — | — | — |

## Implementation plan

### Phase 1 — Confirm the flag boundary
- Outcome: the supported evaluation boundary is known.
- Approach: inspect the current clients and prove the smallest shared contract without changing checkout behavior.
- Planned changes:
  1. Locate the frontend and backend checkout entry points and their flag clients.
  2. Verify whether both can consume one evaluation contract.
- Affected boundaries / entry points: checkout frontend, checkout backend, shared flag client.
- Dependencies: repository evidence.
- Exit criteria: the shared boundary is confirmed or the decision records why it must change.
- Verification: focused inspection and the smallest runnable provider check.
- Recovery: leave checkout behavior unchanged and keep kickoff pending.

### Phase 2 — Integrate behind the flag (provisional)
- Outcome: both checkout entry points use the confirmed boundary while the existing checkout remains the default.
- Approach: adapt the entry points through the settled contract and keep the old path available.
- Planned changes:
  1. Add the shared evaluation at each confirmed entry point.
  2. Route enabled traffic to the new checkout without removing the old path.
- Affected boundaries / entry points: the boundaries confirmed in Phase 1.
- Dependencies: Phase 1 decision and settled interface.
- Exit criteria: the flag controls both entry points without changing disabled behavior.
- Verification: focused integration checks for enabled and disabled paths.
- Recovery: disable the flag and revert the bounded integration if the contract fails.

### Phase 3 — Verify rollout and recovery (provisional)
- Outcome: the integrated path and rollback behavior have evidence suitable for an explicit rollout decision.
- Approach: exercise the supported scenarios and record limitations before changing exposure.
- Planned changes:
  1. Verify the enabled, disabled, and rollback paths.
  2. Present the evidence and unresolved rollout choices for confirmation.
- Affected boundaries / entry points: checkout behavior and operational flag control.
- Dependencies: Phase 2 integration and user-owned rollout decisions.
- Exit criteria: verification evidence is current and rollout ownership is explicit.
- Verification: scenario checks plus direct rollback observation.
- Recovery: keep exposure disabled until the evidence and decision support rollout.

## Kickoff gate

- Status: pending
- [ ] Decisions: the flag-evaluation boundary choice is decided with its named confirmation.
- [ ] Design: the settled evaluation contract is reflected in `02-architecture.md`.
- [ ] Route: the major route connects the current Goal to the completion contract, and Phase 1 is executable with exit, verification, and recovery criteria.
- [ ] Verification: checks for the enabled, disabled, and rollback paths are identified in `verification.md`.

## Risks and recovery

| Risk | Detection | Mitigation | Recovery / rollback |
|---|---|---|---|
| The provider cannot keep cohorts aligned | Phase 1 cannot prove a shared evaluation contract | Keep discovery isolated from checkout behavior | Revise the boundary before implementation |

## Phase closeout

- Review: evidence from both checkout entry points.
- Record update: the decision, route, architecture, status, and verification evidence affected by the result.
- Checkpoint: a reviewed discovery checkpoint carrying the task trailer.

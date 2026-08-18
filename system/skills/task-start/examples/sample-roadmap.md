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

## Task relationships

| Task / proposed work | Relationship from this task | Owned boundary / exchanged contract | Coordination condition |
|---|---|---|---|
| T-021 | depends-on | Owns the shared flag client contract consumed here | Confirm the stable evaluation API before Phase 2 |
| T-023 | sibling | Owns checkout regression coverage for the same Feature | Exchange final flag-off and flag-on scenarios before rollout |
| proposed:physical-device-qualification | follow-up | Would own device-specific rollout evidence | Open only if Phase 3 reveals a device-only gap |

## Open questions and assumptions

### Open questions
- Which existing flag client should own the shared evaluation boundary?
- Which conversion, error-rate, and latency thresholds gate rollout increases?

### Assumptions
- The repository already has a supported flag provider; discovery validates this before Phase 1.

## Decision log

| Decision | Status | Rationale / evidence | Consequences |
|---|---|---|---|
| Start rollout at 1% | decided | Requirement baseline is stricter than the host draft | Monitoring gates every increase |
| Centralize checkout flag evaluation | proposed | Avoid partial frontend/backend gating | Confirm owner during discovery |

## Phases

### Phase 1 — Discovery and flag boundary
- Outcome: supported provider and evaluation owner are confirmed.
- Dependencies: repository inspection.
- Acceptance: frontend and backend can evaluate the same flag safely.
- Verification: focused provider smoke check.

### Phase 2 — Gated checkout
- Outcome: old and new checkout paths are selected exclusively by the flag.
- Dependencies: Phase 1 decision.
- Acceptance: flag off preserves current behavior; flag on reaches the new flow.
- Verification: unit checks plus both manual checkout paths.

### Phase 3 — Rollout controls
- Outcome: thresholds, monitoring, and rollback ownership are documented.
- Dependencies: production metrics and owner confirmation.
- Acceptance: every rollout step has a go/no-go rule and immediate rollback.
- Verification: dry-run the rollback procedure.

## Risks and recovery

| Risk | Detection | Mitigation | Recovery / rollback |
|---|---|---|---|
| Partial gating | frontend/backend cohort mismatch | one shared evaluation boundary | disable flag and revert gating commit |
| Regression during rollout | conversion, error, or latency threshold breach | staged rollout | disable flag globally |

## Phase closeout

Each phase ends with review, cleanup, relationship and bundle synchronization, verification, and a commit carrying the task trailer.

# Roadmap

`01-status.md` is the current task head. This file owns the decisions and plan that lead to it.

## Scope and constraints

### In scope
- <!-- capability or outcome -->

### Out of scope
- <!-- explicit boundary -->

### Constraints and dependencies
- <!-- technical, product, environment, or sequencing constraint -->

## Task relationships

| Task / proposed work | Relationship from this task | Owned boundary / exchanged contract | Coordination condition |
|---|---|---|---|
| <!-- T-### or proposed:<slug> --> | <!-- depends-on / blocks / sibling / follow-up / derived-from / supersedes --> | <!-- what each task owns or passes across the boundary --> | <!-- event, decision, or interface that requires coordination --> |

Interpret the relationship from the current task: `depends-on` means this task needs the listed work, `blocks` means this task gates it, `follow-up` means the listed work follows this task, and `derived-from` or `supersedes` also use this-task-first direction. Record only relationships that touch this task. Do not copy another task's state here; resolve current state from that task's own status file. If a dependency blocks this task, also update `01-status.md`. Before archive, convert each unresolved `proposed:<slug>` into a task ID, cancel or descope it explicitly, or transfer it to the Feature Brief and `summary.md`.

## Open questions and assumptions

### Open questions
- <!-- question, owner, and what it blocks -->

### Assumptions
- <!-- assumption, risk if wrong, and how to validate -->

## Decision log

| Decision | Status | Rationale / evidence | Consequences |
|---|---|---|---|
| <!-- topic and current choice --> | proposed / decided / superseded | <!-- why --> | <!-- scope or follow-up --> |

Keep only the context needed to explain the current direction or prevent a rejected path from being replayed. Mark a changed decision superseded and preserve its concise rationale; move bulky analysis to `artifacts/` instead of growing this log indefinitely. A decided change to the task goal or completion conditions must also update `01-status.md`.

## Phases

### Phase 1 — <!-- name -->
- Outcome:
- Dependencies:
- Acceptance:
- Verification:

### Phase 2 — <!-- name -->
- Outcome:
- Dependencies:
- Acceptance:
- Verification:

## Risks and recovery

| Risk | Detection | Mitigation | Recovery / rollback |
|---|---|---|---|
| <!-- risk --> | <!-- signal --> | <!-- prevention --> | <!-- response --> |

## Phase closeout

A phase is complete only after all of the following:

1. Review the phase changes and resolve or record every substantive finding.
2. Remove leftovers and update affected comments, docs, and interfaces.
3. Update `01-status.md` and every other bundle file changed by reality, including relationships, decisions, verification, and pitfalls.
4. Commit the verified unit with its `Task: T-###` trailer before starting the next phase.

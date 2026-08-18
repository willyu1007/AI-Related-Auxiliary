# Example: Full pass (blocked task)

## `01-status.md` update (sketch)
- State: blocked
- Current phase: integration verification
- Blocker: waiting for schema access approval
- Next step: once access is granted, run migrations and re-run verification

## `00-roadmap.md` update (sketch)
- ✅ Milestone 1: ...
- 🟡 Milestone 2: ... (blocked)
- Decision: keep the migration path unchanged until production schema access confirms the assumption
- Relationship: T-018 provides the schema contract; current task resumes when that contract is available

## `pitfalls.md` update (sketch)
- Hazard: repeatedly running integration verification without schema access
- Evidence: the command cannot reach the protected schema endpoint
- Prevention: check access before starting the suite
- Applies until: the setup command performs a schema-access preflight

## `verification.md` update (sketch)
- ✅ Typecheck/build
- ❌ Integration tests (blocked by missing environment variable)
- Latest evidence or limitation: ...

## Governance and commit
- `sync --apply`: passed; allocated/refreshed task metadata
- `lint --check`: passed
- Checkpoint commit: `<sha>` with `Task: T-###`

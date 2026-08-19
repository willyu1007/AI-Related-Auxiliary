# Example: Full pass (blocked task)

## `01-status.md` update (sketch)
- State: blocked
- Current phase: integration verification
- Blocker: waiting for schema access approval
- Next step: once access is granted, run migrations and re-run verification

## `00-roadmap.md` update (sketch)
- Decision alignment: keep the migration path as `proposed`; production schema access is the closure evidence before it becomes `decided`.
- Task relationship: `T-018 depends-on` supplies the schema contract; this task resumes integration after that contract is available.
- Implementation plan: the integration-verification phase keeps the migration command as its first planned change, names the protected schema endpoint as an affected boundary, and exits only after migration and verification succeed.
- Recovery: if the schema differs from the working assumption, stop the migration and return the evidenced choice to decision alignment.
- Kickoff gate: `pending`; the schema decision and settled migration design are not yet closed, so dependent implementation must not resume.

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

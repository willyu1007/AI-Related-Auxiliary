# Automatic debug cleanup policy

Cleanup is mandatory after verified success and on `STOP`. Perform it before the final handoff; do not delegate it back to the user.

## Checklist

1. List the session's run ids and instrumented paths.
2. Remove blocks marked:
   - `DEBUG-MODE: BEGIN <run_id>`
   - `DEBUG-MODE: END <run_id>`
3. Remove session-only logs, flags, counters, samplers, temporary alternate
   branches, imports, and config.
4. Search for the **specific run ids** and inspect generic marker matches:
   - `DEBUG-MODE: BEGIN`
   - `DEBUG-MODE: END`
   - `[DBG:`
5. Review the diff to avoid deleting pre-existing diagnostics owned by the
   project or another investigation.
6. Run the narrowest relevant check after removal.
7. Summarize useful evidence, then remove the session-owned
   `.ai/.tmp/debug-mode/<session_id>/` directory unless retention was explicitly
   requested.
8. Report `cleanup: done`.

## If cleanup is blocked

Do not present the debug task as complete. Name every remaining file/marker, explain why removal failed, and provide the safest next action.

## Permanent observability

Keeping a metric/log is a separate product decision, never the default. Convert it to project conventions, remove all debug markers, and review privacy, volume, cardinality, and operational ownership.

# Automatic debug cleanup policy

Cleanup is mandatory when the in-scope investigation completes, is abandoned, cannot continue, or the user stops it. A documented pause awaiting required human evidence is not completion. Perform cleanup before reporting completion; do not delegate it back to the user.

## Checklist

1. List the session's run ids and instrumented paths.
2. Remove blocks marked:
   - `DEBUG-MODE: BEGIN <run_id>`
   - `DEBUG-MODE: END <run_id>`
3. Remove session-only logs, flags, counters, samplers, imports, config, and
   temporary code paths or conditionals introduced by this session.
4. Search for the **specific run ids** and inspect generic marker matches:
   - `DEBUG-MODE: BEGIN`
   - `DEBUG-MODE: END`
   - `[DBG:`
5. Review the diff to avoid deleting pre-existing diagnostics owned by the
   project or another investigation.
6. Run the appropriate post-cleanup checks after removal.
7. Summarize durable, project-relevant lessons in the final report and note any
   targeted non-duplicative regression protection added by the in-scope fix.
8. Remove the session-owned `.ai/.tmp/debug-mode/<session_id>/` directory unless
   retention was explicitly requested. Do not retain the raw journal as project
   documentation.
9. Report `cleanup: done`.

## If cleanup is blocked

Do not present the debug task as complete. Name every remaining file/marker, explain why removal failed, and provide the safest next action.

## Permanent observability

Within a fix request, keep repository-local evidence-preserving observability when it is required for diagnosis and uses existing project mechanisms. Convert it to project conventions, remove all debug markers, and review privacy, volume, and cardinality. Production deployment, external resources, and new operational ownership remain outside that authorization.

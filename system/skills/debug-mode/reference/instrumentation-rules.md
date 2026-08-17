# Debug instrumentation rules

Instrumentation exists to distinguish hypotheses, not to narrate the program.

## Markers

Use one `run_id` per iteration, e.g. `dbg-YYYYMMDD-HHMMSS-<4hex>`.

Every debug-only code block:

```text
DEBUG-MODE: BEGIN <run_id>
... temporary probe ...
DEBUG-MODE: END <run_id>
```

Every temporary log includes `[DBG:<run_id>]` or an equivalent structured `run_id` field. Track all touched files for cleanup.

## Placement

Prefer high-information boundaries:

- suspected function entry/exit
- state transitions
- error boundaries
- network / database / filesystem calls
- queue, lock, callback, and async boundaries

Capture branch, state, timestamps/duration, counts, safe correlation IDs, and error name/code. Do not log full payloads by default.

## Avoid changing the bug

- Prefer buffered/structured logging over synchronous I/O.
- Avoid tight-loop logging; sample or count.
- For timing bugs, record ordering and timestamps rather than large values.
- Reuse the project logger; do not introduce a debug framework.

## Privacy

Prefer presence flags, lengths, categories, and stable non-reversible identifiers.
Never log credentials or raw auth headers. See `privacy-redaction.md`.

## Lifecycle

Temporary probes stay only through verification. Verified success or `STOP` immediately triggers the automatic cleanup policy.

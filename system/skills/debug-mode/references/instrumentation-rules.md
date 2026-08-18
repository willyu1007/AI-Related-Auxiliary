# Debug instrumentation rules

Instrumentation exists to distinguish hypotheses, not to narrate the program.

## Markers

Use one `run_id` per instrumentation iteration, e.g. `dbg-YYYYMMDD-HHMMSS-<4hex>`.

When the file syntax permits, bracket each debug-only code block:

```text
DEBUG-MODE: BEGIN <run_id>
... temporary probe ...
DEBUG-MODE: END <run_id>
```

Every temporary log includes `[DBG:<run_id>]` or an equivalent structured `run_id` field. When a file cannot safely carry marker comments, record its exact path, probe location, and run id in the journal. Track all touched files for cleanup.

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

Prefer presence flags, lengths, categories, non-sensitive correlation IDs, and approved keyed hashes when stable correlation is necessary.
Never log credentials or raw auth headers. Follow [privacy-redaction.md](privacy-redaction.md).

## Lifecycle

Temporary probes stay only while the current in-scope investigation is active, including a documented pause awaiting required human evidence. Retain only probes needed for the pending action. Apply the automatic cleanup policy when the investigation completes, is abandoned, cannot continue, or the user stops it.

# Temporary debug journal

Session: `<session_id>`
Completion criteria: `<expected behavior>`
Environment: `<runtime/build/device>`
Session status: `<active|awaiting-human|complete|stopped>`

## Active constraints

- Confirmed facts: `<facts supported by evidence>`
- Ruled-out hypotheses: `<hypotheses and ruling evidence>`
- Failed probes or corrections: `<attempt and why it failed>`
- Remaining uncertainties: `<unknowns that still affect the next decision>`

---

## Iteration `<n>` · `<run_id or none>` · `<UTC timestamp>`

### Hypotheses
- `[supported|ruled out|uncertain]` `<hypothesis>` — `<evidence>`

### Changed paths
- `<path and reason>` or `none`

### Instrumentation
- `<path/location/fields>` or `none`

### Evidence
- `<short redacted signal>`

### Correction
- `<not applied | concise change and rationale>`

### Verification
- Result: `<pass|fail|inconclusive>`
- Threshold progress: `<observed>/<required>`

### Human checkpoint (only when used)
- Reason: `<why agent action is insufficient>`
- Requested action: `<exact user action>`
- Requested evidence: `<format, applicable run id, and redaction>`
- Status: `<awaiting|received>`

### Decision
- New information since the prior iteration: `<evidence or changed condition>`
- Next step: `<action and why it is not a repeat>`

### Cleanup
- `<pending | done; run ids removed>`

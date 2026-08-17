---
name: debug-mode
description: >-
  Run an evidence-driven debugging loop when a runtime bug's root cause is
  unclear: form falsifiable hypotheses, add removable instrumentation when
  needed, reproduce with available tools, apply a minimal evidence-backed fix,
  verify it, and automatically remove debug-only changes and temporary artifacts.
  At startup ask once which optional approval gates to use; default is no
  instrumentation or fix gate. Not for obvious static/type errors that do not
  require runtime evidence.
---

# Debug Mode

Turn an unclear runtime symptom into a supported root cause, a minimal fix, and a verified clean worktree:

`intake → hypothesize → instrument (if needed) → reproduce → analyze → fix → verify → cleanup`

The current agent executes commands and reads their output with its available tools. Do not introduce a separate terminal-capture workflow.

## When to use

- intermittent, race, lifecycle, state-machine, performance, or memory bugs
- regressions where the first explanation is uncertain
- environment-specific failures requiring runtime evidence
- failures where existing logs do not distinguish plausible causes

Use a simpler direct fix for an obvious syntax, type, or build error whose cause is already proven. If reproduction is impossible, add the smallest durable observability needed for future evidence, but do not claim the bug is verified.

## Startup choice (ask once)

Unless the user already chose a policy, ask one compact question at intake:

> Approval gates (default: none): `none`, `instrument`, `fix`, or `both`?

| Mode | Pause before instrumentation | Pause before behavior-changing fix |
|------|------------------------------|------------------------------------|
| `none` (default) | no | no |
| `instrument` | yes | no |
| `fix` | no | yes |
| `both` | yes | yes |

In `none` mode, continue without a mandatory instrumentation-plan message. Still explain material findings and the final fix. These modes only control debug-workflow interruptions: they never bypass normal safety, destructive operation, production-write, credential, or permission requirements.

The user may say `STOP` at any time. `STOP` immediately transitions to cleanup.

## Core rules

1. Start with 3–6 falsifiable hypotheses, not a log spray.
2. Instrument only where evidence will separate those hypotheses.
3. Every temporary change is marked with a unique `run_id` and tracked for automatic cleanup (see `reference/instrumentation-rules.md`).
4. Prefer the smallest fix justified by evidence. Avoid speculative refactors.
5. Deterministic bugs need one full passing reproduction; flaky/timing bugs default to three consecutive passes.
6. Never log secrets or unnecessary PII.
7. Cleanup is part of completion, not a later suggestion.

## Execution protocol

### Phase 0 — Intake

Ask the startup approval choice together with the minimum missing debug inputs:

- expected vs actual behavior (Definition of Done)
- exact repro steps and frequency
- environment/runtime/build mode and relevant recent changes
- current evidence (stack trace, screenshot, logs)

Do not repeat questions the repository or tools can answer.

Create a session id and iteration run id, e.g. `session-dbg-YYYYMMDD-HHMMSS` and `dbg-YYYYMMDD-HHMMSS-<4hex>`.

For a short single-iteration bug, keep records in chat. For multi-iteration, flaky, or session-spanning work, optionally create:

`.ai/.tmp/debug-mode/<session_id>/journal.md`

Use `templates/journal-entry.md`; read only the latest relevant entries. The directory is temporary and is automatically removed during cleanup unless the user explicitly asks to retain it.

### Phase 1 — Hypothesize

For each hypothesis state:

- expected observation if true
- observation that would rule it out
- evidence source (existing logs/test or instrumentation point)

If existing evidence is sufficient, skip instrumentation.

### Optional instrumentation gate

Only when mode is `instrument` or `both`, present the hypotheses, instrumentation locations/fields, reproduction plan, and wait for approval. Otherwise proceed directly without a mandatory plan summary.

### Phase 2 — Instrument (only if needed)

- Apply the smallest reversible instrumentation.
- Use existing logging/telemetry; do not add a framework just to debug.
- Wrap every debug-only block and tag every debug log with the current run id.
- Track each changed path and run id for cleanup.

### Phase 3 — Reproduce and collect evidence

Default path:

1. Run the repro command yourself when feasible.
2. Read command output directly with available shell/terminal/browser/device tools.
3. Extract only the signals needed to support or rule out hypotheses.

When the environment is inaccessible (for example a user's physical device or private production console), ask the user to run the exact repro and return a short, redacted, run-id-filtered excerpt. Do not ask for full terminal tails.

### Phase 4 — Analyze

Mark every hypothesis `supported`, `ruled out`, or `uncertain`, citing evidence.

- Insufficient evidence → new run id, refined hypotheses, minimal next probe.
- Supported root cause → propose the smallest fix and its verification.
- New evidence in a long investigation → append a short journal entry.

### Optional fix gate

Only when mode is `fix` or `both`, present:

- evidence-backed root cause
- files and minimal change
- risks / rollback
- verification plan

Wait for approval. Otherwise implement the evidence-backed fix directly.

### Phase 5 — Fix

- Make the smallest behavior-changing correction.
- Keep temporary instrumentation until the verification threshold is met.
- Run the narrowest useful tests/checks plus the original reproduction.

### Phase 6 — Verify

Follow `reference/verification-policy.md`.

- deterministic: at least one complete pass
- flaky/race/timing: three consecutive passes by default
- failure: return to hypotheses with a new run id; do not stack speculative fixes

### Phase 7 — Automatic cleanup (mandatory)

On verified success **or `STOP`**, execute cleanup in the same working turn before final handoff:

1. Remove all debug-only blocks/logs/flags introduced by this session.
2. Search for this session's run-id markers and confirm none remain.
3. Inspect the diff so cleanup does not remove unrelated pre-existing diagnostics.
4. Re-run the smallest check needed to prove cleanup did not break the fix.
5. Summarize useful journal evidence in chat, then delete `.ai/.tmp/debug-mode/<session_id>/` unless retention was explicitly requested.

Do not finish with “remember to clean up.” If cleanup cannot be completed, report exact remaining paths/markers and treat the task as incomplete.

## Final report

- symptom and supported root cause
- evidence that distinguished it
- minimal fix and risk
- verification attempts/results
- regression protection recommendation
- `cleanup: done` (or exact unresolved cleanup blocker)

## Boundaries

- Do not claim verification without reproduction evidence.
- Do not add instrumentation when existing evidence already proves the cause.
- Do not leave debug-only changes or temporary session artifacts after completion.
- Do not retain a debug signal as permanent observability without treating it as a deliberate product change (remove debug markers and review privacy/volume).
- Do not log/request secrets, tokens, raw auth headers, or unnecessary PII.

## Assets

| Path | Role |
|------|------|
| `reference/instrumentation-rules.md` | Removable, low-impact evidence probes |
| `reference/verification-policy.md` | Pass thresholds and failure behavior |
| `reference/cleanup-policy.md` | Mandatory automatic cleanup checklist |
| `reference/privacy-redaction.md` | Evidence minimization |
| `templates/journal-entry.md` | Optional temporary iteration record |

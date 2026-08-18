---
name: debug-mode
description: >-
  Use when the user asks to diagnose, reproduce, or fix a runtime failure whose
  root cause is unclear, especially an intermittent, environment-dependent,
  timing, lifecycle, state, performance, or memory issue.
---

# Debug Mode

## Core rules

- Proceed autonomously within the requested scope. Ask only when blocked by missing information, authority, or a material user decision; otherwise use progress updates without pausing.
- Form a small set of falsifiable hypotheses and collect only evidence that can distinguish them.
- Treat every failed or inconclusive attempt as evidence. Before another iteration, update the active constraints and do not repeat a ruled-out hypothesis, probe, or correction unless new evidence invalidates the earlier result.
- When the requested scope includes a fix, implement the complete evidence-backed correction and all necessary dependent changes without seeking additional approval; avoid unrelated work.
- Do not claim a root cause or successful verification beyond the evidence obtained.
- Remove all session-only instrumentation and artifacts when the investigation completes, is abandoned, cannot continue, or is stopped.

## Interaction routing

Verify autonomously first, including with available shell, browser, desktop, and device-control tools. Use human-in-the-loop assistance only when required information or action cannot be obtained or performed by the agent, such as a physical-device interaction, MFA, an inaccessible private environment, account-specific information, or a subjective observation.

For a simple blocking question before investigation state or temporary changes exist, ask directly without creating a journal. Before pausing an active investigation for human assistance:

1. Create a session id if one does not exist, then create or update the journal checkpoint with the current hypotheses, evidence, applicable run ids, changed paths, and pending decision.
2. Explain why human involvement is required and provide the exact minimal action to perform.
3. Specify the evidence to return, its format, any applicable run id, and required redaction.
4. Do not request credentials, secrets, or unnecessary raw logs.

When the user responds, validate the environment and run id where applicable, append the returned evidence to the active journal or record it concisely in chat, and resume the interrupted phase without restarting the investigation.

A documented pause awaiting required human evidence is not completion. Retain only the temporary instrumentation needed for the pending action and keep it fully tracked. If the investigation completes, is abandoned, cannot continue, or the user stops it, proceed to cleanup.

## Execution protocol

### Phase 1 — Intake

Establish the following from the request, repository, and available tools:

- expected and actual behavior, including completion criteria
- reproduction conditions and frequency
- environment, runtime, build mode, and relevant recent changes
- existing evidence such as stack traces, screenshots, logs, and failing tests

Ask only for missing inputs that block progress. Do not repeat questions the repository or tools can answer.

Create a session id whenever a journal or temporary instrumentation is used. Resolve one active repository or worktree root and maintain the journal only at `<active-root>/.ai/.tmp/debug-mode/<session_id>/journal.md`; do not create duplicates in parent repositories or adjacent workspaces. Keep a short single-iteration investigation in chat. For any multi-iteration, flaky, session-spanning, or human-assisted active investigation, use `templates/journal-entry.md`. Before each iteration, read the journal's active constraints and latest relevant entry. Remove the temporary journal during cleanup unless the user explicitly requests retention.

### Phase 2 — Establish baseline

- Run the reproduction yourself and inspect its output with available tools when feasible, before adding instrumentation.
- Inspect existing evidence, relevant code and tests, and recent changes.
- Record the reproduction command, environment, outcome, and frequency needed for later comparison.

When the environment or required action is inaccessible, follow Interaction routing. Ask the user for an exact reproduction and a short redacted excerpt; do not request full terminal tails.

If the requested scope is reproduction only and the reproduction outcome is established, record it and proceed to cleanup. If further evidence is required only to establish reproduction, use the evidence loop for that purpose and exit as soon as the reproduction completion criteria are met or the stop condition applies.

### Phase 3 — Evidence loop

1. Form a small set of falsifiable hypotheses. For each, identify the observation that would support it, the observation that would rule it out, and the available evidence source.
2. Collect existing evidence first. If it cannot distinguish the hypotheses, read `references/instrumentation-rules.md` and add the least intrusive reversible probes needed.
3. Reproduce the symptom and collect only the signals needed to distinguish the hypotheses.
4. Mark each hypothesis `supported`, `ruled out`, or `uncertain`, citing the evidence.
5. Update the active constraints with confirmed facts, ruled-out hypotheses, failed probes or corrections, and remaining uncertainties.
6. Start another iteration only when it can produce new discriminating evidence. State what changed and why the next hypothesis, probe, or correction differs from prior attempts. Repetition is allowed only to characterize the baseline, meet a verification threshold, or when changed conditions invalidate the earlier result.

When a second iteration becomes necessary, create the session journal before continuing if none exists and seed its active constraints from the evidence already recorded in chat.

For temporary instrumentation, use the current session id, use a unique run id per iteration as defined by `references/instrumentation-rules.md`, and track every touched path. When a journal is active, update its active constraints and append a concise entry after every iteration. For long investigations, provide progress updates at meaningful checkpoints without pausing.

If no current reproduction path exists, use available evidence without claiming verification. When a fix request exposes code that discards evidence required for diagnosis, automatically implement and verify evidence-preserving changes within the scoped repository using existing project mechanisms. Ask for user involvement only when evidence collection requires production deployment, external resources, or new operational ownership. For reproduction- or diagnosis-only requests, recommend the change without implementing it.

Stop iterating when no next in-scope hypothesis or probe can produce new discriminating evidence or reduce the remaining uncertainty. Record the unresolved hypotheses and the exact evidence needed next; do not claim a verified root cause.

If no root cause is supported, do not enter Correct. Proceed to cleanup and report the unresolved status, even when a fix was requested.

When the requested scope ends at reproduction or diagnosis, record the requested result and proceed to cleanup as soon as the completion criteria are met or the stop condition applies.

### Phase 4 — Correct

Enter this phase only when the requested scope includes a fix. Implement the complete evidence-backed correction and all necessary dependent changes without seeking additional approval; avoid unrelated work. Keep temporary instrumentation until verification is complete.

When it materially prevents recurrence, preserve the lesson through the implementation, an appropriate existing check, or targeted non-duplicative regression protection. Do not add tests or documentation that duplicate existing coverage.

### Phase 5 — Verify

Read and follow `references/verification-policy.md`. Run the original reproduction plus all checks needed to cover the affected behavior and necessary regression surface.

If verification fails or is inconclusive:

1. Record the failing evidence, attempted correction, verification result, and next decision in the active journal; keep a concise record in chat when no journal is used.
2. Update the active constraints so the failed correction and the evidence against it constrain the next iteration.
3. Review the behavior-changing changes introduced by the failed correction. Remove unsupported changes; retain a partial change only when independently justified by evidence.
4. Keep or revise temporary instrumentation only when it can still distinguish the remaining hypotheses.
5. Return to the evidence loop only when the next iteration can produce new discriminating evidence as required by Phase 3; start a new run id when further instrumentation is needed. Otherwise stop iterating, clean up, and report the verification limitation.

Do not stack speculative fixes or claim success when verification cannot be performed.

### Phase 6 — Cleanup

Read and apply `references/cleanup-policy.md` when the investigation completes, is abandoned, cannot continue, or the user stops it. Remove session-only instrumentation, markers, and temporary artifacts; inspect the diff and run the appropriate post-cleanup checks.

If cleanup cannot be completed, report every remaining path or marker and treat the task as incomplete.

## Final report

- symptom and root-cause status: supported or unresolved
- distinguishing evidence and remaining uncertainty
- material ruled-out approaches and reusable lessons
- implemented or recommended correction and its risk, when applicable
- verification attempts/results
- regression protection implemented or recommended, when applicable
- `cleanup: done` (or exact unresolved cleanup blocker)

## Boundaries

- Autonomy does not expand the requested scope or bypass normal safety, permission, or production-change requirements.
- Treat permanent logs, metrics, or telemetry as deliberate product changes, not retained debug instrumentation. A fix request authorizes repository-local evidence-preserving changes through existing project mechanisms, but not production deployment, external resources, or new operational ownership. Remove debug markers and review privacy, volume, and cardinality.
- Never collect, request, store, or expose credentials, secrets, raw auth headers, or unnecessary sensitive data; follow `references/privacy-redaction.md`.

## Resources

| Path | Role |
|------|------|
| `references/instrumentation-rules.md` | Removable, low-impact evidence probes |
| `references/verification-policy.md` | Pass thresholds and failure behavior |
| `references/cleanup-policy.md` | Mandatory automatic cleanup checklist |
| `references/privacy-redaction.md` | Evidence minimization |
| `templates/journal-entry.md` | Required state record for multi-iteration, flaky, session-spanning, or human-assisted investigations |

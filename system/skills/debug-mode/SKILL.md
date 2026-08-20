---
name: debug-mode
description: Use when diagnosing, reproducing, or fixing a runtime failure or performance regression whose root cause is unclear.
---

# Debug Mode

## Establish the investigation

Resolve whether the requested outcome is reproduction, diagnosis, or a fix.
Establish the expected and actual behavior, completion criteria, environment,
reproduction conditions and frequency, and existing evidence.

Build or identify a feedback signal that exercises the reported symptom, and
record its invocation, environment, outcome, and baseline frequency. Prefer a
fast, deterministic, agent-runnable signal, but do not block investigation when
one cannot be built; use available evidence and state the resulting limitation.
Minimize the reproduction when doing so materially narrows the hypothesis space
or creates useful regression protection.

Read `references/privacy-redaction.md` before collecting, requesting, or quoting
logs, traces, payloads, identifiers, or other potentially sensitive evidence.

Keep short investigations in the conversation. Create a session id and use
`templates/journal-entry.md` at
`<active-root>/.ai/.tmp/debug-mode/<session_id>/journal.md` when the investigation
uses temporary instrumentation, pauses for human evidence, spans sessions, or
becomes too iterative or flaky to track reliably in chat. Maintain one journal
at the active repository or worktree root, update its active constraints after
each evidence iteration and before a pause, and remove it during cleanup unless
the user explicitly requests retention.

## Run the evidence loop

1. Form a small set of falsifiable hypotheses. For each, identify the observation
   that would support it, rule it out, and distinguish it from the alternatives.
2. Collect existing evidence first. If it cannot distinguish the hypotheses,
   read `references/instrumentation-rules.md` and add only the least intrusive,
   reversible probes needed.
3. Exercise the feedback signal and collect only discriminating evidence.
4. Mark each hypothesis `supported`, `ruled out`, or `uncertain`, and update the
   active constraints with confirmed facts, failed or inconclusive attempts, and
   unsupported corrections.
5. Iterate only when the next probe or hypothesis can produce new information.
   Do not repeat a ruled-out approach unless changed conditions invalidate the
   earlier evidence.

If no reproduction path exists, continue from available evidence without
claiming reproduction or verification. Stop when the root cause is supported or
no in-scope action can reduce the remaining uncertainty. If no root cause is
supported, do not claim one or apply a speculative correction. An independently
justified mitigation may still proceed under **Correct when authorized**;
otherwise clean up and report the unresolved state even when a fix was requested.

For a reproduction- or diagnosis-only request, stop once that outcome is met.
Do not continue into correction merely because a possible fix is visible.

## Request human evidence only when necessary

Use available tools before asking the user to reproduce an action or collect
evidence. Ask only when the required environment, physical interaction, account
state, or subjective observation is inaccessible. Before pausing, checkpoint the
journal with the current evidence and pending decision, then request the exact
minimal action and redacted evidence needed. A pause is not completion; resume
from the checkpoint without restarting the investigation.

## Correct when authorized

Apply a correction only when the requested scope includes a fix and the evidence
supports either the root cause or an independently justified mitigation with a
concrete expected effect and decisive verification path. Label a mitigation as
such; do not claim that it resolves the root cause. Implement the complete
in-scope correction and necessary dependent changes without mixing unrelated
work. Keep temporary instrumentation until verification finishes. Authorization
to change repository code does not authorize production deployment, external
resources, or new operational ownership.

When regression protection would materially prevent recurrence, read
`references/verification-policy.md` before adding it; do not duplicate existing
coverage.

## Verify and clean up

Read and apply `references/verification-policy.md`. Re-run the original feedback
signal and the checks needed for affected behavior and relevant regressions. A
failed or inconclusive attempt becomes evidence: update the active constraints,
remove unsupported behavior changes, and return to the evidence loop only when
the next iteration can distinguish the remaining hypotheses. Do not stack
speculative fixes or claim success without decisive verification.

Read and apply `references/cleanup-policy.md` whenever the investigation
completes, is abandoned, cannot continue, or is stopped. Cleanup precedes the
final result; if it cannot be completed, report the exact residue and leave the
task incomplete.

## Return the result

Report the requested outcome, root-cause status, decisive evidence, correction
when applicable, verification results, remaining uncertainty, and cleanup status.
Include ruled-out approaches only when they materially help future investigation.

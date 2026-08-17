# Debug verification policy

## Thresholds

- Deterministic issue: at least one complete reproduction pass with the expected outcome and no critical regression.
- Flaky, race, timing, or intermittent issue: three consecutive passes by default.

The user may lower a threshold with explicit risk acknowledgement or stop at any time.

## Record each attempt

- attempt and consecutive-pass count
- environment differences
- pass / fail / inconclusive
- residual anomalies

A pass satisfies the intake Definition of Done. A fail includes the original symptom, a new critical regression, or evidence that the root cause persists.

On failure, return to hypotheses with a new run id. Do not immediately stack another speculative fix.

After the threshold is met, transition directly to automatic cleanup. The fix is not complete until cleanup and the post-cleanup check succeed.

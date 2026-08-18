# Debug verification policy

## Thresholds

- Deterministic issue: at least one complete original-reproduction pass with the expected outcome, plus the checks needed to cover affected behavior and relevant regressions.
- Flaky, race, timing, or intermittent issue: choose the attempt count and success threshold from the observed baseline failure rate and environment. When no defensible rate is available, require at least three consecutive passes and state the residual uncertainty.

The user may request a different threshold or stop at any time.

## Record each attempt

- attempt count and threshold progress
- environment differences
- pass / fail / inconclusive
- residual anomalies

A pass satisfies the intake completion criteria. A fail includes the original symptom, a new relevant regression, or evidence that the root cause persists. An inconclusive result means the environment or reproduction conditions were not controlled well enough, or the evidence and sample size were insufficient; it does not advance the pass count or support a success claim. Treat both failed and inconclusive results as evidence and add them to the active constraints.

On failure or an inconclusive result, record the attempt and update the active constraints before reviewing the behavior-changing changes it introduced. Remove unsupported changes before the next correction; retain a partial change only when independently justified by evidence. Preserve unrelated and pre-existing work. Return to the evidence loop only when the next iteration can produce new discriminating evidence, use a new run id when further instrumentation is needed, and do not stack speculative fixes.

After the threshold is met, transition directly to automatic cleanup. The fix is not complete until cleanup and the post-cleanup check succeed.

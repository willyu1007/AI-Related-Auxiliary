---
name: review-code
description: >-
  Use when code or code changes need direct review, either as the requested task
  or as part of an authorized fix.
---

# Review Code

## Resolve the scope

Honor an explicit target; otherwise infer the narrowest complete scope and ask
only about material ambiguity. Inspect necessary context without expanding the
target; respect exclusions and disclose coverage limits.

### Scope types

- **Session delta** — changes made since the last reliable review checkpoint in the active session.
- **Uncommitted worktree** — staged, unstaged, and untracked changes within the
  requested or inferred target; unrelated or pre-existing work is not included
  solely because it shares the worktree.
- **VCS change set** — a commit, range, branch against a base, or PR.
- **Semantic scope** — code belonging to a feature, task, module, or subsystem across commits and worktree state.
- **Repository** — the repository's current code as a whole.

Use incremental review only with a reliable prior baseline; otherwise review the
full related change set. In a re-review, check the prior findings, their fixes,
and related regressions.

## Set the review policy

- **Outcome** — apply explicit review priorities and judge whether the target
  satisfies the task intent and acceptance conditions.
- **Repository fit** — separately judge relevant contracts and established
  conventions; passing one dimension does not excuse failing the other.
- **Fixing** — when changes are authorized, fix evidence-backed issues with
  clear, in-scope corrections as they are found and verify them; otherwise
  report only.
- **Leave unresolved** — do not guess when a fix requires a material decision,
  exceeds the authorized scope, or lacks enough evidence.

## Record findings

A finding needs inspected evidence, a precise location, and a concrete
consequence. Keep uncertainty as an assumption or question rather than a finding.

Classify each issue at the lowest severity supported by the evidence:

- **Must fix** — a reachable failure, unacceptable risk, or requirement or
  contract violation that prevents the accepted outcome.
- **Should fix** — an evidence-backed current-scope risk worth correcting, but
  not a demonstrated blocker.
- **May fix** — an optional improvement with no demonstrated current risk; omit
  low-value matters of taste.

Severity reflects consequence and reachability, not fix effort or reviewer
preference. Verification is decisive only when it exercises the reported
consequence or original symptom, or directly checks the relevant contract or
invariant; a nearby passing check is insufficient. Verify claims from tools or
other reviewers against the code, use project tooling as evidence instead of
repeating every rule it already enforces, and distinguish checks run from checks
recommended.

## Return the result

State the reviewed scope, then summarize issues in a table:

| Issue / evidence | Severity | Status | Resolution | Verification |
|---|---|---|---|---|

Put unresolved issues first and use `fixed`, `unresolved`, or `risk accepted`
for status. Use `risk accepted` only after explicit acceptance by the user or
another authorized decision-maker. For a fixed issue, record what changed and
how it was verified; for an unresolved issue, record the bounded fix direction
and required verification. If no issues were found, say so instead of returning
an empty table; if all found issues were fixed, say that none remain unresolved.
Disclose material coverage limits after the table.

---
name: resolve-vcs-conflicts
description: >-
  Use when an authorized merge, rebase, cherry-pick, or revert is already in
  progress and Git has stopped on unresolved conflicts. Do not use to plan an
  integration or diagnose a regression after the operation is complete.
---

# Resolve VCS Conflicts

Reconcile both sides' intended behavior within the current operation and the
user's authorization.

## Establish the operation

- Inspect Git status, the unmerged index, and the active operation's metadata.
  Identify the operation, its destination or base, the commit currently being
  replayed when applicable, and every unmerged path.
- Verify which commits the index stages represent. `ours` and `theirs` are
  operation-dependent labels, not evidence of intent.
- Identify pre-existing or unrelated worktree changes as the foreign set. Modify
  and stage only explicit integration paths.

## Recover intent

For each affected behavior, determine what the base and each side require from
the smallest useful set of primary evidence: relevant commit messages and diffs,
accepted task requirements, nearby contracts, callers, and tests.

- Include modify/delete and rename cases, as well as non-conflicted callers or
  interfaces affected by the combination; the semantic scope may extend beyond
  marked hunks.
- Resolve generated artifacts through their authoritative inputs and regenerate
  them with the repository's mechanism when available.

## Resolve the behavior

- Preserve both intents when they are compatible, even when that requires an
  integration adjustment outside the marked hunk.
- When the intents are incompatible, follow an accepted requirement or contract
  only when it clearly owns the choice, and make the dropped behavior explicit.
  Otherwise stop before deciding and request the missing decision.
- Base the result on recovered intent, not recency, current-branch status, or edit
  size. Do not introduce behavior required by neither side or attach unrelated
  cleanup or refactoring.

## Verify the result

- Confirm the index has no unresolved entries. Also inspect affected files for
  leftover conflict markers; absence of markers alone is not sufficient.
- Review staged and unstaged diffs as a combined result. Check for silently
  dropped behavior, duplicate effects, broken callers, and unintended changes
  outside the integration scope.
- Run focused checks that exercise the reconciled behavior and the repository's
  relevant standard checks. Report unrelated or pre-existing failures
  separately.

## Finish within authorization

- If the original request authorized completing the current operation, continue
  or commit it as that operation requires. If continuing reveals another set of
  conflicts, repeat this workflow with the new commit and evidence.
- That authorization does not imply skipping or aborting commits, starting a
  different integration, publishing, or pushing. Request direction when skip or
  abort would change the intended outcome.
- If completion is not authorized, leave the verified resolution intact and
  report the exact operation state and next required action.

Report the operation and paths resolved, material choices or unknowns, checks,
remaining foreign changes, and the final Git state.

---
name: codex-implementation
description: >-
  Use when the user asks for a repository change to be implemented by Codex
  CLI, or when the intended behavior or design is already defined and the
  main work is coding or mechanical execution rather than unresolved product,
  UI, copy, or API design decisions.
---

## Boundaries

Claude owns task scoping, diff review, verification, and final reporting. Codex must not commit, push, deploy, or edit global configuration unless the user explicitly requests it.

## Workflow

1. Pin the current state with `git status --short` and note any user changes already present.
2. Define the implementation scope: files or behavior to change, files to avoid, constraints, and verification commands.
3. Keep related changes in one Codex run when they share context and acceptance criteria. Split only independent scopes or work that cannot be verified clearly as one unit.
4. Create a temporary artifact directory for Codex's report.
5. Run `codex exec` with repo write access.
6. After Codex exits, inspect `git status` and `git diff`.
7. Run proportionate verification yourself.
8. If the diff or verification exposes a bounded Codex-created problem, correct it directly or give Codex an evidence-backed follow-up, then repeat inspection and verification. Do not repeat the same failed approach.
9. Report what Codex changed, what Claude verified, and any remaining risks.

Use this command shape:

```bash
ARTIFACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/codex-implementation.XXXXXX")"
REPORT="$ARTIFACT_DIR/report.md"
PROMPT="$ARTIFACT_DIR/prompt.md"

# Write a self-contained prompt to $PROMPT, then run:
codex exec \
  -C "$PWD" \
  --add-dir "$ARTIFACT_DIR" \
  -s workspace-write \
  -o "$REPORT" \
  - < "$PROMPT"
```

Pick the model tier per the model-selection rubric in CLAUDE.md and pass it with `--model`; omit the flag to use the `~/.codex/config.toml` default.

Use `-s workspace-write` by default. Use `-s danger-full-access` only when the implementation truly needs access outside the repo, app launch automation, simulator work, package manager global state, or other machine-level operations.

## Prompt Requirements

Tell Codex:

- The exact implementation goal and acceptance criteria.
- The repo path and current branch context if relevant.
- Which existing patterns, files, or tests to inspect first.
- Files or behavior that must not be changed.
- That it must preserve unrelated user changes.
- That it must not commit, push, deploy, or edit global config.
- Which verification commands to run, or to explain why they were skipped.
- To write a concise final report with files changed, verification, and unresolved questions.

Keep each Codex run coherent. Let Codex complete related implementation work end to end; split independent scopes when doing so improves isolation or verification. Ask the user only when choosing a boundary would change the requested outcome.

## Example Prompt

```text
You are implementing a scoped change for Claude.

Repository: /absolute/path/to/repo
Artifact directory: /tmp/codex-implementation.xxxxxx

Goal:
- Add keyboard navigation to the command palette.

Acceptance criteria:
- ArrowUp and ArrowDown move the highlighted item.
- Enter selects the highlighted item.
- Escape closes the palette.
- Existing mouse behavior keeps working.

Constraints:
- Preserve unrelated user changes.
- Do not commit, push, deploy, or edit global config.
- Follow existing component and test patterns.

Verification:
- Run the focused component tests if available.
- Otherwise run the nearest relevant typecheck or test command and explain the choice.

Report:
- Files changed
- Behavioral summary
- Verification run and result
- Anything blocked or uncertain
```

## Review After Codex

Always inspect Codex's diff before telling the user the work is done. When a bounded defect or failed check is attributable to Codex's changes, correct it directly or provide a follow-up containing the new evidence, then rerun the relevant verification. Continue while each iteration makes progress; stop when the same failure recurs, requirements are ambiguous, required access or dependencies are unavailable, or Codex changes cannot be separated safely from user work.

Revert only Codex-created mistakes when you are sure they are not user changes. Remove unrelated Codex changes and continue when they can be separated safely; otherwise stop and report the diff summary.

If `codex` is not installed or fails to start, implement the change directly when it remains in scope. Report a blocker only when direct implementation is not viable.

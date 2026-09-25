---
name: codex-review
description: >-
  Use when an implementation plan or repository change needs review or
  cross-checking, or when a deep investigation cannot be settled by reading
  the code. Do not use for a mechanical change already covered by a
  deterministic check.
---

The review must have a target: uncommitted changes, a base, a commit, or a named plan. Report findings. Do not edit files in the review.

Set `MODEL` for the situation, then pass `--model "$MODEL"` as in the command below. Every review run uses `xhigh` reasoning effort.

- Code review or cross-checking: `gpt-6-sol`
- A plan or architecture document that needs a full-system view: `gpt-6-astra`
- A deep investigation that reading the code cannot settle, within a bounded problem: `gpt-6-sol`
- A deep investigation that has to hold a whole-system view: `gpt-6-astra`

## Workflow

1. Identify the review target and the model that produced it.
2. Assign the review role:
   - For non-Codex-authored work, Codex is the primary reviewer unless the caller explicitly assigns it an additional-review role.
   - For Codex-authored work, Claude is the primary reviewer of requirements, behavior, architecture, security, and failure modes. Treat Codex's review as supplemental; deterministic verification may still be delegated to Codex through the relevant workflow.
3. Choose exactly one review input: a built-in target (`--uncommitted`, `--base`, or `--commit`) or custom instructions that identify the target.
4. Create a temporary artifact directory for the Codex report.
5. Run `codex review` with the selected input and the `MODEL` chosen above.
6. Read Codex's report and verify important claims against the code before presenting them.

Use one of these command shapes:

```bash
ARTIFACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/codex-review.XXXXXX")"
REPORT="$ARTIFACT_DIR/report.md"
PROMPT="$ARTIFACT_DIR/prompt.md"
MODEL="gpt-6-sol"
SHA="<commit-sha>"

# Built-in targets: choose one and do not also pass a custom prompt.
codex -C "$PWD" --model "$MODEL" -c model_reasoning_effort=xhigh review --uncommitted > "$REPORT"

codex -C "$PWD" --model "$MODEL" -c model_reasoning_effort=xhigh review --base main > "$REPORT"

codex -C "$PWD" --model "$MODEL" -c model_reasoning_effort=xhigh review --commit "$SHA" > "$REPORT"

# Custom instructions: identify the target in $PROMPT and omit target flags.
codex -C "$PWD" --model "$MODEL" -c model_reasoning_effort=xhigh review - < "$PROMPT" > "$REPORT"
```

Keep `--model` and `-c model_reasoning_effort=xhigh` before the `review` subcommand.

## Custom Review Prompt

Use a custom prompt only when a built-in target review is insufficient. The prompt must identify what to review because custom instructions cannot be combined with `--uncommitted`, `--base`, or `--commit`.

```text
Review the specified changes for concrete bugs, regressions, security issues, requirement mismatches, and missing coverage only when it leaves a concrete failure undetected.

Report only actionable findings; omit style preferences, nits, and speculative risks without a concrete failure mode. For each finding include:
- severity
- file and line reference
- concrete failure mode
- suggested fix direction

Do not edit files. If there are no substantive findings, say so and name only residual risks or test gaps tied to concrete behavior.
```

Add task-specific context when useful: requirements, risky areas, expected behavior, relevant tests, or files Claude is unsure about.

## Reporting Back

Before relaying a Codex finding, inspect the cited code or diff enough to decide whether the finding is real. In the user-facing response, separate confirmed issues from Codex suggestions you did not verify.

If Codex finds nothing, say that clearly and mention what review target it inspected.

If `codex` is not installed or the command fails, review the changes directly when practical. Report a blocker only when no viable review route remains.

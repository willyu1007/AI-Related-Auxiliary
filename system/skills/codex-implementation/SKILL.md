---
name: codex-implementation
description: >-
  Use when a repository change involves a substantial amount of code editing,
  finding or fixing a bug, or checking work against a known specification.
---

DO NOT USE WHEN:

- The work is exploratory: the outcome, approach, or scope is still being found.
- The work is routine implementation that moves an already chosen task forward, and it is not a specified change, a bounded bug, or a check against an existing specification.
- The work is visual, or it runs from planning through a first prototype.

Otherwise hand the writing to the Codex model that fits:

- A clear specification applied across many sites: `gpt-6-luna`
- A specified implementation whose instructions and goal are already explicit: `gpt-6-sol`
- Finding or fixing a bug within a bounded problem: `gpt-6-sol`
- Checking work against an existing specification: `gpt-6-sol`

## Boundaries

Claude owns task scoping, diff review, verification, and final reporting. Codex must not commit, push, deploy, or edit global configuration unless the user explicitly requests it.

## Workflow

1. Pin the current state with `git status --short` and note any user changes already present.
2. Define the implementation scope: files or behavior to change, files to avoid, constraints, and verification commands.
3. Keep related changes in one Codex run when they share context and acceptance criteria. Split only independent scopes or work that cannot be verified clearly as one unit.
4. Create a temporary artifact directory for Codex's report.
5. Run `codex exec` with repo write access.
6. After Codex exits, run the review loop below.
7. Report what Codex changed, what Claude verified, and any remaining risks.

Use this command shape:

```bash
ARTIFACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/codex-implementation.XXXXXX")"
REPORT="$ARTIFACT_DIR/report.md"
PROMPT="$ARTIFACT_DIR/prompt.md"
MODEL="gpt-6-sol"

# Write a self-contained prompt to $PROMPT, then run:
codex -C "$PWD" --model "$MODEL" -c model_reasoning_effort=xhigh exec \
  --add-dir "$ARTIFACT_DIR" \
  -s workspace-write \
  -o "$REPORT" \
  - < "$PROMPT"
```

Set `MODEL` from the situation at the top, then pass `--model "$MODEL"` as in the command above. Every implementation run uses `xhigh` reasoning effort.

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

Always inspect `git status` and Codex's diff before telling the user the work is done, and run proportionate verification yourself. When a bounded defect or failed check is attributable to Codex's changes, correct it directly or provide a follow-up containing the new evidence, then rerun the relevant verification. Continue while each iteration makes progress; stop when the same failure recurs, requirements are ambiguous, required access or dependencies are unavailable, or Codex changes cannot be separated safely from user work.

Revert only Codex-created mistakes when you are sure they are not user changes. Remove unrelated Codex changes and continue when they can be separated safely; otherwise stop and report the diff summary.

If `codex` is not installed or fails to start, implement the change directly when it remains in scope. Report a blocker only when direct implementation is not viable.

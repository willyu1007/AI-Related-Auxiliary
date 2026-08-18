---
name: codex-computer-use
description: >-
  Use when completing or verifying work requires GUI control, screenshots,
  simulator interaction, or live application state that code inspection and
  shell commands alone cannot provide.
---

## Boundaries

Launch apps, simulators, or browsers without asking when needed for the requested verification. Ask first only when the run would disrupt the user's environment, such as closing apps, changing system settings, or acting on real accounts or data.

## Workflow

1. Select a git-ignored artifact directory. Prefer the repository's `.ai/.tmp/`; otherwise use an existing ignored temporary directory.
2. Give Codex a self-contained prompt with the repo path, exact flow, constraints, artifact directory, and report format.
3. Run `codex exec` non-interactively.
4. Read Codex's report, inspect or reference screenshot paths, and summarize the result for the user.

Use this command shape:

```bash
# Use this per-repo location only when .ai/.tmp is git-ignored.
TMP_ROOT="$PWD/.ai/.tmp"
mkdir -p "$TMP_ROOT"
ARTIFACT_DIR="$(mktemp -d "$TMP_ROOT/codex-computer-use.XXXXXX")"
REPORT="$ARTIFACT_DIR/report.md"
PROMPT="$ARTIFACT_DIR/prompt.md"

# Write a self-contained prompt to $PROMPT, then run:
codex exec \
  -C "$PWD" \
  --add-dir "$ARTIFACT_DIR" \
  -s danger-full-access \
  -o "$REPORT" \
  - < "$PROMPT"
```

Pick the model tier per the model-selection rubric in CLAUDE.md and pass it with `--model`; UI verification rarely needs the top tier.

Use `-s danger-full-access` only when GUI automation, simulators, desktop app launching, screenshots, or other host access requires it and the environment is controlled. Otherwise prefer `-s workspace-write`. Add `--skip-git-repo-check` when the working directory is not a git repository.

Ensure `.ai/.tmp/` is git-ignored before running Codex. If it is not, use an existing ignored temporary directory rather than modifying tracked files solely for the handoff.

## Prompt Requirements

Tell Codex:

- The exact behavior to verify.
- The platform and app type, such as iOS, web, Electron, CLI, or desktop.
- Known launch commands, test credentials, seed data, deep links, or fixtures.
- Whether source edits are allowed. Default to no edits.
- Where screenshots, logs, and the final report should be saved.
- To return pass, fail, or blocked, plus steps performed, observed behavior, screenshot paths, and actionable feedback.

Keep the prompt specific enough that Codex does not need the surrounding Claude conversation.

## Example Prompt

```text
You are verifying implemented behavior for Claude using computer use.

Repository: /absolute/path/to/repo
Artifact directory: <repo>/.ai/.tmp/codex-computer-use.xxxxxx

Behavior to verify:
- The command palette opens with Cmd+K and closes with Escape.

Platform / app type:
- Web app, launched locally.

Launch / setup:
- Start the dev server using the project's dev command (e.g. `pnpm dev` or `bun dev`).
- Do not assume a port. Read the actual URL and port from the server's startup output; the default may already be in use.
- Poll the printed URL until it responds before interacting. If the server never becomes reachable within a reasonable wait, stop and report `blocked` with the captured output.

Constraints:
- Do not edit source files.
- Do not act on real accounts or production data.

Artifacts:
- Save all screenshots and logs under the artifact directory, using absolute paths.
- List every screenshot path explicitly in the final report.
- Capture a screenshot on any failure or unexpected state before reporting.
- Write the final report to the report path.

Report:
- Overall result: pass, fail, or blocked
- Steps performed
- Observed behavior
- Screenshot paths
- Actionable feedback
```

## Reporting Back

Before relaying a Codex result, open the referenced screenshots or logs and inspect them enough to decide whether the finding is real. In the user-facing response, separate confirmed behavior from Codex claims you did not verify.

State the overall result clearly — pass, fail, or blocked — and name the behavior and platform Codex inspected. Distinguish a genuine behavior failure (`fail`) from an environment or setup problem such as a port conflict or a server that never came up (`blocked`), since the two call for different follow-ups. Surface screenshot paths so the user can look themselves.

If `codex` is not installed or the command fails, use available direct verification tooling when practical. Report a blocker only when no viable verification route remains.

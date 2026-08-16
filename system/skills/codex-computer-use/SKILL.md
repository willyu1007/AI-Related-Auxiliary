---
name: codex-computer-use
description: Ask Codex CLI (OpenAI's current coding models) to run local app verification that needs computer use: browser automation, simulators, screenshots, app launching, or independent runtime inspection. This is how OpenAI models are invoked for computer-use work. Use when the user asks Claude to test a flow, verify UI behavior, inspect a running app, capture screenshots, or report confirmation and feedback about implemented behavior that benefits from computer use functionality.
---

# Codex Computer Use

Use Codex as a separate local verification agent when the task needs real UI interaction, screenshots, simulator/browser/device state, or an independent runtime check outside Claude's current context.

Do not use this for ordinary code reading, typechecking, linting, or tests Claude can run directly. Launching apps, simulators, or browsers to verify the requested work is fine without asking; ask first only if the run could disrupt the user's environment beyond that (closing their apps, changing system settings, acting on real accounts or data).

## Workflow

1. Create the per-repo handoff directory under `.ai/.tmp/`.
2. Give Codex a self-contained prompt with the repo path, exact flow, constraints, artifact directory, and report format.
3. Run `codex exec` non-interactively.
4. Read Codex's report, inspect or reference screenshot paths, and summarize the result for the user.

Use this command shape:

```bash
# Per-repo handoff directory under .ai/.tmp; create if missing.
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
  "$(cat "$PROMPT")"
```

Pick the model tier per the model-selection rubric in CLAUDE.md and pass it with `--model`; UI verification rarely needs the top tier.

Use `-s danger-full-access` for GUI automation, iOS simulators, desktop app launching, screenshots, or access outside the repo. For non-GUI checks that only need the repo and artifact directory, prefer `-s workspace-write`. Add `--skip-git-repo-check` when the working directory is not a git repository.

Ensure `.ai/.tmp/` is git-ignored before running Codex; add it to `.gitignore` if it is not, so handoff artifacts don't show up as untracked changes.

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
- Test account: reviewer@example.com / seeded in the dev database.

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

If `codex` is not installed or the command fails, report the error and offer to run the verification directly instead.

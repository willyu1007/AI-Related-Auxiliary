---
name: wizard
description: Use when a setup, migration, or cutover contains an ordered sequence of actions that only the user can perform because they require private access, secret custody, MFA, a physical device, or another user-bound capability.
---

# Wizard

Complete everything the agent can perform directly. Use a wizard only for the remaining steps that require the user, plus the minimum automation needed to carry their results into the surrounding workflow.

A wizard is an interactive Bash script. Treat it as a temporary handoff artifact unless the user wants a repeatable setup path kept in the project.

## Isolate the human boundary

Inspect the project and target workflow before asking for information.

A step belongs in the wizard only when it requires something unavailable to the agent, such as:

- the user's private account or session;
- a secret the user should enter without exposing it in chat;
- MFA, a physical device, or another user-bound action.

Difficulty, repetition, an unfamiliar dashboard, or a long command sequence do not create a human boundary. Do not hand the user work the agent can perform.

For each remaining step, identify the user action, required input, resulting output, destination, sensitivity, and the point where the agent can resume. Confirm the stage plan only when ambiguity would materially change it or an irreversible action is involved.

## Author the wizard

Verify current dashboard paths and commands from reliable context; ask when they cannot be established rather than inventing them.

Copy [template.sh](template.sh) to the target path. Keep the library above the `STAGES` marker unchanged, replace the example below it, and set `TOTAL_STAGES` correctly.

- Use one focused `stage` per user-only outcome, in dependency order.
- Open the relevant destination before giving precise instructions or requesting a value.
- Use `ask_secret` for secrets and keep them out of chat and visible output.
- Persist captured values where the project actually consumes them. Use `set_secret` or `set_var` only for names the project's CI expects.
- Before a secret is written to a file, confirm the destination is ignored by version control; otherwise write it to the project's secret store or stop and tell the user.
- Use `confirm` immediately before an irreversible user action.

## Verify and hand off

- Run `bash -n <script>` and `shellcheck` when available, then make the script executable.
- Trace every captured value to its intended destination and verify external names against project configuration.
- Do not run the wizard end to end; it depends on user access and input.
- Tell the user how to run it and what the agent can continue once it finishes.

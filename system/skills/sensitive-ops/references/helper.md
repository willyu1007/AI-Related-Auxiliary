# Shell Helper Workflow

Read this reference only after the user explicitly requests a script, `.sh` file, interactive helper, or guided shell workflow.

## Author the helper

Resolve the effective operations document first: use the user-supplied private document when present, otherwise use `~/Documents/LLM/sensitive-ops.md`.

1. Add one stable workflow marker such as `<!-- sensitive-ops:cloudflare-setup -->` and one unique placeholder per durable outcome to that document.
2. Copy [template.sh](../template.sh) to a temporary path outside the repository. Keep its library above the `STAGES` marker unchanged and replace the fail-closed scaffold below it.
3. Register the title, workflow marker, and every placeholder once with `configure_workflow`, then call `prepare_workflow` before presenting stages.

Keep the registered outcome order stable. The template derives one completion marker per outcome and writes it with the durable value; never hand-author or remove those markers. A valid outcome contains exactly its pending placeholder or its completion marker.

- Use one focused stage per outcome, in dependency order.
- Use hidden input for durable secrets and visible input for non-secret values.
- Open the relevant destination before asking the user to act there.
- Record only the durable result of MFA, OAuth, physical-device, or authenticated UI actions; never record one-time codes, temporary tokens, sessions, or other transient proof.
- Confirm immediately before an irreversible user action.
- Allow `:later` and Ctrl-C. Preserve completed outcomes in the document and skip them when the helper is rerun.

## Validate and hand off

Run `bash -n <helper>` and `shellcheck` when available, then make the helper executable. Do not run it end to end because it depends on the user's access and input.

The helper revalidates the effective document at startup and before every write. It rejects relative paths, symbolic links, files not owned by the current user, group/other permissions, and Git-tracked files. Git is required to verify that the document is untracked; if Git is unavailable, the helper exits `1` and the workflow falls back to the document path. Do not weaken or bypass those checks.

Return absolute clickable links to both the helper and the operations document. Give the exact, shell-safe command the user should run:

- For the default document: `'/absolute/path/to/helper.sh'`
- For a user-supplied document: `SENSITIVE_OPS_FILE='/absolute/path/to/custom.md' '/absolute/path/to/helper.sh'`

Shell-quote both paths for the user's shell. Never place a sensitive value in the command or its arguments.

Explain what the agent can continue after completion and how to resume with the same command:

- Exit `0`: all tracked outcomes are complete; the agent can reread the document and continue the blocked workflow.
- Exit `2`: progress was saved after `:later`, Ctrl-C, or a deferred user action; rerun the same command.
- Exit `1`: setup, validation, or persistence failed; keep completed results and return to the document workflow with remaining placeholders visible.

After a successful run has been consumed and the agent has resumed, delete the temporary helper. Keep it only when the user explicitly asks for a repeatable setup path.

---
name: project-status
description: Progress questions spanning tasks, answered without writing anything. Use for "what is in flight", "what is blocked", "how far along are we", "what should I do next".
---

# Project Status

Answer the question from what is written down, and make the answer actionable.

Read-only is the point of this skill, not a limitation. Scope is the portfolio: several tasks at once, the shape of the whole. A question about one specific task the user intends to continue is a different job — that one rebuilds the task's context rather than summarizing it.

## Response templates

Pick by what was asked, then follow that reference's **Data Source** commands:

| Question | Reference |
|----------|-----------|
| What tasks exist? | [reference/task-list.md](reference/task-list.md) |
| How far along are we? | [reference/progress-summary.md](reference/progress-summary.md) |
| What should I do next? | [reference/next-action.md](reference/next-action.md) |
| What is blocked? | [reference/blocked-items.md](reference/blocked-items.md) |
| What is the current focus? | [reference/semantic-focus.md](reference/semantic-focus.md) |

## Workflow

1. **Classify the question** and open the matching reference.

2. **Gather from the hub.** Run the reference's data-source commands — usually
   `ctl-project-governance.mjs query` with a `--status` or `--text` filter. Never guess task details; open `00-overview.md` when the query output is not enough. Without a hub, scan `dev-docs/**/active/*/00-overview.md` for `State:` directly.

3. **Check consistency, do not fix it.** `lint --check` reveals drift between the registry and the task bundles. When lint reports errors, include `sync --apply` in the output as a suggested remediation and leave the running to the user.

4. **Ground claims about active work.** For any `in-progress` or `blocked` task, run:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs resume --task <T-###> --json
   ```

   Report the commit timeline, worktree warnings, and any disagreement between the packet and the documented status. An empty timeline means progress is unknown, not zero. Without the script, ground the same claim with `git log --grep="^Task: T-###"` directly.

5. **For semantic questions**, quote the `Semantic Feature Briefs` section of `.ai/project/feature-map.md`. `dashboard.md` supplies the focus index only, never the semantic body.

6. **Answer from the template**, ending with at least one command the user can run.

## Rules

- Never modify files. No `sync --apply`, no edits under `dev-docs/**` or `.ai/project/**`.
- Never invent a task detail, a blocker reason, or a semantic intent. Undocumented means `unknown`.
- Never present a claim about landed work the `resume` packet does not support; state the gap.
- Status counts in the answer must match the query output they came from.

## Contract

Hub sources of truth: `.ai/project/CONTRACT.md`. Task status semantics: `dev-docs/AGENTS.md`.

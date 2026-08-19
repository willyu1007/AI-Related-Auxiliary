---
name: project-status
description: >-
  Use for read-only questions spanning tracked tasks: what exists, what is in
  flight or blocked, how far work has progressed, what should happen next,
  which tasks appear archive-ready, or whether the project hub has drifted.
---

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
| Which tasks appear ready to archive? | [reference/archive-readiness.md](reference/archive-readiness.md) |
| Is the project hub consistent? | [reference/hub-drift.md](reference/hub-drift.md) |

## Workflow

1. **Classify the question.** Read `dev-docs/README.md` for task semantics, then open the matching reference.

2. **Gather from task bundles across linked worktrees.** Run the reference's data-source commands — usually
   `ctl-project-governance.mjs query --all-worktrees` with a `--status` or `--text` filter. Never guess task details; open the returned `status_doc_path` when the query output is not enough.

3. **Check consistency, do not fix it.** `lint --check` reveals drift between the registry and the task bundles. Report the drift and the appropriate maintenance action; do not run write-mode repair.

4. **Ground claims about active work.** For any `in-progress` or `blocked` task, run:

   ```bash
   node .ai/scripts/ctl-project-governance.mjs resume --repo-root <worktree_path> --task <T-###> --json
   ```

   Report the commit timeline, worktree warnings, and any disagreement between the packet and the documented status. An empty timeline means progress is unknown, not zero; `git log --grep="^Task: T-###"` is the same evidence without the packet around it.

5. **For semantic questions**, quote the `Semantic Feature Briefs` section of `.ai/project/feature-map.md`. `dashboard.md` supplies the focus index only, never the semantic body.

6. **Answer from the template.** When the reference is archive readiness, treat `State: done` as a claim and report the first missing gate rather than changing anything. End with at least one command the user can run.

## Rules

- Never modify files. No `sync --apply`, no edits under `dev-docs/**` or `.ai/project/**`.
- Never invent a task detail, a blocker reason, or a semantic intent. Undocumented means `unknown`.
- Never present a claim about landed work the `resume` packet does not support; state the gap.
- Status counts in the answer must match the query output they came from.

## Authority

Hub semantics follow `.ai/project/AGENTS.md`. Active task progress is `01-status.md` `## Progress` → `State:`; archive location owns archived state. Registry task status is a derived projection.

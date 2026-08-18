---
name: manage-ideas
description: Keep a ledger of deferred ideas — "worth doing, not now" — at .ai/project/ideas/ideas.yaml. Use when the user wants to record an idea for later, park a feature or improvement that is out of scope right now, update or drop a recorded idea, or list and re-evaluate what has been parked and decide what is worth starting. Also use when a valuable idea surfaces mid-task and the user says later or not now. Not for tracking active work.
---

# Manage Ideas

Ideas that are worth doing but not now die in chat scrollback. The ledger is their memory: one file, one entry per idea, carrying enough context that a later session — or a later you — can judge it without re-deriving the reasoning.

## Ledger location

`.ai/project/ideas/ideas.yaml` in the target repository. Materialize only when absent — `-n` keeps a re-run from flattening an existing ledger:

```bash
mkdir -p .ai/project/ideas && cp -n <this-skill>/assets/ideas/.ai/project/ideas/ideas.yaml .ai/project/ideas/ideas.yaml
```

`<this-skill>` is the directory holding this `SKILL.md`.

## Schema

```yaml
version: 1
ideas:
  - id: I-001                      # I-###, unique, immutable, highest + 1
    title: CSV export for reports
    status: deferred               # deferred | promoted | implemented | dropped
    summary: >-                    # 1-3 sentences: what, and why it is worth keeping
      Reports are copied into spreadsheets by hand today; a CSV endpoint removes that.
    why_not_now: Blocked by the reporting rewrite.   # optional
    trigger: Reporting v2 lands.                     # optional: what would make it timely
    review_after: "2026-09-01"                       # optional: re-evaluate after this date
    tags: [reporting]                                # optional
    linked_tasks: [T-012]                            # optional: related T-### ids
    created: "2026-08-18"
    updated: "2026-08-18"
```

Required: `id`, `title`, `status`, `summary`, `created`, `updated`. Everything else is optional and may be omitted entirely.

Statuses: `deferred` (parked, the default), `promoted` (selected to become real work), `implemented` (delivered), `dropped` (no longer worth doing — the reason goes into `summary`). **Staleness is not a status**: an idea with `review_after` in the past needs review, and the date field already says so.

## Capture

The capture moment is usually mid-task — something valuable surfaces and the user says later or not now. Capture is a thirty-second detour, never a derailment:

1. Write the entry with the required fields plus whatever context is already in hand (`why_not_now`, `trigger` cost nothing to fill now and everything to reconstruct later).
2. Allocate the next `I-###`: highest existing id + 1.
3. Confirm the id in one line and return to the interrupted work.

Fill optional fields from what was actually said or is visibly true — **blank beats invented**. One quick follow-up question is fine when the answer is on the tip of the conversation; a questionnaire is not. Ask beyond that only when the summary would otherwise be too thin to judge later.

## Review

When the user asks what is parked, what is worth starting, or whether the ledger is still valid:

1. Read the ledger; filter by whatever the user scoped (status, tag, date).
2. Flag **needs review**: `review_after` in the past.
3. Flag **promotion candidates**: `trigger` matches what is now true — the blocking work landed, the assumption changed.
4. Flag **drop candidates**: the assumption in `summary` or `why_not_now` no longer holds.
5. Answer as a table — `id`, `title`, `status`, one-line recommendation — and treat every recommendation as a suggestion. **No signal is a valid verdict**: when the repository offers no evidence for or against a trigger or assumption, say so instead of forcing a call. Persist a change only when the user says so.

Promoting an idea means it leaves the ledger's custody: open tracked work for it, record the task id in `linked_tasks`, set `status: promoted`. The ledger keeps the pointer, the task record takes over the work.

## Rules

- Never hard-delete an entry; `dropped` with the reason is the terminal state.
- Never reuse or renumber an `I-###`.
- One ledger; never maintain a parallel idea list in chat, docs, or another file.
- Never mark `implemented` by inferring from code alone — say what evidence supports it.
- Never let capture derail the task in progress: record, confirm, return.
- Update `updated` (entry-level) on every change; keep field names and enums stable.
- No secrets in the ledger.

## Verification

After any write: the YAML parses, ids are unique, and every entry carries the six required fields.

## Assets

| Path | Role |
|------|------|
| `assets/ideas/.ai/project/ideas/ideas.yaml` | Empty ledger with schema comments, laid out as it lands in a repository |

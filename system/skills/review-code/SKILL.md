---
name: review-code
description: >-
  Review code changes yourself and produce a prioritized, actionable report.
  Use when the user asks to review a diff, PR, commit, uncommitted work, or an
  implementation for correctness, security, performance, architecture boundaries,
  maintainability, or missing verification. Model-agnostic: the current agent
  (Claude or Codex) reads the change and reports. Not for delegating review to a
  separate CLI second opinion, not for task-hub drift checks, and not for fixing
  TypeScript or runtime errors unless the user also asks for fixes.
---

# Review Code

Perform a structured review of **already written** code changes. The current agent is the reviewer. Claude and Codex can both use this skill; install it wherever that agent loads skills.

This is the default self-review path. When the user explicitly wants an independent second-pass review via another model's CLI, use that delegated review workflow instead of this skill.

## When to use

- Feature or bugfix is implemented and needs review before merge
- A refactor changed module boundaries or public contracts
- The user asks for a code review, PR review, or risk assessment of a diff
- Preparing release notes around what still blocks merge

## When not to use

- Delegating review to another agent/CLI for a second opinion
- Project-hub / task-record lint (governance drift is a different concern)
- Primary work is fixing compile errors or frontend crashes (review may follow)
- Only aligning task docs with the repository

## Review target

Identify what to review before reading files:

| Target | How to obtain |
|--------|----------------|
| Uncommitted work | `git status` + `git diff` / `git diff --cached` (+ untracked as needed) |
| Branch vs base | `git diff <base>...HEAD` (confirm base with the user if unclear) |
| Single commit | `git show <sha>` or `git diff <sha>^!<sha>` |
| Named paths / PR checkout | User-specified paths or the checked-out PR |

State the target in the report summary. Do not claim a full review of files you did not inspect.

## Workflow

1. **Restate intent** — what problem the change solves, blast radius, and any NFR (auth, multi-tenant, perf, compatibility).
2. **Optional author self-check** (when reviewing your own just-written work) — see `./reference/feedback-standards.md`. Skip rubber-stamp self-approval.
3. **Review top-down** using the rubric below: contracts and boundaries first, then implementation detail.
4. **Classify findings** as must fix / should fix / may fix. Every must-fix item needs evidence, why it matters, a proposed fix direction, and a verification action.
5. **Emit the report** using `./templates/review-report.template.md` (checklist: `./templates/review-checklist.md`). Prefer the conversation as the channel unless the user asks to write a file.
6. **Soft handoff to task docs** — if `dev-docs/active/<slug>/04-verification.md` exists and the review named concrete checks, offer to record them on the next sync; do not invent a task solely to store a review.

## Rubric

Apply what fits the change. Do not force backend layering language onto a frontend-only or script-only diff.

### 1. Boundaries and structure

- Responsibilities stay coherent (UI vs data, route vs domain vs persistence, etc.)
- Dependency direction matches project conventions
- Abstractions are justified (not premature, not leaky)

### 2. Contracts and API surface

- Inputs/outputs are explicit and stable where they cross a boundary
- Error shapes are consistent with existing clients
- Public exports stay minimal and intentional

### 3. Correctness and error handling

- Behavior matches the stated intent; edge cases and failure modes are considered
- Errors are mapped consistently; unknown failures are observable
- Retries / idempotency where the domain requires them

### 4. Security and privacy

- AuthZ/AuthN checks sit in the right place and match the threat model
- Secrets and PII are not logged or exposed to clients
- No unsafe sinks (injection, unsanitized HTML, `eval`, etc.) without justification

### 5. Performance

- Obvious N+1, unbounded lists, or hot-path blocking work
- Caching/invalidation coherent when present
- Expensive paths at least bounded

### 6. Testing and verification

- Critical business rules have automated coverage where feasible
- New endpoints/flows have a realistic verification path
- Tests look deterministic and maintainable

### 7. Maintainability

- Naming and module shape aid the next reader
- Duplication vs reuse is intentional
- Non-obvious decisions are documented lightly

## Severity

Align with `./reference/feedback-standards.md`:

| Report section | Meaning |
|----------------|---------|
| Must fix | Blocking — merge/ship only after resolution or explicit risk acceptance |
| Should fix | Important — default to fix in the same change unless deferred with rationale |
| May fix | Optional — author decides; do not block solely on these |

In inline comments (PR style), prefixes `[blocker]`, `[suggestion]`, `[question]`, `[nit]` remain useful. Map blockers → must fix; most suggestions → should/may fix.

## Boundaries

- Do not approve or LGTM without reading and understanding the change
- Do not skip security review when auth, permissions, crypto, or privacy touch the diff
- Do not leave vague feedback; every finding needs an actionable next step
- Do not block on personal style that is not a project or team standard
- Do not edit files unless the user also asks you to implement fixes
- Do not treat another agent's review output as authority without verifying claims
- Prefer correctness and risk over cosmetics

## Assets

| Path | Role |
|------|------|
| `templates/review-report.template.md` | Report skeleton |
| `templates/review-checklist.md` | Short severity checklist |
| `examples/sample-review-report.md` | Worked example |
| `reference/feedback-standards.md` | Feedback quality, severity prefixes, author self-check |

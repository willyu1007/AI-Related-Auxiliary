# Upstream Skills Integration

This document records the capabilities from
[`mattpocock/skills`](https://github.com/mattpocock/skills/tree/main/skills)
that should be merged into this repository's existing workflows or considered
as new skills. It intentionally omits rejected and already-covered skills.

## Added skills

### `research`

Added a standalone research skill rather than coupling general information
discovery to task planning. It combines upstream `research` source discipline
with the question framing, recency boundaries, evidence mapping, and conflict
handling from `perform-web-research` in `Template-Skill-Addon`.

- Scale effort to the question: answer a bounded lookup directly and use the
  fuller evidence workflow for multi-source, current, conflicting, or
  source-attributed investigation.
- Prefer sources that own the answer, use the minimum sufficient evidence, and
  distinguish facts, inferences, conflicts, and unresolved uncertainty.
- Return a cited answer in the conversation by default. Do not require a
  background agent, evidence table, fixed source count, or repository artifact.
- When delegated, return a compact evidence packet while leaving downstream
  decisions and repository updates to the receiving agent.

## Merge into existing skills

### `task-plan` and `goal-mode`: executable migration shape

Implemented in `task-plan` without adopting the issue and ticket hierarchy from
`to-tickets`; `goal-mode` remains the orchestration pointer.

- Prefer roadmap phases that produce an independently demonstrable or decisive
  vertical result.
- For a wide migration that cannot remain useful as ordinary vertical slices,
  represent `expand -> migrate in bounded batches -> contract` as explicit
  checkpoints.
- Keep each migration batch recoverable and verifiable. Completion requires the
  contract checkpoint to remove the superseded path and its unsupported dual
  track.
- Keep this work in one task unless it genuinely needs an independent outcome,
  state, owner, handoff, verification lifecycle, worktree, or managed interface.

### `task-handoff`: sensitive-information boundary

Add an explicit requirement to redact credentials, tokens, personal data, and
other sensitive evidence from the handoff block. Continue to reference durable
task records, commits, and diffs instead of duplicating them into the handoff.

### `review-code`: VCS comparison authority

For a VCS change-set review, make the comparison basis explicit and reliable:

- resolve and disclose the commit, range, base, or merge base used to construct
  the reviewed diff;
- identify the user instruction, task bundle, requirement, issue, or other
  accepted source that owns the intended behavior;
- treat uncertainty in either authority as a coverage limitation rather than
  silently selecting a convenient baseline or intent.

## Add new skills

### `write-agent-docs`

Add a compact authoring skill for skills, `AGENTS.md`, `CLAUDE.md`, and reusable
prompt files. It should complement `manage-llm-config`: the existing skill owns
runtime placement and consumption, while this skill owns the clarity and
structure of instructions read by an agent.

The skill should define only the non-obvious authoring contract:

- context pointers state when and why another resource must be read;
- steps, direct references, and conditional references are separated so the
  default context contains only what the task needs;
- progressive disclosure follows real workflow branches rather than document
  size alone;
- completion conditions are observable and cover the whole requested outcome;
- environment and repository evidence outrank duplicated prose declarations;
- repeated rules, no-op instructions, obsolete explanations, and competing
  authorities are removed rather than accumulated.

Suggested trigger:

> Use when creating or revising skills, AGENTS.md, CLAUDE.md, or reusable prompt
> files that direct agent behavior.

### `resolve-vcs-conflicts`

Add a thin workflow contract for conflicts produced by merge, rebase, or
cherry-pick operations.

- Recover both sides' intent from the operation, commits, task records,
  requirements, and affected callers.
- Preserve compatible intent from both sides; request a decision when the
  intended behaviors materially conflict.
- Do not select a side by recency or introduce behavior required by neither
  side.
- Verify the resolved behavior and return control to the interrupted roadmap
  phase.
- Treat aborting, continuing, staging, and committing as separate actions
  governed by the user's authorization and the repository state.

This skill should be added when VCS conflict recovery is a recurring workflow;
it does not need to block the higher-value merges above.

## Remaining implementation order

1. Add the handoff redaction and VCS review-baseline contracts.
2. Design and validate `write-agent-docs`.
3. Add `resolve-vcs-conflicts` when observed usage justifies the dedicated
   workflow.

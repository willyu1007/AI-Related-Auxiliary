---
name: agent-council
description: >-
  Use when a complex, multi-surface, or high-risk task benefits from an explicit
  multi-agent council with distinct model roles, frozen interfaces, parallel
  disjoint execution, independent adversarial review, and strict coordinator
  governance. Do not use for single-pass edits or mechanical changes already
  covered by deterministic checks.
---

# Agent Council

You are the **Coordinator**. If you received a member brief instead, execute only
your assigned brief and skip this file.

Convene a council only when breadth, parallel file tracks, or cross-model
adversarial review materially reduces risk. Keep ordinary tasks single-agent.

## 1. Council Roster and Invocation

Assign roles by capability and independence. Use a different model family or a
fresh, unframed context for adversarial review whenever available.

| Role | Responsibility | Default model | Built-in invocation |
|---|---|---|---|
| **Coordinator** | Scope & user alignment, pre-flight environment health, charter & frozen interfaces, file partitioning, triage, deterministic verification, commits, and final report | Current host model (Claude / Gemini) | Current session |
| **Architect & Plan Reviewer** | Whole-system plan audit against real code before writes start; checks hidden coupling, invariants, rollback, and missed consumers | `gpt-6.2-astra` (`xhigh`) | Codex CLI (`exec -s read-only`) |
| **Parallel Implementers** | Bounded edits inside strictly disjoint owned files, returning diff summary and local verification | Host model or `gpt-6.2-sol` / `gpt-6-luna` (`xhigh`) | Host subagent tool (Antigravity `invoke_subagent` `TypeName: "self"` / `send_message`, or Claude/Cursor subagent) or Codex CLI (`exec -s workspace-write`) |
| **Code Reviewer** | Blind post-implementation audit for concrete bugs, regressions, auth/privacy breaks, and requirement mismatches | `gpt-6.2-sol` (`xhigh`), or `gpt-6.2-astra` (`xhigh`) when full-system audit is requested | Codex CLI (`review --uncommitted` / `--base` / `--commit` / custom prompt) |
| **Investigator / Verifier** (optional) | Read-only codebase mapping, runtime/UI capture, or live browser/simulator checks | Host model (or `flash` for browser automation) | Host read-only / browser subagent or focused verification runner |

### Built-in invocation shapes

**GPT models via Codex CLI** — resolve a binary that supports the requested model
before dispatch (check `codex` on `PATH`; on macOS, if the `PATH` binary rejects
`gpt-6.2-*` with `model_not_found`, check the ChatGPT desktop app bundle
`/Applications/ChatGPT.app/Contents/Resources/codex-cli/CodexCLI.app/Contents/MacOS/codex`).
Always place `--model` and `-c model_reasoning_effort=xhigh` before the
subcommand, and keep prompt/report files in a scratch directory:

```bash
ARTIFACT_DIR="$(mktemp -d "${TMPDIR:-/tmp}/agent-council.XXXXXX")"
PROMPT="$ARTIFACT_DIR/prompt.md"
REPORT="$ARTIFACT_DIR/report.md"

# Plan review or whole-system read-only audit (gpt-6.2-astra):
"$CODEX_BIN" -C "$PWD" --model gpt-6.2-astra -c model_reasoning_effort=xhigh \
  exec -s read-only - < "$PROMPT" > "$REPORT" 2>&1

# Code review on uncommitted diff (gpt-6.2-sol or gpt-6.2-astra):
"$CODEX_BIN" -C "$PWD" --model gpt-6.2-sol -c model_reasoning_effort=xhigh \
  review --uncommitted > "$REPORT" 2>&1

# Bounded specified implementation (gpt-6.2-sol or gpt-6-luna):
"$CODEX_BIN" -C "$PWD" --model gpt-6.2-sol -c model_reasoning_effort=xhigh \
  exec --add-dir "$ARTIFACT_DIR" -s workspace-write -o "$REPORT" - < "$PROMPT"
```

**Gemini / Claude via Antigravity or host tools** — dispatch parallel tracks with
`invoke_subagent` (`TypeName: "self"`, `Model: "inherit"` unless the user names
another model) and continue existing workers via `send_message`; pass
`Model: "flash"` for browser verification subagents. Use native `swarm` only when
the user explicitly invokes `/swarm` or a swarm is already active.

**Fallback rule** — if a CLI, model, or subagent tool is unavailable, report the
gap transparently and fall back to direct execution or the strongest remaining
independent reviewer. Never silently downgrade a user-specified model and never
claim an unavailable member participated.

## 2. Charter: Goals, Rules, and Boundaries

Freeze a concise **Council Charter** (in scratch or the active task plan) before
any write member starts:

1. **Goal & Done-When** — exact user-approved outcome, acceptance criteria, and
   explicit non-goals.
2. **Hard Invariants** — architecture boundaries, auth/privacy rules, backwards
   compatibility or rollout gates, brand/UI rules, and repository checks that no
   member may relax.
3. **Frozen Interfaces** — shared types, route/API shapes, store actions,
   props, and `testID`s agreed up front. Coordinator or one designated owner
   lands shared contract changes before parallel tracks depend on them.
4. **Disjoint Ownership Table** — map every track to exact owned paths and
   explicitly forbidden paths. Two concurrent writers must never edit the same
   file or contend on the same build output, simulator, or test database.
5. **Mutation & Escalation Boundary** — implementers never commit, push, deploy,
   edit global config, revert unrelated user changes, or widen scope. Any
   missing product decision, cross-track interface break, or blocked invariant
   returns to Coordinator immediately.

## 3. Execution and Verification Protocol

Run the council in five bounded phases:

1. **Pre-flight & Charter (Coordinator)** — inspect `git status --short`, note
   pre-existing dirty/untracked files to preserve, verify required binaries,
   runtime ports, and base checks, then draft the Charter.
2. **Pre-Implementation Plan Review (Architect)** — send the Charter and target
   file list to the Plan Reviewer (`read-only`) to hunt for missed consumers,
   race conditions, broken invariants, or dual-track leftovers. Verify every
   finding against source code and absorb confirmed fixes into the Charter
   before dispatching writers. Pause for user alignment if a finding changes
   product behavior or scope.
3. **Disjoint Execution (Coordinator + Implementers)** — dispatch parallel
   tracks with self-contained briefs containing:
   - exact goal, acceptance criteria, and frozen interfaces;
   - owned files vs. forbidden files and unrelated dirty files to preserve;
   - hard invariants and required local checks to run;
   - prohibited actions (no commit/push/deploy/scope creep) and exact return
     format (files changed, behavioral delta, checks run, blockers).
   For tightly coupled small edits, Coordinator executes directly rather than
   creating artificial tracks.
4. **Parallel Verification & Blind Code Review** — once all tracks finish, run
   the repository's deterministic checks (typecheck, unit/integration/DB tests,
   lint, contract/lock checks) in parallel with a blind **Code Reviewer** pass
   on the real diff. Give the reviewer the target, accepted intent, and hard
   invariants only — never pass author reassurance, pre-framed conclusions, or
   write authority.
5. **Severity-Gated Convergence & Landing** — inspect every reviewer finding in
   code before acting, then triage:
   - **P0 / P1 (Must fix):** reachable defect, data/auth/privacy break,
     regression, or contract/requirement violation — mandatory fix.
   - **Concrete P2 (Should fix):** evidence-backed edge failure or missing
     guard within scope — fix in the current pass.
   - **Style / speculative nits:** drop unless user-requested.
   Cap review-fix loops at **2 rounds** by default (re-reviews check prior fixes
   and regressions). If P0/P1 findings remain or require a product/architecture
   ruling, stop and escalate to the user with concrete options. Once green,
   Coordinator commits verified revertible units (and reseals any repository
   locks in their required commit order) without pushing unless authorized.

## 4. Coordinator Responsibilities

Actively enforce four guardrails across the whole run:

- **Environment & workspace health:** verify tool versions, `PATH`, test DB /
  runtime availability, and clean file ownership before fan-out. Keep scratch
  artifacts out of the repository and preserve every unrelated user file.
- **Progress without polling:** launch independent members in parallel and rely
  on reactive wakeup when subagents or background CLI runs complete — never
  poll in sleep loops. Check actual diffs, not just worker summaries, before
  declaring a phase done.
- **Anti-drift governance:** compare every handback and review comment against
  the frozen Charter. Reject unapproved scope expansion, silent fallback paths
  that recreate dual tracks, weakened assertions, or skipped repository hooks.
- **Human decision gates & truthful reporting:** batch product or risk rulings
  with concrete options and a recommendation; never guess silently. In the final
  report, state who participated (model and role), confirmed findings resolved
  vs. rejected, exact deterministic checks run with real counts, and any
  retained exceptions or follow-ups.

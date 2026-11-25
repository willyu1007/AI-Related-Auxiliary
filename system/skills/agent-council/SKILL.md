---
name: agent-council
description: >-
  Activate only when the user explicitly calls this skill by name.
disable-model-invocation: true
---

# Agent Council

You are the **Coordinator**. If you received a member brief instead, execute only
your assigned brief and skip this file.

## 1. Roles and Dispatch

| Role | Default assignment | Dispatch |
|---|---|---|
| **Coordinator** | Current host model | Current session |
| **Plan Reviewer** | Full-system plan tier | `codex-review` |
| **Parallel Implementer** | Current host model (default for exploratory, UI, or host-context tracks); `codex-implementation` only for an explicitly specified bounded track | Host native subagent tool (never shell-spawned agents; use a swarm only if explicitly requested or already active), or `codex-implementation` |
| **Code Reviewer** | Code-review tier (full-system tier when requested) for non-Codex tracks; fresh non-Codex host reviewer for Codex-authored tracks | `codex-review` (non-Codex tracks), or fresh host subagent / Coordinator direct review (Codex-authored tracks; `codex-review` supplemental only) |

Follow `codex-review` and `codex-implementation` for all Codex CLI arguments,
model routing, and sandbox rules — do not invent parallel command shapes here.
If an external delegation skill or model is unavailable (for example, inside a
Codex host without `codex-*` skills), fall back to another available model or a
fresh unframed subagent and disclose the gap; never silently downgrade a
user-specified model or claim an unavailable member participated.

## 2. Council Charter

Freeze a concise Charter (in scratch or the active task plan) before any write
member starts:

1. **Goal & Done-When** — approved outcome, acceptance criteria, and non-goals.
2. **Hard Invariants** — architecture, auth/privacy, compatibility or rollout
   gates, UI rules, and repository checks no member may relax.
3. **Frozen Interfaces** — shared types, routes, contracts, props, and
   `testID`s. Coordinator or one designated owner lands shared contract changes
   before dependent tracks start.
4. **Disjoint Ownership** — exact owned paths and forbidden paths per track,
   plus pre-existing dirty/untracked user files to preserve. Concurrent writers
   must never share a file, build output, simulator, or test database.
5. **Write & Escalation Boundary** — implementers never commit, push, deploy,
   edit global config, revert unrelated changes, or widen scope; any missing
   product ruling, cross-track break, or blocked invariant returns to the
   Coordinator immediately.

## 3. Execution and Convergence

1. **Pre-flight & Charter.** Inspect `git status --short`, verify required
   runtime/test dependencies, and freeze the Charter.
2. **Plan Review.** Run the Plan Reviewer on the Charter and target files before
   writes start to catch missed consumers, races, broken invariants, or
   dual-track leftovers. Verify every finding in source code and fold confirmed
   fixes into the Charter.
3. **Disjoint Execution.** Dispatch independent tracks in parallel with
   self-contained briefs carrying only their Charter slice, required local
   checks, and return shape (files changed, behavioral delta, checks run,
   blockers). Execute small or tightly coupled edits directly instead of
   inventing artificial tracks. Rely on reactive wakeup as members finish — never
   poll in sleep loops.
4. **Verification & Blind Review.** Inspect actual diffs (not just worker
   summaries), then run repository deterministic checks in parallel with the
   Code Reviewer on the real diff. Give the reviewer only the target, accepted
   intent, and Charter invariants — never author framing or reassurance.
5. **Triage, Convergence & Landing.** Verify every finding against code before
   acting:
   - **P0 / P1:** mandatory fix (reachable defect, auth/privacy/data break,
     regression, or contract/requirement violation).
   - **Concrete P2:** fix in the current pass (evidence-backed edge failure or
     missing guard in scope).
   - **Style / speculative nits:** drop unless user-requested.

   Cap review-fix loops at **2 rounds** (re-reviews check prior fixes and
   regressions). Whenever a finding changes product behavior/scope or an
   unresolved P0/P1 requires a trade-off, pause and escalate to the user with
   concrete options and a recommendation. Once green, Coordinator commits
   verified revertible units (respecting any repo lock/commit ordering) without
   pushing unless authorized.

   In the final report, state every participating role and model, confirmed
   findings resolved vs. rejected, exact verification commands with real counts,
   and any retained exceptions or follow-ups.

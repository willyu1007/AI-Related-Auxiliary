---
name: agent-council
description: >-
  Activate only when the user explicitly calls this skill by name.
disable-model-invocation: true
---

## Roles

The Coordinator is this session's main model. Every other role is a separate
run. Do not reuse a run across roles, even when the model id matches.

- **ChatGPT models (`gpt-*`)** — Codex CLI, not swarm:
  `codex exec -m <model> -c model_reasoning_effort=xhigh`. Reviewer and council
  runs add `--sandbox read-only`. An Implementer run adds `-s workspace-write`.
  Continue with a new `codex exec` and the new brief.
- **Any other model** — swarm, not Codex CLI. Continue with `send_message`.

If a requested model is unavailable, disclose the gap and use another available
model on the channel that model requires. Do not claim a missing member
participated.

- **Coordinator** — this session.
- **Implementer** — lands that plan. Default is this session. Another run only
  for a disjoint track this session is not writing.
- **Reviewer** — one run, not a council member. Checks the plan and the diff
  for implementation defects only, not whether a pass line is met. Default
  `gpt-6.2-astra` at reasoning `xhigh`.
- **Council members** — one run each. Defaults: `gpt-6.2-astra` at reasoning
  `xhigh`, `gemini-4-neon-xhigh`, `claude-opus-5-5-high`.

## Council Charter

Freeze a concise Charter (in scratch or the active task plan) before any write
starts. The Coordinator sets the scorecard here. Members do not change it.

1. **Scorecard** — the goal. Each dimension has a name, a type, and a pass
   line.
   - **Subjective** (visual quality, tone, hierarchy): a minimum score.
   - **Objective** (latency, error rate, a check count): a condition that can
     be verified against the current state.
   Use numbers the user already gave. Otherwise write the pass lines and
   continue.
2. **Hard Invariants** — architecture, auth/privacy, compatibility or rollout
   gates, UI rules, and repository checks no member may relax.
3. **Frozen Interfaces** — shared types, routes, contracts, props, and
   `testID`s. The Coordinator, or one designated owner, lands shared contract
   changes before dependent tracks start.
4. **Disjoint Ownership** — exact owned paths and forbidden paths per track,
   plus pre-existing dirty/untracked user files to preserve. Concurrent writers
   must never share a file, build output, simulator, or test database.
5. **Write & Escalation Boundary** — an extra Implementer run never commits,
   pushes, deploys, edits global config, reverts unrelated changes, or widens
   scope. A blocked invariant returns to the Coordinator, who decides inside
   the scorecard and continues.

## Execution

Before changing the Charter, the plan, or the diff, verify the cited finding
in source. Do not stop to ask the user. Reject and record any suggestion that
changes a pass line or the scorecard.

**Pre-flight.** Inspect `git status --short`, verify required runtime and test
dependencies, and freeze the Charter.

**Rounds.** Repeat the seven steps below from blind evaluation. Default **3**
repetitions. Use the user's number when one is given. Stop when every pass
line is met or that many repetitions have finished.

1. **Blind evaluation** — council members, in parallel.
   - **Input:** the scorecard, the Charter invariants, and the target. No other
     member's findings. No Coordinator conclusion.
   - **Output:** a subjective dimension gets a score, the evidence, and a next
     step when it misses. An objective dimension gets met or not met from the
     current evidence, and a next step when it misses. No taste score on an
     objective dimension.
2. **Cross-review** — the same members. They do not rescore.
   - **Input:** the other members' scores, achievement judgments, and next
     steps only. No Coordinator verdict.
   - **Output:** suggestions only — an omission the others missed, or a point
     they agree with and emphasize.
3. **Plan** — the Coordinator.
   - **Output:** one implementation plan for the dimensions that missed in the
     blind evaluation, including the cross-review suggestions.
4. **Plan review** — the Reviewer, before any write.
   - **Input:** the plan and the target files.
   - **Output:** implementation defects only. The Coordinator folds confirmed
     fixes into the plan.
5. **Implementation** — the Implementer.
   - **Output:** the plan landed.
6. **Blind diff review** — the Reviewer. The Coordinator runs repository checks
   in parallel.
   - **Input:** the merged diff and the implementation plan. Not the scorecard.
   - **Output:** implementation defects only.
7. **Fix** — the Implementer, on the same run. The Reviewer checks those fixes.
   - **P0 / P1:** fix before the next repetition (reachable defect,
     auth/privacy/data break, regression, or contract violation).
   - **Concrete P2:** fix in this round when it is an evidence-backed edge
     failure or missing guard in scope.
   - **Style / speculative nits:** drop unless user-requested.

**Commit**
- When every pass line is met, the Coordinator commits verified revertible
  units, in any repo lock or commit order, and does not push unless authorized.

**Final report**
- Participating role and model.
- Each dimension's pass line, and its last score or met / not met.
- Rejected suggestions that would have changed the scorecard.
- Findings resolved and findings rejected.
- Verification commands with real counts.
- Retained exceptions and follow-ups.

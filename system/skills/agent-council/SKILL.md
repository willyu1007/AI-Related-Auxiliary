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
  `codex exec -m <model> -c model_reasoning_effort=xhigh -o <scratch>/<role>-r<n>.md`
  (redirect stdout/stderr logs to `<scratch>/<role>-r<n>.log`; attach UI
  screenshots with `-i <file>`). Reviewer and council runs add
  `-s read-only`; an Implementer run adds `-s workspace-write`. Continue with a
  new `codex exec` and the new brief.
- **Any other model** — swarm, not Codex CLI. Drive workers with `post_message`
  (`@<name>`) and `swarm_wait`, not `send_message`. Before spawning, check
  model availability and quota via `swarm` (`models` / `status`).
- **Runtime verifier (UI or live interactive targets)** — `browser` subagent
  (continued via `send_message`), capturing fresh desktop and narrow/mobile
  evidence with a full reload after any server or linked-package restart.

If a requested model is unavailable or hits quota limits, disclose the gap,
switch its model (`swarm` `model`) or `kill` it cleanly, and use another
available model on the channel that model requires. Never claim a missing
member participated, never post `@all`, and never `@mention` a retired or
unavailable worker even in negative instructions.

- **Coordinator** — this session.
- **Implementer** — lands the plan. Default is this session. Spawn another run
  only for a disjoint track this session is not writing.
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
   continue. Assign distinct primary audit lenses across council members when
   helpful while all still evaluate the shared scorecard.
2. **Hard Invariants** — architecture, auth/privacy, compatibility or rollout
   gates, UI rules, and repository checks no member may relax.
3. **Frozen Interfaces** — shared types, routes, contracts, props, and
   `testID`s. The Coordinator, or one designated owner, lands shared contract
   changes and upstream package publishes before dependent tracks start.
4. **Disjoint Ownership & Repo Anchors** — exact owned paths, forbidden paths,
   and expected branch (`git branch --show-current`) per repository, plus
   pre-existing dirty/untracked files to preserve. Concurrent writers must
   never share a file, build output, simulator, or test database.
5. **Write & Escalation Boundary** — an extra Implementer run never commits,
   pushes, deploys, edits global config, reverts unrelated changes, or widens
   scope. A blocked invariant returns to the Coordinator, who decides inside
   the scorecard and continues.

## Execution

Before changing the Charter, the plan, or the diff, verify the cited finding
against source, existing tests/contracts, and rendered DOM/tokens when
applicable. Do not stop to ask the user. Reject and record in the Charter any
suggestion that changes a pass line or the scorecard.

**Pre-flight.** Inspect `git status --short` and `git branch --show-current` in
each target repo, verify runtime/test dependencies and model availability,
capture baseline runtime evidence if UI-facing, and freeze the Charter.

**Rounds.** Repeat the loop below from blind evaluation. Default **2**
repetitions (cap **3**, or the user's explicit count). Stop early when every
pass line is met, or when a round produces zero P0/P1 and zero concrete
evidence-backed P2 findings.

1. **Blind evaluation** — council members, in parallel, dispatched before any
   member reports.
   - **Input:** the scorecard, Charter invariants, target, and current runtime
     evidence. No other member's findings. No Coordinator conclusion.
   - **Isolation:** swarm members skip later board posts during Step 1, write
     their blind evaluation to `<scratch>/<role>-r<n>.md`, and post only
     `@coordinator done: <path>`.
   - **Output:** a subjective dimension gets a score, evidence, and a next step
     when it misses. An objective dimension gets met or not met from current
     evidence (never pass visual or interactive pass lines on source or unit
     tests alone), and a next step when it misses. No taste score on an
     objective dimension.
2. **Cross-review (when material disagreement exists)** — the same members,
   without rescoring. Skip when Step 1 scores and next steps already align.
   - **Input:** peer evaluation files (scores, judgments, and next steps only;
     no Coordinator verdict).
   - **Output:** suggestions only — an omission others missed, or a point to
     emphasize.
3. **Plan** — the Coordinator.
   - **Output:** one implementation plan for dimensions that missed in blind
     evaluation, incorporating verified cross-review suggestions.
4. **Plan review (for structural, contract, state, or multi-track plans)** —
   the Reviewer, before any write. Skip for isolated local style or copy
   polish.
   - **Input:** the plan and target files.
   - **Output:** implementation defects only. The Coordinator folds confirmed
     fixes into the plan.
5. **Implementation** — the Implementer.
   - **Output:** the plan landed, following upstream-before-downstream order
     across repositories.
6. **Blind diff review & Verification** — the Reviewer inspects the current
   round's diff while the Coordinator runs repository checks and fresh runtime
   verification in parallel.
   - **Input to Reviewer:** the round diff and implementation plan. Not the
     scorecard.
   - **Output:** implementation defects only.
7. **Fix** — the Implementer, on the same run.
   - **P0 / P1:** fix before the next repetition (reachable defect,
     auth/privacy/data break, regression, or contract violation). Reviewer
     re-checks P0/P1 and behavioral fixes.
   - **Concrete P2:** fix in this round when it is an evidence-backed edge
     failure or missing guard in scope. Deterministic checks and fresh runtime
     evidence suffice for isolated style or copy fixes.
   - **Style / speculative nits:** drop unless user-requested.

**Commit (per verified round)**
- Once a round is green, re-verify branch and `git status --short`, drop
  dev-server generated noise without touching foreign dirty files, and commit
  verified revertible units (respecting repo lock/pin/commit order). Never push
  unless authorized.

**Final report**
- Participating roles and models (including any fallback or unavailable model).
- Each dimension's pass line, last score or met / not met, and whether
  verified live vs. static/unit-only (noting any unreachable role/auth state).
- Rejected suggestions that would have changed the scorecard.
- Findings resolved and findings rejected.
- Verification commands with real counts.
- Retained exceptions and follow-ups.

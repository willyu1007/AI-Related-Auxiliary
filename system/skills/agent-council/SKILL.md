---
name: agent-council
description: >-
  Activate only when the user explicitly calls this skill by name.
disable-model-invocation: true
---

## Roles

Every non-Coordinator role is a separate run; never reuse a run across roles,
even on the same model.

- **ChatGPT (`gpt-*`)** — Codex CLI, not swarm:
  `codex exec -m <model> -c model_reasoning_effort=xhigh -o <scratch>/<role>-r<n>.md`
  (`-s read-only` for council/reviewer, `-s workspace-write` for implementer,
  `-i <file>` for screenshots). Continue with a new `codex exec`.
- **Other models** — swarm, not Codex CLI: drive with `post_message`
  (`@<name>`) and `swarm_wait`, not `send_message`. Check `swarm`
  `models`/`status` before spawning.
- **Runtime verifier (UI/live targets)** — `browser` subagent (`send_message`),
  desktop and narrow/mobile viewports, full reload after server or
  linked-package restarts.

If a model is unavailable or quota-limited, disclose the gap, switch it
(`swarm` `model`) or `kill` it, and substitute an available model on its
required channel. Never claim a missing member participated, post `@all`, or
`@mention` an unavailable or retired worker.

- **Coordinator** — this session.
- **Implementer** — this session by default; separate run only for a disjoint
  write track.
- **Reviewer** — default `gpt-6.2-astra`; checks plans and diffs for
  implementation defects only, never pass lines.
- **Council** — defaults `gpt-6.2-astra`, `gemini-4-neon-xhigh`,
  `claude-opus-5-5-high`.

## Charter

Freeze a concise Charter in scratch or the active task plan before any write:

1. **Scorecard** — Coordinator-owned dimensions with type and pass line:
   Subjective (minimum score) or Objective (verifiable condition). Use
   user-given numbers; otherwise set them and continue.
2. **Hard invariants** — architecture, auth/privacy, rollout/repo gates, and UI
   rules no member may relax.
3. **Frozen interfaces** — shared contracts, types, routes, props, `testID`s;
   land shared contracts and upstream package publishes before dependent tracks.
4. **Ownership & repo anchors** — owned/forbidden paths, expected branch per
   repo, and pre-existing dirty/untracked files to preserve. Concurrent writers
   never share a file, build output, simulator, or test DB.
5. **Extra-implementer boundary** — never commits, pushes, deploys, edits
   global config, reverts unrelated changes, or widens scope; blocked
   invariants return to the Coordinator.

## Loop

Verify cited findings against source, tests/contracts, and rendered DOM/tokens
before acting. Do not stop to ask the user. Reject and log in the Charter any
suggestion that changes the scorecard.

- **Pre-flight:** check `git status --short`, `git branch --show-current`,
  runtime/test deps, and baseline runtime evidence (if UI-facing); freeze the
  Charter.
- **Rounds:** default **2** (cap **3**, or user's count). Stop early when every
  pass line is met, or when a round yields zero P0/P1 and zero evidence-backed
  P2 findings.

1. **Blind evaluation** (council, parallel, before any member reports) — pass
   scorecard, invariants, target, and runtime evidence; no peer findings or
   Coordinator verdict. Swarm members skip later board posts during Step 1,
   write to `<scratch>/<role>-r<n>.md`, and post only `@coordinator done: <path>`.
   Output per dimension: subjective score + evidence + next step if missed;
   objective met/not met from current evidence (no taste score; never pass
   visual/interactive lines on source or unit tests alone) + next step if missed.
2. **Cross-review** (same members, no rescoring) — skip when Step 1 scores and
   next steps align. Pass peer files only; output omissions or emphasis only.
3. **Plan** (Coordinator) — one plan covering missed dimensions and verified
   cross-review suggestions.
4. **Plan review** (Reviewer, before writes) — skip for isolated local
   style/copy polish. Pass plan and target files; fold confirmed implementation
   defects into the plan.
5. **Implement** (Implementer) — land the plan, upstream repos before
   downstream.
6. **Diff review & checks** (parallel) — Reviewer inspects the round diff and
   plan (no scorecard) for implementation defects; Coordinator runs repo checks
   and fresh runtime verification.
7. **Fix** (same Implementer run) — fix all P0/P1 (Reviewer re-checks P0/P1
   and behavioral fixes) and evidence-backed in-scope P2 (deterministic checks
   + runtime evidence suffice for isolated style/copy); drop speculative nits.
8. **Checkpoint commit** — once green, re-verify branch and
   `git status --short`, stage only owned changes, and commit revertible units
   in repo lock/pin order. Never push unless authorized.

## Final Report

- Participating roles and models (including fallbacks/gaps).
- Each dimension's pass line, final score or met/not met, and verification
  basis (live vs. static/unit-only, noting unreachable role/auth states).
- Rejected scorecard-change suggestions.
- Confirmed findings resolved vs. rejected.
- Exact verification commands with real counts.
- Retained exceptions and follow-ups.

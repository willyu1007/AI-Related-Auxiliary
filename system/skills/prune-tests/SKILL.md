---
name: prune-tests
description: >-
  Activate only when the user explicitly calls this skill by name.
disable-model-invocation: true
---

# Prune Tests

Delete low-value tests and their dedicated fixtures within the approved scope.
Leave only the thinnest direct evidence for high-consequence behaviors the
product still needs long-term. Optimize for execution and maintenance cost.
Do not promise fixed cuts in case count, coverage, or runtime. Remove CI
overhead only when that work is in scope.

## Set trade-offs and baseline

- Honor the user's repo, exclusions, approved list, and authorization. Stay
  read-only when only inventory or discussion is requested.
- Confirm behavior from real product entry points and current rules. Do not treat
  test names, old plans, or version labels as requirements. When a list disagrees
  with product reality, mark the gap; do not invent business rules to keep a
  numbered case.
- Map real execution entries enough to choose what to delete: default commands,
  workspace/project config, CI, databases, cross-repo joint checks, tools,
  native deps, and release verification. Count files, runner-reported cases, and
  independent behaviors separately. Full discovery, skip, and duplicate-run
  reconciliation belongs in Full verification—do not block same-turn deletion
  on a complete channel audit.
- Prefer a measured baseline with clear source and scope when one is already
  available. If missing, note the commands you will use for after-prune
  verification and continue deleting; record revision, environment, exit codes,
  and wall-clock time with Full verification. List already-failing or inactive
  channels separately; do not treat them as a full green baseline.

## Choose the core by guarantee value

Calling this skill to prune (not inventory or discussion) authorizes deletion
inside that scope. In the same turn: state the retained core, the deletion set,
and the guarantees that will be lost, then delete per the table below. Stop and
ask only when a candidate is the last evidence for still-supported behavior and
the user has not accepted losing that guarantee; with clear prior acceptance,
delete without re-asking.

Classify by current behavior, risk, and duplicate responsibility—not by file age
or whether everything is green. Do not keep a test only because CI still runs it
or it has a unique assertion; record low-value unique coverage as coverage loss
and delete it. Success means non-core is gone and entries are synced—not that an
audit was written while the suite stayed nearly intact. If detail or
duplicate-layer cases still dominate, the prune is incomplete; keep cutting.

| Category | Handling |
| --- | --- |
| High-consequence current behavior that needs long-term protection | **Keep** only the thinnest direct evidence per guarantee. Prefer critical boundaries such as auth and privacy, transactional atomicity, idempotency, concurrency races, unknown-outcome recovery, and undo. Concrete trade-offs follow this product. |
| Multiple layers verifying the same guarantee | **Delete duplicate layers.** Keep only the layer most likely to catch a real fault. Keep wiring or interaction evidence only when it covers a different risk. |
| Field/error-code/state permutations, implementation snapshots, ordinary UI detail, excess tool self-tests | **Delete by default.** Fold any still-valid unique coverage loss into the report; uniqueness alone does not retain them. |
| Removed features, retired tracks, one-off drills, and corpora with no current use | **Delete** with dedicated fixtures after checking current callers, public contracts, conventionally loaded entry points, pins, and external consumers. No consumer after that check: delete; do not keep the whole file on mere uncertainty. |

For each retained flow, state the current behavior, fixed inputs or bounded
sequential steps, observable outcome, and source location. Renaming tests,
merging outer cases, or moving files alone is not pruning.

- Inspect parameter tables, loop registration, fixture replay, and in-test
  iteration. Cut real variants and execution; do not hide the old matrix inside
  one case, and do not move it to nightly, manual, or verify.
- Count happy path, lost response, and recovery of the same command as one
  continuous flow when that is the real scenario. Do not glue independent risks
  only to reduce counts. Dual-participant races, replays, and bounded
  interactions must state actual steps.
- Make evidence reach the claimed result. A mock call is not a commit; a schema
  compile or byte hash is not business behavior.
- Keep mocks outside the core guarantee. When claiming transactional, real
  dual-owner, or native-load protection, exercise the matching database, both
  boundaries, or native entry; otherwise narrow the claim. Do not invent a
  general test framework just to prune.

## Delete and sync consumers

- Trim non-core inputs in mixed files, then clean fixtures, snapshots, helpers,
  mocks, config, runners, workspaces, and deps along the deletion scope. Keep
  anything still consumed by production, tools, or other tests. Also remove
  branches inside living helpers that exist only for retired patterns.
- Judge reachability after resolving package exports, conventional loads,
  scripts, CI, and release entry points. Cross-repo pinned artifacts may have no
  local import; check consumer pins before deleting. Distinguish test replay
  specs from production schemas, protocol types, artifacts, and generated
  inputs.
- Sync default commands, full verification entry points, CI, and docs; remove
  retired entries. Keep the real core that must keep running so defaults or
  conditionals do not silently skip them.
- Sync behavior eligibility, coverage matrices, and other guarantee claims to
  what real evidence still supports. Shrinking a coverage claim is not a
  production-contract semantic change; do not rotate unrelated production
  versions just to delete tests.
- For cross-repo pins, frozen copies, or source locks, follow the repo's existing
  protocol and tools: commit source, recompute identity, and update affected
  consumers. Verify fixed revisions against actual provider bytes. Do not only
  edit consumer JSON, exclude test paths to dodge source checks, or hand-fill
  hashes to bypass seals.

## Reduce CI overhead when in scope

Read [references/ci-cost.md](references/ci-cost.md) when assessing or changing CI
cost. Keep the retained core and release/security gates as invariants unless the
user approves a different trade-off. Approval to prune tests does not itself
authorize changing cache, image, runner, or publication policy.

Separate test-suite savings from CI preparation savings. Trace the actual event
paths and step timings before choosing between fewer jobs/checkouts, narrower
installs, persistent caches, or fewer image builds. For a CI-only request, leave
test coverage unchanged. Explain the proposed savings and trade-offs before
implementation when the user asks for discussion.

## Full verification and delivery

- Run every retained channel after pruning, plus the repo's required type, lint,
  contract, and source checks—including conditionally enabled database,
  cross-repo, native, and artifact channels. Do not run only changed files or
  the default command. Use an isolated temporary environment you control for
  databases and destructive scenarios; clean up objects and processes you create.
- Reconcile discovery, execution, and skip counts against the retention list
  item by item. For existing failures, separate product, test setup, and
  environment causes. Keep valid guarantees; fix or report under existing
  authorization. Do not delete failing cases to buy a green suite. List
  unrun or skipped channels honestly.
- If verification changes source, re-run affected checks. For lock or doc
  metadata-only edits, at least re-verify checksums, source, and consumer links.
  Record results against the final delivered identity.
- Report tests and dedicated fixtures actually deleted or trimmed, retained-core
  mapping, input and file reductions, coverage loss, dependency/entry/pin
  changes, full verification results, and wall-clock times for before/after
  commands. Provide a per-file inventory when scale warrants it.
- When CI is in scope, report job, checkout, install, cache, and timing changes
  under [Measure and report](references/ci-cost.md#measure-and-report); include
  cold/warm comparisons for cache changes.
- Compare like scope and environment. Call out precompile, migration, package,
  startup, and cache differences. Skips or overlaps in old reports are not
  independent runs. When new real joint checks are added, do not subtract their
  total time from the old unit-only channel. If there is no comparable full
  baseline, say so; do not infer speedup from case counts.

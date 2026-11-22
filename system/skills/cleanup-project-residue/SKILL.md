---
name: cleanup-project-residue
description: >-
  Use when cleaning repository residue on request, or completing an approved
  replacement or refactor that retires old source and guidance. Covers obsolete
  code, context and dedicated assets, not Git workspace disposal or reducing
  guarantees for still-supported behavior.
---

# Cleanup Project Residue

## Select the boundary

- **Approved replacement:** finish the requested replacement by migrating callers
  and removing the superseded implementation and its guidance in the same delivery
  unit. Apply the existing authorization; do not ask again for each dependent
  deletion or documentation edit within that boundary.
- **Explicit cleanup:** use the requested session, task, recent-work or repository
  scope below. An inventory or discussion stays read-only; a finding is not itself
  authorization to retire a supported feature.
- If retirement would change an unapproved contract, lose needed data or affect
  another task's work, leave that part intact, name the missing decision or
  migration, and continue independent approved cleanup.

## Scan Boundaries

- **During replacement:** follow the replaced entry point through callers, exports,
  configuration, tests and context. Search repository-wide and across known
  consumers for reachability; do not turn each checkpoint into an unrelated
  whole-repository sweep.
- **Current session:** Inspect every file, including untracked files, inside directories touched by this session.
- **Current task:** Use the task's explicit file or commit boundary when available. Otherwise inspect directories changed from the task branch's identifiable merge base, plus current working-tree changes. If no reliable task boundary exists, fall back to recent work and state that assumption.
- **Recent work or fresh session:** Inspect directories touched by the last ten commits.
- **Full sweep:** Inspect the whole repository only when explicitly requested.
- **Root exception:** Treat touched root-level files individually; never treat the repository root as recursively touched.
- **Evidence scope:** Search the whole repository when determining whether a candidate is referenced or still needed.
- **Semantic depth:** By default, run shallow checks repository-wide and deep checks only within candidate scope. A full sweep runs deep checks repository-wide.
- **Broad checks:** For explicit cleanup, check unused dependencies and exact duplicates repository-wide. During replacement, check the affected dependency and duplicate groups. Outside candidate scope, report signals without expanding deletion scope.
- **Ignored files:** Exclude gitignored files except `.ai/.tmp/`. Itemize entries there that are not from the current session or whose ownership is unclear.
- **Task records:** Include obsolete instructions in active records and archived summaries when they describe a retired path as current. Preserve required record structure, task identity, decisions and factual verification evidence; update their current guidance through the repository's record conventions. Do not delete a task bundle merely because its implementation was replaced.
- **Handback:** Name all unswept directories.

## Candidate Checks

### Reachability

| Candidate | Required evidence |
|-----------|-------------------|
| Leftover files: one-off scripts, temp fixtures, debug artifacts, generated output | No import or reference anywhere. Use `git log` recency only for prioritization, never as evidence. |
| Unused dependencies | No import, config, script, or name-resolved plugin reference, and no peer role for a kept dependency. Do not assume an unimported devDependency is unused. |
| Unread config | No code reads the config key or environment variable; `.env.example` may also disagree with actual usage. |
| Dead exports | No importer uses the exported symbol, or a barrel re-exports something deleted. |
| Broken references | A doc, CI step, or manifest script points to a path that does not exist. |
| Orphan test assets | The owning test for a fixture, snapshot, or mock helper is gone. |
| Dead branches inside living files | A typechecker or linter confirms unreachable code, such as code after an unconditional return or an `if (false)` arm. Treat removal as an itemized edit. |

### Duplication

- Hash-check exact duplicate files using the broad-check scope in [Scan Boundaries](#scan-boundaries). Skip trivially small files, structural duplicates such as per-package licenses, vendored copies, and generated output. If one copy is unreferenced, classify it for deletion; if both are referenced, report the deduplication as a refactor.
- Treat repeated responsibilities, versioned names, wrappers, and compatibility shims as signals. Analyze them under [Semantic and Dual-Track Checks](#semantic-and-dual-track-checks).

### Markers

- Check `TODO`/`FIXME`, commented-out code, suppressed type errors, `.only`/`.skip` in tests, and feature flags whose value is constant at every read site.
- Delete markers that no longer apply, propose itemized edits for valid but outdated markers, and report genuine debt for the user to schedule.
- Report scattered root-level session notes and plans as doc sprawl.

## Semantic and Dual-Track Checks

Treat semantic drift as disagreement about currently supported behavior across the current task, requirements, public APIs, schemas, config, production entry points and callers, tests, docs, or comments. A shallow check compares names, paths, defaults, and literal claims. A deep check traces inputs, outputs, errors, side effects, and call paths. Apply the depth limits under [Scan Boundaries](#scan-boundaries).

Treat sibling files, directories, symbols, or tests that serve the same responsibility but differ mainly by iteration markers—such as `legacy`, `old`, `new`, `final`, `backup`, `copy`, `v<number>`, numeric suffixes, or semantic-version-like strings—as dual-track signals. Also flag forwarding wrappers, thin forwarding adapters, compatibility shims, parallel tests, and multiple implementations of one responsibility. These are signals, not verdicts.

Do not flag a versioned name by itself when the version is required by an explicit API, protocol, schema, migration, release, or compatibility contract; record that contract as the retention anchor.

For each signal group, build a track map covering:

- Implementations and entry points.
- Production callers and any public or external surface.
- Tests, fixtures, snapshots, and mocks.
- Docs, comments, config, and schemas.
- The intended contract from the current task, requirements, or supported public API.

Choose a canonical track only from explicit current-task intent, a supported contract, or production entry points and callers. Never choose by version label, filename, or recency alone.

| Track state | Handling |
|-------------|----------|
| A canonical track is clear and another track has no live callers | Remove the superseded track and its dedicated tests, assets and guidance within the approved boundary. |
| A canonical track is clear but another track still has callers | Migrate the callers within the approved replacement, then remove the old implementation. For callers outside that boundary, name the owner, migration and blocker; do not call retirement complete. |
| Multiple tracks are required by an explicit supported contract | Name that contract and the actual consumers. Record the owner and exit condition for a temporary transition; do not invent compatibility requirements. |
| The canonical track or intended behavior is unclear | Report the semantic conflict; do not silently align code, tests, or docs. |

Do not retain superseded source as `legacy`, a backup directory, a forwarding
wrapper, a disabled code path or reference-only code. Preserve ordinary
implementation history in Git. A retained non-canonical runtime path needs the
supported contract and consumers above; being called, old or potentially useful
does not establish that contract.

## Retire source and context together

1. **Resolve the current implementation.** Use the approved task intent, supported
   contracts and real entry points. If these disagree, report the conflict rather
   than choosing by filename, version or commit date.
2. **Move consumers first.** Trace resolved package exports, conventional loaders,
   scripts, external/public consumers and cross-repository pins. Migrate approved
   callers, remove old dispatch/fallback paths and update source locks through the
   repository's protocol. An artifact with no local import may still be pinned.
3. **Remove the old unit.** Delete the retired source and its exclusive fixtures,
   mocks, snapshots, helpers, flags, config, dependencies and execution entries.
   In shared files remove only the obsolete parts, preserving current callers.
4. **Remove obsolete guidance.** Reconcile README/navigation, agent instructions,
   architecture, task status, acceptance claims, examples and code comments that
   lead readers to the old path. Current instructions name the sole supported
   entry; remove superseded alternatives rather than copying them into a legacy
   guide or leaving both routes for the next agent to choose.
5. **Preserve required historical facts.** Migration history, frozen releases,
   recovery references and required task archives follow their explicit retention
   rules. Historical statements must be identifiable as historical, and summaries
   that otherwise look like current instructions must point to the current entry.
   Do not rewrite an old passing result as qualification of the new implementation.
6. **Prove closure.** Search for remaining references to the retired entry and
   trace each remaining hit to a current caller, a resolved edit or an explicit
   retention anchor. Check a fresh agent's normal entry documents: they must not
   instruct it to start from the retired implementation. Report blockers instead
   of describing a remaining old route as completed cleanup.

## Stale Tests

Group tests by the supported behavior and production entry point they protect. Treat a test as a cleanup candidate when it is undiscovered by every project or CI test command, skipped or expected-fail without active ownership, tied to a removed or non-canonical track, superseded by the current task, duplicated by an active test, or limited to obsolete implementation details. A discovered and passing test can still be stale.

For each candidate, search for a retention anchor:

- Unique coverage of a currently supported production behavior.
- An explicit public API, compatibility, security, permission, or regression contract.
- Use by an active CI, release, or environment-integration workflow.
- An active issue, owner, or expiry condition for a skipped test.
- An explicit requirement from the current task.

Delete the candidate when no retention anchor exists. For a mixed test, remove only the obsolete test cases. Batch clear tracked deletions only when they satisfy [Approval Classes](#approval-classes); keep untracked deletions and environment- or external-contract-sensitive cases itemized.

Retiring tests for removed behavior does not authorize shrinking guarantees for
still-supported behavior. Verify the resulting change under the workflow below.

## Approval Classes

First apply existing authorization for the specific retirement and its dependent
edits. For changes outside that boundary, classify in this order:

| Class | Criteria | Handling |
|-------|----------|----------|
| Report only | The change may alter supported behavior, affect an externally invisible consumer, kill a live implementation track, or rewrite a still-current test | Recommend an action; require a separate instruction before acting |
| Itemized approval | The target is untracked, evidence is non-mechanical, or the change edits a surviving file without changing supported behavior | Show each path or diff with its evidence; require explicit approval |
| Batch deletion | The target is tracked, repository-wide evidence shows no use, and no convention-loaded, public, or behavior-sensitive surface is involved | Present one deletion list for one approval |

Outside an approved replacement, treat convention-loaded files and public entry
points as report-only until their consumers and retirement authorization are
established. Inspect each such surface rather than mechanically batching it.

Present surviving-file edits as concrete diffs. Existing approval for the same
replacement covers its in-scope edits; unrelated behavior changes remain report-only.

## Workflow

1. **Set boundaries.** Apply [Scan Boundaries](#scan-boundaries) and record the candidate scope and unswept directories.

2. **Capture the baseline.** Identify the checks required for this change and use existing qualified results where their inputs still hold; otherwise run them within execution authorization. Record pre-existing failures and checks that cannot run.

3. **Collect evidence.** Apply [Candidate Checks](#candidate-checks), [Semantic and Dual-Track Checks](#semantic-and-dual-track-checks), and [Stale Tests](#stale-tests), searching repository-wide for every candidate or track group. Treat dead-code tool output as candidates, never verdicts.

4. **Classify and act within scope.** Apply [Approval Classes](#approval-classes). Show the path or track group, evidence and action; proceed with already-authorized retirement and its dependent edits. Ask only for a missing decision or authorization that changes the boundary.

5. **Stage approved changes.**
   - Apply approved tracked deletions.
   - Apply itemized surviving-file edits exactly as shown.
   - Remove dependencies through the project's package manager, then perform a clean install.
   - Move approved untracked targets to a recoverable temporary backup outside the repository.
   - Do not act on a report-only finding unless the user separately instructs that exact change.

6. **Verify.** Verify the repository-required checks for the affected behavior, contracts and consumers, including any mandatory full gate. Reuse qualified results only where the final inputs and coverage still hold; otherwise run the checks within execution authorization and compare with the baseline. For context-only edits, verify paths, references and current claims without inventing business test obligations. Do not infer build, database or environment authorization from cleanup. If a new failure appears, repair within the approved boundary or restore the responsible change; if attribution is unclear, restore the batch and narrow it. Report unrun checks and existing failures; do not describe an incomplete gate as green.

7. **Finalize.** Permanently delete staged untracked backups only after verification succeeds. Commit a verified coherent unit when requested or required by repository workflow; keep required source and context retirement in the same delivery, following any mandated source/lock/pin commit order.

8. **Hand back.** Report removed source and guidance, the current entry point, retained candidates with their anchors, report-only findings, unswept directories and verification results. List every remaining old runtime path, wrapper, semantic conflict and dual track with its supported contract or migration blocker. Do not describe the candidate scope as clean while obsolete current instructions, unresolved semantic drift or unanchored old tracks remain.

## Guardrails

- A batch approval covers only the presented batch; an approved replacement covers only that replacement and its necessary in-scope retirement.
- Do not touch gitignored files except approved `.ai/.tmp/` candidates. Never treat `.env`, credential, token, or secret files as cleanup candidates, and never quote their contents.
- Never delete, weaken, or bypass a check to make verification pass.
- Preserve unrelated working-tree changes and their staging. A standalone cleanup must not absorb unrelated feature edits; an approved replacement includes its necessary source and context retirement.
- When the same class of leftover recurs, recommend an upstream lifecycle rule in the handback; do not change that lifecycle unless separately requested.

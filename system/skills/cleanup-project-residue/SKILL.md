---
name: cleanup-project-residue
description: Use when the user explicitly asks to clean up repository leftovers from the current session, current task, or recent work, or to perform a full-repository sweep.
---

# Cleanup Project Residue

## Scan Boundaries

- **Current session:** Inspect every file, including untracked files, inside directories touched by this session.
- **Current task:** Use the task's explicit file or commit boundary when available. Otherwise inspect directories changed from the task branch's identifiable merge base, plus current working-tree changes. If no reliable task boundary exists, fall back to recent work and state that assumption.
- **Recent work or fresh session:** Inspect directories touched by the last ten commits.
- **Full sweep:** Inspect the whole repository only when explicitly requested.
- **Root exception:** Treat touched root-level files individually; never treat the repository root as recursively touched.
- **Evidence scope:** Search the whole repository when determining whether a candidate is referenced or still needed.
- **Semantic depth:** By default, run shallow checks repository-wide and deep checks only within candidate scope. A full sweep runs deep checks repository-wide.
- **Always-global checks:** Always check unused dependencies and exact duplicates. Outside candidate scope, only report version-residue signals and skipped or TODO-marked tests.
- **Ignored files:** Exclude gitignored files except `.ai/.tmp/`. Itemize entries there that are not from the current session or whose ownership is unclear.
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

- Hash-check exact duplicate files repository-wide. Skip trivially small files, structural duplicates such as per-package licenses, vendored copies, and generated output. If one copy is unreferenced, classify it for deletion; if both are referenced, report the deduplication as a refactor.
- Treat repeated responsibilities, versioned names, wrappers, and compatibility shims as signals. Analyze them under [Semantic and Dual-Track Checks](#semantic-and-dual-track-checks).

### Markers

- Check `TODO`/`FIXME`, commented-out code, suppressed type errors, `.only`/`.skip` in tests, and feature flags whose value is constant at every read site.
- Delete markers that no longer apply, propose itemized edits for valid but outdated markers, and report genuine debt for the user to schedule.
- Report scattered root-level session notes and plans as doc sprawl; never modify task records.

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
| A canonical track is clear and another track has no live callers | Classify the unused track and its unanchored tests and assets for deletion. |
| A canonical track is clear but another track still has callers | Report the dual-track risk and an ordered migration path: callers, tests, docs/config, then the old implementation or wrapper. |
| Multiple tracks are required by an explicit compatibility contract | Retain them and record the contract as the retention anchor. |
| The canonical track or intended behavior is unclear | Report the semantic conflict; do not silently align code, tests, or docs. |

Do not treat a live legacy path, wrapper, or compatibility shim as harmless by default. Every retained non-canonical track needs an explicit compatibility anchor; otherwise report it as unresolved technical debt.

## Stale Tests

Group tests by the supported behavior and production entry point they protect. Treat a test as a cleanup candidate when it is undiscovered by every project or CI test command, skipped or expected-fail without active ownership, tied to a removed or non-canonical track, superseded by the current task, duplicated by an active test, or limited to obsolete implementation details. A discovered and passing test can still be stale.

For each candidate, search for a retention anchor:

- Unique coverage of a currently supported production behavior.
- An explicit public API, compatibility, security, permission, or regression contract.
- Use by an active CI, release, or environment-integration workflow.
- An active issue, owner, or expiry condition for a skipped test.
- An explicit requirement from the current task.

Delete the candidate when no retention anchor exists. For a mixed test, remove only the obsolete test cases. Batch clear tracked deletions only when they satisfy [Approval Classes](#approval-classes); keep untracked deletions and environment- or external-contract-sensitive cases itemized.

Run every configured project check after deletion. Once the retention-anchor check has passed, a green suite completes the verification.

## Approval Classes

Classify findings in this order; the first matching class wins:

| Class | Criteria | Handling |
|-------|----------|----------|
| Report only | The change may alter supported behavior, affect an externally invisible consumer, kill a live implementation track, or rewrite a still-current test | Recommend an action; require a separate instruction before acting |
| Itemized approval | The target is untracked, evidence is non-mechanical, or the change edits a surviving file without changing supported behavior | Show each path or diff with its evidence; require explicit approval |
| Batch deletion | The target is tracked, repository-wide evidence shows no use, and no convention-loaded, public, or behavior-sensitive surface is involved | Present one deletion list for one approval |

Treat files loaded by convention and public entry points as report-only unless explicit retirement evidence exists; even then, handle them item by item and never batch them.

Treat edits to surviving files as itemized changes with proposed diffs. If an edit may change supported behavior, classify it as report-only instead.

## Workflow

1. **Set boundaries.** Apply [Scan Boundaries](#scan-boundaries) and record the candidate scope and unswept directories.

2. **Capture the baseline.** Identify and run the project's existing checks before making changes. Record existing failures and checks that cannot run.

3. **Collect evidence.** Apply [Candidate Checks](#candidate-checks), [Semantic and Dual-Track Checks](#semantic-and-dual-track-checks), and [Stale Tests](#stale-tests), searching repository-wide for every candidate or track group. Treat dead-code tool output as candidates, never verdicts.

4. **Classify and report.** Apply [Approval Classes](#approval-classes). For each finding, show the path or track group, evidence, proposed action, and approval class. Wait for the required approval.

5. **Stage approved changes.**
   - Apply approved tracked deletions.
   - Apply itemized surviving-file edits exactly as shown.
   - Remove dependencies through the project's package manager, then perform a clean install.
   - Move approved untracked targets to a recoverable temporary backup outside the repository.
   - Do not act on a report-only finding unless the user separately instructs that exact change.

6. **Verify.** Run the same checks and compare them with the baseline. If a new failure appears, restore the responsible change. If attribution is unclear, restore the batch and retry in smaller groups. Report any check that could not run; do not describe the gate as green.

7. **Finalize.** Permanently delete staged untracked backups only after verification succeeds. Commit verified changes only when requested or required by the repository workflow; keep deletions, surviving-file edits, and dependency changes separate.

8. **Hand back.** Report deleted items, retained candidates with their anchors, report-only findings, unswept directories, baseline results, and final verification results. List every remaining live legacy path, wrapper, compatibility shim, semantic conflict, and dual track with its retention anchor or migration blocker. Do not describe the candidate scope as clean while unresolved semantic drift, dual-track risk, or unanchored technical debt remains; distinguish completed approved actions from remaining risk. Never modify task records.

## Guardrails

- Act only on explicitly approved paths and diffs. A batch approval covers only the presented batch; each itemized or report-only finding requires its own named approval or instruction.
- Do not touch gitignored files except approved `.ai/.tmp/` candidates. Never treat `.env`, credential, token, or secret files as cleanup candidates, and never quote their contents.
- Never delete, weaken, or bypass a check to make verification pass.
- Preserve unrelated working-tree changes. Never stage or commit them, and never mix cleanup changes into a feature commit.
- When the same class of leftover recurs, recommend an upstream lifecycle rule in the handback; do not change that lifecycle unless separately requested.

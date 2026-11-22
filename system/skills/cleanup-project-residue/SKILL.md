---
name: cleanup-project-residue
description: >-
  Use when cleaning repository residue on request, or completing an approved
  replacement or refactor that retires old source and guidance. Covers obsolete
  code and its maintained assets, not execution artifacts, Git workspace disposal
  or reducing guarantees for still-supported behavior.
---

# Cleanup Project Residue

Retire superseded source and current guidance together. Keep ordinary
implementation history in Git, not in a parallel reference implementation.

## Scan boundaries

For an ambiguous cleanup request, distinguish source and guidance from execution
output and Git resources before setting the scan boundary. Do not report a source
sweep as complete workspace cleanup.

Use the replacement boundary when cleanup is part of an approved replacement.
Use an explicit-cleanup mode only for a separately requested sweep.

- **During replacement:** limit semantic checks, unused-dependency checks and
  duplicate analysis to the replaced entry point, its callers, configuration,
  tests, context and related candidate groups. Do not scan unrelated code for
  semantic drift at each checkpoint.
- **Explicit session cleanup:** inspect files, including untracked files, in the
  directories touched by this session.
- **Explicit task cleanup:** use the task's file or commit boundary; otherwise
  inspect directories changed from its identifiable merge base and current edits.
  If that boundary cannot be recovered, use recent work and state the assumption.
- **Recent work or fresh session:** inspect directories touched by the last ten commits.
- **Full sweep:** inspect the whole repository only when explicitly requested.
- **Root exception:** treat touched root-level files individually, not as a
  recursively touched repository root.
- **Evidence lookup:** search repository-wide and across known consumers to
  determine whether each candidate is referenced or still needed. This lookup
  does not expand the candidate set.
- **Explicit-cleanup depth:** perform shallow semantic checks, unused-dependency
  checks and exact-duplicate analysis repository-wide; trace behavior deeply only
  within candidate scope. A requested full sweep also runs deep checks globally.

Distinguish maintained source assets from execution output. Include fixtures,
contract snapshots, generated descriptors and helpers maintained with the retired
source. Exclude temporary run scripts, build directories, diagnostic logs,
throwaway screenshots, exports and copied caches; their disposal depends on task
ownership, consumers and retention rather than source reachability. Do not treat
ignored files, secrets or private configuration as deletion candidates.

Include active task records and archived summaries when they describe a retired
path as current. Preserve required record structure, identity and factual evidence;
reconcile their current guidance through the repository's record conventions.
Do not delete a task bundle merely because its implementation was replaced.

## Candidate checks

| Candidate | Required evidence |
|---|---|
| Superseded source or a dedicated maintained asset | No current importer, conventional loader, tool, public consumer or pin still needs it. Age only prioritizes investigation. |
| Unused dependency | No import, config, script or resolved plugin reference, and no peer role for a retained dependency. An unimported devDependency may still be required. |
| Unread config | No current reader of the key or environment variable; reconcile examples with actual usage. |
| Dead export | No importer uses the resolved symbol, including package exports and barrel re-exports. |
| Broken reference | A doc, CI entry or script points to a missing path. |
| Orphan test asset | Its owning test is gone and no other current consumer uses it. |
| Dead branch inside a living file | A typechecker or linter confirms it is unreachable; remove only that branch. |

Apply the scan boundary when hash-checking exact duplicates. Skip trivially small
files, structural duplicates such as per-package licenses, vendored copies and
execution output. An unreferenced copy is a deletion candidate; two referenced
copies require a refactor decision.

Check in-scope TODO/FIXME markers, commented-out code, suppressed type errors,
exclusive/skipped tests, constant flags and scattered session notes. Remove only
superseded markers; report valid debt with its current owner or retention anchor.

## Semantic and dual-track checks

Compare current intent with APIs, schemas, config, entry points, callers, tests,
docs and comments. Shallow checks compare names, paths, defaults and literal
claims; deep checks trace inputs, outputs, errors, side effects and call paths.

Treat parallel responsibilities, forwarding adapters and iteration labels such
as legacy, old, new, backup or version suffixes as signals, not deletion evidence.
An explicit API, protocol, schema, migration or release version is not residue
merely because its name contains a version.
Map each group to its entry points, consumers, tests, assets, context and intended
contract. Resolve the canonical implementation from approved task intent,
supported contracts and actual production callers. If these disagree, report the
conflict; do not choose by filename, version or recency.

| Track state | Action |
|---|---|
| Canonical is clear; old track has no current consumers | Retire the old unit within authorization. |
| Old track still has consumers | Migrate approved callers first. Name the owner, migration and blocker for callers outside scope; retirement remains incomplete. |
| An explicit supported contract requires multiple tracks | Name the contract and actual consumers. A temporary transition needs an owner and exit condition. |
| Intended behavior is unclear | Leave decision-dependent changes intact and report the ambiguity. |

Do not keep superseded source as legacy, a backup directory, forwarding wrapper,
disabled path or reference-only code. A retained non-canonical runtime path needs
the supported contract above; speculative compatibility is not a retention anchor.

## Stale tests

Group tests by the current behavior and production entry point they protect.
Candidates include undiscovered tests, unowned skips, retired tracks, duplicates
and obsolete implementation assertions. A passing test can still be obsolete.
Check for a retention anchor: unique protection of current behavior, a supported
API/security/regression contract, an active CI/release workflow, an owned issue
or an explicit task requirement.

Remove unanchored candidates and their exclusive assets; in mixed tests remove
only obsolete cases. Retiring tests for removed behavior does not authorize
shrinking guarantees for still-supported behavior.

## Authorization

Questions and inventories are read-only. An approved replacement covers its
necessary in-scope caller migration, source deletion and guidance edits without
repeated approval. It does not cover unrelated behavior, data loss, another task's
work or an unapproved external contract. Leave those parts intact, name the
missing decision and continue independent approved work.

For findings outside existing authorization, use the first matching class:

| Class | Condition | Action |
|---|---|---|
| Report only | May alter supported behavior, affect an external consumer, retire a live track or rewrite a current test | Recommend the exact change; wait for its authorization. |
| Itemized approval | Untracked target, non-mechanical evidence or an edit to a surviving file | Show the path/diff and evidence for approval. |
| Batch deletion | Tracked, mechanically unused, no conventional/public/behavior-sensitive surface | Present one bounded deletion list for approval. |

Inspect convention-loaded and public surfaces individually. A batch approval
covers only that batch. Preserve foreign content and index state; do not absorb
unrelated feature edits into cleanup.

## Workflow

1. **Bound and inspect.** Select the scan boundary, separate foreign changes and
   identify required checks and pre-existing failures. Collect candidate evidence
   under the sections above; tool output alone is not a verdict.
2. **Retire the approved unit.**
   - Migrate callers, dispatch/fallback paths and pins through repository protocols.
   - Remove the old source and its exclusive tests, fixtures, snapshots, helpers,
     flags, config, dependencies and execution entries. Preserve shared consumers.
   - Reconcile README/navigation, agent instructions, architecture, task status,
     acceptance claims, examples and comments. Current instructions name the sole
     supported entry; delete old operating steps rather than keeping a deprecated
     alternative for the next agent to choose.
   - Apply explicit retention rules to migration history, frozen releases, recovery
     references and required archives. Mark historical facts as historical and
     point misleading summaries to the current entry. Old results qualify only
     their recorded inputs.
   - Use the project's package manager for dependency changes. Preserve approved
     untracked source candidates in a recoverable location until verification succeeds.
3. **Verify closure.** Search remaining references to the retired entry and account
   for each as a current consumer, a resolved edit or an explicit retention anchor.
   Check the normal documents a fresh agent reads: none may direct it to the old
   implementation as current.
   Verify repository-required checks for the affected behavior, contracts and
   consumers, including mandatory full gates. Reuse results only where final
   inputs and coverage still hold; otherwise run within execution authorization.
   Context-only edits need path, reference and claim checks, not invented business
   tests. Cleanup does not grant build, database or environment authorization.
   Repair a new failure within scope or restore the responsible change; when
   attribution is unclear, restore the batch and narrow it. Never weaken checks
   to obtain a pass; disclose existing failures and unrun checks.
4. **Deliver.** Commit a verified coherent unit when requested or required by
   repository workflow, following mandated source/lock/pin order. Delete recovery
   copies of untracked source only after verification succeeds. Report removed source and
   guidance, the current entry, retained anchors/blockers, unswept scope and check
   results. Do not claim closure while old runtime routes or obsolete current
   instructions lack an agreed disposition.

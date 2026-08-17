---
name: cleanup-repo
description: Sweep the repository for content whose reason to exist has expired — leftover scripts and temp files, stale or meaningless tests, unused dependencies, dead exports and unread config, docs and comments that no longer match the code, duplicate implementations, expired TODO markers. Use when the user asks to clean up, tidy, prune, or check for stale or redundant content. Deletes only with evidence and approval. Not for reviewing the quality of newly written changes, and not for fixing bugs.
---

# Cleanup Repo

Remove what no longer earns its place. The repository is a reference graph, and rot is a graph defect: **unreachable nodes** (things nothing points to) and **dangling edges** (references whose target is gone). Every lens below is a reachability question, which is what makes findings mechanical, evidence-backed, and batchable.

A special case outranks the rest: **a stale test is not clutter, it is poison.** Dead files sit still; a test pinning obsolete behavior actively corrupts the next iteration — the red light pressures whoever sees it to "fix" the code backwards or weaken the assertion.

## Scope

Candidates are scoped. **Evidence never is** — "nothing references this" is only decidable by searching the whole repository.

| Request | Candidate scope | Semantic depth |
|---------|-----------------|----------------|
| Ordinary cleanup | The area this session's work touched; fall back to directories from recent commits | Shallow drift check may cover the whole repo (cheap); deep drift only for content this session touched |
| "全仓" / "全面清理" / full sweep | Whole repository | Deep drift check across the repo |

Two lenses are global in every run because their detection is inherently repo-wide and cheap: unused dependencies, and exact-duplicate files.

## Lenses

### A. Reachability (mechanical, high confidence)

| Target | Evidence of death |
|--------|-------------------|
| Leftover files: one-off scripts, temp fixtures, debug artifacts, generated output | No import, no reference anywhere, no recent touch in `git log` |
| Unused dependencies | Declared in the manifest, zero imports in code — they still cost every install and build |
| Unread config | Config keys or env vars no code reads; `.env.example` drifted from actual usage |
| Dead exports | Exported symbols nothing imports; barrel files re-exporting deleted things |
| Broken references | Docs, CI steps, or manifest scripts pointing at paths that no longer exist |
| Orphan test assets | Fixtures, snapshots, and mock helpers whose test is gone |

### B. Subject alignment (judgment required)

| Target | The question |
|--------|--------------|
| Stale tests | Does this still verify something the current system promises? |
| Semantic drift | Doc or comment disagrees with code — which side is the intent? |
| Doc sprawl | Session notes and plans scattered at the root that belong in the task record or nowhere |

Shallow drift is a literal check: names, comments, and doc claims against what the code visibly does. Deep drift — whether a document's described design still matches the system — needs real understanding; keep it to the session's content unless a full sweep was requested.

Drift direction is a judgment: usually the doc is stale and follows the code, but when the doc records the intent and the code wandered, deleting the disagreement would legalize a bug — report that case instead of "fixing" the doc.

### C. Duplication

Exact duplicates — identical content under different names — are cheap to find (hash compare) and always checked. Two implementations of the same responsibility (one usually reachable only from tests or nothing) are the expensive cousin: detect within scope, and deciding **which track is canonical** is the user's call whenever it is not obvious. Killing the loser changes behavior — report, do not act, unless approved.

### D. Markers (grep-cheap, verdict varies)

`TODO`/`FIXME`, commented-out code blocks, suppressed type errors, `.only`/`.skip` left in tests, feature flags whose decision landed long ago. Three-way verdict: no longer applicable → delete; still valid but outdated → rewrite; genuine debt → list for the user to schedule, do not silently absorb.

## Stale tests

Detection heuristics, by descending confidence:

1. References symbols that no longer exist — a dangling edge, mechanically checkable
2. Skipped or expected-fail for many commits with nobody un-skipping it
3. Snapshot no test regenerates
4. Test theater: mocks everything, asserts nothing the system promises
5. Names or describes features the code no longer has

Verdicts: subject is dead → delete; subject lives but behavior changed → report (rewriting a test is a behavior judgment, not cleanup); test theater → report.

**The asymmetry:** for ordinary code, the suite staying green is proof a deletion was safe. Deleting a test always leaves the suite green — so test deletions rest entirely on subject evidence, and the confidence bar is one notch higher than every other lens.

## Risk model

The risk hierarchy is inverted from intuition: deleting a **tracked** file is cheap (`git rm`, revertible); deleting an **untracked** file is permanent — and LLM leftovers are mostly untracked.

| Pile | Criteria | Handling |
|------|----------|----------|
| Batch delete | Tracked + evidence of no use | One list, one approval, one `git rm` commit |
| Itemized confirm | Untracked, or evidence is circumstantial | Each path with its evidence; explicit approval per item |
| Report only | Deletion changes behavior (killing a track, dead code with a possible hidden call surface, test rewrites) | Into the report with a recommendation; never acted on unprompted |

## Workflow

1. **Fix the scope** and say so in the report. Default is the session's touched area; a full sweep only when asked.

2. **Collect candidates** through the lenses. Search for evidence repository-wide regardless of scope. Every candidate carries its evidence — no evidence, no finding.

3. **Classify** into the three piles and **report**: what, why dead, which pile. Wait for approval.

4. **Execute approvals.** Tracked deletions land as one `chore` commit, separate from any feature work and without a `Task:` trailer unless the cleanup itself is the task. Untracked deletions follow the itemized approvals exactly. Approved dependency removals go through the project's package manager (e.g. `pnpm remove <dep>`).

5. **Verification gate (mandatory).** Run the project's own checks — typecheck, lint, tests, build. Green is the proof the deletions were truly dead; reachability analysis can be fooled by dynamic imports and string-built paths, the gate cannot. A failure reverts the deletion that caused it and gets recorded, not argued with.

6. **Hand back:** deleted, kept-with-reason, and the report-only list. Scattered session docs found on the way are merged into their task's record if one exists — deleting them without merging just means the next session scatters them again.

## Prevention

The sweep is the cure; prevention is birth rules, and they already exist — temp artifacts are born under `.ai/.tmp/`, session documents belong in the task record, generated output belongs in `.gitignore`. When the sweep keeps finding the same class of leftover, the fix is the birth rule upstream, and that observation belongs in the handback.

## Rules

- Never delete without stated evidence, and never expand a deletion beyond what was approved.
- Never delete an untracked file without itemized approval — there is no undo.
- Never treat a green suite as proof that deleting a *test* was safe.
- Never rewrite logic; behavior-changing findings are report-only.
- Never mix cleanup deletions into a feature commit.
- Never satisfy the verification gate by deleting or weakening the check that failed.
- Never touch task records or their archives — they are the record layer, and archiving is their lifecycle, not deletion.
- No secrets, credentials, or tokens quoted in the report.

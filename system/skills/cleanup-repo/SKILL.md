---
name: cleanup-repo
description: Sweep the repository for content whose reason to exist has expired — leftover scripts and temp files, stale or meaningless tests, unused dependencies, dead exports and unread config, semantic drift between docs/comments and code, dual-track risk from duplicate or legacy implementations (old/v2/wrapper leftovers), lingering tech-debt markers. Use when the user asks to clean up, tidy, prune, check for stale or redundant content, or run a semantic-drift, dual-track, or tech-debt check. Deletes only with evidence and approval. Not for reviewing the quality of newly written changes, not for fixing bugs, and not for simplifying or refactoring code that stays, and not for task-record or project-hub repair.
---

# Cleanup Repo

Remove what no longer earns its place. The repository is a reference graph, and rot is a graph defect: **unreachable nodes** (things nothing points to) and **dangling edges** (references whose target is gone). Every lens below is a reachability question, which is what makes findings mechanical, evidence-backed, and batchable.

A special case outranks the rest: **a stale test is not clutter, it is poison.** Dead files sit still; a test pinning obsolete behavior actively corrupts the next iteration — the red light pressures whoever sees it to "fix" the code backwards or weaken the assertion.

## Scope

Candidates are scoped. **Evidence never is** — "nothing references this" is only decidable by searching the whole repository.

| Request | Candidate scope | Semantic depth |
|---------|-----------------|----------------|
| Ordinary cleanup | The directories this session's work touched; in a fresh session, the directories touched by the last ten commits | Shallow drift check may cover the whole repo (cheap); deep drift only for content this session touched |
| "全仓" / "全面清理" / full sweep | Whole repository | Deep drift check across the repo |

Directory granularity is literal: everything inside a touched directory is a candidate, including untracked files — they have no history to appear in, so a diff-based reading would exclude the highest-risk pile forever.

Rot is anti-correlated with recent activity — code is dead precisely because nobody touches it — so the default scope selects where rot is least likely. Two consequences: the handback always names the directories the sweep did not cover, and four lenses run globally in every sweep because they are repo-wide and cheap. Two act: unused dependencies, exact-duplicate files. Two only report: a name-signal grep for version-iteration residue (`legacy`, `old`, `v2`, `deprecated`, `backup`, `copy`) and a scan for skipped or TODO-marked tests — the poison categories live precisely where the scope never reaches, so they at least get named.

**Gitignored files are out of scope entirely.** The ignore rule already declares their lifecycle, they do not clutter the repository view, and the pile most likely to hide credentials (`.env` and friends) lives there — untracked, unrecoverable, and never a cleanup candidate.

One carve-out: entries under `.ai/.tmp/` that do not belong to the current session are itemized-confirm candidates. That directory is where disposable artifacts are deliberately concentrated, and a session that crashed instead of finishing leaves debris there with no other reaper.

## Lenses

### A. Reachability (mechanical, high confidence)

| Target | Evidence of death |
|--------|-------------------|
| Leftover files: one-off scripts, temp fixtures, debug artifacts, generated output | No import, no reference anywhere (recency in `git log` is a prioritization tiebreaker, never evidence — stability is not death) |
| Unused dependencies | Zero imports **and** no mention in any config, script, or plugin resolved by name, **and** not a peer of a kept dependency — most devDependencies are imported by nothing and alive |
| Unread config | Config keys or env vars no code reads; `.env.example` drifted from actual usage |
| Dead exports | Exported symbols nothing imports; barrel files re-exporting deleted things |
| Broken references | Docs, CI steps, or manifest scripts pointing at paths that no longer exist |
| Orphan test assets | Fixtures, snapshots, and mock helpers whose test is gone |
| Dead branches inside living files | Code after an unconditional return, `if (false)` arms, enum members nothing constructs — typechecker- or linter-attested; edit-shaped, so itemized |

### B. Subject alignment (judgment required)

| Target | The question |
|--------|--------------|
| Stale tests | Does this still verify something the current system promises? |
| Semantic drift | Doc or comment disagrees with code — which side is the intent? |
| Doc sprawl | Session notes and plans scattered at the root |

Shallow drift is a literal check: names, comments, and doc claims against what the code visibly does. Deep drift — whether a document's described design still matches the system — needs real understanding; keep it to the session's content unless a full sweep was requested.

Drift direction is a judgment: usually the doc is stale and follows the code, but when the doc records the intent and the code wandered, deleting the disagreement would legalize a bug — report that case instead of "fixing" the doc.

### C. Duplication

Exact duplicates — identical content under different names — are cheap to find (hash compare) and always checked. The verdict follows references: a copy nothing references goes to a delete pile; when **both** copies are referenced, deduplication is a refactor and the finding is report-only. Skip trivially small files and structural duplicates — per-package licenses, vendored copies, generated output. Two implementations of the same responsibility are the expensive cousin: detect within scope, and deciding **which track is canonical** is the user's call whenever it is not obvious — obvious means the reference asymmetry is total, one side with zero live importers. Killing the loser changes behavior — report, do not act, unless approved.

Version-iteration residue is this lens's self-labeling form. LLM iteration leaves files and symbols named `legacy`, `old`, `v2`, `new`, `final`, `backup`, `copy`, and forwarding wrappers or compat shims kept only because call sites were never migrated. The name is a detection signal, not a verdict — the verdict is still reachability: nothing references the old track → delete pile; live references remain → report with the migration path (move the call sites, then kill the track), never a silent rewrite.

### D. Markers (grep-cheap, verdict varies)

`TODO`/`FIXME`, commented-out code blocks, suppressed type errors, `.only`/`.skip` left in tests, feature flags whose value is constant at every read site. Three-way verdict: no longer applicable → delete; still valid but outdated → rewrite; genuine debt → list for the user to schedule, do not silently absorb.

## Stale tests

Detection heuristics, by descending confidence:

1. References symbols that no longer exist — a dangling edge, mechanically checkable
2. Skipped or expected-fail for many commits with nobody un-skipping it
3. Snapshot no test regenerates — prefer the test runner's own obsolete-snapshot report over hand-mapping snapshot conventions
4. Test theater: mocks everything, asserts nothing the system promises — grep finds the signals (mock-dense files, assertion-free bodies); the judgment itself stays report-only
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

Two standing exclusions from the batch pile, whatever the reference count: **files loaded by convention rather than reference** — framework routes, database migrations, CI workflows, tool configs — and the **public entry points of anything published**. Their consumers live outside the reference graph, so the verification gate stays green while they break. Itemized at best, and usually not candidates at all.

Findings that **edit a surviving file** — removing a dead export, pruning a barrel, rewriting a marker, repairing a comment or reference — are a different product from deletions. Never batch: itemized with the diff shown, landing in their own `chore` commit, never inside the `git rm` commit.

## Workflow

1. **Fix the scope** and say so in the report. Default is the session's touched area; a full sweep only when asked.

2. **Collect candidates** through the lenses. Search for evidence repository-wide regardless of scope. Use the project's own dead-code tooling when it exists (knip, depcheck, ts-prune, vulture, …) — a tool's output is a candidate list, never a verdict. Every candidate carries its evidence — no evidence, no finding.

3. **Capture the baseline.** Run the project's checks once before anything is deleted and record what is already red. A suite that was red before the sweep cannot convict a deletion; without the baseline, red-before is indistinguishable from red-caused.

4. **Classify** into the three piles and **report**: what, why dead, which pile — plus the directories the sweep did not cover. Wait for approval.

5. **Execute the reversible approvals, in order.** (a) Tracked deletions — one `chore` commit. (b) Surviving-file edits — a second `chore` commit, diffs exactly as approved. (c) Dependency removals via the project's package manager (e.g. `pnpm remove <dep>`) — their own commit, and green only after the checks pass on a clean install; the existing `node_modules` can hide a removed package that something else still resolves. No `Task:` trailer on any of these unless the cleanup itself is the task.

6. **Verification gate (mandatory).** Run the project's own checks — typecheck, lint, tests, build — and compare against the baseline. Green is the proof the deletions were truly dead; reachability analysis can be fooled by dynamic imports and string-built paths, the gate cannot. A new failure reverts the deletion that caused it and gets recorded, not argued with; when it cannot be attributed to a single deletion, revert the whole cleanup commit and retry in smaller batches. "No runnable checks" means the commands do not exist — slow, credential-gated, or red-at-baseline all count as runnable. When there are truly none, the deletions rest on evidence alone and the handback says exactly that.

   **Untracked deletions wait for this gate.** Only after it is green, execute the itemized untracked approvals exactly as given — they are the irreversible ones, so everything reversible is verified first.

7. **Hand back:** deleted, kept-with-reason, the report-only list, the unswept directories, and the baseline status. Session docs with an owning task are reported with a recommendation to fold them into that task's record through the record layer's own workflow — this skill never writes task records. Orphan session docs with no owning task are report-only and never deleted: they may be the only written trace of a decision.

## Prevention

The sweep is the cure; prevention is birth rules, and they already exist — temp artifacts are born under `.ai/.tmp/`, session documents belong in the task record, generated output belongs in `.gitignore`. When the sweep keeps finding the same class of leftover, the fix is the birth rule upstream, and that observation belongs in the handback.

## Rules

- Never delete without stated evidence, and never expand a deletion beyond what was approved.
- Never delete an untracked file without itemized approval — there is no undo.
- Never touch gitignored files; `.env` and credential files are never candidates.
- Never treat a green suite as proof that deleting a *test* was safe.
- Never rewrite logic; behavior-changing findings are report-only.
- Never mix cleanup deletions into a feature commit.
- Never satisfy the verification gate by deleting or weakening the check that failed.
- Never touch task records or their archives — they are the record layer, and archiving is their lifecycle, not deletion.
- No secrets, credentials, or tokens quoted in the report.

---
name: acceptance-campaign
description: >-
  Use when coordinating broad acceptance, regression, or pre-release testing
  and fixing across many features. Not for a single case or reproduction.
---

# Acceptance Campaign

You are the coordinator. If you received a unit brief instead, follow the brief and skip this file.

## Lane

Run every check against one lane: the running services, data stores, configuration, and client
slots.

- Run test batches in parallel only across slots and data partitions; give each slot and each
  partition to one batch at a time. A batch may hold several slots for a cross-system journey. A
  batch holds every partition it writes and every shared state its acceptance depends on: the
  whole group when a write affects it (attendance affects a class), and any shared object it
  changes (an organization-wide setting, an identity's roles, a shared catalog, a global flag).
  Share only stable read-only content. Put work whose effects cannot be separated in a window. Run
  fix and integration work off the lane, in worktrees, disposable databases, and local test runs.
- Change the lane only through the lane operator and only while no test batch runs. Record the
  lane closed while a change, a fault, or a resume is under way, and open it again once the
  operator's smoke check passes.
- When a unit reports a lane-level fault, record the lane closed, dispatch no test batch, wait for
  the running batches' actual handbacks, have the lane operator repair the lane, and re-judge the
  evidence taken during the fault.
- Run exclusive work (fault injection, data resets, switching device time zones for a test) in a
  window recorded in `progress.md`, opened only after every test batch has handed back and ended
  with a verified restore.
- To run more batches at once, have the lane operator add slots. Run work that needs a second
  running environment as a separate campaign.

## Units

Write each brief from its template in [references/units.md](references/units.md) and fill every
placeholder before dispatch: find a missing fact in the records, by a read-only check, or by
asking the user.

- **Lane operator** starts, syncs, changes configuration, seeds data, smoke-checks, repairs, and
  restores the lane, and owns the runbook.
- **Test batch** runs checks on the slots and partitions it holds.
- **Fix unit** fixes and verifies in its own worktree from the lane head, within the modules it
  owns.
- **Integrator** assembles candidate lane heads and prepares the main-line landing, in fresh
  worktrees.

Within a session, reuse one agent for the lane operator and one for the integrator. Do short work
that needs no slot yourself, such as a read-only check or a records update.

## Rules

1. Prove what is loaded with a marker that carries the build or version: a version string in a
   bundle or log line, a version field, a registration hash, or a probe whose result differs
   between the old and new code. Never accept a ready line or a git ref as proof, and count a probe
   only for the service and path it covers.
2. Keep switches with wide side effects (automatic moderation, background processing of shared data,
   real model calls, real outbound messages) on only during their window or where a ruling keeps
   them on, and record their state in the Lane section. If one is on without a ruling, ask the
   user and leave it as it is meanwhile.
3. Keep a write whose outcome is unknown pending under its original operation (command id,
   request, or draft); check its result instead of resending it as a new operation.
4. Surface an action refused by a permission check to the user; no agent retries it another way.
5. Never bypass repository hooks. Land on the main line and push only under existing authorization;
   when the user pushes, hand them the commands.
6. Touch only checkouts, worktrees, devices, and services the campaign owns. Write temporary files,
   including unit work dirs, in a scratch directory. Before removing anything, resolve real paths
   and skip symlinks.
7. Verify a mechanism before explaining it to the user, and label anything inferred.
8. Take every time you record from the system clock, and derive planned times from it.

## Records

Keep the campaign directory outside every worktree: use the location the user's instructions name
for presentation artifacts, otherwise `<Desktop>/acceptance-campaign/<slug>/`, with a kebab-case
slug. Put `progress.md`, the rendered `index.html`, `evidence/`, and, if the project has none, the
runbook there.

- Write `progress.md` yourself, as one current snapshot, in the format of
  [references/progress-format.md](references/progress-format.md). Keep its Lane section complete
  enough to resume from without asking.
- After each change, run `node <skill-dir>/scripts/render-progress.mjs <campaign-dir>/progress.md`,
  where `<skill-dir>` is the directory of this file. Fix every error and rewrite every warned cell
  before telling the user the page is current; never edit `index.html`.
- Keep screenshots, recordings, logs, and API captures under `evidence/`. Leave adopted evidence
  where it is and link to it.
- At each landing, sync decisive results, rulings, handoff items, and gaps into the mapped
  repository task records through the repository's task workflow.
- Write a requested handoff document as a current snapshot of state, next steps, and constraints,
  and point it to `progress.md`.

## Process

### Plan

1. Continue a campaign in a new session through Resume, on its existing `progress.md`. Only when
   adopting another set of records, transcribe them into `progress.md` in a new campaign
   directory: rows, handoff items, findings, blockers, lane facts, and the user decisions that
   rank as rulings. Check that every row and open item made it in, tell the user the old records
   will no longer be updated, and add anything found missing later with a note in the Summary.
2. List rows with their acceptance condition for the lane's scope, including the evidence
   qualification it requires (for example "iOS simulator and Android emulator"), and any existing
   result with its baseline. Name hardware `physical device` and virtual targets `simulator` or
   `emulator`; never write a bare "device". Reuse valid results.
3. Map each ledger to its repository task in the `Tasks` header. Record missing mappings instead
   of creating tasks or widening scope.
4. Fill the Lane section as progress-format.md requires. Confirm the runbook rebuilds the lane from
   files alone and covers: the worktrees, stores, and ports the campaign owns; the environment
   file; start and sync steps; smoke checks (health routes, invariants, allow-list entries, read
   routes, load proofs, device time zones); sign-in per slot; how to read server state for
   second-channel checks; the authorized business write APIs and their tools; how fix units get,
   isolate, and clean up disposable databases; project constraints; and known traps. If the
   project has no runbook, have the lane operator write one in the campaign directory.
5. Schedule time-gated rows (next-day due items, opening hours, expiry) now. Before creating,
   seeding, or consuming test data, read [references/test-data.md](references/test-data.md).
6. Put work that unblocks other rows first. Write `progress.md` and render it before the first
   dispatch.

### Dispatch

- Before each dispatch, re-read `progress.md` and record the unit under Units with what it holds.
  Keep each entry, with its state, branch or head, verification evidence, and next step, until its
  work is adopted or discarded.
- Dispatch a test batch only when every slot and partition it needs is free; name in its brief
  what it holds and any time gate as its Not-before time. Treat a resource as held until its unit
  actually hands back.
- Run fix units in parallel, each from the current lane head with its own modules. Before a fix
  unit changes code outside its modules, reassign ownership. Let each fix unit regenerate the
  generated files its gates require, following the repository's rules for locks and pins; the
  integrator rebuilds them after merging.
- Leave a running unit's slot, partitions, and worktree alone.

### Triage

Classify every finding before acting on it:

| Kind | Example | Disposition |
| --- | --- | --- |
| `defect` | In-scope behavior is wrong or missing: a draft locks forever after a rejected save | Fix unit, then retest on the lane; ask the user whether to fix now or defer only when the fix needs a new product decision, a breaking contract change, or work beyond the authorized scope |
| `design` | A board intentionally shows only today | Document where the design lives; judge the row on it |
| `gap` | A capability whose scope is unconfirmed: a second account owner | Ask for a ruling; in scope, treat it as a defect; out of scope, register it in the task's gap list and judge on substitute evidence only under that ruling |
| `environment` | A launcher forces a feature switch off | Fix the lane or runbook |
| `ruling` | A capacity limit or a label is undecided | Ask the user; continue unaffected work |
| `handoff` | The check needs a real identity provider | Move it to the handoff package |

Never lower an acceptance condition or widen scope by classifying a finding. Before calling a
finding a defect, check the required switches, rebuilt artifacts, and loaded baseline; rule out
tool artifacts (inspector caches, input typed by automation tools), other writers (including the
user's own actions), and device limits; and re-observe it through a second channel such as a server
read. Grade defects P1 (lost or wrong data, security, a blocked main user flow), P2 (a broken flow
with a workaround), or P3 (polish). Fix P1 and P2 in the campaign, and P3 when the user agrees.

### Rulings

- Ask with options, a recommended default, and the rows each option affects. Batch the questions.
- Number as a ruling every decision that changes scope, an acceptance basis, a business policy, or
  a switch with side effects; update the affected acceptance conditions and carry it to the task's
  decision record at the next landing. Record a fix-now or defer answer in the finding's
  Disposition, citing the user's decision.
- Hold only the affected rows while a ruling is pending, and never treat elapsed time as consent.
- Pass the rows of a fix that changes user-facing design only after the user confirms screenshots
  from the lane.

### Judge

- Use the statuses `not-tested`, `partial`, `passed`, `failed`, and `blocked` for judgments only,
  and track work in progress under Units. An unresolved failure of a required check makes a row
  `failed`. `blocked` means a missing implementation, account, or decision; a time gate goes to
  the Blockers table and leaves the status alone. `partial` means some required check or
  qualification is still unverified.
- Record the evidence qualification each result established: what it proves (contract, unit, API,
  emulator or simulator on a named platform, physical device, cross-system journey) and under
  which identity and data. Pass only what was established, per platform; never pass a device row
  on source, unit tests, mocks, or an API check.
- Move what the development environment cannot close (physical devices, real identity providers,
  production content moderation, real push credentials, external services) into the handoff
  package with what it needs and its release gate, linked to its rows. Pass a row when its lane
  scope is established; keep the release requirement with the handoff item, and never count a
  handoff as evidence.
- Judge after each test batch hands back: flip rows with their evidence, re-render, and tell the
  user the delta.
- When the loaded baseline changes, take the rows and components the fix units name as directly
  affected, add the rows reached through contracts, permissions, or shared logic, and retest that
  set. Turn its `passed` rows to `partial`, keeping their evidence and baseline; leave `failed`
  rows `failed` until their failed qualification is retested. A restart without a code or
  configuration change needs only the smoke check.

### Sync

While no test batch runs, bring code onto the lane only as a candidate head that passed the
repository gates. A branch that contains the current lane head and passed the gates is its own
candidate; otherwise have the integrator merge from the current lane head. Across repositories,
settle one candidate per repository and check their dependencies on each other. Then have the
lane operator fast-forward, migrate if the brief authorizes it, seed, run the final smoke check
with the load proofs, and open the lane. Record the new loaded baseline, its load proofs, and the
retest set. Run configuration changes and seeding as lane operations, not candidates. If the smoke
check fails, keep the lane closed until it is repaired or returned to the previous baseline.

### Land

When the user asks to land the lane on the main line, have the integrator prepare it from the lane
head; across repositories, the depended-on repository lands first. After the push, remove merged
unit worktrees and branches.

### Pause and resume

- Pause: dispatch nothing new, send running units a stop instruction, wait for their actual
  handbacks, and record running state, pending operations, and resume steps in `progress.md`. Keep
  the lane up, and dispatch the remaining work later as new briefs.
- Resume, including a new session on the same campaign: read `progress.md`, record the lane
  closed, re-check pending operations and Units, and have the lane operator check the runbook
  against the lane and run the smoke check; never reuse earlier readiness claims.

### Close

Close execution when every row has a current judgment with evidence or a stated reason it has
none, every row not passed has a disposition (fixed, ruled, handed off, or deferred by the user),
and nothing is pending. Report tested and untested scope, the handoff package with its release
gates, and the verified baseline, and say that execution closure is not release readiness unless
those gates are verified. Retire the lane only with the user's agreement.

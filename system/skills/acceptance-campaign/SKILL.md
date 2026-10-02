---
name: acceptance-campaign
description: >-
  Use when coordinating broad acceptance, regression, or pre-release testing
  and fixing across many features. Not for a single case or reproduction.
---

# Acceptance Campaign

You are the coordinator. If you received a unit brief instead, follow the brief and skip this file.

## 1. Boundary

Run every check against one lane: the running services, data stores, configuration, and client
slots.

- Run test batches in parallel only across slots and data partitions; give each slot and each
  partition to one batch at a time. A batch may hold several slots for a cross-system journey. A
  batch holds every partition it writes and every shared state its acceptance depends on: the
  whole group when a write affects it (attendance affects a class), and any shared object it
  changes (an organization-wide setting, an identity's roles, a shared catalog, a global flag).
  Share only stable read-only content; put work whose effects cannot be separated in a window
  (section 5).
- Run fix and integration work off the lane, in worktrees, disposable databases, and local test
  runs. Change the lane only through the lane operator and only through section 5.
- Keep switches with wide side effects (automatic moderation, background processing of shared data,
  real model calls, real outbound messages) on only during their window or where a ruling keeps
  them on, and record their state in the Lane section. If one is on without a ruling, ask the
  user and leave it as it is meanwhile.
- Keep a write whose outcome is unknown pending under its original operation (command id,
  request, or draft); check its result instead of resending it as a new operation.
- Surface an action refused by a permission check to the user; no agent retries it another way.
- Never bypass repository hooks. Land on the main line and push only under existing authorization;
  when the user pushes, hand them the commands.
- Touch only checkouts, worktrees, devices, and services the campaign owns. Write temporary files,
  including unit work dirs, in a scratch directory. Before removing anything, resolve real paths
  and skip symlinks.
- Verify a mechanism before explaining it to the user, and label anything inferred.
- Take every time you record from the system clock, and derive planned times from it.

## 2. Initialize

1. Continue a campaign through Resume (section 6), on its existing `progress.md`. Only when
   adopting another set of records, transcribe them into `progress.md` in a new campaign
   directory: rows, handoff items, findings, blockers, lane facts, and the user decisions that
   rank as rulings (section 4). Check that every row and open item made it in, tell the user the
   old records will no longer be updated, and add anything found missing later with a note in the
   Summary.
2. Keep the campaign directory outside every worktree: use the location the user's instructions
   name for presentation artifacts, otherwise `<Desktop>/acceptance-campaign/<slug>/`, with a
   kebab-case slug. Put `progress.md`, the rendered `index.html`, `evidence/` (screenshots,
   recordings, logs, API captures), and, if the project has none, the runbook there. Leave adopted
   evidence where it is and link to it.
3. Write `progress.md` yourself, as one current snapshot, in the format of
   [references/progress-format.md](references/progress-format.md): each row with its acceptance
   condition for the lane's scope and any existing result with its baseline (reuse valid results),
   and each ledger mapped to its repository task in the `Tasks` header. Record missing mappings
   instead of creating tasks or widening scope.
4. Check the runbook against the lane operator's runbook duty in
   [references/units.md](references/units.md); if it is missing or incomplete, have the lane
   operator complete it.
5. Schedule time-gated rows (next-day due items, opening hours, expiry) now. Before creating,
   seeding, or consuming test data, read [references/test-data.md](references/test-data.md).
6. Put work that unblocks other rows first.
7. After every change to `progress.md`, run
   `node <skill-dir>/scripts/render-progress.mjs <campaign-dir>/progress.md`, where `<skill-dir>`
   is the directory of this file. Fix every error and rewrite every warned cell before telling the
   user the page is current; never edit `index.html`.

## 3. Dispatch

1. Pick the unit. Within a session, reuse one agent for the lane operator and one for the
   integrator. Do short work that needs no slot yourself, such as a read-only check or a records
   update.
   - **Lane operator** changes, smoke-checks, and restores the lane (section 5), and owns the
     runbook.
   - **Test batch** runs checks on the slots and partitions it holds.
   - **Fix unit** fixes in its own worktree from the current lane head, within the modules it owns.
   - **Integrator** assembles candidate lane heads (section 5) and prepares the main-line landing
     (section 6), in fresh worktrees.
2. Write the brief from its template in [references/units.md](references/units.md) and fill every
   placeholder: find a missing fact in the records, by a read-only check, or by asking the user.
3. Re-read `progress.md` and check resources. Dispatch a test batch only when every slot and
   partition it needs is free, with any time gate as its Not-before time. Give fix units disjoint
   modules, and reassign ownership before one changes code outside its modules. Treat a resource
   as held until its unit actually hands back, and leave a running unit's slot, partitions, and
   worktree alone.
4. Dispatch, and record the unit under Units with what it holds. Keep the entry, with its state,
   branch or head, verification evidence, and next step, until its work is adopted or discarded.

## 4. Receive and judge

After each handback, judge its rows, update `progress.md`, re-render, and tell the user the delta.

- Judge with the statuses defined in progress-format.md. Pass only what a result established, per
  platform, under the identity and data it used; never pass a device row on source, unit tests,
  mocks, or an API check. Name hardware `physical device` and virtual targets `simulator` or
  `emulator`.
- Keep acceptance conditions to the lane's scope. Move what the development environment cannot
  close (physical devices, real identity providers, production content moderation, real push
  credentials, external services) into the handoff package with what it needs and its release
  gate, linked to its rows. Pass a row when its lane scope is established, and never count a
  handoff as evidence.
- Classify every finding:

  | Kind | Condition | Action |
  | --- | --- | --- |
  | `defect` | In-scope behavior is wrong or missing | Fix unit, then retest on the lane |
  | `design` | The behavior matches the design | Record where the design lives; judge the row on it |
  | `gap` | The capability's scope is unconfirmed | Ask for a ruling: in scope, it becomes a defect; out of scope, register it in the task's gap list and judge on substitute evidence only under that ruling |
  | `environment` | The lane, not the product, causes it | Fix the lane or runbook through section 5 |
  | `ruling` | A product decision is open | Ask the user; continue unaffected work |
  | `handoff` | Only an environment outside the lane can check it | Move it to the handoff package |

- Before calling a finding a defect, rule out the lane (switches, rebuilt artifacts, loaded
  baseline), tools (caches, automated input), other writers (including the user), and device
  limits, and re-observe it through a second channel such as a server read. Grade defects P1
  (lost or wrong data, security, a blocked main user flow), P2 (a broken flow with a workaround),
  or P3 (polish); fix P1 and P2 in the campaign and P3 when the user agrees. Never lower an
  acceptance condition or widen scope by classifying.
- Ask the user with options, a recommended default, and the rows each option affects, batching the
  questions: every open ruling, and whether to fix a defect now or defer it, but only when the fix
  needs a new product decision, a breaking contract change, or work beyond the authorized scope.
  Record a fix-now or defer answer in the finding's Disposition. Number as a ruling every decision
  that changes scope, an acceptance basis, a business policy, or a switch with side effects, and
  update the affected acceptance conditions. Hold only the affected rows while a question is
  pending, and never treat elapsed time as consent.
- Pass the rows of a fix that changes user-facing design only after the user confirms screenshots
  from the lane.

## 5. Update the lane

Make every lane change through one entry: record the lane closed, dispatch no test batch, wait
until every running test batch has actually handed back, have the lane operator do the work, run
the final smoke check with the load proofs, and record the lane open. If the smoke check fails,
keep the lane closed until it is repaired or returned to the previous baseline. Record the new
loaded baseline, its load proofs, and the retest set.

- **Code**: bring code onto the lane only as a candidate head that passed the repository gates. A
  branch that contains the current lane head and passed the gates is its own candidate; otherwise
  have the integrator merge from the current lane head. Across repositories, settle one candidate
  per repository and check their dependencies on each other. The lane operator fast-forwards and
  migrates only as its brief authorizes.
- **Load proofs**: prove what is loaded with a marker that carries the build or version: a version
  string in a bundle or log line, a version field, a registration hash, or a probe whose result
  differs between the old and new code. Never accept a ready line or a git ref, and count a probe
  only for the service and path it covers.
- **Retest**: take the rows and components the fix units name as directly affected, add the rows
  reached through contracts, permissions, or shared logic, and retest that set. Turn its `passed`
  rows to `partial`, keeping their evidence and baseline; leave `failed` rows `failed` until their
  failed qualification is retested. A restart without a code or configuration change needs only
  the smoke check.
- **Configuration and seeding**: run them as lane operations, after code and migrations and before
  the final smoke check.
- **Window**: run exclusive work (fault injection, data resets, switching device time zones for a
  test) inside the entry, record the window in `progress.md`, and end it with a verified restore.
- **Fault**: when a unit reports a lane-level fault, take the entry at once, have the lane operator
  repair the lane, and re-judge the evidence taken during the fault.
- **Slots**: to run more batches at once, have the lane operator add slots. Run work that needs a
  second running environment as a separate campaign.

## 6. Pause, resume, land, and close

- **Pause**: dispatch nothing new, send running units a stop instruction, wait for their actual
  handbacks, and record running state, pending operations, and resume steps in `progress.md`. Keep
  the lane up, and dispatch the remaining work later as new briefs.
- **Resume**, including a new session on the same campaign: read `progress.md`, record the lane
  closed, re-check pending operations and Units, and have the lane operator check the runbook
  against the lane and run the smoke check; never reuse earlier readiness claims.
- **Land**: when the user asks to land the lane on the main line, have the integrator prepare it
  from the lane head, with the depended-on repository first, and sync decisive results, rulings,
  handoff items, and gaps into the mapped repository task records through the repository's task
  workflow. After the push, remove merged unit worktrees and branches.
- **Handoff**: write a requested handoff document as a current snapshot of state, next steps, and
  constraints, and point it to `progress.md`.
- **Close** execution when every row has a current judgment with evidence or a stated reason it
  has none, every row not passed has a disposition (fixed, ruled, handed off, or deferred by the
  user), and nothing is pending. Report tested and untested scope, the handoff package with its
  release gates, and the verified baseline, and say that execution closure is not release
  readiness unless those gates are verified. Retire the lane only with the user's agreement.

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
  partition to one batch at a time. Let a batch hold several slots for a cross-system journey. A
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
   directory: rows, handoff-package items, findings, blockers, lane facts, and the user decisions
   that rank as rulings (section 4). Check that every row and open item made it in, tell the user
   the old records will no longer be updated, and add anything found missing later with a note in
   the Summary.
2. Keep the campaign directory outside every worktree: use the location the user's instructions
   name for presentation artifacts, otherwise `<Desktop>/acceptance-campaign/<slug>/`, with a
   kebab-case slug. Put `progress.md`, the rendered `index.html`, `evidence/` (screenshots,
   recordings, logs, API captures), and, if the project has none, the runbook there. Leave adopted
   evidence where it is and link to it.
3. Write `progress.md` yourself, as one current snapshot, in the format of
   [references/progress-format.md](references/progress-format.md): each row with its acceptance
   condition for the lane's scope and any existing result with its baseline (reuse valid results),
   each ledger mapped to its repository task in the `Tasks` header, and this session named in the
   `Coordinator` header. Record missing mappings instead of creating tasks or widening scope.
4. Check the runbook against the lane operator's runbook duty in
   [references/units.md](references/units.md); if it is missing or incomplete, have the lane
   operator complete it.
5. Schedule time-gated rows (next-day due items, opening hours, expiry) now. Before creating,
   seeding, or consuming test data, read [references/test-data.md](references/test-data.md).
6. Plan the first candidate: the fixes it will carry, the formal gates and permissions it needs,
   its main blocker, and the rows to retest once it loads. Write it as the first item of
   Next, and order the rest so work that unblocks the candidate or other rows comes first.
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
     Dispatch a longer read-only investigation as a fix unit whose goal is a report and that
     changes no code.
   - **Integrator** assembles candidate lane heads (section 5) and prepares the main-line landing
     (section 6), in fresh worktrees.
2. Write the brief from its template in [references/units.md](references/units.md) and fill every
   placeholder: find a missing fact in the records, by a read-only check, or by asking the user.
3. Re-read `progress.md` and check resources. Dispatch a test batch only when every slot and
   partition it needs is free, with any time gate as its Not-before time. Give fix units disjoint
   modules, and reassign ownership before one changes code outside its modules. Treat a resource as
   held until its unit actually hands back, and leave a running unit's slot, partitions, and
   worktree alone.
   - Keep one candidate in flight, and dispatch fix units only for it or the next one. While
     handed-back code waits for sync, assemble and load it before dispatching new fix work. When a
     fix's blocker has no near unlock, take that fix and the fixes that depend on it out of the
     candidate, mark them `stopped`, and load the rest.
   - Dispatch a fix that depends on another unit's change only after that change is handed back,
     branched from its head and named in the brief's Depends on line. When a prerequisite stops,
     tell the units that depend on it.
4. Record the unit under Units with the resources it reserves and the state `dispatching`, then
   dispatch it, then add its agent and set it `running`. Keep the entry, with its state, branch or
   head, verification evidence, and next step, until its work is adopted: a test batch once its
   results are judged into `progress.md`, a lane operation once it is recorded under Loaded, and a
   fix unit or integrator once its code lands on the main line or is discarded. Mark code awaiting
   sync `handed back`, code on the lane awaiting landing `on lane`, and code that is unfinished,
   blocked, or rejected `stopped`; never take `stopped` code into a candidate or a landing.

## 4. Receive and judge

After each handback, judge its rows, update `progress.md` and its Summary, re-render, and tell the
user the delta. For every code handback, decide at once: into the candidate, back to its fix unit
with what to fix, or waiting on whom for what; record the decision as the unit's next step. Admit
code into the candidate only when it returns every Return item of its brief, including the
reader-side verification of a cross-layer change.

- Judge with the statuses defined in progress-format.md. Pass only what a result established, per
  platform, under the identity and data it used; never pass a device row on source, unit tests,
  mocks, or an API check. Name hardware `physical device` and virtual targets `simulator` or
  `emulator`.
- Mark a row `failed` as soon as a required check fails, before its cause is confirmed, with
  Remaining naming the confirmation; file the finding once it is classified.
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
  or P3 (polish); fix P1 and P2 within the authorized scope by default, and P3 when the user
  agrees. Never lower an
  acceptance condition or widen scope by classifying.
- Ask the user about each open ruling, including a fix that needs a new product decision.
- Ask whether to fix a defect now or defer it only when the fix needs a breaking contract change
  or work beyond the authorized scope. Record the answer in the finding's Disposition.
- Ask with options, a recommended default, and the rows each option affects, batching the
  questions. Do not ask a pending question again while its facts and options are unchanged; ask
  again after new evidence or a change of scope. Hold only the affected rows while a question is
  pending, and never treat elapsed time as consent.
- Number as a ruling every decision that changes scope, an acceptance basis, a business policy, or
  a switch with side effects, and update the affected acceptance conditions.
- Pass the rows of a fix that changes user-facing design only after the user confirms screenshots
  from the lane.

## 5. Update the lane

Make every lane change through one entry: record the lane closed, dispatch no test batch, wait
until every running test batch has actually handed back, have the lane operator do the work, run
the final smoke check with the load proofs, and record the lane open. If the smoke check fails,
keep the lane closed until it is repaired or returned to the previous baseline. Record the new
loaded baseline and its load proofs under Loaded, and write the next candidate as the first item of
Next.

- **Code**: bring code onto the lane only as a candidate head that passed the formal gates: the
  checks and artifacts (locks, pins, generated files) the repository requires before code loads or
  lands. A branch that contains the current lane head and passed them is its own candidate;
  otherwise have the integrator merge from the current lane head. Across repositories, settle one
  candidate per repository and check their dependencies on each other. Assemble candidates off the
  lane before taking the entry; test batches may run meanwhile. The lane operator fast-forwards and
  migrates only as its brief authorizes.
- **Load proofs**: prove what is loaded for each changed service and client with existing version
  information (a version string in a bundle or log line, a version field, a registration hash) or
  a read-only probe whose result differs between the old and new code. Where neither exists, have
  a fix unit add a minimal load marker. Use a business write as a probe only when the brief
  authorizes it, on a disposable sample, inside the entry before the lane opens, and record the
  sample as consumed. Never accept a ready line, a git ref, or a passing retest as a load proof,
  and count a probe only for the service and path it covers.
- **Retest**: take the rows and components that the fix units or the lane operator name as directly
  affected by this lane change, add the rows reached through contracts, permissions, or shared
  logic, and retest that set. Turn its `passed` rows to `partial`, keeping their evidence and
  baseline, and leave `failed` rows `failed` until their failed qualification is retested; set each
  row's Remaining to the retest and list the retest in Next. For a row whose change crosses layers,
  take the evidence on the reader side. If the retest needs consumed samples, seed replacements
  first (references/test-data.md). After a restart without a code or configuration change, run
  only the smoke check.
- **Configuration and seeding**: run them as lane operations, after code and migrations and before
  the final smoke check.
- **Window**: run exclusive work (fault injection, data resets, switching device time zones for a
  test) inside the entry, record the window as the lane operator's entry under Units, and end it
  with a verified restore.
- **Bad data after load**: when a retest shows that loaded code writes wrong data or breaks rows
  that passed, close the affected partitions, then either return to the previous baseline through
  the entry or load a forward fix as the next candidate; record the choice.
- **Fault**: when a unit reports a lane-level fault, send running test batches a stop instruction,
  take the entry, have the lane operator repair the lane, and re-judge the evidence taken during
  the fault.
- **Slots**: to run more batches at once, have the lane operator add slots. Run work that needs a
  second running environment as a separate campaign.

## 6. Pause, resume, land, and close

- **Pause**: dispatch nothing new, send running units a stop instruction, wait for their actual
  handbacks, and record running state, pending operations, and resume steps in `progress.md`.
  Reserve the partitions of an interrupted chain, note any due time that falls inside the pause,
  and dispatch no checks. Keep the lane up, and dispatch the remaining work later as new briefs.
- **Resume**, including a new session on the same campaign: read the `Coordinator` header and
  Units in `progress.md`; if another coordinator is still active, ask the user before acting.
  Otherwise set `Coordinator` to this session, read the handoff document if there is one, record
  the lane closed, re-check pending operations and Units, check the runbook as in section 2, have
  the lane operator run the smoke check, and record the lane open once it passes; never reuse
  earlier readiness claims.
- **Land**: when the user asks to land the lane on the main line, first list the failed rows and
  open P1 and P2 findings caused by lane code, and leave that code out or get the user's
  agreement. Have the integrator prepare the landing from the lane head, with the depended-on
  repository first, and sync decisive results, rulings, handoff items, and gaps into the mapped
  repository task records through the repository's task workflow. After the push, move the
  evidence the records cite into `evidence/`, then remove the merged unit worktrees, branches, and
  Units entries.
- **Handoff**: write a requested handoff document as a current snapshot of state, next steps, and
  constraints, and point it to `progress.md`.
- **Close** execution when every row has a current judgment with evidence or a stated reason it
  has none, every row not passed has a disposition (fixed, ruled, handed off, or deferred by the
  user), and nothing is pending. Report tested and untested scope, the handoff package with its
  release gates, and the verified baseline, and say that execution closure is not release
  readiness unless those gates are verified. Retire the lane only with the user's agreement.

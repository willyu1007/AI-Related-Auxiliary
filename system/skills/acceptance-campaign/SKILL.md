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
slots. A fix joins the campaign baseline once it lands on the lane.

- Run test batches in parallel only across slots and data partitions; each slot and each
  partition belongs to one batch at a time. A batch may hold several slots for a cross-system
  journey. Partitions never overlap: when a write affects a whole group (attendance affects a
  class), the group is the partition, and when a batch must change something other partitions
  also read (an organization-wide setting, a shared catalog, a global flag), that shared object is
  a partition held by that batch. Run fix and integration work off the lane, in worktrees,
  disposable databases, and local test runs.
- Change the lane only through the lane operator and only while no test batch runs. Record the
  lane closed while a change or resume is under way, and open again once the operator's smoke
  check passes.
- Run exclusive work (fault injection, data resets, switching device time zones for a test) in a
  window recorded in `progress.md`, with every test batch stopped, ending with a verified restore.
  Setting device time zones to the business time zone is part of the smoke check.
- To run more batches at once, have the lane operator add slots. Work that needs a second running
  environment is a separate campaign.

## Units

Dispatch bounded units and judge their handbacks; to stop, dispatch nothing new. Write each brief
from its template in [references/units.md](references/units.md) and fill every placeholder before
dispatch: find a missing fact in the records, by a read-only check, or by asking the user, because
the unit cannot.

- **Lane operator** starts, syncs, changes configuration, seeds data, smoke-checks, and restores
  the lane, and owns the runbook.
- **Test batch** runs checks on the slots and partitions it holds.
- **Fix unit** fixes and verifies in its own worktree from the lane head.
- **Integrator** prepares the main-line landing in fresh worktrees and returns push commands.

Within a session, reuse one agent for the lane operator and one for the integrator. Do short work
that needs no slot yourself, such as a read-only check or a records update.

## Rules

1. Prove the loaded baseline with a runtime marker such as a bundle string, a ready line, or a
   version or registration hash; a git ref does not prove what runs.
2. Keep switches with wide side effects (automatic moderation, background processing of shared data,
   real model calls, real outbound messages) on only during their window or where a ruling keeps
   them on, and record their state in the Lane section of `progress.md`. If one is on without a
   ruling, ask the user and leave it as it is meanwhile.
3. Keep a write whose outcome is unknown pending under its original operation (command id,
   request, or draft); check its result instead of resending it as a new operation.
4. Surface an action refused by a permission check to the user; no other agent retries it.
5. Never bypass repository hooks. Land on the main line and push only under existing authorization;
   when the user pushes, hand them the commands.
6. Touch only checkouts, worktrees, devices, and services the campaign owns. Write temporary files,
   including unit work dirs, in a scratch directory. Before removing anything, resolve real paths
   and skip symlinks.
7. Verify a mechanism before explaining it to the user, and label anything inferred.
8. Take every time you record from the system clock.

## Records

Keep the campaign directory outside every worktree: use the location the user's instructions name
for presentation artifacts, otherwise `<Desktop>/acceptance-campaign/<slug>/`, with a kebab-case
slug. It holds `progress.md`, the rendered `index.html`, `evidence/`, and the runbook when the
project has none of its own.

- Write `progress.md` yourself, as one current snapshot, in the format of
  [references/progress-format.md](references/progress-format.md). Its Lane section must let a fresh
  coordinator resume without asking.
- After each change, run `node <skill-dir>/scripts/render-progress.mjs <campaign-dir>/progress.md`.
  Fix every error and rewrite every warned cell before telling the user the page is current; never
  edit `index.html`.
- Keep the lane's current state in the Lane section and how to operate it in the runbook:
  environment file, ports and processes, health routes, allow-list entries, read routes, where
  client markers show, sign-in per slot, and the project constraints every unit follows.
- Keep screenshots, recordings, logs, and API captures under `evidence/`. Leave adopted evidence
  where it is and link to it.
- At each landing, sync decisive results, rulings, handoff items, and gaps into the mapped
  repository task records through the repository's task workflow.
- Write a requested handoff document as a current snapshot of state, next steps, and constraints,
  and point it to `progress.md` for rows and lane facts.

## Process

### Plan

1. When adopting a campaign already in flight, transcribe its current records into `progress.md` in
   a new campaign directory: rows, handoff items, findings, blockers, lane facts, and every user
   decision as a numbered ruling. Check that every row and open item of the source made it in, and
   tell the user the old records will no longer be updated. Add anything found missing later and
   note it in the Summary.
2. List rows with their acceptance condition, including the evidence qualification it requires
   (for example "iOS and Android device"), and any existing result with its baseline. Reuse valid
   results.
3. Map each ledger to its repository task in the `Tasks` header. Record missing mappings instead
   of creating tasks or widening scope.
4. Fill the Lane section as progress-format.md requires. Confirm the runbook rebuilds the lane from
   files alone and covers the worktrees, stores, and ports the campaign owns; start and sync steps;
   smoke checks (health routes, invariants, allow-list entries, read routes); how to read server
   state for second-channel checks; and known traps. If the project has no runbook, have the lane
   operator write one in the campaign directory.
5. Schedule time-gated rows (next-day due items, opening hours, expiry) now, seed their samples in
   advance, and record them under Objects with the business time zone. Use real time: never
   change device clocks, and have the lane operator set device time zones to the business time
   zone unless a row needs another.
6. Put work that unblocks other rows first. Write `progress.md` and render it before the first
   dispatch.

### Dispatch

- Before each dispatch, re-read `progress.md`, then record the unit under Units with what it
  holds. Dispatch a test batch only when every slot and partition it needs is free, and name in its
  brief what it holds and any time gate as its Not-before time. Run fix units in parallel with
  disjoint file ownership, each from the current lane head.
- Before a window, stop every test batch yourself; the lane operator cannot see them.
- Leave a running unit's slot, partitions, and worktree alone.

### Test data

- Create data only through the product or the project's fixture scripts, never by writing stores
  directly. Build a fixture script as a fix unit with an integration test on a disposable
  database; it requires a confirm word, is idempotent, names every object as synthetic, and prints
  what it created. The lane operator seeds it as a lane change, while no test batch runs.
- Give each data set its own partition, recorded under Partitions, with its objects under Objects.
  If the set needs lane configuration (allow-lists, gates), seeding includes that lane change.
- Use the existing sign-in identities; new ones come from the user. Destructive flows use up
  disposable identities, so plan one per destructive case and record which are spent.
- Upload only synthetic media or public sample images, and only into the batch's partitions:
  background jobs such as matching or moderation process everything they can reach.
- Keep fixture timestamps on real time when a row checks time behavior; seed time-gated samples
  ahead instead of backdating them.
- Data a fixture created does not count as evidence for the flow that normally creates it; tag such
  results `fixture` in the qualification.
- A lane stand-in for an external service (automatic moderation, a fake push gateway) is a switch
  with wide side effects: it needs a ruling, and what it replaces goes to the handoff package.
  Mocks below the lane (unit and contract tests) never pass a row.
- Record leftover data under Partitions; whether it is removed is decided when the lane retires.

### Triage

Classify every finding before acting on it:

| Kind | Example | Disposition |
| --- | --- | --- |
| `defect` | A draft locks forever after a rejected save | Fix unit, then retest on the lane |
| `design` | A board intentionally shows only today | Document where the design lives; judge the row on it |
| `gap` | No write path exists for a second account owner | Register in the task's gap list; judge on substitute evidence only under a ruling |
| `environment` | A launcher forces a feature switch off | Fix the lane or runbook |
| `ruling` | A capacity limit or a label is undecided | Ask the user; continue unaffected work |
| `handoff` | The check needs a real identity provider | Move it to the handoff package |

Before calling a finding a defect, check the required switches, rebuilt artifacts, and loaded
baseline; rule out tool artifacts (inspector caches, input typed by automation tools), other
writers (including the user's own actions), and device limits; and re-observe it through a second
channel such as a server read. Grade defects P1 (lost or wrong data, security, a blocked main user
flow), P2 (a broken flow with a workaround), or P3 (polish). Fix P1 and P2 in the campaign, and P3
when the user agrees.

### Rulings

- Ask with options, a recommended default, and the rows each option affects. Batch the questions.
- Number each accepted ruling, update the affected acceptance conditions, and carry it to the
  task's decision record at the next landing.
- Hold only the affected rows while a ruling is pending; elapsed time is not consent.
- Pass the rows of a fix that changes user-facing design only after the user confirms screenshots
  from the lane.

### Judge

- Use the statuses `not-tested`, `partial`, `passed`, `failed`, and `blocked`; they record
  judgments only, and work in progress shows under Units. An unresolved failure
  of a required check makes a row `failed`. `blocked` means a missing implementation, account, or
  decision; a time gate goes to the Blockers table and leaves the status alone. `partial` means
  some required check or qualification is still unverified.
- Record the evidence qualification each result established: what it proves (contract, unit, API,
  emulator or simulator on a named platform, physical device, cross-system journey) and under
  which identity and data. Pass only what was established, per platform; source, unit tests, or an
  API check do not pass a device row.
- Move what the development environment cannot close (real identity providers, production content
  moderation, real push credentials, external services) into the handoff package with what it needs
  and its release gate. A partial row lists only the remainder the lane can obtain; once that is
  established, pass the row and leave the handed-off part in the handoff package.
- Judge after each test batch hands back: flip rows with their evidence, re-render, and tell the
  user the delta.
- When the loaded baseline changes, retest before they pass again the rows the incoming fixes name
  and every row that uses the screens, services, or switches those fixes change. A known
  failure stays until its failed qualification is retested.

### Sync

While no test batch runs, have the lane operator bring verified fixes onto the lane. Record the new
loaded baseline and the rows to retest. If the smoke check fails, keep the lane closed until it is
repaired or returned to the previous baseline.

### Land

When the user asks to land the lane on the main line, have the integrator prepare it from the lane
head; across repositories, the depended-on repository lands first. After the push, remove merged
unit worktrees and branches.

### Pause and resume

- Pause: dispatch nothing new, collect the running handbacks, and record running state, pending
  operations, and resume steps in `progress.md`. Keep the lane up.
- Resume: read `progress.md`, record the lane closed, re-check pending operations, and have the
  lane operator check the runbook against the lane and run the smoke check; earlier readiness
  claims do not carry over.

### Close

Close execution when every row has a current judgment with evidence or a stated reason it has
none, every row not passed has a disposition (fixed, ruled, handed off, or deferred by the user),
and nothing is pending. Report tested and untested scope, the handoff package with its release
gates, and the verified baseline, and say that execution closure is not release readiness unless
those gates are verified. Retire the lane only with the user's agreement.

---
name: acceptance-campaign
description: >-
  Use when a broad acceptance, regression, staging, or pre-release effort must
  test and fix many features across platforms, devices, roles, or repositories,
  with coordinated agents, per-feature judgments, and visible progress. Not for
  a single case, one unit test, or a one-off reproduction.
---

# Acceptance Campaign

You coordinate the campaign. If you were dispatched as a unit with a brief, read only your section
of [references/units.md](references/units.md) and the sections your brief names; do not run the
process below.

## Model

The campaign runs on **one lane**: the single running environment of services, data stores,
configuration, and the clients that test against it. The lane's code line is also the integration
line; a fix is integrated once it lands on the lane.

- **Slots** are the devices or clients on the lane. One operator per slot; batches on different
  slots run at the same time.
- **Data partitions** are the tenants, groups, identities, and records each batch may write. One
  writer per object.
- **Sandboxes** are worktrees, disposable databases, and local test runs outside the lane. Fix and
  integration work runs there in parallel and never touches the lane.
- Only the lane operator changes the lane, and only between batches.

More than one lane is out of scope. When the work needs more throughput than the lane's slots
provide, split it into separate campaigns.

## Terms

- **Row**: one acceptance item in a ledger, with an id, acceptance condition, status, evidence
  qualification, remaining work, and evidence links.
- **Ledger**: a named set of rows judged and counted together, such as screens, cross-system
  chains, or a feature register.
- **Evidence qualification**: what a result establishes (contract, unit, API, emulator or simulator
  on a named platform, physical device, cross-system journey) and under which identity and data
  (development identity, fixture, synthetic data).
- **Baseline**: the code and configuration a result was obtained on. The loaded baseline (what
  runs) and the committed baseline (what a branch says) are recorded separately.
- **Finding**: an observation that has not been triaged yet.
- **Ruling**: a numbered user decision that settles behavior or changes an acceptance condition.
- **Handoff package**: items the development environment cannot close (real identity providers,
  production moderation, real push credentials, external services). Each names what it needs and
  the release gate it belongs to. Handoff items do not hold a row at partial.
- **Unit**: a bounded piece of work with a brief and a handback: a test batch, a fix unit, a lane
  operation, or an integration.
- **Runbook**: the project's file-based recipe to start, sync, smoke-check, and restore the lane,
  with its known traps.

## Roles

| Role | Does | Never |
| --- | --- | --- |
| Coordinator (you) | Plans, dispatches, triages, asks for rulings, judges rows, owns `progress.md`, talks to the user | Runs a unit's work while that unit owns it |
| Lane operator | Starts, syncs, smoke-checks, and restores the lane; keeps the runbook; runs exclusive windows | Changes product code |
| Test batch | Runs checks on one slot within its partitions; reports results with qualification | Changes the lane or code |
| Fix unit | Fixes and verifies in its own worktree from the lane head | Touches the lane |
| Integrator | Prepares the main-line landing in a fresh worktree: records, repository artifacts, gates, push commands | Pushes, or touches the lane or main checkouts |

Units are bounded: dispatch, wait for the handback, judge. Stopping means not dispatching the next
unit. Reuse the same agent for roles that gain from continuity, such as the lane operator and the
integrator. Do simple one-pass work yourself.

## Rules

1. The lane changes only through the lane operator, only while no batch runs, and opens to batches
   only after its smoke check passes.
2. One operator per slot and one writer per object. Exclusive work (fault injection, clock changes,
   data resets) runs in a declared window with every other batch stopped and ends with a verified
   restore.
3. Switches with wide side effects (automatic moderation, background matching, real model calls,
   real outbound messages) are on only during their window. Record their state in the Lane section.
4. Prove the loaded baseline with a runtime marker such as a bundle string, a ready line, or a
   version or registration hash. A git ref does not prove what runs.
5. Treat a failure as an environment suspect first: check required switches, rebuilt artifacts,
   and the loaded baseline before calling it a defect.
6. An unknown write result stays pending under its original command id. Check it; never resend it
   under a new id.
7. Never print secrets. Check environment files by key name and count only. Read secret-bearing
   documents by exact line range and redact every value.
8. An action refused by a permission check is not redone by another agent. Surface it to the user.
9. Never bypass repository hooks. Landing on the main line and pushing follow existing
   authorization; when the user pushes, hand them the commands.
10. Do not touch checkouts, worktrees, devices, or services you do not own. Before removing
    anything, resolve real paths and skip symlinks.
11. Report execution closure, not release readiness, unless the release gates are verified.

## Records

Keep the campaign directory outside every worktree. Use the location the user's instructions name
for presentation artifacts; otherwise use `<Desktop>/acceptance-campaign/<slug>/`.

- `progress.md` is the single campaign record, written only by you in the format of
  [references/progress-format.md](references/progress-format.md). It holds current facts: replace
  stale content instead of appending history.
- `index.html` is generated and never edited by hand. Run
  `node <skill-dir>/scripts/render-progress.mjs <campaign-dir>/progress.md` after every change to
  `progress.md`, and fix every reported error before telling the user the page is current.
- `evidence/` holds screenshots, recordings, logs, and API captures linked from rows. No secrets.
- Repository task records stay authoritative for their tasks. At integration checkpoints, sync
  decisive results, rulings, handoff items, and gaps into the mapped task records through the
  repository's task workflow. Do not copy task goals or plans into `progress.md`.
- A handoff document, when asked for, is a current snapshot: state, next steps, and constraints.

## Process

### 1. Plan

1. Inventory rows: acceptance condition, required qualification, and existing results with their
   baselines. Reuse valid results and record what each depends on.
2. Map rows to repository tasks by scope and ownership. Record missing mappings instead of creating
   tasks; a mapping never expands campaign scope.
3. Design the lane: slots, data partitions per planned batch, the switches each row needs,
   side-effect windows, disk and port budget, and the invariants its launchers assert. Confirm the
   runbook rebuilds the lane from files alone.
4. Schedule time-gated rows (next-day due items, opening hours, expiry) now and seed their samples
   in advance. Set device time zones and business dates explicitly; never change clocks to fake
   time.
5. Put supply that unlocks downstream rows first. Write `progress.md` and render the page before
   the first dispatch.

### 2. Dispatch

- Write each brief with the fields in [units.md](references/units.md#brief).
- Queue test batches per slot. Run fix units in parallel with disjoint file ownership, each from
  the current lane head.
- Every unit hands back immediately on a missing prerequisite or a refused action, with the unlock
  condition. Nothing waits silently.
- While a unit runs, do not change its slot, partitions, or worktree.

### 3. Triage findings

Classify each finding before acting on it:

| Kind | Example | Disposition |
| --- | --- | --- |
| `defect` | A draft locks forever after a rejected save | Fix unit, then retest on the lane |
| `design` | A board intentionally shows only today | Document where the design lives; judge the row on that basis |
| `gap` | No write path exists for a second guardian | Register in the task's gap list; judge on substitute evidence only under a ruling |
| `environment` | A launcher forces a feature switch off | Fix the lane or runbook; not a product defect |
| `ruling` | A capacity limit or a label is undecided | Ask the user; continue unaffected work |
| `handoff` | The check needs a real identity provider | Move it to the handoff package; it leaves the findings |

Before calling a finding a defect, rule out tool artifacts (inspector caches, injected input), other
writers (including the user's own manual actions), and device capability limits, and re-observe it
through a second channel such as a server read. Grade defects P1 (lost or wrong data, security, a
blocked core path), P2 (a broken path with a workaround), or P3 (polish). Fix P1 and P2 within the
campaign and P3 by agreement.

### 4. Rulings

- Ask with options, a recommended default, and the rows each option affects. Batch the questions.
- Number each accepted ruling, record it in `progress.md`, update the affected acceptance
  conditions, and sync it to the task's decision record at the next checkpoint.
- A pending ruling blocks only the rows it affects. Elapsed time is not consent.
- A fix that changes user-facing design needs the user's confirmation, with screenshots from the
  lane, before its rows pass.

### 5. Judge

- Use the statuses `not-tested`, `testing`, `partial`, `passed`, `failed`, and `blocked`. A known
  unresolved failure of a required check makes the row `failed`. `blocked` means a missing
  prerequisite; `partial` means some required qualification is still unverified.
- Pass only what was established, per platform and identity. Source, unit tests, or an API check do
  not pass a device row. Mark development identities and fixtures in the qualification.
- A partial row lists only the remaining work the development environment can obtain. Everything
  else moves to the handoff package.
- Judge in rounds after each batch: flip rows with their evidence, re-render so the counts are
  recomputed, and tell the user the delta.
- When the loaded baseline changes, rows whose behavior it touches lose their pass until retested.
  A known failure stays until the failed qualification is retested.

### 6. Sync the lane

Between batches, have the lane operator bring verified fixes onto the lane: fast-forward, rebuild
consumed artifacts, restart only affected services, reload clients, and smoke-check. Record the new
loaded baseline and the rows that need a retest. If the smoke check fails, the lane stays closed
until it is repaired or returned to the previous baseline.

### 7. Land on the main line

At a checkpoint the user wants landed, typically at the end of a day, have the integrator branch
from the lane head in a fresh worktree, write the task records, update repository-required
artifacts (locks, pins, generated files) in the repository's order, run the full repository gates
on the exact head in a clean tree, and return push commands that verify ancestry. Across
repositories, the depended-on repository lands first. Afterwards, remove merged unit worktrees and
branches.

### 8. Pause and resume

- Pause: stop dispatching, let running units hand back, and record running state, pending
  operations, and resume steps in `progress.md`. A pause is not teardown.
- Resume: read `progress.md` and the task records, then re-check the lane (ports, processes,
  devices, loaded markers, pending operations) before dispatching. Old readiness claims need fresh
  checks.

### 9. Close

Close execution when every row has a current judgment with evidence or a stated reason it has none,
every row that is not passed has a disposition (fixed, ruled, handed off, or deferred by the user),
and no unit or operation is pending. Report tested and untested scope, the handoff package with its
release gates, and the verified baseline, separately from release readiness. Retire the lane only
with the user's agreement, and keep shared or unknown-owned resources.

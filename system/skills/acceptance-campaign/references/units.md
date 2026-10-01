# Units

You were dispatched by the campaign coordinator. The shared [terms](../SKILL.md#terms) and
[rules](../SKILL.md#rules) apply to you; the coordinator's process does not. Do not talk to the
user; your handback is your report.

## Brief

The coordinator's brief gives:

- **Goal and completion**: what done means for this unit.
- **Boundary**: the rows, behaviors, files, or services in scope.
- **Baseline**: the lane head or branch to start from, and for tests the loaded baseline to expect.
- **Resources**: slot, data partitions, worktree path, ports.
- **File ownership**: the paths you may change (fix units and integrators).
- **Stuck policy**: on a missing prerequisite or a refused action, write `BLOCKER.md` in your work
  directory (what, why, unlock condition, what can still proceed) and hand back immediately.

Report a wrong or incomplete brief before doing work that depends on it.

## Handback

Return:

- **Results**: per row or behavior, what you observed, the evidence qualification, evidence paths,
  and the loaded baseline.
- **Writes and side effects**: business records created or changed, identities used, device state
  changes, and switches toggled, kept apart from read-only checks.
- **Pending**: operations with an unknown outcome, under their original ids.
- **Blockers**: unlock conditions and impact.
- **Resources**: what you return and its state (signed out, gate shown, window closed, worktree
  clean).
- **Commits**: branch, head, and the checks you ran with their exit codes.

## Lane operator

- Own the runbook: start commands, environment file location, ports, data stores, invariants, sync
  steps, smoke checks, restore steps, and known traps. The lane must be rebuildable from the runbook
  and its files alone; nothing may exist only in a process's memory.
- Launchers assert the lane's invariants (store names, registration or schema hashes) and pass
  required feature switches explicitly, because local defaults may force them off.
- Sync: fast-forward only. Note dependency, schema, or migration changes; migrate only as
  authorized and after a dump. Rebuild every built artifact the lane consumes, restart only the
  affected services, and reload the clients.
- Smoke: health; invariants; allow-lists; required switches on the running processes (names and
  counts only); key read routes for the changed rows; a loaded marker in each client.
- Exclusive window: announce it, confirm the other batches stopped, run it, restore, verify the
  restore, and close it.
- Before large builds, check free disk. Track the ports, processes, and devices the lane holds.

## Test batch

- Preflight: the loaded marker matches the brief, required switches are on, the identity is right,
  the business date and time zone are as planned, the partitions hold no foreign writes, and the
  slot is free.
- Prefer the current business date and near effective and expiry times; use separate samples for
  long waits. Do not change clocks or bypass business rules.
- Log every business write with its object and purpose. Destructive flows (account closure,
  revocation) use disposable identities or objects named in the brief. Upload only synthetic or
  public non-personal media unless the brief provides consented material.
- Before reporting a defect, rule out tool artifacts, injected-input artifacts, other writers, and
  device capability limits, and confirm through a second channel.
- Capture evidence that matches the qualification: screenshots for visual state, recordings for
  motion, server reads for persisted state.
- Exit: sign out or return to the starting gate, close any window, and record what remains in the
  partitions.

## Fix unit

- Work in your own worktree from the lane head. Never touch the lane, main checkouts, or other
  worktrees.
- Change only owned files; route cross-boundary needs to the coordinator.
- Verify the exact commit in a clean tree and read exit codes, not filtered output. Include the
  repository gates your change can affect, such as routing tables, contracts, or generated counts.
- Mark a fix whose correctness depends on runtime wiring (launchers, switches, configuration) as
  "needs smoke on sync" and say what to check.
- If the fix changes user-facing design, say so; its rows wait for the user's confirmation.

## Integrator

- Branch from the lane head in a fresh worktree and confirm the main line is an ancestor.
- Write the task records, then the repository-required artifacts in the repository's order. Across
  repositories, finish the depended-on repository first so the dependent one can pin its head.
- Run the full gates on the final head in a clean tree.
- Return the final heads and push commands that check ancestry and push without touching main
  checkouts, in dependency order. Do not push and do not bypass hooks.

## Examples

A fix unit brief:

```text
Role: fix unit. Rows: D04.
Goal: a save rejected as unknown_activity_tag refreshes the slot's tags, keeps the draft,
      and retries under a new command id.
Start: worktree <worktrees>/d04-retired-term, branch fix/d04-retired-term from lane head 86c0021f.
Own: apps/mobile/src/teacher/activity-slot/**, packages/integrations/src/teacher-board.ts
Done: tests for the rejection path; typecheck and affected suites exit 0 on the head; handback.
Stuck: write BLOCKER.md and hand back.
```

A test batch handback:

```text
Slot: android-1. Partitions: demo class A, synthetic child 01. Loaded: bundle marker found, lane 7037261a.
D04 passed (Android, development teacher identity): add domain, tag activity, record keeps the tag,
    retired tag still readable. evidence/android-r18/d04-*.png
E02 partial: 120 items read across two pages; next-day due item seeded for tomorrow.
Writes: 1 domain added; 3 records; 1 attention item appended to synthetic child 01.
Pending: none. Blockers: none.
Returned: signed out, gate shown, port forwarding unchanged.
```

# Unit brief templates

Paste the unit's template into its brief, add or drop lines as the task needs, keep the common
ending, and fill every `<placeholder>` before dispatch; never send a gap the unit would have to
guess. A line may say "per runbook <path>" when the runbook holds the fact. Make the brief stand
alone.

## Common ending

```text
Stuck: stop only the checks that depend on a missing prerequisite or a refused action. Write
BLOCKER.md in your work dir (what, why, unlock condition), finish the independent checks, then
hand back. Hand back at once if preflight fails or the lane itself misbehaves (a service down, a
smoke-level fault). Never retry a refused action another way.
Stop: on a stop instruction, start no new check and hand back at a safe point.
Hand back:
- Results: per row or behavior, what you observed or why it was not run, its evidence
  qualification, evidence paths, and the loaded baseline.
- Writes and side effects: records created or changed, identities used, device state changes,
  switches toggled; keep them apart from read-only checks.
- Pending: operations with an unknown outcome, under their original operation.
- Blockers: unlock conditions and impact.
- Resources: what you return and its state.
```

## Lane operator

```text
Role: lane operator for <campaign>. You alone change the lane.
Lane: runbook <path>; environment file <path>; slots <slot: device or URL, app id>.
Off limits: <devices, checkouts, services the campaign does not own>.
Constraints: <applicable project rules and user instructions, including this task's constraints>.
Work dir: <path>. Hand back by: <time and zone>.
Task: <start | sync to <candidate heads> | change <configuration or allow-list> | seed <fixture
command> | smoke | repair | restore | window for <purpose>>.
Sync: fast-forward only. Migrate only when this brief says so: <migrations or none>, after a dump.
Rebuild every built artifact the lane consumes, restart only the affected services, and reload the
clients.
Seed: after sync and migration and before the final smoke, check the health of the services the
fixture needs, run it, and record what it created.
Window: every test batch has handed back; run, restore, verify the restore, and close.
Smoke, last before opening the lane. If a lane process is down, restart it from the runbook, rerun
the whole smoke, and report the restart.
- health: <routes>
- invariants: <store names, registration or schema hashes>
- allow-lists: <list and its expected entries or snapshot path>
- switches on the running processes: <name=value list>
- device time zones: set to <business time zone, unless a row needs another>
- read routes for the rows the next batches test: <routes>
- load proofs for each changed service and client: <read-only method and expected result>; a
  write probe only on <disposable sample> when this brief authorizes it, recorded as consumed
Runbook: keep it able to rebuild the lane from files alone, covering the worktrees, stores, and
ports the campaign owns; the environment file; start and sync steps; smoke checks (health routes,
invariants, allow-list entries, read routes, load proofs, device time zones); sign-in per slot; how
to read server state for second-channel checks; the authorized business write APIs and their
tools; how fix units get, isolate, and clean up disposable databases; project constraints; and the
traps you hit. If there is no runbook, write it at <path>.
Check free disk before builds and installs.
Done: <condition>. Return the loaded baseline with its load proofs, changed processes and ports,
smoke results, and the rows and components a configuration or seeding change directly affects.
```

## Test batch

```text
Role: test batch. Slots, held only by you until handback: <slot: device or URL, app id, client,
sign-in>.
Rows: <id: acceptance condition; remaining work>.
Risk: <for a retest, the change it covers and what it must prove>. Reuse: <evidence kept without
rerunning, or none>.
Steps: <optional for a multi-identity or multi-client chain: ordered steps, each with identity,
client, action, expected result, and check>.
Known: <rulings, design decisions, handoff items, and open findings that bear on these rows>.
Expect: load proofs for the services and clients this batch depends on: <markers or probes>;
identities <identity per client or step>; business date <date> in <time zone>.
Partitions you hold: <partition: write or depend>. Write only in partitions marked write.
Destructive flows use <disposable identities or objects>.
Objects: <ids of the records, invitations, or samples you act on>.
Write APIs: <authorized business write APIs and tools from the runbook, or none>; use them only to
prepare a check or take API-level evidence, never in place of a required UI check.
Off limits: <other slots, devices, checkouts, services>.
Constraints: <applicable project rules and user instructions, including this task's constraints>.
Work dir: <path>. Not before: <time and zone, or none>. Hand back by: <time and zone>; if you
cannot finish by then, stop at a safe point and hand back what you have.
Preflight the load proofs, identities, and date and time zone; a mismatch is a blocker.
Use the current business date and the nearest feasible effective and expiry times, with margin
for your operations, asynchronous processing, and evidence capture.
Leave the lane's services, configuration, and code, and device clocks, unchanged.
Upload only synthetic media or public sample images, and only into your partitions.
Log every business write with its object and purpose. If a write's outcome is unknown, do not
resend it as a new operation; check it and report it as pending.
Before reporting a defect, rule out tool artifacts, input typed by automation tools, other
writers, and device limits, and confirm it through <server read route or tool>.
Evidence under <evidence dir>: screenshots for visual state, recordings for motion, server reads
for persisted state.
Exit: leave each slot at <exit state, such as signed out> and list what remains in the
partitions.
```

## Fix unit

```text
Role: fix unit. Rows or findings: <ids>. Goal: <observable behavior after the fix>.
Evidence: <finding, reproduction, evidence paths, and suspected cause marked as inference>.
Depends on: <unit and branch whose change this fix needs, or none>.
Worktree <path>, branch <branch> from <lane head, or the prerequisite's handed-back head> <head>.
Own modules: <modules>. Read any module; before changing code outside your modules, ask the
coordinator to reassign ownership.
Work dir: <path outside the worktree>. Disposable database: <per runbook <section>, or none>.
Constraints: <applicable project rules and user instructions, including this task's constraints>.
Hand back by: <time and zone, only for an integration slot or resource reservation, or none>.
Leave the lane, main checkouts, and other worktrees untouched, and do not bypass hooks.
Regenerate the generated files your gates require, and follow the repository's rules for locks and
pins.
Verify the exact commit in a clean tree and read exit codes: <typecheck, tests, and the formal
gates your change can affect, such as routing tables, contracts, or generated counts>. Verify a
cross-layer change through the reader as well as the writer.
Stop: on a stop instruction, leave unfinished changes uncommitted in your worktree and return the
changed files, the failing tests, and the step to resume from.
Done: <condition>. Return:
- the branch, head, and checks you ran with their exit codes;
- the rows and components the fix directly affects;
- migrations, dependency, manifest, or contract changes;
- a load proof for the lane: a method and the expected result that tell the new code from the old;
- whether user-facing design changed.
```

## Integrator

```text
Role: integrator. Repositories in landing order: <repository: lane head>.
Off limits: <the lane, main checkouts, and other units' worktrees>.
Constraints: <applicable project rules and user instructions, including this task's constraints>.
Work dir: <path>. Hand back by: <time and zone, only for a landing slot or resource reservation,
or none>.
Task: <assemble a candidate lane head from <fix branches> | land the lane on the main line>.
Assemble: in a fresh worktree per repository, branch from the current lane head, merge the fix
branches, rebuild the shared generated files, update locks and pins by the repository's rules, and
run the formal gates on the head in a clean tree. Check the candidates' dependencies across
repositories. Return the candidate heads, the merged branches, their combined migration,
dependency, manifest, and contract changes, and the fix units' load proofs; leave the lane to its
operator.
Land: in a fresh worktree per repository, branch from its lane head and confirm the main line is
an ancestor. Write the task records for <tasks>: decisive results, rulings <ids>, handoff items,
and gaps. Then update repository-required artifacts in the repository's order: <locks, pins,
generated files>. Finish the depended-on repository first. Run the formal gates on each final head
in a clean tree. Return the final heads and push commands that check ancestry and push without
touching main checkouts, in landing order.
Return the checks you ran and their exit codes. Do not push and do not bypass hooks.
```

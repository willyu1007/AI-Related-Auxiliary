# Unit brief templates

Paste the unit's template into its brief, keep only the lines its task needs, and append the
common ending. Fill every `<placeholder>` before dispatch; never send a gap the unit would have to
guess. A line may say "per runbook <path>" when the runbook holds the fact. Make the brief stand
alone.

## Common ending

```text
Stuck: on a missing prerequisite or a refused action, stop, write BLOCKER.md in your work dir
(what, why, unlock condition, what can still proceed), and hand back. Never retry a refused
action another way.
Hand back:
- Results: per row or behavior, what you observed, its evidence qualification, evidence paths,
  and the loaded baseline.
- Writes and side effects: records created or changed, identities used, device state changes,
  switches toggled; keep them apart from read-only checks.
- Pending: operations with an unknown outcome, under their original operation.
- Blockers: unlock conditions and impact.
- Resources: what you return and its state.
```

## Lane operator

```text
Role: lane operator for <campaign>. Only you change the lane.
Lane: runbook <path>; environment file <path>; slots <slot: device or URL, app id>.
Off limits: <devices, checkouts, services the campaign does not own>.
Constraints: <project rules every unit follows, from the runbook>.
Work dir: <path>. Hand back by: <time and zone>.
Task: <start | sync to <branch@head> | change <configuration or allow-list> | seed <fixture
command> | smoke | restore | window for <purpose>>.
Sync: fast-forward only. Report dependency, schema, or migration changes; migrate only when this
brief says so, and after a dump. Rebuild every built artifact the lane consumes, restart only the
affected services, and reload the clients.
Window: the coordinator has stopped every test batch; run, restore, verify the restore, and close.
Smoke before opening the lane. If a lane process is down, restart it from the runbook, rerun the
whole smoke, and report the restart.
- health: <routes>
- invariants: <store names, registration or schema hashes>
- allow-lists: <list and its expected entries or snapshot path>
- switches on the running processes: <name=value list>
- device time zones: <zone>; set them if they differ
- read routes for the rows the next batches test: <routes>
- loaded marker in each client: <markers>
Keep the runbook able to rebuild the lane from files alone, covering the worktrees, stores, and
ports the campaign owns, and add the traps you hit. If there is no runbook, write it at <path>.
Check free disk before builds and installs.
Done: <condition>. Return the loaded baseline, changed processes and ports, and smoke results.
```

## Test batch

```text
Role: test batch. Slots, held only by you until handback: <slot: device or URL, app id, client,
sign-in>.
Rows: <id: acceptance condition; remaining work>.
Known: <rulings, design decisions, handoff items, and open findings that bear on these rows>.
Expect: loaded marker <marker>; identities <identity per client or step>; business date <date>
in <time zone>.
Partitions you may write: <partitions>. Destructive flows use <disposable identities or objects>.
Objects: <ids of the records, invitations, or samples you act on>.
Off limits: <other slots, devices, checkouts, services>.
Constraints: <project rules every unit follows, from the runbook>.
Work dir: <path>. Not before: <time and zone, or none>. Hand back by: <time and zone>; if you
cannot finish by then, stop at a safe point and hand back what you have.
Preflight the loaded marker, identities, and date and time zone; a mismatch is a blocker.
Leave the lane's services, configuration, and code, and device clocks, unchanged. Upload only
synthetic media or public sample images, and only into your partitions; never private photos of
real people unless this brief supplies consented ones.
Log every business write with its object and purpose. If a write's outcome is unknown, do not
resend it as a new operation; check it and report it as pending.
Before reporting a defect, rule out tool artifacts, input typed by automation tools, other
writers, and device limits, and confirm it through <server read route or tool>.
Evidence under <evidence dir>: screenshots for visual state, recordings for motion, server reads
for persisted state.
Exit: leave each slot at <exit state, such as signed out> and list what
remains in the partitions.
```

## Fix unit

```text
Role: fix unit. Rows or findings: <ids>. Goal: <observable behavior after the fix>.
Worktree <path>, branch <branch> from lane head <head>. Change only <paths>.
Work dir: <path outside the worktree>.
Leave the lane, main checkouts, and other worktrees untouched, and do not bypass hooks.
Verify the exact commit in a clean tree and read exit codes: <typecheck, tests, and repository
gates such as routing tables, contracts, or generated counts>.
If correctness depends on launchers, switches, or configuration, mark "needs smoke on sync" and
say what to check. Say whether user-facing design changed.
Done: <condition>. Return the branch, head, and the checks you ran with their exit codes.
```

## Integrator

```text
Role: integrator. Repositories in landing order: <repository: lane head>.
Work dir: <path>.
In a fresh worktree per repository, branch from its lane head and confirm the main line is an
ancestor.
Write the task records for <tasks>: decisive results, rulings <ids>, handoff items, and gaps.
Then update repository-required artifacts in the repository's order: <locks, pins, generated
files>. Finish the depended-on repository first.
Run the full gates on each final head in a clean tree.
Return the final heads and push commands that check ancestry and push without touching main
checkouts, in landing order, with the checks you ran and their exit codes. Do not push and do not
bypass hooks.
```

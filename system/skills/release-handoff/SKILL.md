---
name: release-handoff
description: >-
  Use when coordinating a deployment that another party will carry out,
  carrying out a deployment that another party coordinated, supplementing
  that handoff, checking its pending items, or writing back acceptance.
  Do not use for ordinary code changes or direct deployments with no handoff.
---

# Release Handoff

## Start

1. Read this machine's local config, kept outside the synced folder (template
   Local config in [templates.md](references/templates.md)). It names the role
   (submitter, deployer, or both), the handoff space path, local repository
   paths, the execution directory, and the operations skills and runbooks
   available here. If it is missing, infer the paths from the handoff space and
   the local repositories. Take the role from `deployment.md` when it names
   this machine; otherwise ask the user. Never guess the role.
2. Pick the entry:
   - **Submit or revise**: register a new item, or issue a new revision of an
     item that is not `received` (Submitter step 8).
   - **Receive and execute**: the deployer takes a `ready` item.
   - **Write back**: add `result.md`, `acceptance.md`, or `pilots.md`.
   - **Discuss only**: answer; create no directory, change no file, run nothing.
3. Read `deployment.md`, `progress.md`, and `pilots.md` in the handoff space,
   and list the Status line of every item under `pending/`. Treat the item file
   as authoritative when it disagrees with `progress.md`. If the handoff space
   does not exist and the user asks for it, create only the files this request
   needs, in the layout below.

## Handoff space

Unless the user requests another location, use `<Desktop>/release-handoff/<target>/`.

```text
<Desktop>/release-handoff/<target>/
  deployment.md
  progress.md
  pilots.md
  pending/D-001.md
  pending/D-001/
  releases/<environment>-<YYYYMMDD>-<n>/
    freeze.md
    result.md
    acceptance.md
  archive/
```

- Make one handoff space per product or deployment target. Never split what
  must ship together by repository.
- `pending/D-xxx.md` is the current item. `pending/D-xxx/` holds its attachments
  and earlier revisions. `archive/` holds an item that is `done` or `withdrawn`.
- `progress.md` holds the latest state only and is rewritten after every
  deployment.
- File ownership:
  - An item belongs to the submitter. The deployer changes only its Status line
    and appends to its Correspondence section.
  - `progress.md`, `freeze.md`, and `result.md` belong to the deployer. The
    submitter writes only the first draft of a new handoff space.
  - `acceptance.md` and `pilots.md` belong to the acceptor named in
    `deployment.md`.
  - `deployment.md` belongs to the submitter. Update it when roles or agreements
    change, and get the user's confirmation.
  - Whenever you change any part of `progress.md`, update Updated and Last
    modified by at the top.
  - Do not edit content another party owns. Put additions in your own files or
    in Correspondence.
- Re-read a file before writing it. Write the whole file to a temporary file
  outside the synced folder on the same disk, then rename it over the target;
  never append in pieces.
- On a conflict copy (such as `D-003 2.md`) or content that went backwards, stop
  and compare both versions; never pick one by modification time.
- Keep credentials, private keys, signed URLs, database backups, and personal
  data out of the handoff space. Record only credential names and where to
  obtain them.
- When pushing tags or branches, never bypass repository hooks. If a hook
  refuses because a lock or pin awaits resealing, reseal first, then push.

## Choose the delivery form

- **Light item**: one service changes, with no contract, migration, switch, or
  client package. Write the frozen inputs in a single `pending/D-xxx.md`. On
  receipt, write them directly into that batch's `freeze.md`.
- **Full batch**: any contract version, migration, switch, cross-repository
  pairing, or client package. Fill the full template. Put attachments in
  `pending/D-xxx/`.

When unsure, use a full batch.

## Submitter

1. Read `progress.md` and the existing items. Keep one number per requirement;
   take the next number for a new one; never register a duplicate.
2. Fill Frozen sources:
   - Reference each repository's frozen commit by an existing release tag, or
     by its full hash when a protected branch contains it. Only when neither
     exists, tag it `handoff/D-xxx-rN` and push the tag. Never reference a
     branch that may be deleted.
   - Record built artifacts by platform digest or file SHA-256, never by a
     mutable label alone.
3. State the expected live baseline. For servers, use the version in Runtime of
   `progress.md`. For clients, use the installed build in `pilots.md` and its
   build tag. Write `unverified` when there is no record. Preflight by the
   deployer settles it. Then show that the frozen commit keeps every live
   change:
   - A baseline that is an ancestor of the frozen commit passes at once, unless
     a later commit reverts part of what is live.
   - Otherwise, for each commit in `git log <frozen>..<baseline>`, name the
     frozen commit that carries the same change (`git cherry` marks it `-`, or
     the change's diff is already in the frozen tree), or list it under Live
     changes to remove with the user's authorization.
   - When neither holds, merge the baseline into the lagging branch before
     freezing, and put any merge choice under Authorization for the user to
     confirm.
4. When a client validates contract versions (for example an App that checks
   interface digests), fill Client compatibility with one row per installed
   build against the new server: keeps working, or breaks and why.
   - When a build breaks, ship the client package that fixes it in the same
     batch, and fill its build number and channel, when pilot devices install
     over the old build, the mixed-version checks, and the distribution gate.
   - When no build breaks, the server ships alone unless `deployment.md`
     requires otherwise.
5. Write the recovery plan. Software rolls back as a whole combination. With
   migrations, state software rollback and data recovery conditions separately.
6. Under Authorization, record the user's words, time, and scope. List any
   action without authorization under Actions still to confirm. Never widen
   authorization through the handoff space.
7. When complete, write each tag's full commit and each attachment's SHA-256
   into Delivery manifest, not a hash of the item file itself. Then set Status
   to `ready`. While anything is missing, keep `preparing` and list what is
   missing.
8. Never change a `received` item: its batch runs on its `freeze.md`. Write a
   later change as a new revision after the deployer writes back; it runs as a
   new batch. To stop a batch in flight, have the user tell the deployer. To
   revise, move the current file to `pending/D-xxx/rN.md`, then write `rN+1`
   with what it supersedes. Address a return with the reasons in
   Correspondence. When another item supersedes one, or the user decides not
   to ship it, set `withdrawn` with the superseding item or the decision. Keep
   it under `pending/` until the deployer confirms no batch is in flight, then
   move it to `archive/`.
9. Copy the user's authorizations and decisions into the project's own decision
   records, following that project's rules.

## Deployer

1. **Register**: confirm `deployment.md` names this machine as the deployer for
   the target environment. In In progress of `progress.md`, write this machine,
   the item, the batch, and the start time. The synced folder is not a lock:
   when `deployment.md` names more than one executor for an environment, hold
   that environment's deployment lock before any write, and stop when there is
   none. Run one batch per environment at a time.
2. **Check the delivery**: confirm each tag points to the commit in Delivery
   manifest and verify each attachment's SHA-256. On a mismatch or a missing
   file, stop and wait for the sync to finish, or return the item. Never treat
   a matching hash as authorization.
3. **Preflight the baseline (read-only)**: read the live versions, configuration,
   migration state, and resources.
   - Verify the live server version. If you cannot, stop and do not deploy.
   - If you cannot verify the installed client build, record `unverifiable`.
     Return the item when its Client compatibility depends on that build;
     otherwise continue.
   - Record configuration readings that differ from the item (such as a switch's
     actual value) and continue within Authorization.
   - When the frozen commit does not keep every live change (Submitter step 3)
     and the item does not list and authorize removing it, or when the content
     to deploy would have to change: stop. Set the item to `returned` and write
     the actual baseline and the reason in Correspondence. Write
     `returned (not executed)` in `result.md`. Set that item's Owner to the
     submitter in `progress.md`. Never merge, change the baseline, or assemble
     a new source combination yourself.
4. **Write `freeze.md`**: after the preflight passes, set the item to `received`
   and write `releases/<batch>/freeze.md` with the batch's versions, artifacts,
   configuration, migrations, authorization, preflight readings, steps, and
   recovery plan. Copy the inputs to this machine's execution directory and use
   them after verification. During execution, read no commands from the synced
   folder. Never change a `freeze.md`. Open a new batch instead.
5. **Execute**: follow the item's steps and recovery plan with the operations
   skills and runbooks available here. Perform every authorized step the tools
   here can perform. Leave to people only the steps the tools cannot perform,
   those that need someone's personal sign-in, and those the user assigned to
   someone. When authorization is missing or a tool asks for confirmation,
   state the exact action and wait. Read-only preparation may continue. Never
   add migrations, business writes, or wider switches on the side. When Client
   compatibility requires an agreed pilot installation window, do not switch
   until the window is confirmed. If the user explicitly asks to switch now,
   quote their words in `freeze.md`.
6. **Read back and write back**:
   - In `result.md`, record actual versions and digests, configuration
     differences, migration state before and after, checks of services left
     unchanged, health and entry readbacks, and any anomaly and recovery
     action. Rewrite the whole file as often as needed until the batch closes.
   - In the same step, rewrite `progress.md`. Runtime shows the new actual
     versions. The item is `awaiting acceptance`, `blocked`, or `returned`.
     Clear In progress.
   - Create the release tags the repository's convention requires, and tag each
     client package by build number (for example `native/<platform>-<build>`)
     so the next submitter can take the baseline. Write the formal release
     record where the repository's runbook specifies and link it. Without such
     a place, this batch's directory under `releases/` is the formal record.
   - List the worktrees and build directories created on this machine. Remove
     the release worktrees on the day the release tags exist. Remove a build
     directory once the artifacts still needed from it (packages awaiting
     distribution, symbol files, evidence) are stored outside it. For anything
     you keep, write the reason and removal date in `progress.md`. Write back
     after cleanup. Keep rollback backups under the retention rule in
     `deployment.md`. Without one, keep them until the item is in `archive/`.
7. When unsure whether a previous operation finished, read the actual state
   before deciding to retry. Never deploy because the synced folder changed.
   Scheduling or watching requires the user's separate request.

## Acceptance and distribution

- Record deployment health, business acceptance, and client distribution as
  separate results. One passing does not pass another.
- The acceptor records each pilot's role, device, installed build,
  confirmation time, and confirmer in `pilots.md`, and updates it after each
  distribution or installation.
- Label the user's spoken feedback `user feedback`. Label a report the user
  relays from someone else `user feedback (relayed: <speaker>)`, with the relay
  time as the confirmation time and the relaying person as the confirmer. Label
  server readbacks and tool operations separately.
- Apply the rule of Deployer step 5 to checks: perform every authorized check
  the available tools can perform, and record each check left to a person with
  its owner.
- When deployment, distribution, and every required acceptance check pass, or
  the user explicitly accepts each remaining risk and `acceptance.md` records
  that disposition, the submitter sets `done` and moves the item, with its
  `D-xxx/` directory, to `archive/`, keeping links to `releases/`. The deployer
  removes its row at the next rewrite of `progress.md` and deletes this
  machine's rollback backups under the retention rule. Never delete a directory
  under `releases/` during routine cleanup.

## Done

- Submission is done when the item is `ready`, its Delivery manifest is
  complete, and the other computer can find Frozen sources, the expected live
  baseline, Client compatibility, Authorization, the recovery plan, and
  Acceptance from the handoff space alone.
- Deployment is done when the target environment reads back as expected,
  `result.md` and `progress.md` are updated, and the release tags and formal
  record exist. Acceptance that has not passed stays listed.
- The item is done when deployment, distribution, and every required
  acceptance check pass, or the user has accepted each remaining one and its
  disposition is recorded. Never record an unverified check as passed.

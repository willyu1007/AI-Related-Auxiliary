---
name: release-handoff
description: >-
  Use when two computers cooperate on deployments through a synced folder: a
  submitter (coordinator or developer) registers what to deploy, a deployer
  receives, freezes, executes, and writes back deployment and acceptance
  results, or either side maintains the current progress. Covers paired
  cross-repository releases, server images, configuration, migrations, and
  native client packages. Do not use for ordinary code changes, single-machine
  deployments, or cloud-platform operating steps.
---

# Release Handoff

## Start

1. Read this machine's local config, kept outside the synced folder (template
   「本机配置」 in [templates.md](references/templates.md)): role (submitter,
   deployer, or both), handoff space path, local repository paths, execution
   directory, and the operations skills and runbooks available here. If it is
   missing, have the user confirm the role and paths first.
2. Pick the entry:
   - **Submit or revise**: register a new item, or issue a new revision of an
     item that is not yet received or was returned.
   - **Receive and execute**: the deployer takes a ready item.
   - **Write back**: add deployment results, acceptance results, or pilot
     installation state.
   - **Discuss only**: answer; create no directory, change no file, run nothing.
3. Read `部署说明.md` and `当前进度.md` in the handoff space, and list the status
   line of every item under `待部署/`; treat the item file as authoritative when
   it disagrees with the progress file. If the space does not exist and the user
   asks for it, create only the files this request needs, in the layout below.

## Handoff space

```text
<synced root>/部署交接/<target>/
  部署说明.md          standing agreements
  当前进度.md          latest state only, rewritten after every deployment
  待部署/D-001.md      one file per item
  待部署/D-001/        that item's attachments and earlier revisions
  发布记录/<environment>-<YYYYMMDD>-<n>/
    冻结.md  部署结果.md  验收结果.md
  归档/                completed or withdrawn items
```

- Make one space per product or deployment target; never split what must ship
  together by repository.
- File ownership:
  - Items belong to the submitter. The deployer changes only an item's 「状态」
    line and appends to its 「往来」 section.
  - `当前进度.md`, 冻结, and 部署结果 belong to the deployer; the submitter
    writes only the first draft of a new space.
  - 验收结果 and the 「试点安装」 table of `当前进度.md` belong to the acceptor
    named in `部署说明.md`. When rewriting `当前进度.md`, keep that table as it is.
  - `部署说明.md` belongs to the submitter; update it when roles or agreements
    change, and get the user's confirmation.
  - Whenever you change any part of `当前进度.md`, update its time and modifier
    at the top.
  - Do not edit other content another party owns; put additions in your own
    files or in 「往来」.
- Re-read a file before writing it. Write the whole file to a temporary file
  outside the synced folder on the same disk, then rename it over the target;
  never append in pieces.
- On a conflict copy (such as `D-003 2.md`) or content that went backwards, stop
  and compare both versions; never pick one by modification time.
- Keep credentials, private keys, signed URLs, database backups, and personal
  data out of the space; record only credential names and where to obtain them.
- When pushing tags or branches, never bypass repository hooks. If a hook
  refuses because a lock or pin awaits resealing, reseal first, then push.

## Choose the delivery form

- **Light item**: one service changes, with no contract, migration, switch, or
  client package. Write the frozen inputs in a single `D-xxx.md`; freeze it
  directly in the release record on receipt.
- **Full batch**: any contract version, migration, switch, cross-repository
  pairing, or client package. Fill the full template; put attachments in
  `D-xxx/`.

When unsure, use a full batch.

## Submitter

1. Read the progress file and existing items. Keep one number per requirement;
   take the next number for a new one; never register a duplicate.
2. Freeze the sources:
   - Tag each repository's frozen commit `handoff/D-xxx-rN` and push the tag.
   - Reference only tags or full commit hashes, never branches that may be
     deleted.
   - Record built artifacts by platform digest or file SHA-256, never by a
     mutable label alone.
3. State the **expected live baseline**: for servers, the version in the progress
   runtime table; for clients, the installed build number in the pilot table and
   its build tag. Write 「未核实」 when there is no record; the deployer's
   preflight settles it. The frozen commit must contain that baseline (the
   baseline is its ancestor): merge the baseline into a lagging branch before
   freezing, and put any merge choice under 「授权」 for the user to confirm.
   Remove a change that is live only by listing each one with the user's
   authorization.
4. When a client validates contract versions (for example an App that checks
   interface digests), fill 「客户端兼容」:
   - which installed builds keep working;
   - the client package, build number, and channel that must ship in the same
     batch;
   - when pilot devices install over the old build;
   - the mixed-version checks required;
   - the distribution gate.
   - Ship a server change to a client-validated contract only in the same batch
     as the client package that carries it.
5. Write the recovery plan: software rolls back as a whole combination; with
   migrations, state software rollback and data recovery conditions separately.
6. Authorization: record the user's words, time, and scope. List any action
   without authorization under 「尚需确认」; never widen authorization through the
   handoff files.
7. When complete, write each tag's full commit and each attachment's SHA-256 into
   「交付清单」 (not the item file itself), then set the status to 「待接收」; while
   anything is missing, keep 「准备中」 and list what is missing.
8. Revise a received or returned item by moving the current file to
   `待部署/D-xxx/rN.md`, then writing `rN+1` with what it supersedes; address a
   return with the reasons in 「往来」. When another item supersedes an item or the
   user decides not to ship it, set 「撤回」 with the superseding item or decision,
   keep it under `待部署/` until the deployer confirms no batch is in flight, then
   move it to `归档/`.
9. Copy the user's authorizations and decisions into the project's own decision
   records, following that project's rules.

## Deployer

1. **Register**: in 「正在执行」 of `当前进度.md`, write this machine, the item,
   the batch, and the start time; re-read after the sync to confirm no other
   executor. Use a server-side deployment lock when one exists. Run one batch per
   environment at a time.
2. **Check the delivery**: confirm each tag points to the commit in the list and
   verify each attachment's SHA-256; on a mismatch or a missing file, stop and
   wait for the sync to finish or return the item. Never treat a matching hash
   as authorization.
3. **Preflight the baseline (read-only)**: read the live versions, configuration,
   migration state, and resources.
   - Verify the live server version; if you cannot, stop and do not deploy.
   - If you cannot verify the installed client build, record 「无法核实」; return
     the item when its client compatibility depends on it, otherwise continue.
   - Record configuration readings that differ from the item (such as a switch's
     actual value) and continue within the authorization.
   - When the frozen commit does not contain the live version and the item does
     not list and authorize removing those changes, or when the content to
     deploy would have to change: stop; set the item to 「退回」 and write the actual
     baseline and the reason in 「往来」; write 「退回（未执行）」 in 部署结果; make the
     submitter the owner of that item in `当前进度.md`. Never merge, change the
     baseline, or assemble a new source combination yourself.
4. **Freeze**: after the preflight passes, set the item to 「已接收」 and write
   `发布记录/<batch>/冻结.md` with the batch's versions, artifacts, configuration,
   migrations, authorization, preflight readings, steps, and recovery plan; copy
   the inputs to this machine's execution directory and use them after
   verification. During execution, read no commands from the synced folder.
   Never change a freeze; open a new batch instead.
5. **Execute**: follow the item's steps and recovery plan with the operations
   skills and runbooks available here. When authorization is missing or a tool
   asks for confirmation, state the exact action and wait; read-only preparation
   may continue. Never add migrations, business writes, or wider switches on the
   side. When client compatibility requires an agreed pilot installation window,
   do not switch until the window is confirmed; if the user explicitly asks to
   switch now, quote their words in the freeze.
6. **Read back and write back**:
   - In 部署结果, record actual versions and digests, configuration differences,
     migration state before and after, checks of services left unchanged, health
     and entry readbacks, and any anomaly and recovery action; rewrite the whole
     file as often as needed until the batch closes.
   - In the same step, **rewrite `当前进度.md`**: the runtime table shows the new
     actual versions; the item is 「已部署待验收」, 「受阻」, or 「退回」; 「正在执行」
     is cleared.
   - Create the release tags the repository's convention requires, and tag each
     client package by build number (for example `native/<platform>-<build>`)
     so the next submitter can take the baseline. Write the formal release record
     where the repository's runbook specifies and link it; without such a place,
     this batch's release record is the formal record.
   - List the worktrees and build directories created on this machine. Remove
     the release worktrees and build directories on the day the release tags
     exist; for any you keep, write the reason and removal date in
     `当前进度.md`. Write back after cleanup. Keep rollback backups under the
     retention rule in `部署说明.md`; without one, keep them until the item is
     archived.
7. When unsure whether a previous operation finished, read the actual state
   before deciding to retry. Never deploy because the synced folder changed;
   scheduling or watching requires the user's separate request.

## Acceptance and distribution

- Record deployment health, business acceptance, and client distribution as
  separate results; one passing does not pass another.
- The acceptor records each pilot's role, device, installed build number,
  confirmation time, and confirmer in the 「试点安装」 table, and updates it after
  each distribution or installation.
- Label the user's spoken feedback 「用户反馈」; label a report the user relays
  from someone else 「用户反馈（转述：<原话人>）」, with the relay time as the
  confirmation time and the relaying person as the confirmer. Label server
  readbacks and tool operations separately.
- Leave checks that need physical devices, designated business accounts, or the
  site's cooperation to their owners; never operate them on their behalf.
- When an item's deployment, distribution, and acceptance all have results, the
  submitter sets 「完成」 and moves the item, with its `D-xxx/` directory, to
  `归档/`, keeping links to the release records; the deployer removes its row at
  the next rewrite of `当前进度.md` and deletes this machine's rollback backups
  under the retention rule. Never delete release records in routine cleanup.

## Done

- Submission is done when the item is 「待接收」, its 「交付清单」 is complete, and the
  other computer can find the frozen sources, baseline, client compatibility,
  authorization, recovery plan, and acceptance list from the handoff space alone.
- Deployment is done when the target environment reads back as expected, 部署结果
  and `当前进度.md` are updated, and the release tags and formal record exist;
  acceptance not yet passed stays listed.
- The item is done when deployment, distribution, and acceptance all have
  results; never record an unverified check as done.

# Templates

Fill these as needed; they are not existing facts. Write `n/a` and the reason for a field that does not apply, and `unverified` for a field not yet verified; never guess. Copy only the fenced text into the handoff space.

## Local config (not in the synced folder)

Keep it in the local user directory, for example `~/.config/release-handoff/<target>.md`, never in the synced folder.

```markdown
# Local config: <target>

- Machine:
- Role: submitter / deployer / both
- Handoff space path: `<Desktop>/release-handoff/<target>/`
- Local repository paths: <repository> → <path>
- Execution directory (not in the synced folder):
- Operations skills and runbooks on this machine:
- Where to obtain credentials (names only):
```

## deployment.md

```markdown
# <target> deployment

- Environments and access points:
- Repositories and cross-repository pairing:
- Client packages and distribution channels:
- Where clients validate contracts, and the rules:
- Deployment runbook (repository path):
- Image registry / artifact channel:
- Submitter, deployer, acceptor, and who maintains each file:
- Deployer for each environment (one per environment), and the deployment lock when an environment has more than one executor:
- Tag convention: handoff `handoff/D-xxx-rN`; release:
- Release records and backup retention:
```

## progress.md

One row per item under Items, latest state only. History stays in `releases/`.

```markdown
# Progress

Updated (with timezone):
Last modified by:

## Runtime

| Environment | Service | Live version / digest | Release batch | Last read-back |
|---|---|---|---|---|

## In progress

- Machine, item, batch, start time:

## Items

| Item | Status | Next action | Owner | Blocker |
|---|---|---|---|---|
```

## pilots.md

```markdown
# Pilot installs

Updated (with timezone):
Last modified by:

| Pilot | Role | Device | Installed build | Confirmed at | Confirmed by |
|---|---|---|---|---|---|
```

## pending/D-xxx.md

```markdown
# D-xxx: <name>

- Revision: rN (why it supersedes rN-1)
- Status: preparing / ready / received / returned / awaiting acceptance / blocked / done / withdrawn
- Form: light item / full batch
- Submitter, target environment, related task and decision ids:
- Items this depends on or supersedes:

## Scope

- User-visible change:
- Services updated:
- Services left unchanged:

## Frozen sources

| Repository | Tag | Full commit | Expected live baseline (source) | Live changes kept (ancestor, or equivalent commits) | Live changes to remove, and their authorization |
|---|---|---|---|---|---|

| Artifact | Version / build | Digest or SHA-256 | Where to obtain it | Who builds it |
|---|---|---|---|---|

Check result (time, input versions, where the evidence is):

## Client compatibility (required when a client validates the contract)

| Installed build (where installed) | Against the new server | Why |
|---|---|---|

When a row breaks:

- Client package, build, and channel that ship in this batch:
- Pilot overwrite install:
- Mixed-version checks: old package against new service, new package against old service — expected result and how to check:
- Distribution gate:

## Environment and data (full batch)

- Migrations and their order:
- Configuration: field, old value, new value (no secret values):
- Credential names this depends on:
- Business data operations and their authorization boundary:

## Steps and recovery

- Runbook or script (path and the commit it belongs to):
- Scope of the write stop and the switch:
- Backup requirements:
- Software rollback combination:
- Data recovery conditions:
- Stop conditions:

## Authorization

- Granted: the user's words, time, and scope:
- Actions still to confirm:

## Acceptance

| Check | Method | Owner |
|---|---|---|

## Delivery manifest

| Entry | Tag → full commit, or attachment SHA-256 |
|---|---|

## Correspondence

- <time> <party>: <return reason, actual baseline, note>
```

## releases/<batch>/freeze.md

Under Inputs and steps fixed for this batch, write this batch's versions, artifacts, configuration, migrations, authorization, step order, and recovery plan in full. Do not only link the item file; that file may still change.

```markdown
# Freeze: <batch>

- Environment, freeze time (with timezone), executing machine:
- Items and revisions included:
- Content not included:
- Delivery manifest check:
- Preflight: actual live baseline (read-back time), configuration readings, differences from the item's assumptions, and how they were handled:

## Inputs and steps fixed for this batch

- Versions, artifacts, configuration, migrations, authorization, step order, recovery plan:
```

## releases/<batch>/result.md

```markdown
# Result: <batch>

- Status: preflight / returned (not executed) / blocked / switching / deployed / rolled back
- Start and end (with timezone):
- Actual versions, commits, digests:
- Services and configuration that actually changed:
- Migration state before and after:
- Checks of services left unchanged:
- Health, entry points, and contract read-back:
- Anomaly, recovery action, last confirmed actual state:
- Release tags, link to the formal release record:
- Worktrees and build directories on this machine, when removed, removal result:
- Remaining work and the next owner:
```

## releases/<batch>/acceptance.md

Use only `pass`, `fail`, `not tested`, or `blocked`. Label server readbacks, user feedback, and tool operations separately. Never write passwords, personal data, or signed URLs.

```markdown
# Acceptance: <batch>

Environment, version, client build:
Acceptor and updated at:

| Check | Result | Time | Evidence or user feedback | Problem and next owner |
|---|---|---|---|---|

## Conclusion

- Met:
- Not met:
- Remaining risk the user accepted (words, time, disposition):
- Next:
```

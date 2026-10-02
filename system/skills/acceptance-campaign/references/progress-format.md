# progress.md format

Follow this layout and these rules exactly. Never write row counts or status tallies. Write status
and kind values in English. Write every cell outside the header, Lane, and Evidence as plain prose
for people, and put commit hashes, ports, paths, and process ids only in the header, Lane, or
Evidence.

## Layout

```markdown
# Shop app acceptance

Updated: 2026-03-14 18:00 +00:00
Tasks: Mobile → SHOP-12 in the app repository

## Summary

Card payment passes on both platforms; the iOS refund check waits for the 09:00 sandbox reset.

## Next

1. iOS refund batch on ios-1, not before 09:00 +00:00, hand back by 11:00 +00:00

## Blockers

| ID | Item | Unlock | Owner | Since | Rows |
| --- | --- | --- | --- | --- | --- |
| B-1 | iOS refund check | The payment sandbox resets daily at 09:00 +00:00 | Coordinator | 2026-03-14 | PAY-02 |

## Rows: Mobile

| ID | Group | Item | Acceptance | Status | Qualification | Remaining | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| PAY-01 | Payment | Card payment | Paying with a saved card shows the receipt; iOS simulator and Android emulator | passed | iOS simulator; Android emulator; test card | - | [run 3](evidence/pay-01.png) |
| PAY-02 | Payment | Refund | A refund appears in the order history within a minute; iOS simulator and Android emulator | partial | Android emulator; test card | iOS refund after the sandbox reset | - |

## Findings

| ID | Severity | Kind | Summary | Disposition | Rows |
| --- | --- | --- | --- | --- | --- |
| F-1 | P2 | defect | The receipt shows the wrong currency after a refund | Fixed; iOS retest pending | PAY-02 |

## Handoff

| ID | Item | Needs | Gate | Rows |
| --- | --- | --- | --- | --- |
| HO-1 | Card payment on physical devices | A real acquirer account and physical iOS and Android devices | Production payments | PAY-01 |

## Rulings

| ID | Date | Decision | Rows |
| --- | --- | --- | --- |
| R1 | 2026-03-13 | Refunds above the order total are rejected, not capped | PAY-02 |

## Lane

- Runbook: docs/runbook.md
- Loaded: app@1a2b3c4, api@5d6e7f8; load proofs: api GET /version returns 5d6e7f8, the About screen shows build 1a2b3c4; smoke passed 2026-03-14 08:40 (evidence/smoke-0314.txt); lane open
- Slots: ios-1 = simulator 0A1B, app com.example.shop, UTC, test-account picker, free; android-1 = emulator-5554, app com.example.shop, UTC, test-account picker, free; web-1 = http://localhost:3000/admin, admin login from the runbook, free
- Partitions: store-a with buyer-1, free; store-b with buyer-2, free, holds 3 leftover test orders; refund settings, free
- Switches: PAYMENTS_SANDBOX=true; REFUNDS_ENABLED=true; EMAIL_SEND=false
- Time zone: business dates and gates use UTC
- Objects: refund order 1042 in store-a, owned by buyer-1, due 2026-03-15 09:00 +00:00, seeded for PAY-02
- Pending: none
- Units: none running
- Off limits: the staging database; other simulators
```

## Rules

- **Header**: the `#` title comes first, then `Key: value` lines. `Updated` (`YYYY-MM-DD HH:MM`
  with an optional `±HH:MM` offset) and `Tasks` (the repository task each ledger maps to) are
  required.
- **Sections**: `##` headings are limited to `Summary`, `Next`, `Blockers`, `Rows: <ledger name>`,
  `Findings`, `Handoff`, `Rulings`, and `Lane`. At least one `Rows:` section and the `Lane` section
  are required; every other section appears at most once. Ledger names carry no counts.
- **Tables**: use exactly the columns shown, in that order. Escape a literal pipe in a cell as `\|`.
  Each cell is one line; separate several facts with `; `.
- **IDs**: unique across all tables, including across ledgers. Suggested prefixes: `R` for
  rulings, `HO-` for handoff items, `F-` for findings, `B-` for blockers.
- **Acceptance**: required; the condition to verify within the lane's scope, including the evidence
  qualification it requires. Name hardware `physical device` and virtual targets `simulator` or
  `emulator`. Put release-level requirements in a linked Handoff item.
- **Status**: one of `not-tested`, `partial`, `passed`, `failed`, `blocked`; statuses record
  judgments only, and work in progress goes under Units. `passed`: the lane scope is established.
  `partial`: some required check or qualification is still unverified. `failed`: a required check
  has an unresolved failure. `blocked`: a missing implementation, account, or decision; a time gate
  goes to Blockers and leaves the status alone. `Remaining` is required unless the status is
  `passed`: the next check, or for an interrupted chain the step to resume from.
- **Qualification**: the evidence qualification established so far, never the required one: the
  evidence level (contract, unit, API, simulator or emulator on a named platform, physical device,
  cross-system journey) and the identity and data, as at most 4 tags separated by `;`, each at
  most 16 characters, or a phase such as `joint check`. Required for `partial` and `passed` rows,
  `-` for `not-tested` rows, and optional for `failed` and `blocked` rows. Put narratives of what
  was verified in the task's verification record.
- **Evidence**: links to the row's evidence, or `-`.
- **Kind**: one of `defect`, `design`, `gap`, `environment`, `ruling`. Move a finding triaged as
  handoff to the Handoff table. **Severity**: `P1`, `P2`, `P3`, or `-`.
- **Rows columns** in Blockers, Findings, Handoff, and Rulings list row ids separated by commas, or
  `-`. Every id must exist in some ledger.
- **Next**: the coming units in order, each with its slots, time gate, and hand-back time.
- **Lane**: `-` bullets starting with each of the labels below, all required, complete enough to
  resume from without asking. Write `none` where a list is empty.
  - `Runbook:` its path.
  - `Loaded:` the loaded baseline with its load proofs, the last smoke result with its evidence
    path, and whether the lane is open or closed.
  - `Slots:` each slot's device or URL, app id, device time zone, sign-in, and holder.
  - `Partitions:` each partition's identities, holder with `write` or `depend`, and leftover data.
  - `Switches:` as `name=value`, every switch a row depends on or that has wide side effects, with
    its window or ruling; plain feature gates stay in the runbook.
  - `Time zone:` the business time zone that dates, due times, and gates use.
  - `Objects:` seeded samples and the objects of an interrupted chain: object, partition,
    identities, due time with zone, and the report of the last run.
  - `Pending:` operations with an unknown outcome, under their original operation.
  - `Units:` each unit's role, agent, state (running, handed back, awaiting sync), work dir or
    worktree, branch or head, verification evidence, what it holds, hand-back time, and next step.
    Keep an entry until its work is adopted or discarded.
  - `Off limits:` devices, checkouts, and services the campaign does not own.
- **Inline formatting**: links `[text](href)`, code spans, and `**bold**`. Write relative links from
  the directory of `progress.md`, to files that exist.
- **Free text**: Summary and Next take paragraphs, `-` bullets, and `1.` numbered lists.
- Keep one current snapshot. Remove a resolved blocker, and a finding once its disposition is in
  the task records.

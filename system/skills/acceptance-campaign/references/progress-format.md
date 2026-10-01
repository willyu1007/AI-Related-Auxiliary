# progress.md format

`scripts/render-progress.mjs` turns `progress.md` into `index.html` and rejects anything that does
not follow this format. It computes every count from the rows; never write counts by hand. The page
uses Chinese labels when the title contains Chinese, otherwise English; status and kind values stay
in English in `progress.md`.

The page is for people. It shows only `Updated` from the header and leaves out the Lane section and
the Evidence column, which serve agents. Write every cell the page shows as plain prose: commit
hashes, ports, paths, and process ids go in the header, Lane, or Evidence. The renderer warns when a
shown cell looks like a commit hash.

## Layout

```markdown
# <Campaign title>

Updated: 2026-10-01 22:55 +08:00
Baseline: app@7037261a, service@239f42e9

## Summary

<Two to five lines: where the campaign stands and what changed last.>

## Rows: <ledger name>

| ID | Group | Item | Acceptance | Status | Qualification | Remaining | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| B01 | Accounts | Sign-in and sign-out | The gate shows after sign-out and the identity is cleared | passed | Android emulator; iOS simulator; dev identity | - | [r16](evidence/b01.png) |
| D04 | Activities | Activity slots and domains | Custom domain tags persist; retired tags stay readable | partial | Android emulator; admin web; dev identity | iOS rerun | [r18](evidence/android-r18/d04.png) |

## Rulings

| ID | Date | Decision | Rows |
| --- | --- | --- | --- |
| R17 | 2026-10-01 | Retired domains stay readable on old records | D04 |

## Handoff

| ID | Item | Needs | Gate | Rows |
| --- | --- | --- | --- | --- |
| HO-1 | Ordinary sign-in | A real identity provider account | Staging sign-in | B01 |

## Findings

| ID | Severity | Kind | Summary | Disposition | Rows |
| --- | --- | --- | --- | --- | --- |
| F-12 | P2 | defect | Draft locks after a rejected save | Fixed; iOS retest pending | D04 |

## Blockers

| ID | Item | Unlock | Owner | Since |
| --- | --- | --- | --- | --- |
| B-3 | Trial start | Application 2 opens at 12:00 | Coordinator | 2026-10-01 |

## Lane

- Loaded: app@7037261a, service@239f42e9 (ready line, registration hash d39ed9f1)
- Slots: android-1 free; ios-1 free
- Windows: face matching off

## Next

1. Trial-start chain after 12:00
2. Next-day due items
```

## Rules

- **Header**: the `#` title comes first, then `Key: value` lines. `Updated` is required.
- **Sections**: `##` headings are limited to `Summary`, `Rows: <ledger name>`, `Rulings`,
  `Handoff`, `Findings`, `Blockers`, `Lane`, and `Next`. At least one `Rows:` section is required;
  every other section appears at most once. Ledgers render in file order.
- **Tables**: use exactly the columns shown, in that order. Escape a literal pipe in a cell as `\|`.
  Each cell is one line; separate several facts with `; `.
- **IDs**: unique across all tables. Suggested prefixes: `R` for rulings, `HO-` for handoff items,
  `F-` for findings, `B-` for blockers; row ids follow the project's own scheme.
- **Status**: one of `not-tested`, `testing`, `partial`, `passed`, `failed`, `blocked`.
  `Remaining` is required unless the status is `passed`; it is what a reader acts on, so state the
  next check, not the history.
- **Qualification**: at most 4 short tags separated by `;`, each at most 16 characters: platform,
  evidence level, identity, or a phase such as `joint check`. Narratives of what was verified belong
  in the task's verification record, not here.
- **Evidence**: links for agents re-judging a row; the page does not show them. Use `-` when none.
- **Kind**: one of `defect`, `design`, `gap`, `environment`, `ruling`. A finding triaged as handoff
  moves to the Handoff table. **Severity**: `P1`, `P2`, `P3`, or `-`.
- **Rows columns** in Rulings, Handoff, and Findings list row ids separated by commas, or `-`.
  Every id must exist in some ledger.
- **Inline formatting**: links `[text](href)`, code spans, and `**bold**`. Relative links resolve
  from the directory of `progress.md` and must exist.
- **Free text**: Summary, Lane, and Next take paragraphs, `-` bullets, and `1.` numbered lists.
- Keep one current snapshot. Remove a resolved blocker, and a finding once its disposition is in
  the task records, instead of striking them through; the task records keep the history.

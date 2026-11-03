---
name: review-ui-visual
description: >-
  Activate only when the user explicitly calls this skill by name.
disable-model-invocation: true
---

# Review UI Visual

Review and report only. Do not edit product code or drive a fix loop. Keep
Visual QA and Visual Regression as separate comparisons. When a task bundle
governs the work, take "finalized interface" from `dev-docs/AGENTS.md`.

## Evidence

- **QA baseline:** the finalized interface. Find it from the review request,
  the task bundle's Outstanding verification item or `Done when`, or a link
  in the issue, PR, or spec. Disclose when none exists or sources conflict.
- **Regression baseline:** running screenshots accepted before this change
  set, or captured at the start of this review for in-scope pages and states.
  Without one, run QA only and disclose that Regression did not run.
- **Actual:** screenshots of the running client; otherwise the same
  components, theme, and data on a running preview. Never use a
  reinterpreted rebuild from source as a baseline or a passing actual.
- **Capture environment:** before judging, align and record viewport, DPR,
  zoom, theme, locale, data, state, and scroll for each baseline/actual pair.
  Misaligned environment is a coverage limit, not a visual defect.
- **Non-defects:** do not treat unsynchronized dynamic time or random data,
  font anti-aliasing or similar renderer noise, or a pixel-diff score alone
  as a defect. Pixel diff is supporting evidence only.

## Scope

- **QA:** every in-scope view and every state the finalized interface
  specifies.
- **Regression:** changed pages, shared chrome, and related pages the user
  or task names. Do not full-site scan by default. Regression is required
  only when the user or task asks for it, or a Regression baseline already
  exists for the in-scope pages. Otherwise leave it `not run` and disclose.
- Disclose states, viewports, or pages not captured.

## Dimensions

Check each in-scope capture against its baseline. Skip a dimension only when
the baseline does not specify it, and say so.

- **Layout** — structure; chrome and content placement; widths and ratios; alignment
- **Typography** — font, size, weight; line height and tracking; hierarchy; overflow or wrapping
- **Visual styling** — color, background, border; radius and shadow; controls; icons and detail
- **Components** — tables, cards, dialogs; buttons, selects, inputs; size and state; cross-page consistency
- **Responsive** — named viewports; squeeze or overflow; navigation; broken layout
- **Interaction** — hover, active, focus; loading, empty, error; disabled, selected; dialogs, menus, expand/collapse

## Workflow

1. Resolve the finalized interface, baselines, capture environment, and
   page or state scope.
2. Capture actuals for QA scope. Run Visual QA on the dimensions above.
3. When Regression is required, capture actuals for Regression scope and
   compare. A shift on unchanged pages or shared chrome is a regression
   even if QA still passes.
4. Grade each finding Must fix, Should fix, or May fix by consequence. A
   difference from the finalized interface is Must fix unless the user has
   accepted that difference.
5. Emit the report. On a non-`PASS` verdict, also emit the difference HTML.
   Tell the user the verdict. Stop.

## Report

### Final Verdict

Choose exactly one:

- **PASS** — no unresolved Must-fix; if Regression was required, it ran and
  has no unresolved Must-fix regressions; if it was not required, disclose
  `Regression: not run`.
- **CONDITIONAL PASS** — no unresolved Must-fix; every remaining finding is
  explicitly `risk accepted`.
- **FAIL** — unresolved Must-fix remains, or Regression was required and
  did not run.

Emit this labeled block:

```text
Verdict: PASS | CONDITIONAL PASS | FAIL
Regression: passed | failed | not run
Counts: total N · unresolved must-fix N · risk accepted N
Open: VQA-001, VRG-002
Difference HTML: <path-or-url-or-none>
```

`Open` lists unresolved Must-fix IDs only. On `PASS`, use `Open: none`
and `Difference HTML: none` unless the user asked for evidence. Assign QA
IDs as `VQA-###` and Regression IDs as `VRG-###`.

### Context

- Finalized interface:
- Baselines:
- Capture method and environment:
- Coverage limits:

### Findings

Group under Visual QA and Visual Regression. If there are no findings, write
`Findings: none` instead of empty blocks. Otherwise use one field block per
finding:

```text
ID: VQA-001
Location:
Route:
Viewport:
State:
Expected:
Actual:
Deviation:
Severity: Must fix | Should fix | May fix
Status: unresolved | risk accepted
Fix:
Selector: <css-or-n/a>
Screenshot:
Affects other pages: yes | no | n/a
```

- `risk accepted` only after explicit acceptance.
- On `FAIL`, the Final Verdict block plus every `unresolved` finding block
  is the handoff packet for a later fix model. This skill does not invoke
  that model. On `CONDITIONAL PASS`, tell the user; do not build a fix
  handoff unless the user still wants remaining non-Must items addressed.

## Difference HTML

When the verdict is not `PASS`, deliver one portable, script-free HTML page
for the user outside the repository:

- One row per unresolved finding (include `risk accepted` when useful).
- Expected on the left, actual on the right, same size and data.
- Label each row with ID, location or page, deviation, and severity.

On `PASS`, skip this page unless the user asks for evidence.

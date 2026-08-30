# UI Style Audit Evidence Policy

A style finding exists only when an applicable project expectation is connected to
an observed divergence, a demonstrated consequence, and the layer that owns the
cause. Declarations, search hits, counts, and screenshots are evidence inputs; none
is decisive in isolation.

House defaults are not audit criteria unless the user or project has explicitly
adopted them. Without a relevant visual contract, report quality-constraint
violations and supported consistency observations rather than preferences as drift.

## Establish the applicable expectation

- Identify the expectations that apply from user criteria, current decisions,
  consumed design-system contracts, and relevant exemplars. Account for accepted
  deviations before treating a difference as drift.
- Read project gates before improvising. Confirm from their source that they are
  read-only before running them; otherwise derive equivalent read-only evidence for
  the relevant checks.
- When the design system comes from a dependency, use the contract shipped with the
  installed version.

## Match evidence to the claim

- **Composition, hierarchy, density, and responsive behavior:** Inspect representative
  rendered states or available screenshots against the applicable expectation. When
  rendered evidence is unavailable, qualify the claim and disclose the coverage limit.
- **Instance-key reachability:** Run
  [../scripts/lint-style-key-reachability.mjs](../scripts/lint-style-key-reachability.mjs)
  against `<repo-root>`. Treat its reports as findings. Do not grep for unused
  style keys.
- **Tokens, scales, and themes:** Compare declared scales with real usage, then trace
  `source declaration → generated value → styling-layer mapping → real call site`.
  Check the reverse path for values synthesized outside the source and themes expected
  to be active but lacking an activation path.
- **Accessibility, interaction, and motion:** Exercise the affected behavior or inspect
  its rendered semantics and runtime state. Calculate contrast from foreground and
  background pairs actually used together.
- **Governance:** Use current decisions, gates, installed dependency contracts, and
  the layer where the divergence originates.

## Respect evidence limits

- A declaration proves intent, not enforcement.
- A rendered example proves occurrence, not prevalence or cause.
- A search hit or count proves presence or coverage, not violation or consequence.
- A zero result proves nothing until the probe matches known project styling as a
  positive control.

Exclude generated output, fixtures, authorized token sources, and accepted deviations
before promoting candidates. When evidence conflicts, report the conflict or gather
stronger evidence instead of silently choosing a convenient source.

## Assign ownership and severity

- Unread instance keys reported by the reachability script are leftovers.
  An unused optional token, dormant theme, or accepted deviation is not drift without
  evidence that it should govern the audited UI.
- Assign contract definition or generation failures to the contract owner, feature
  misuse to the feature owner, and dependency defects to the upstream owner. Do not
  hide an upstream issue with a local override.
- Choose the lowest severity supported by consequence, not by occurrence count,
  unfamiliar appearance, or the existence of a contract label:
  - **Must fix:** Blocks accessibility, a critical interaction, or a supported
    platform, or causes sustained resource use with material impact.
  - **Should fix:** A relevant explicit contract is bypassed, or reusable scales,
    hierarchy, or component conventions have materially drifted and will keep
    spreading.
  - **May fix:** A localized visual improvement that does not affect task completion,
    accessibility, or system consistency.

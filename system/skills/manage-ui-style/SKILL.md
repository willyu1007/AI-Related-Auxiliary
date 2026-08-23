---
name: manage-ui-style
description: Use when designing or changing UI, grounding it in actual user tasks, aligning it with a project's visual system, capturing reusable style decisions, or auditing visual drift.
---

# Manage UI Style

## Ground the UI in the use case

Treat the developer and the actual user as separate perspectives, even when they
are the same person. The developer's request defines the required outcome and
boundaries; the use case determines how the UI organizes information, interaction,
feedback, and copy. Do not turn implementation context, requirement rationale, or
the system's internal model into visible explanation.

Recover the smallest credible use case from the request and existing product
evidence: the user's context and goal, what they already know, and the decisions,
actions, feedback, and recovery needed to complete the task. Treat this as design
reasoning, not an additional deliverable. If materially different use cases remain
plausible, surface the conflict instead of inventing requirements or expanding scope.

Visible copy must help the user orient, decide, act, anticipate a material state or
consequence, or recover. Remove copy that only narrates the interface, repeats
visible information, or explains implementation. If removing it changes no user
behavior or understanding, remove it; if it compensates for weak structure, labels,
affordances, or feedback, fix the interface first. Use the user's vocabulary.

## Establish style authority

Resolve visual decisions in this order:

- The user's explicit visual direction and accepted choices.
- The project's active visual contract: consumed tokens and components, current
  decision records, and relevant exemplars.
- The house taste in [references/taste-rubric.md](references/taste-rubric.md)
  only for decisions left open by both.

Inspect the nearby UI and the shared style sources it uses. Prefer an explicit
current contract over accidental local usage, and consumed project patterns over
stale or unconnected documentation. Surface material conflicts instead of silently
creating another convention. Visual authority does not waive accessibility,
platform behavior, or interaction correctness. Do not copy the house rubric into
the project.

## Reuse before creating

- **Reuse:** Before proposing or implementing, locate the consumed component or
  composition that already owns the same responsibility. Base mocks on that owner;
  in production, visual resemblance is not reuse—consume the shared implementation
  instead of reproducing its markup locally.
- **Extend:** When the difference is bounded and belongs to the same responsibility,
  extend the existing owner's supported variants instead of creating a sibling.
- **Create:** Introduce a new pattern only when its responsibility, behavior, or
  constraints materially differ from what the project already provides.
- **Use canonical icons:** Treat icons as shared design assets. Reuse the project's
  consumed icon component or asset first; otherwise use one established icon set
  consistent with the platform and nearby UI. Preserve the source geometry and
  `viewBox`, and apply size, stroke, color, and alignment through the project's
  existing conventions. Do not hand-draw, reconstruct, mix families, or approximate
  a recognizable product, platform, or brand icon. Create a custom icon only when
  product-specific meaning or an explicit design request requires it, and verify it
  at its actual rendered sizes beside neighboring icons.

## Mock, choose, and implement

A change is non-trivial when confirming its direction before production could avoid
meaningful rework because it changes composition, information hierarchy, grouping,
navigation, the primary action or affordance, responsive behavior, or establishes a
reusable pattern. An isolated correction that follows an accepted exemplar and
leaves those decisions unchanged is trivial.

- **Implement a trivial change:** Derive from the nearest relevant exemplar and
  reuse the project's consumed components, tokens, and styling approach.

- **Confirm a clear direction:** For a non-trivial change whose direction is clear,
  create one static HTML mock before editing production components. Derive it from
  the relevant exemplar and use content, states, and density grounded in the
  representative use case.

- **Explore an open question:** Create alternatives only when the user requests
  them or the question is materially unresolved.

  - **Question:** State the design decision the alternatives must resolve.
  - **Fixed context:** Hold the page purpose, available data, project visual
    system, and unrelated decisions constant. Use realistic content and density;
    use read-only data or stubs for mutations.
  - **Distinct answers:** Let each alternative take a different position on
    structure, information hierarchy, grouping, navigation, or the primary
    action or affordance.
  - **Similarity check:** If two alternatives embody the same structural answer,
    merge them or replace one. Differences in color, type, radius, copy, or
    decoration alone do not count.

- **Deliver the decision:** Deliver mocks as HTML communication artifacts. Stop
  after delivery and wait for approval or a selection before production
  implementation.

- **Implement the decision:** Use the project's consumed components, tokens, and
  styling approach. When no styling approach exists, consider Tailwind if a shared
  utility and token layer would reduce repeated styling and fits the project's
  tooling and scope. Do not introduce or migrate to it solely for an isolated change
  in an established project. Add a missing token or reusable component only when the
  target needs it and the change is within scope.

- **Protect runtime quality:** Avoid continuously repainting effects unless they
  communicate persistent state; prefer lower-cost or static alternatives and
  preserve a reduced-motion path.

- **Clean up and bound the change:** Remove rejected variants and temporary
  switching code from production work. Do not turn a local UI task into a
  retroactive design-system rewrite.

## Crystallize accepted decisions

- **Qualify the decision:** Crystallize only when it is within the authorized scope
  and the decision is accepted, stable, and useful beyond the current UI.

- **Encode the contract:** Put reusable values and enforceable structure in the
  token or component layer the application actually consumes. Give each reusable
  pattern one consumed owner; documentation alone does not make a decision part of
  the visual system.

- **Record the context:** Extend the project's existing design record. If none
  exists, create the smallest project-appropriate record that captures intent,
  authoritative sources, rationale, exemplar pointers, and any accepted deviations.

- **Bound the change:** State what later work should inherit and any material gaps.
  Do not backfill unrelated UI or expand the record merely to make it comprehensive.

## Audit and correct

Read [references/audit.md](references/audit.md) before auditing.

- **Establish coverage:** Name the included and excluded scope, the project's
  actual styling syntax, and the relevant gates, decisions, and accepted deviations.

- **Build evidence:** Calibrate probes against known project usage and trace
  declarations through to real consumers. Do not treat declarations, search hits,
  or zero counts as proof by themselves.

- **Correct when authorized:** An audit-only request is read-only. When correction
  is requested or already authorized, fix clear in-scope findings. Distinguish
  `Fixed`, `Unresolved`, and `Risk accepted`; use `Risk accepted` only after
  explicit acceptance.

- **Report:** Return findings in a compact table:

| Issue / evidence | Severity | Owner | Status | Resolution / verification |
|---|---|---|---|---|

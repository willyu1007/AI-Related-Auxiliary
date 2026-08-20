---
name: research
description: >-
  Use when a question or delegated task requires external information to be
  found, verified, compared, or cited, especially when it is current,
  multi-source, or contested.
---

# Research

## Goal

Return a direct answer with traceable support for every material externally
verifiable claim. Keep facts, inferences, conflicting evidence, and unknowns
distinct.

## Route the work

If the work was delegated, perform it directly and never delegate it again.
Then choose the lightest research depth:

- **Direct lookup:** When one authoritative source owns the answer, verify its
  scope, applicability, and recency, then answer with a citation.
- **Investigation:** Use the workflow below when the answer depends on multiple
  claims, sources, time boundaries, comparisons, or conflicting evidence. When
  not already delegated, delegate an independent bounded question if the runtime
  supports subagents and authorization permits it; give the worker the exact
  question, boundaries, recency requirements, and required output. While it
  runs, continue only independent work. Otherwise investigate directly.

## Run an investigation

1. **Frame.** State the exact question and what a sufficient answer must
   establish. Preserve the request's settled scope. Identify any date, version,
   jurisdiction, environment, or other boundary that could change the answer;
   ask only when a missing boundary would materially change the investigation.
2. **Select sources.** Prefer sources that own the claim: official documentation,
   specifications, source code, first-party APIs, release notes, standards
   bodies, and original research as applicable. Use secondary sources for
   discovery or interpretation, and label material claims whose best available
   support remains secondary.
3. **Gather.** Use the smallest source set that adequately supports the answer,
   without a fixed quota. Capture dates, versions, and applicable conditions when
   they affect correctness. When sources disagree, describe the disagreement and
   its likely boundary or cause instead of resolving it by popularity.
4. **Stop.** Stop when the answer is supported or the remaining uncertainty is
   bounded and further search has no clear path to changing the result.
5. **Synthesize.** Lead with the answer and cite only inspected sources that
   support the claim, placing pointers next to material claims. Separate facts,
   inferences, conflicts, and unknowns; explain inference reasoning. Recommend
   only when requested, keeping the recommendation separate from its evidence
   and naming assumptions that could reverse it. State material coverage limits
   and what would close a remaining unknown; absence of evidence is not proof of
   absence.

## Deliver

- Return the result in the conversation by default. Create a durable artifact
  only when the user requests one or the delegating caller explicitly assigns
  one; then follow the existing repository convention rather than inventing a
  notes location.
- When delegated, return a compact packet with the question and boundaries,
  cited findings, inferences and uncertainties, validity limits, and remaining
  evidence needs. The receiving agent owns downstream decisions and repository
  updates.
- Quote only the minimum source material needed and exclude credentials, tokens,
  personal data, and other sensitive evidence from the result.

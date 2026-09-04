---
name: html-communication
description: >-
  Use when a plan, spec, report, summary, findings, comparison, or UI mock
  needs a portable page or visual surface rather than a conversational
  answer, whether requested directly or produced by another workflow.
---

# HTML Communication

## HTML Document

Create one portable, script-free HTML file. Write it as UTF-8 and put
`<meta charset="utf-8">` as the first child of `<head>`.

- Present information as a concise, scannable working document, not a landing page.
- Use semantic HTML, inline CSS, and a responsive layout.
- Use inline SVG or data URLs for embedded visuals.
- Use links, anchors, and native HTML elements such as `<details>` when navigation or progressive disclosure helps.
- Match the presentation to the information: use timelines for sequences, side-by-side comparisons for alternatives or before-and-after states, parallel columns for concurrent tracks, and diagrams for meaningful relationships.
- Use color to communicate status, categories, differences, or emphasis, rather than as decoration.

## Content Scope

HTML changes presentation, not scope. Include only the requested result and the minimum context,
labels, and explanation needed to understand or use it.

- Do not add sections merely to make the artifact feel complete or polished. Omit executive
  summaries, background, methodology, key takeaways, recommendations, risks, next steps, and
  appendices unless requested or necessary.
- State each fact once. Add an overview only when the document is otherwise difficult to navigate;
  use it to orient the reader rather than repeat the details.
- Present only the current result. Include conversation context, decision records, revision history,
  or process narrative only when the user explicitly asks for it.
- Before delivery, remove anything that does not help the reader answer the requested question or
  perform the requested task.

The artifact may travel beyond this session. Report what a value means or how environments differ,
never the credential, token, or private connection string itself.

## Audience and Content Layers

Keep developer-facing communication separate from product-facing UI.

### Developer-Facing Communication

Unless the user specifies another audience, treat non-UI artifacts and all content outside a UI
mock's product surface as developer-facing.

- Keep it concise and structured. Prefer short sections, bullets, tables, diagrams, and labeled
  values over paragraphs.

### Product-Facing UI

Within a UI mock's product surface, write for the actual user in the concrete product scenario.

- Use realistic product copy and data appropriate to that user.
- Do not carry conversation content, prompts, code, implementation details, developer constraints,
  acceptance criteria, task instructions, or design rationale into the UI.
- Do not add explanatory text merely to describe the mock or make it easier to review.
- Include helper text, onboarding, empty states, or error messages only when they are genuine parts
  of the product experience.

## UI Mocks

When delivering a UI mock:

- When the request focuses on a feature rather than the frame or an overall
  scheme, place it in its existing outer frame.
- Follow the project's visual conventions and templates already in use.
- If the user asks to break the current state, drop only what that request overrides.
- Render the product, not a presentation about the product. Make the proposed UI the visual center
  of the artifact.
- Keep content outside the product surface to the minimum needed for identification. A short title
  or variant label is usually sufficient.
- Do not add introductory copy, feature summaries, rationale panels, legends, or explanatory
  captions unless explicitly requested.
- For variants, label them `A`, `B`, `C`... outside the product surface and lay them out for direct
  comparison.
- Represent tabs, overlays, pagination, and other interactive states as labeled static states or
  variants in the same document.
- When annotations are requested, place them outside the product surface and keep them visually
  secondary to the UI.

## Artifact Lifecycle

- Unless the user requests another location, use `<Desktop>/html-communication/<slug>/`.
- Name `<slug>` and every file in kebab-case from the subject, two or three words. Do not copy the request, document title, directory slug, or a date into a name.
- Call the primary HTML file `index.html`.
- Reuse that directory for related follow-up work.
- Update the primary HTML file in place across iterations. Create versioned, numbered, or timestamped copies only when the user asks to preserve separate versions.
- When the user prefers a quick visual review, render only the requested or changed views as images in `previews/`, update stable preview filenames in place, and present the images directly in the conversation.

## Delivery

Deliver the document locally.

1. Keep the primary HTML file and its previews outside the repository unless the user requests otherwise.
2. Return an absolute, directly clickable link to the primary HTML file.

---
name: html-communication
description: Use when a plan, spec, report, summary, findings, comparison, or UI mock should be delivered as an HTML communication artifact, whether requested directly or produced by another workflow.
---

# HTML Communication

Apply these instructions to HTML communication artifacts, not HTML that ships as part of a product.

## HTML Document

Create one portable, script-free HTML file.

- Present information as a working document, not a landing page: dense, scannable, and organized around the content.
- Use semantic HTML, inline CSS, and a responsive layout.
- Use inline SVG or data URLs for embedded visuals.
- Use links, anchors, and native HTML elements such as `<details>` when navigation or progressive disclosure helps.
- Match the presentation to the information: use timelines for sequences, side-by-side comparisons for alternatives or before-and-after states, parallel columns for concurrent tracks, and diagrams for meaningful relationships.
- For longer documents, provide a compact overview before the details and link overview items to their corresponding sections when useful.
- Use color to communicate status, categories, differences, or emphasis, rather than as decoration.

## Content Focus

Present only the current result. Include conversation context, decision records, revision history,
or process narrative only when the user explicitly asks for it.

The artifact is user-facing and travels beyond this session. Report what a value means or how environments differ, never the credential, token, or private connection string itself.

## UI Mocks

When delivering a UI mock:

- Render the proposed view, not a description of it.
- For variants, label them `A`, `B`, `C`... and lay them out for direct comparison.
- Represent tabs, overlays, pagination, and other interactive states as labeled static states or
  variants in the same document.

## Artifact Lifecycle

- Unless the user requests another location, use `<Desktop>/html-communication/<task-name>/` and keep files from the same task together.
- Reuse the task directory for related follow-up work.
- Update the primary HTML file in place across iterations. Create versioned, numbered, or timestamped copies only when the user asks to preserve separate versions.
- When the user prefers a quick visual review, render only the requested or changed views as images in `previews/`, update stable preview filenames in place, and present the images directly in the conversation.

## Delivery

Deliver the document locally.

1. Keep the primary HTML file and its previews outside the repository unless the user requests otherwise.
2. Return an absolute, directly clickable link to the primary HTML file.

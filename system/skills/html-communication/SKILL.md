---
name: html-communication
description: Use when the user asks to communicate through an HTML document, or if they mention "HTML" with no additional context.
metadata:
  harness: [claude, codex]
  scope: fleet
---

# HTML Communication

## When to Use

Use this skill when the user wants a plan, spec, write-up, findings, summary, report, comparison, or set of UI mocks presented as readable HTML — or when they provide a postplan.dev URL whose contents you need to read.

Do not use it for HTML that ships as part of a product.

## Document

Create one self-contained HTML file, capped at 512 KB.

- Write it like a spec, not a landing page: dense, scannable, no hero, decorative chrome, marketing voice, or em dashes.
- Color serves information differentiation, not decoration: use it to encode status, categories, diffs, and emphasis; keep everything without semantic meaning restrained.
- Make it mobile-readable with a responsive viewport and no fixed-width layout.
- Use semantic HTML, inline CSS, inline SVG, and HTTPS or data-URL images.
- Use an inline classic script only when interactivity materially helps. Keep scripted pages useful without JavaScript; the sandbox blocks storage, fetch, workers, frames, forms, and popups.
- In script-free files, give external links `target="_blank"` and `rel="noopener noreferrer"`. If any script exists, omit `target="_blank"`.
- Avoid continuously repainting CSS animations (pulse, shimmer, blur, spinners); they peg the GPU on high-refresh displays.

Never include external or module scripts, inline event handlers, `javascript:` URLs, forms, iframes, embeds, objects, applets, meta refresh, linked stylesheets, secrets, private URLs, or local filesystem paths.

## UI Mocks

When the user asks for variants:

- Render real styled variants, not descriptions.
- Label them `A`, `B`, `C`... for easy selection.
- Lay them out for direct comparison.
- Keep one file across iterations so its location (and Postplan URL, if uploaded) stays stable.

## Delivery

Default delivery is local:

1. Write the HTML file into a dedicated directory on the user's Desktop (not into the repository), keeping related presentation files together.
2. Report a directly clickable link to the primary file.

Upload to Postplan only when the user asks for it or asks for a shareable URL:

1. Run `npx postplan upload <file path>`.
2. Report both the local path and the returned Postplan URL.
3. Re-upload the same absolute path to update the existing URL. Use `npx postplan upload <file path> --new` only when a new draft is wanted.

If validation fails, fix the markup and retry. If a scripted upload needs authentication, ask the user to run `postplan auth login`, then retry without removing the requested interactivity.

Never open a browser or claim the document is hosted before upload succeeds. Do not verify in a browser unless the user asks.

## Reading a Postplan URL

When the user provides a postplan.dev URL, fetch it with the shell. Do not use web search or a browser.

1. Remove a trailing slash, then append `/raw` unless the URL already ends in `/raw`.
2. Run `curl --fail --silent --show-error --location --max-time 30 --output /tmp/postplan.html '<raw-url>'`.
3. Read `/tmp/postplan.html` and continue the user's request from its contents.

If `curl` fails, report its actual status or network error. Do not substitute search results.

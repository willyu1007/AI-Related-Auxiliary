---
name: uml-diagrams-new
description: Use when creating or editing Mermaid-based flowcharts, class, sequence, state-machine, or structure diagrams with draw.io, especially when the result must follow local styling or fit a technical document.
---

# UML diagrams

This extends the official draw.io Skill with local diagram and document-fit requirements. A successful Mermaid-to-draw.io conversion is only a first render; it is not a finished diagram.

## Source and outputs

- Keep `media/<basename>.mmd` as the editable semantic source.
- Generate `<basename>.drawio` from that source. Apply layout and local style corrections to this generated file.
- Export the requested final format from `.drawio`, never directly from `.mmd`.
- Keep the `.mmd` source after conversion.

## Required workflow

1. Read `upstream/SKILL.md` and the matching type reference below.
2. Decide before drawing whether the diagram is for a document. If a target document is provided, read its usable content width and page height. If document fit is required but the target width is unknown, ask for the width or the document before calling the figure document-ready.
3. Write or revise `media/<basename>.mmd`. Keep semantic changes in Mermaid; use the type reference for structure and layout choices.
4. Convert and style with the shared renderer. Mermaid diagrams already have an initial layout; pass a documented ELK preset only when the type reference calls for it. Do not use ELK to compensate for a topology that needs changing.

   ```powershell
   & scripts/render-diagram.ps1 -InputPath <basename>.mmd -DiagramType <type> [-LayoutJson layouts/<preset>.json]
   ```

   The renderer waits for CLI output, applies the shared style script, and exports only when requested. It does not decide topology, move nodes, or replace visual QA.
5. Ungroup Mermaid containers when present, then reapply local styles:

   ```powershell
   & scripts/apply-diagram-style.ps1 -InputPath <basename>.drawio -DiagramType <type>
   ```

6. Make type-specific geometry corrections in draw.io or user-drawio MCP: ports, label offsets, lifeline details, waypoints, and spacing. Do not calculate coordinates by hand. If a change needs nodes or relationships added, removed, split, or reordered, return to step 3 and reconvert.
7. When document fit is required, use the target document's actual available width `W_doc` and height. Estimate the placed height as `H_doc = W_doc × (image height / image width)`. If the image exceeds the available page height or its labels are unreadable at that placement, revise the Mermaid layout and repeat the render. Apply this check to every diagram; the type-specific node-count thresholds are early warnings, not exemptions.
8. Export from `.drawio` and inspect the final cropped image:

   ```powershell
   & scripts/render-diagram.ps1 -InputPath <basename>.drawio -DiagramType <type> -OutputPng <basename>.png
   ```

   A diagram is ready only when its type rules, shared style, connections, labels, canvas bounds, and any document-fit target all pass.

For a document target, the `700–1200 px` width in type references means the cropped draw.io canvas before export scaling. The standard export uses `-s 3`, so the PNG's pixel width is three times larger; do not use PNG pixel width as its physical Word/PDF placement width.

## Shared visual contract

| Element | Required result |
|---|---|
| Fill | White (`#ffffff`) |
| Shape borders and connectors | `#333333`, width `2` |
| Text | Black (`#000000`), Microsoft YaHei, at least `14` |
| Edge labels | White background |
| Flowchart, state, and structure edges | Orthogonal, straight corners |
| State start/end | Text ovals “开始” and “结束”; no solid black start/end dots |
| Sequence participants | Top name box only; dashed lifeline; no activation bars unless requested |

Run the style script after every fresh Mermaid conversion. It does not preserve hand-applied changes made to a previous `.drawio` file.

## Type references

| Diagram | Read this file | Preset |
|---|---|---|
| Flowchart | `references/flowchart.md` | `layouts/flowchart-default.json` when needed |
| Class | `references/class-diagram.md` | `layouts/class-default.json` when needed |
| Sequence | `references/sequence-diagram.md` | None |
| State machine | `references/state-machine.md` | None |
| Structure / component | `references/structure.md` | `layouts/structure-default.json` or `layouts/graph-horizontal.json` |

Examples and rendered previews are indexed in `examples/README.md`.

## Tool responsibilities

| Tool | Use it for |
|---|---|
| `scripts/render-diagram.ps1` + draw.io CLI | Mermaid conversion, optional documented ELK layout, shared styling, final export |
| `scripts/apply-diagram-style.ps1` | Reapply local visual rules after Ungroup or another fresh conversion |
| user-drawio MCP | Targeted post-conversion geometry and label corrections |

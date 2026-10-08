# Geometry sources

`scripts/geometry-rules.mjs` adapts `intersectionRect`, Liang–Barsky
`interiorLengthInsideRect`, and segment intersection from
[Sunwood-ai-labs/draw-io-skill](https://github.com/Sunwood-ai-labs/draw-io-skill/blob/131921b2039b02fc8ee16b23bdb951b1fbb59594/scripts/check-drawio-svg-overlaps.mjs),
revision `131921b2039b02fc8ee16b23bdb951b1fbb59594` (MIT, copyright 2026 Sunwood-ai-labs).
License: [Sunwood-MIT.txt](Sunwood-MIT.txt).

Changes: separate pixel and parameter tolerances; measure ordinary edge labels
with browser DOM instead of estimating character widths; use exported outlines,
preserve cell ancestry, and explicitly report unsupported coverage.

Rule selection also references
[drawio-diagram-builder visual validation](https://github.com/holdyounger/drawio-diagram-builder/blob/main/scripts/validate_visual_quality.py)
(MIT, copyright 2026 XiaoM). No code copied from that project.
Its text estimates and group exclusions are not adopted.

Playwright is an Apache-2.0 dependency; its package retains its own license.

# Pack: plan-visualizer

Renders a complex plan as a self-contained interactive HTML artifact — navigation, diagrams,
timelines, comparisons, impact maps — instead of a wall of Markdown.

## Dependencies

None. The skill ships its own HTML templates, components, and browser-side scripts; nothing is
fetched at runtime and nothing is installed.

## Install

```bash
cp -R packs/plan-visualizer/files/. /path/to/your/project/
```

## Contents

| Path | Role |
|------|------|
| `.ai/skills/workflows/planning/plan-html-visualizer/SKILL.md` | The skill |
| `.../templates/base.html` | Artifact shell |
| `.../components/*.html` | 10 blocks: timeline, mindmap, flow graph, impact map, risk card, … |
| `.../scripts/*.js` | Interaction, navigation, i18n, feedback protocol |
| `.../reference/*.md` | Artifact format, component guide, feedback protocol |

## Why a separate pack

The skill is orthogonal to task governance: nothing here reads or writes `dev-docs/`, and nothing
knows about the project hub. A presentation tool that happens to be useful next to both.

`start-dev-docs-task` (in `dev-docs-continuity`) mentions handing a finished `roadmap.md` to this skill.
That handoff is optional in both directions — either pack works without the other.

## Boundaries

- Visualizes an existing plan; does not create the plan or make engineering decisions.
- The HTML artifact is a view, never the source of truth. `roadmap.md` stays authoritative.

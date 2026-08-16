---
name: plan-html-visualizer
description: >-
  Render an existing implementation plan, architecture or design proposal, refactoring
  strategy, migration plan, or multi-step change analysis as a self-contained interactive
  HTML artifact. Use when the plan benefits from navigation, diagrams, timelines,
  comparisons, or impact maps rather than plain chat or Markdown, and when the user asks to
  revise a previously generated HTML plan artifact — changing sections, diagrams,
  comparisons, or phases. This skill presents a plan; it does not author one. To produce the
  plan itself use start-dev-docs-task, and for content that reads fine as chat or Markdown,
  answer directly instead.
---

# Plan HTML Visualizer

Turn a plan that already exists into one self-contained HTML file the user can navigate, inspect,
and comment on — then read those comments back and regenerate.

The artifact is a view, never the record. Engineering reasoning, plan quality, and implementation
decisions stay with the agent and with the plan document.

## Artifact and workspace

| | |
|---|---|
| Input | The plan: current conversation, a host plan-mode artifact, a `start-dev-docs-task` roadmap at `dev-docs/active/<task>/roadmap.md`, or a document the user points at |
| Output | One HTML file under `<repo-root>/.ai/.tmp/html-viewer/`, named for the task |
| Revision input | The previously generated artifact at that same path |

`.ai/.tmp/html-viewer/` is temporary agent workspace, not project source or durable documentation.
Do not copy artifacts elsewhere unless the user asks.

Display language applies to the whole artifact:

```yaml
# Supported: zh-CN | en
artifact_language: zh-CN
```

Set `<html lang>` to that value. `scripts/i18n.js` localizes fixed UI chrome from `<html lang>` at
runtime, so only generated content — titles, summaries, details — needs writing in that language.

## Workflow

### Phase 1 — Extract structured information

Answer: *what engineering information does the plan contain?* Extract only what is already in the
plan or the coding context. Do not invent, rewrite, improve, or expand.

Candidate elements: goal, context, current state, target state, component, dependency,
implementation phase, task, technical decision, risk, file impact, verification strategy,
constraint. Extract only the ones that materially improve understanding.

Capture artifact metadata when available: artifact id, creation/update time, task title,
conversation or session id, project id. Omit unavailable identifiers or mark them `"unknown"` —
never fabricate.

### Phase 2 — Choose presentation

Answer: *how does the reader understand the plan fastest?* Choose by the shape of the information,
never for decoration. The table is a menu of optional dimensions; a dimension absent from the plan
is simply skipped.

| Component | Use for | Resource |
| --- | --- | --- |
| Mindmap overview | plan structure at a glance; auto-rendered from the semantic context model | `components/mindmap.html` + `scripts/mindmap.js` |
| Summary | goals, scope, key changes, constraints, major risks | `components/summary-card.html` |
| Timeline | strictly ordered phases, migration sequences, dependent steps | `components/timeline.html` |
| Flow graph | branching / conditional workflows with decision points | `components/flow-graph.html` + `scripts/flow-graph.js` |
| Parallel tracks | concurrent workstreams with sync points | `components/parallel-tracks.html` |
| Architecture diagram | component relationships, dependencies, data flow, boundaries | `components/architecture-graph.html` |
| Before / after comparison | refactoring, migration, behavior replacement | `components/comparison.html` |
| Decision view | technical choices, trade-offs, alternatives already in the plan | `components/decision-card.html` |
| Risk view | implementation, migration, compatibility, operational risks | `components/risk-card.html` |
| Impact map | affected files, modules, dependencies, cross-cutting changes | `components/impact-map.html` |
| Detail sections | implementation details, commands, API/DB changes, validation steps | inline, collapsed by default |

Selection heuristics and anti-patterns: `reference/component-guide.md`.

**Focus budget (MUST).** Screen space is the scarce resource, so select ruthlessly:

- The artifact opens with an **overview band** — the mindmap (`span-two-thirds`, auto-rendered from
  the semantic context model) plus a compact summary card (`span-third`). Always present.
- Beyond the overview band, mark **at most 2** views `priority: "primary"` — the dimensions
  carrying the core of this particular plan (timeline + risks for a migration; comparison + impact
  for a refactor).
- Everything else is `priority: "secondary"` and renders collapsed.
- Omit dimensions with no substance. Never pad with a component just because the component exists.

**Layout (SHOULD).** Each view declares a `span` in the presentation model, mirrored as a class on
the section element: `span-full` (default), `span-two-thirds`, `span-half`, `span-third`. Compact
views — risk cards, decision cards, comparisons, parallel tracks — SHOULD share rows rather than
each taking a full-width band.

### Phase 3 — Render

One self-contained HTML file:

- MUST embed everything — presentation, the four models, styling, interaction scripts. No companion
  files, and no external network resources (CDN scripts, fonts, remote images). The file opens
  offline.
- Inline scripts MUST be classic scripts, no `import`/`export`. Inline `scripts/i18n.js` first, and
  `scripts/graph-support.js` before `mindmap.js` or `flow-graph.js` when either is used.
- Use the shipped templates and components rather than inventing HTML structures. The agent
  supplies content, presentation intent, and semantic context; the template layer owns layout,
  assembly, styling, and behavior.
- Lead with what is changing, why it matters, the approach, key risks, and affected areas. Details
  belong in collapsed sections. Long plans need working navigation anchors and a clear heading
  hierarchy.

## Embedded models

Four JSON blocks. Schemas, field rules, and DOM attribute conventions: `reference/artifact-format.md`.

| Block id | Purpose |
| --- | --- |
| `plan-artifact-metadata` | Task/session identification for agent recovery and disambiguation |
| `plan-semantic-context` | Minimum semantic plan nodes, with stable ids, needed to recover context from feedback |
| `plan-presentation-model` | Which views exist, which nodes they represent, what is collapsed |
| `plan-pending-feedback` | Pending feedback events; empty on generation, cleared after consumption |

**Semantic traceability (MUST).** Every element the user can select for feedback must resolve to a
node in `plan-semantic-context`, and every view in `plan-presentation-model` must reference node ids
that exist. Without that mapping, feedback cannot be traced back to the plan and the loop breaks.

## Feedback loop

The artifact is a read-only presentation with exactly one write path: the built-in feedback UI.

1. The user selects a section and types free-form text. The interaction layer appends a pending
   event to `plan-pending-feedback` — the only part of the file that may change after generation.
   Persistence mechanics (File System Access API, download-replace and copy-to-chat fallbacks):
   `reference/feedback-protocol.md`.

   ```json
   {
     "nodeId": "phase-2-db-migration",
     "feedback": "Run this after the canary release instead.",
     "selectedText": "Migrate the user table",
     "viewId": "view-timeline",
     "createdAt": "2026-07-07T17:20:00+08:00"
   }
   ```

2. The agent reads the artifact and parses the four models.

3. Each pending event maps to a semantic node: by `nodeId` when present, otherwise by matching
   `selectedText` or `viewId` against the presentation model. An event that cannot be mapped is a
   question for the user, not a guess.

4. The agent interprets the feedback in the recovered context and updates the **plan**, not the
   HTML.

5. The agent regenerates the whole file at the same path: identifiers and content of unaffected
   nodes stay stable, `updatedAt` and `version` advance, and `plan-pending-feedback` returns to
   empty.

Feedback events are transient — they exist only between recording and consumption. The artifact
keeps no feedback history.

**Scope (MUST).** Apply feedback to the referenced node and directly affected neighbours (a
migration phase plus its tasks, risks, validation steps, and diagrams). Do not rewrite unrelated
sections unless the feedback changes the plan's overall structure.

## Rules

- **Preserve engineering intent.** Never introduce technical decisions, change strategy, add
  assumptions, expand scope, or silently resolve open questions the plan left open.
- **Never invent structure.** Do not create relationships, dependencies, decisions, risks, or
  constraints because they would look good in a diagram. Visual structure reflects the plan.
- **Never hand-edit an artifact,** and never read a hand-edited one as plan truth. Users must not
  edit rendered content or the other three models; treat such files as untrusted presentation state
  and recover from the embedded models or the conversation.
- **Never ask the user to classify feedback.** Interpreting intent — question, correction, change
  request, concern, constraint — is the agent's job.

## Assets

- `templates/base.html` — page shell with the four JSON blocks and the layout grid
- `components/` — the presentation components in the Phase 2 table
- `scripts/i18n.js` — UI chrome localization (zh-CN / en); inline first
- `scripts/navigation.js` — navigation behavior
- `scripts/interaction.js` — selection and secondary-section collapsing
- `scripts/graph-support.js` — shared zoom toolbar and jump-to-node helpers
- `scripts/mindmap.js` — renders the overview mindmap from the semantic context model
- `scripts/flow-graph.js` — renders flow graphs from embedded flow specs
- `scripts/feedback.js` — recording and persisting pending feedback events
- `reference/artifact-format.md` — model schemas and attribute conventions
- `reference/component-guide.md` — component selection guidance
- `reference/feedback-protocol.md` — feedback event lifecycle, persistence, recovery

Read reference files only when needed.

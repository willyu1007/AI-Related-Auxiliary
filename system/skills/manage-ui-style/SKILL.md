---
name: manage-ui-style
description: Design UI that looks like it belongs to its project, and keep it that way. Use when building or changing any non-trivial interface, screen, component, or layout; when the user asks to unify, tidy, or fix the look of an app; when a project's style is worth capturing so later work can inherit it; or when the user asks to check UI drift or audit an interface against its own design system. Not for backend or data work, and not for copywriting alone.
---

# Manage UI Style

Style does not survive in rules alone. Every generation re-derives the visual decisions, and every re-derivation drifts — so the project's own code is the source of truth for how it looks, and this skill's job is to find it, work from it, and keep it honest.

Two layers, and they never merge:

- **The house layer travels with this skill**: `./reference/taste-rubric.md` (positions with consequences) and `./reference/anti-patterns.md` (the floor, in force in every mode). Both load before designing — they exist to counterweight generation defaults, which is only possible before the code is written.
- **The project layer lives in the repository**: its tokens, its exemplar screens, its `STYLE.md`. This is what makes each project look like itself.

Never copy the house layer into a project. A rulebook in a repository is a rulebook nobody reads.

## Look before designing

Every run starts by finding what the project already has:

```bash
ls src/**/tokens.* src/**/theme.* tailwind.config.* 2>/dev/null
cat docs/ui/STYLE.md 2>/dev/null
```

What turns up decides the mode — you do not ask for it:

| Found | Mode | Meaning |
|-------|------|---------|
| Project has tokens / exemplars / `STYLE.md` | **Strict** | Derive from them. This is how consistency happens without anyone asking for it. |
| Nothing yet | **Free** | Design against the house rubric, then crystallize (Workflow B). |
| User says "try something different" | **Explore** | Overrides either default — but the anti-pattern floor still holds. |

## Workflow A — Design

1. **Load the house layer** (`taste-rubric.md`, `anti-patterns.md`) and the project layer if it exists. Before generating, not after.

2. **Mock first.** For any non-trivial screen, layout, or copy change: build several distinct static HTML mocks, deliver them, report where they are, and stop. Wait for a pick before touching real components. Mocks belong in a dedicated directory outside the repository; when that is not possible, a temporary directory inside it, named in the handback. After the pick, mocks are deleted — unless one is being promoted to an exemplar, which is Workflow B.

3. **Derive, do not invent.** In strict mode, new screens come from the nearest exemplar — copy its composition and swap the content. Only tokens and primitives supply values; a literal color, radius, or font-size in a feature file is the drift starting.

   **When the token layer does not cover the value you need** — a project with colors but no type scale is the common case — the exemplar's existing values are the implicit scale: match one of them exactly rather than inventing a neighbour, and say in the handback which scale is missing so it can be declared. Adding the missing token is a proposal, never a silent side effect, and it is never applied retroactively to files this task did not touch.

4. **Constrain the vocabulary, not just the behavior.** Where the project styles with utility classes, configure the framework's theme to expose only its scale, so out-of-scale classes stop existing rather than relying on discipline not to type them — check how the *exemplar* is written, not what is installed; a framework present but unused by real code is not the project's styling approach, and constraining it is busywork. Take **behavior** from libraries (focus management, ARIA, keyboard navigation, portals, dismissal) — hand-written dialogs are how a codebase ends up with three modal implementations and four z-index values. Take **appearance** from tokens, always.

5. **Close with the mechanical set** from `./reference/anti-patterns.md`. Report hits with what you did about them.

## Workflow B — Crystallize

Run when a project has produced UI worth keeping and the project layer does not yet cover it — either because there is no layer at all, or because a genuinely new pattern landed that no exemplar covers (the first hero, the first wizard, the first data-dense board). A style record written once and never revisited goes stale by standing still; incremental crystallization is what keeps it honest.

1. Extract the tokens actually used into the project's real token file — the one the app consumes, not a document.
2. Mark one to three screens as exemplars: a list, a form, a detail or overview. These are what later work copies.
3. Write `docs/ui/STYLE.md` from `./templates/STYLE.md`: intent, axis positions, token decisions with reasons, exemplar pointers. Increment only — the house layer is not repeated here.
4. Say plainly that the project is now in strict mode, and what that changes.

## Workflow C — Audit

When the user asks to check drift, or before a release that cares how it looks.

1. Run the mechanical set from `./reference/anti-patterns.md` across the source.
2. Count the scales actually in use and compare against the declared ones:

   ```bash
   rg -o 'border-radius:\s*[^;]+' src/ | sort | uniq -c | sort -rn
   rg -o 'font-size:\s*[^;]+' src/ | sort | uniq -c | sort -rn
   ```

   A declared three-step radius scale that shows fourteen distinct values in practice is the finding — the contract exists and adherence decayed.
3. Check the project layer against itself: exemplars still representative, `STYLE.md` claims still true, tokens declared but never consumed, tokens consumed but never declared.
4. **Report, do not fix.** Group by severity — floor violations (accessibility, continuous repaint, contrast) first, then scale drift, then cosmetics. Every finding gets a file and line. Fixes happen only on a separate instruction, because a style sweep that rewrites while it reports is unreviewable.

## Harvest

When a project improves something the house layer should learn — a better composition, a token decision that generalizes — say so in the handback and propose the rubric edit. Upward flow is how the house layer stays alive; without it the rubric slowly describes a project that no longer exists.

## Rules

- Never design before reading what the project already has.
- Never copy the rubric or the anti-pattern list into a project repository.
- Never let a literal color, radius, or font-size into a feature file; the token layer is the only source.
- Never rewrite code during an audit.
- Never edit real components before a mock has been picked, for any non-trivial change.
- Explore mode relaxes the rubric, never the floor.
- Never introduce a continuously repainting animation, and never ship motion without a reduced-motion path.
- Never claim a screen is done before its empty, loading, and error states exist.

## Assets

| Path | Role |
|------|------|
| `reference/taste-rubric.md` | Positions with consequences; the house defaults a project may override |
| `reference/anti-patterns.md` | The floor, plus the mechanical command set |
| `templates/STYLE.md` | Project style record — increment only |

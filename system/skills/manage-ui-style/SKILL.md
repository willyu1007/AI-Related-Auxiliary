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

Every run starts by finding what the project already has. Search for the **artifact**, not for a filename — a crystallized project may have recorded itself as `PARADIGMS.md`, `DESIGN.md`, a kit README, or a Storybook, and looking only for `docs/ui/STYLE.md` will miss the best documentation in the repository:

```bash
find . -type f \( -name 'tokens.*' -o -name 'theme.*' -o -name 'design-tokens.*' \) -not -path '*/node_modules/*'
rg -l --iglob '*.md' 'design token|design system|scale|paradigm|typography|governance|style guide' .
find . -name 'tailwind.config.*' -not -path '*/node_modules/*'; rg -l '@theme|@tailwind' --glob '*.css' .
```

Search the whole repository, not `src/` — a monorepo keeps its tokens in a package or a top-level `ui/`, and Tailwind v4 configures itself inside CSS with no config file to find. Stay on `find`, `rg`, and `git`; a probe built on a tool that may not be installed reports "nothing here" and an exit code nobody reads. **Never silence stderr on a discovery probe**, and treat a command finding nothing as the probe missing rather than the project being empty — widen it before concluding.

Read whatever turns up before deciding anything is missing. What is found decides the mode — you do not ask for it:

| Found | Mode | Meaning |
|-------|------|---------|
| Tokens *and* exemplars or a style record | **Strict** | Derive from them. This is how consistency happens without anyone asking for it. |
| Tokens but nothing to derive composition from | **Strict on values, free on composition** | Every value comes from the token layer; the composition is yours to design, and it is a crystallize candidate the moment it is picked. |
| Nothing yet | **Free** | Design against the house rubric, then crystallize (Workflow B). |
| User says "try something different" | **Explore** | Overrides any default — but the anti-pattern floor still holds. |

## Workflow A — Design

1. **Load the house layer** (`taste-rubric.md`, `anti-patterns.md`) and the project layer if it exists. Before generating, not after.

2. **Mock first.** For any non-trivial screen, layout, or copy change: build several distinct static HTML mocks, deliver them, report where they are, and stop. Wait for a pick before touching real components. Mocks belong in a dedicated directory outside the repository; when that is not possible, a temporary directory inside it, named in the handback. After the pick, mocks are deleted — unless one is being promoted to an exemplar, which is Workflow B.

3. **Derive, do not invent.** In strict mode, new screens come from the nearest exemplar — copy its composition and swap the content. Only tokens and primitives supply values; a literal color, radius, or font-size in a feature file is the drift starting.

   Copying is the fallback, not the ceiling. **The strongest project layer is components that make the wrong structure unreachable** — a hub that only renders rows cannot grow a card grid, and no discipline is required to keep it that way. When a project ships such components, compose with them rather than copying screens; when a composition is being copied for the third time, that is the signal to lock it into a component instead.

   **When the token layer does not cover the value you need** — a project with colors but no type scale is the common case — the exemplar's existing values are the implicit scale: match one of them exactly rather than inventing a neighbour, and say in the handback which scale is missing so it can be declared. Adding the missing token is a proposal, never a silent side effect, and it is never applied retroactively to files this task did not touch.

4. **Constrain the vocabulary, not just the behavior.** Where the project styles with utility classes, configure the framework's theme to expose only its scale, so out-of-scale classes stop existing rather than relying on discipline not to type them — check how the *exemplar* is written, not what is installed; a framework present but unused by real code is not the project's styling approach, and constraining it is busywork. Take **behavior** from libraries (focus management, ARIA, keyboard navigation, portals, dismissal) — hand-written dialogs are how a codebase ends up with three modal implementations and four z-index values. Take **appearance** from tokens, always.

5. **Close with the mechanical set** from `./reference/anti-patterns.md`. Report hits with what you did about them.

## Workflow B — Crystallize

Run when a project has produced UI worth keeping and the project layer does not yet cover it — either because there is no layer at all, or because a genuinely new pattern landed that no exemplar covers (the first hero, the first wizard, the first data-dense board). A style record written once and never revisited goes stale by standing still; incremental crystallization is what keeps it honest.

1. Extract the tokens actually used into the project's real token file — the one the app consumes, not a document.
2. Mark one to three screens as exemplars: a list, a form, a detail or overview. These are what later work copies.
3. Record it. `./templates/STYLE.md` is the shape when nothing exists yet — intent, axis positions, token decisions with reasons, exemplar pointers, increment only. **When the project already records itself under other names, extend those instead**: a repository holding a paradigm spec and a typography contract does not need a seventh document, and adding one is the duplication this skill exists to prevent. Crystallizing an already-crystallized project means finding what is genuinely missing — usually the pointer that says which file new work derives from — and adding only that.
4. Say plainly that the project is now in strict mode, and what that changes.

## Workflow C — Audit

When the user asks to check drift, or before a release that cares how it looks.

1. **Scope and calibrate.** Name which packages are in the audit and which are excluded. Then establish how the project actually writes style — literal CSS, utility classes, CSS-in-JS — because the probes differ and the wrong one fails silently. `./reference/anti-patterns.md` opens with the calibration commands.

2. **Run the mechanical set**, using the variant that matches. **Treat a near-zero result as a probe failure until proven otherwise** — a mature application with no radius declarations is not a disciplined application, it is a probe pointed at the wrong syntax. The same suspicion applies to your own tooling: a batched shell block that truncates, or a missing binary, produces the identical silent zero. Confirm a zero against a positive control before believing it, and report every count with the command that produced it.

   **When the project ships its own gate** — a lint preset, a governance script, a spec validator — read it before improvising. Its checks are calibrated to this codebase and will be sharper than anything grepped blind. Run it only after confirming from its source that it writes nothing; gates commonly regenerate baselines or evidence directories, and a "check" subcommand is not a promise. When it cannot be run safely, reimplement its checks from its source rather than guessing, and report the gate's existence — **a gate nobody wired into CI or a hook is the root cause underneath most of what the audit finds**, and saying so is worth more than any individual finding.

3. **Measure the scales and compare against what the project declares.** A declared four-step radius scale showing thirty-one distinct forms in practice is the finding — the contract exists and adherence decayed.

4. **Trace token consumption**, which is where the highest-value findings live and where no single command reaches. Follow the chain: source declaration → generated variables → remapping into the styling layer → real call sites. A break anywhere means the token layer governs nothing downstream of it, and that failure is invisible to every grep in the mechanical set — a declared type scale with one consumer looks identical to a healthy one from the outside. Also check the reverse: values synthesized outside the token source, and themes fully built with no code path that activates them.

5. **Triage every finding by owner before ranking it** — the question that makes an audit usable is *who can fix this*. A value inside a consumed library or kit is upstream: report it there with evidence, never as a local override, because an override is how a project forks its design system by accident. A local usage of a shared token is local — the *use* is yours, the *value* is not. The same split exists inside a single repository whenever a contract layer and a feature layer coexist: a literal in the feature layer is local drift, the same literal in the contract layer is a contract change.

   When the design system arrives as a dependency, **read its contracts from the installed copy** under the package directory, never from memory or from the upstream repository — they travel with the installed version and describe the system this project actually has. If they are absent, say which version is installed and that the contract applied may not match it.

   Ownership follows the project's **declared** scope, not the directory it sits in. A file inside the contract directory whose own header scopes it to features, or which the project's protection list deliberately excludes, is feature-owned — trust that self-classification, and report the boundary itself as a governance finding. Reading location alone turns ordinary feature accretion into a contract emergency and buries the narrow, fixable problem underneath it.

   Where the project ships a deviation ledger or decision record, read it before calling anything drift: several will be decisions, and reporting a considered deviation as a defect is how an audit loses its credibility. A ledger of mechanical fingerprints carries no reasoning — the real decisions are then annotated at the value, so also search token and contract sources for status or rationale fields before concluding nothing was decided.

6. **Report, do not fix.** Group by severity — floor violations (accessibility, continuous repaint, contrast) first, then scale drift, then cosmetics. Every finding gets a file, a line, and its owner. Fixes happen only on a separate instruction, because a sweep that rewrites while it reports is unreviewable.

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

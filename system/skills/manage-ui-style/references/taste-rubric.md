# House Taste

Use this reference only when the user and project leave a visual decision open, or
when the user asks to explore a new direction. Treat it as an overridable aesthetic
preference, not a design system or an audit criterion.

## Preferences

- **Give color a role.** Keep default states neutral, use the primary color for
  navigation and trust, reserve the accent for the primary action, and derive
  semantic colors coherently.
- **Build hierarchy deliberately.** Prefer space, type, and borders as primary
  signals; use depth when it clarifies layering or interaction.
- **Keep scales small and explicit.** Radius, type, and spacing should each form a
  reusable scale. When no scale is declared, match an exemplar instead of inventing
  a neighboring literal.
- **Match density to the task.** Read-heavy interfaces tend denser; write-heavy
  interfaces tend looser. Keep density coherent within a view.
- **Make typography serve the content.** Use tabular numbers for money, counts,
  dates, and progress. For Chinese UI, choose an explicit CJK typeface and suitable
  line height rather than applying Latin uppercase and spacing conventions.
- **Use composition to express priority.** Let content relationships determine
  grouping and containers. Give the primary action or information the clearest
  emphasis instead of assigning equal visual weight by default.
- **Keep motion restrained and meaningful.** Prefer short, deliberate transitions
  over ambient or repeated animation.

## Concrete fallbacks

- **Color:** Navy `#283E68`, orange `#E1703C`, and semantic colors `#2E8B6B` /
  `#C98A2B` / `#B5402F`.
- **Surfaces:** Canvas `#FBF7F1`, sunken `#F5EFE6`, and surface `#FFFDFA`; derive
  borders from the relationship between the canvas and primary color.
- **Scales:** Spacing `4/8/12/16/24/32/48/64`, type `12/14/15/20/28/40`, and
  motion `120ms / 180ms / 280ms` for feedback, ordinary transitions, and overlays.

## Exercise aesthetic intent

Use easily over-applied devices—such as cards, gradients, pills, glass effects,
decorative icons, and prominent motion—selectively and with restraint. Each should
support grouping, hierarchy, identity, status, or interaction rather than merely
decorate or repeat a familiar pattern. Do not make one device the default treatment
for every section or state.

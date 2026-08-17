# Feedback standards (absorbed from review hygiene)

Short rules for review comments. The report sections in `SKILL.md` remain the primary severity model (must / should / may).

## Be specific and constructive

- Bad: "This is confusing" / "This is wrong"
- Good: name the symbol or behavior, the failure mode, and a concrete alternative

Explain **why**, not only **what**. Mark team convention vs personal preference.

## Inline severity prefixes (PR-style comments)

| Prefix | Use when |
|--------|----------|
| `[blocker]` | Must fix before merge; maps to **Must fix** |
| `[suggestion]` | Improvement; author may defer with rationale |
| `[question]` | Need clarification before judging |
| `[nit]` | Minor style; never the sole merge blocker |

## Author self-check (before asking others to review)

- [ ] Project checks the team relies on pass locally (typecheck/tests as applicable)
- [ ] Change description explains what and why
- [ ] No leftover debug noise or commented-out blocks you meant to delete
- [ ] No unrelated changes mixed into the same review target
- [ ] Secrets and personal data are absent from the diff
- [ ] Docs or contracts updated when the public surface changed

## Anti-patterns

- Rubber-stamp LGTM without stating what was inspected
- Nitpick storms that bury blockers — batch nits and label them
- Turning a PR thread into a large redesign debate — escalate design out of line comments when rework is large
- Blocking on personal style that is not a written team standard

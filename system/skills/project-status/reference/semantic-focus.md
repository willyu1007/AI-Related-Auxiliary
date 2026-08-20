# Semantic Focus Report

Use when the user asks for a Feature-level semantic summary, its mapping context, or the project's recorded focus.

## Data Source

```bash
node .ai/scripts/ctl-project-governance.mjs query --json
cat .ai/project/registry.json
cat .ai/project/dashboard.md
```

## Output Template

```markdown
## Semantic Focus

**Primary Feature**
- Feature: F-xxx <title>
- Description:
- Milestone:
- Mapped task signals:

**Recorded Project Focus** *(only when populated in dashboard manual fields)*
- Outcome this cycle:
- Cross-task dependency:
- Decision deadline:
- Next governance checkpoint:

**Evidence**
- registry: <Feature record>
- dashboard: <Focus index reference, optional>

**Recommended Next Step**: <one concrete action>
Command: `<executable command>`
```

## Rules
- Only report Feature semantics explicitly documented in its registry `title` and `description`.
- Treat generated views as index context only; do not use them as semantic body sources.
- Treat dashboard manual focus fields as project coordination context, not as Feature meaning.
- If the description is missing, report `unknown` and identify the Feature record that needs confirmation.
- Keep status facts and semantic statements separate.

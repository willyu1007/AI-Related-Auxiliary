# Prisma Schema Diff Preview

## Context
- Task: `<task>`
- Target environment: `<dev|staging|prod>`
- Target identity (redacted): `<project/cluster/database>`
- SSOT: `prisma/schema.prisma`

## Preview
- Method: `<migrate dev --create-only|migrate diff>`
- Exact command (no inline credentials): `<pnpm exec prisma ...>`
- Migration directory or SQL evidence: `<path>`
- Connections used by preview: `<development/shadow/other/none>`
- Database-backed preview authorization: `<00-connection-check.md reference|not-applicable>`

## Proposed Changes
### Additions
- `<model/column/index/constraint>`

### Modifications
- `<change>`

### Removals
- `<drop or none>`

## SQL Review
- SQL reviewed: `<yes|no>`
- Unexpected operations: `<details or none>`
- Lock/table rewrite concerns: `<details or none>`

## Destructive Assessment
- Destructive operations present: `<yes|no>`
- Data-loss risk: `<low|medium|high>`
- Compatibility risk: `<low|medium|high>`
- Required safeguards: `<backup/snapshot/window/dual-read/none>`

Do not record `DATABASE_URL` or any credential value.

# Prisma Migration Plan

## Scope
- Task: `<task>`
- Target environment: `<dev|staging|prod>`
- Target identity (redacted): `<project/cluster/database>`
- Strategy: `<migrate dev|migrate deploy|db push exceptional>`
- Rationale: `<why>`

## Preconditions
- [ ] Prisma format and validation pass.
- [ ] Generated SQL or diff preview was reviewed.
- [ ] Destructive operations are identified.
- [ ] Backup/snapshot is ready, or risk acceptance is explicit.
- [ ] Maintenance and application compatibility needs are addressed.

## Apply
1. `<pnpm exec prisma migrate dev>`
2. `<pnpm exec prisma migrate deploy>`

List only the command appropriate to the target environment. Do not include credentials.

## Rollback
- Strategy: `<forward fix|restore snapshot|application rollback|other>`
- Trigger: `<condition>`
- Owner: `<person/team>`

## Verification
- Migration status: `pnpm exec prisma migrate status`
- Relevant tests: `<commands>`
- Acceptance criteria: `<observable result>`

## Explicit Approval
- Approved target: `<environment and redacted identity>`
- Destructive risk accepted: `<yes|no|not-applicable>`
- Backup/risk decision: `<summary>`
- Approved strategy: `<strategy>`
- Approved by/at: `<identity, UTC timestamp>`

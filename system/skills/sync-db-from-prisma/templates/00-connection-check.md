# Prisma Connection Check

## Scope
- Task: `<task>`
- Target environment: `<dev|staging|prod>`
- Target identity (redacted, no connection string): `<project/cluster/database>`
- Provider: `<postgresql|mysql|sqlite|sqlserver|mongodb>`
- Direction: `repository -> database`

## Preflight
- Timestamp (UTC): `<YYYY-MM-DDTHH:MM:SSZ>`
- `prisma/schema.prisma` is the SSOT: `<yes|no>`
- Credentials are available only through the process environment: `<yes|no>`
- Development/shadow database available when required: `<yes|no|not-applicable>`
- Preview authorization for named development/shadow resources: `<approved by/at|not-applicable>`
- Migration permissions confirmed: `<yes|no|unknown>`
- Connectivity result: `<PASS|FAIL|NOT-RUN>`

## Evidence
- Command (no inline credentials): `<pnpm exec prisma ...>`
- Redacted result: `<summary>`

## Security
- Never record `DATABASE_URL` or any other credential value in this file.

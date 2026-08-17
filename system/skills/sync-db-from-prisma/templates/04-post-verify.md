# Prisma Post-Apply Verification

## Context
- Task: `<task>`
- Target environment: `<dev|staging|prod>`
- Target identity (redacted): `<project/cluster/database>`
- Applied migration(s): `<identifiers>`

## Migration State
- Command: `pnpm exec prisma migrate status`
- Timestamp (UTC): `<YYYY-MM-DDTHH:MM:SSZ>`
- Result: `<PASS|FAIL>`
- Redacted summary: `<summary>`

## Application Verification
- Relevant tests: `<commands and PASS|FAIL>`
- Integration checks: `<commands and PASS|FAIL>`
- Smoke checks: `<commands and PASS|FAIL>`

## LLM Contract
- Sync command: `node <this-skill>/scripts/ctl-db-schema.mjs sync --repo-root <repo>`
- Verify command: `node <this-skill>/scripts/ctl-db-schema.mjs verify --repo-root <repo>`
- Result: `<PASS|FAIL>`

## Final Result
- Migration complete: `<yes|no>`
- Acceptance criteria met: `<yes|no>`
- Remaining risks/follow-ups: `<details or none>`

Do not record `DATABASE_URL` or any credential value.

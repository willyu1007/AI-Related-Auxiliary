# Prisma Migration Execution Log

## Context
- Task: `<task>`
- Target environment: `<dev|staging|prod>`
- Target identity (redacted): `<project/cluster/database>`
- Approved strategy: `<migrate dev|migrate deploy|db push exceptional>`
- Approval reference: `<02-migration-plan.md section/timestamp>`

## Commands
| Timestamp (UTC) | Command | Result | Redacted summary |
|---|---|---|---|
| `<time>` | `<pnpm exec prisma ...>` | `<PASS|FAIL>` | `<summary>` |

## Observations
- `<migration identifiers, duration, warnings>`

## Incidents and Responses
- Incident: `<details or none>`
- Response: `<details or none>`
- Follow-up: `<details or none>`

## Security Check
- [ ] No `DATABASE_URL`, password, token, or other credential was logged.

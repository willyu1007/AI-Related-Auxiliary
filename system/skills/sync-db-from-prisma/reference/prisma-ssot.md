# Prisma SSOT

## Fixed contract

- SSOT: `prisma/schema.prisma`
- Direction: repository to database

Only the Prisma file defines schema intent. Apply it through reviewed Prisma migrations.

## Reading

Read `prisma/schema.prisma`. Nothing derives a second description of the schema, so nothing can disagree with it — a generated projection would buy structure the Prisma file already has, in exchange for a copy that goes stale between regenerations.

Prisma's own tooling answers the questions the file does not: `prisma migrate status` for what the database has applied, and `prisma migrate diff` for the difference between two known states.

## Boundaries

Keep persistence mappings aligned with the project architecture, without imposing a universal layering rule.

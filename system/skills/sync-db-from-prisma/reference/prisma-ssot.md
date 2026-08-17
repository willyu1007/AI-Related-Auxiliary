# Prisma SSOT and LLM Projection

## Fixed contract

- SSOT: `prisma/schema.prisma`
- Direction: repository to database
- Generated projection: `docs/context/db/schema.json`

Only the Prisma file defines schema intent. Apply it through reviewed Prisma migrations. Never hand-edit the JSON projection or use it to drive database changes.

## Reading

Prefer the projection for LLM schema discovery because it is structured, stable, and locally readable. It may not be smaller than the Prisma source. If it is missing or stale, regenerate and verify it; otherwise fall back to reading `prisma/schema.prisma`.

## Writing and boundaries

Run the bundled controller from its skill installation:

```bash
node <this-skill>/scripts/ctl-db-schema.mjs sync --repo-root <repo>
node <this-skill>/scripts/ctl-db-schema.mjs verify --repo-root <repo>
```

The projection records the source SHA-256 and normalized model shape. The parser intentionally covers common Prisma schema constructs, not the complete Prisma grammar; warnings require human review. `sync` can emit a partial projection for inspection, but `verify` fails while parser warnings remain; read the Prisma SSOT directly for omitted details. Keep persistence mappings aligned with the project architecture, without imposing a universal layering rule.

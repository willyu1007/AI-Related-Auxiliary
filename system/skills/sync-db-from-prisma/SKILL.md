---
name: sync-db-from-prisma
description: Use when a user asks to add, modify, or remove persistent models in prisma/schema.prisma; create or apply Prisma migrations; or resolve repo-to-database drift. Covers only repository-to-database Prisma SSOT workflows, not database-to-code db pull, data backfills, ordinary data CRUD, or task-record synchronization.
---

# Sync Database from Prisma

Treat `prisma/schema.prisma` as the only schema source of truth (SSOT). The direction is always repository to database. Carry a schema change through reviewable migration evidence, an explicit write approval, environment-appropriate application, and verification.

The gate is the whole skill. Every command below is Prisma's own; nothing here reimplements what Prisma already does.

## Hard Preconditions

Stop unless all of these are true:

- The target repository contains `prisma/schema.prisma`.
- That file is the project's database schema SSOT.
- The requested direction is repository to database.
- The target environment (`dev`, `staging`, or `prod`) is known.
- Credentials remain in the target process environment. Never place a connection string, password, token, or unredacted credential in chat or evidence.

`<this-skill>` means the absolute directory containing this `SKILL.md`. Resolve it from the loaded skill location; the evidence templates below are read from there.

## Workflow

### A. Confirm scope and evidence location

1. Restate the intended persistent-model change, target environment, target database identity in redacted form, and acceptance criteria.
2. Inspect the target repository's local instructions and Prisma configuration.
3. If the repository tracks tasks and this change belongs to one, use:
   `dev-docs/active/<slug>/artifacts/db/`.
4. Otherwise use `.ai/.tmp/db-sync/<run-id>/`.
5. Copy the five files from `./templates/` into that evidence directory. Evidence contains commands, decisions, and redacted summaries—not credentials.

### B. Change and validate the Prisma SSOT

1. Edit `prisma/schema.prisma` and any repository/domain mappings affected by the intended contract.
2. Respect the project's existing boundaries. Avoid leaking generated Prisma types into business code unless the project deliberately uses that architecture.
3. Run:

```bash
pnpm exec prisma format
pnpm exec prisma validate
```

Do not proceed while either command fails.

### C. Preview and review the migration

Prefer a versioned migration preview in a development environment:

```bash
pnpm exec prisma migrate dev --create-only --name <slug>
```

Before running it, obtain explicit approval to use the named development and shadow databases. `--create-only` creates migration files without applying the newly generated migration, but `migrate dev` is not a read-only or connection-free command: it uses the development and shadow databases and may reconcile existing migration history. This preview authorization is limited to those named development resources and is **not** approval to apply the proposed migration.

When `--create-only` is unsuitable, use an appropriate `pnpm exec prisma migrate diff ...` command with explicit from/to inputs. Prisma has no universal migration dry-run: inspect exactly which inputs the selected command reads and whether it needs a connection. Obtain approval before using any database-backed input; an offline schema-to-migrations-directory comparison does not require a database authorization.

Review every generated `migration.sql`. Record additions, alterations, removals, locks or rewrite risks, data-loss risk, and a destructive-change assessment in `01-schema-diff-preview.md`. Record the rollout, rollback, and verification plan in `02-migration-plan.md`. Read `./reference/migrate-vs-push.md` when selecting a strategy.

### D. Obtain explicit write approval

After reviewing the preview, ask for separate explicit approval before applying to the target database. Confirm:

- target environment and redacted target identity;
- whether destructive operations are present and accepted;
- backup or snapshot readiness, or explicit risk acceptance;
- apply strategy and exact command class (`migrate dev`, `migrate deploy`, or the exceptional `db push`).

Preview authorization is not apply approval. If apply approval is missing, ambiguous, or for another environment, stop before the target write.

### E. Apply by environment

After approval, log commands and results in `03-execution-log.md`.

Development:

```bash
pnpm exec prisma migrate dev
```

Staging or production:

```bash
pnpm exec prisma migrate deploy
```

Use `pnpm exec prisma db push` only when the user explicitly chooses it for a disposable environment and accepts that it does not create versioned migration history. Never substitute it silently when migration generation is difficult.

### F. Verify the applied state

Run:

```bash
pnpm exec prisma migrate status
```

Then run the relevant repository tests, integration checks, and application smoke checks. Capture the result and remaining risks in `04-post-verify.md`. A successful command is not sufficient if the application contract or relevant behavior fails.

### G. Refresh repository mappings

Finish any affected repository adapters, domain mappings, fixtures, and tests that were not safely completed before application. Commit them with the schema and migration changes according to the target repository's policy.

## Reading the schema

When something needs the database shape — an agent included — read `prisma/schema.prisma`. It is declarative, structured, and it is the SSOT itself, so there is no generated projection to keep fresh and no second copy that can be stale. See `./reference/prisma-ssot.md`.

What the file does not answer, Prisma's own tooling does: `prisma migrate status` for what the target database has applied, `prisma migrate diff` for the gap between two named states.

## Completion Checklist

- [ ] Target environment and redacted target identity are recorded.
- [ ] Prisma format and validation pass.
- [ ] Migration SQL and destructive assessment were reviewed.
- [ ] Explicit apply approval is recorded before any database write.
- [ ] The environment-appropriate strategy was applied.
- [ ] Migration status and relevant tests pass.
- [ ] Repository/domain mappings remain coherent where applicable.
- [ ] Evidence contains no credentials.

## Boundaries

- Never execute a database-backed preview or target write automatically or without authorization for the named database resources. Preview authorization never implies apply approval.
- Never run `db pull` or make the database authoritative.
- Do not perform data backfills or transformations; plan and approve those separately.
- Do not use this workflow for ordinary data CRUD or task-record synchronization.
- Never store secrets in chat, evidence, or migration files.
- Default to versioned migrations; permit `db push` only as the explicit disposable-environment exception.
- Respect project boundaries; avoid leaking generated Prisma types unless the project deliberately uses that architecture. Do not impose a universal layered architecture.

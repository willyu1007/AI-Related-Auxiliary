# Prisma Migrate vs. DB Push

## Default: versioned migrations

Use Prisma Migrate by default. It creates reviewable migration history and supports controlled deployment:

- Development preview: `pnpm exec prisma migrate dev --create-only --name <slug>`
- Development apply: `pnpm exec prisma migrate dev`
- Staging/production apply: `pnpm exec prisma migrate deploy`

`--create-only` does not apply the newly generated migration, but `migrate dev` still uses the development and shadow databases and may reconcile existing migration history. Obtain explicit authorization for those named resources first. Do not describe the command as read-only or offline, and do not treat preview authorization as approval to apply the proposed migration.

`pnpm exec prisma migrate diff ...` can compare explicit sources and optionally emit SQL. Its connection behavior depends on those sources; review the selected arguments and generated SQL.

## Exceptional: DB push

Prisma has no native `db push` dry-run. Use `migrate diff` for a preview where practical.

Run `pnpm exec prisma db push` only when all are true:

- the user explicitly selects it;
- the target environment is disposable;
- lack of versioned migration history is acceptable;
- destructive risk and safeguards were reviewed;
- explicit database-write approval was given.

Difficulty generating a migration is not sufficient reason to switch to push. Never use `migrate dev` against staging or production.

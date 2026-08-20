---
name: sync-db-from-prisma
description: Create or update the repository's Prisma schema as the database-structure source of truth, or synchronize Prisma schema changes and migrations from the repository to target databases.
---

# Sync Database from Prisma

The project-configured Prisma schema is the repository's database-structure source of truth. Work may update the schema and migration history, synchronize existing repository changes to a target database, or both. Synchronization flows from the repository to the database.

## Workflow

### 1. Inspect and route

Inspect the repository's local instructions, Prisma configuration, schema location, migration history, package manager, and existing scripts. Determine whether the task requires a repository schema change, target database synchronization, or both.

### 2. Update the repository schema

Run this branch when the requested database structure changes.

1. Update the project-configured Prisma schema and the application mappings, fixtures, or tests affected by its contract.
2. Follow the repository's existing package manager, scripts, schema layout, and migration strategy.
3. Format and validate the schema, and regenerate the Prisma Client when required by the project's Prisma version and workflow.
4. When the repository uses versioned migrations, generate a development migration according to the task scope. Use `prisma migrate dev --create-only --name <name>` when database synchronization is not part of the task or when the SQL must be edited before application.
5. Review generated migration SQL for unintended drops, type changes, constraint failures, table rewrites, or data changes that require a separate backfill.

This branch may finish with repository changes only; it does not require synchronizing a database unless that is part of the task.

### 3. Synchronize the target database

Run this branch when repository-defined schema changes need to reach a database. Resolve the target environment and connection configuration, then use the repository's existing command or the matching Prisma workflow:

- Development with versioned migrations: `prisma migrate dev`.
- Staging or production: `prisma migrate deploy`.
- Prototyping without migration history, or a provider that does not use Prisma Migrate: `prisma db push`.

A synchronization-only task assumes that the Prisma schema and migration history already agree. If a new migration is required, return to the repository-update branch first. Use `prisma migrate status` or `prisma migrate diff` when the current migration state or schema drift needs diagnosis before synchronization.

Inspect the pending migration or Prisma warning before accepting destructive changes. Confirm an ambiguous target or an unapproved destructive or production write instead of guessing.

When both branches apply, update the repository schema and migration history before synchronizing the target database.

### 4. Verify

For repository changes, run the project-relevant schema validation, Client generation when used, and affected tests. After database synchronization, check migration status when migrations are used and run the relevant integration or smoke checks. Report the applied migrations or schema result, verification result, and any remaining data migration work.

### Parallel work

Give each worktree that runs `prisma migrate dev` or `prisma db push` its own development database, and isolate any explicitly configured shadow database. Parallel branches may create migrations independently; after integration, reconcile the final Prisma schema and migration history and validate the combined history against an isolated database. Keep a single writer for Prisma schema and migration files on a shared branch, and serialize migration writes to each shared staging or production database.

## Scope

Database-to-repository introspection and ordinary data CRUD are outside this workflow. Treat required backfills as explicit data-migration or application work alongside the schema change rather than as an automatic effect of schema synchronization.

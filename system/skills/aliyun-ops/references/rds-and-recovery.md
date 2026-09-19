# Databases and Recovery

Keywords: SSL, CA, password authentication failed, NOLOGIN, CREATEROLE, RLS,
Prisma, backup, PITR.

## D01 On password authentication failure, check account spelling before reset

Check instance, port, database, username, and SSL target character by
character. An underscore omitted from an admin name is a different account. An
old DMS session working is not proof the new password is verified.

If the user required keeping the password, do not rotate it for diagnosis. If
reset is required, use the originally authorized private input channel. Do not
put the password in an OpenAPI URL, chat, or a shell argument. Password
minimums follow the current service check and the user's choice.

## D02 A database URL does not mean the same thing in every tool

Use the target driver's parameter form and an already-verified connection
flow. Do not stuff a Prisma URL into `PGDATABASE`. Check URL encoding and
driver-specific query params when needed. Do not keep reprinting a full DSN,
or treat one tool failure as the database being down.

## D03 Enabling RDS SSL is a shared instance change, not one app's switch

Confirm the selected internal endpoint, instance, and change window. After
submit, confirm SSL enabled, the async modify finished, and the matching
ConnectionString. Enabling the capability is not forcing TLS on every
connection.

Current connections should use the official CA and check hostname. Local
`openssl -starttls postgres` is not application verification. The real app
driver must prove connect and reject a wrong hostname.

## D04 `sslmode=require` alone does not prove certificate identity checks

Accept a positive connect and rejection of an untrusted CA or wrong hostname.
Finding `sslmode=require` in a string is not that proof. Some Logto versions
need `NODE_EXTRA_CA_CERTS` plus the real driver; recheck the current version.
Do not fix connect by globally disabling certificate checks.

## D05 A privileged admin is not necessarily the business-database owner

A platform-created RDS database may be owned by a platform role. `CREATE
ROLE`, a written password, or a displayed admin privilege do not prove the
current connection can seed. Check database owner, LOGIN, membership,
schema / table / sequence privileges, and an actual login.

## D06 Cloud-console grant enums are not PostgreSQL runtime privilege design

Use the current API's supported enums. A PG cloud-disk instance may reject
`GrantAccountPrivilege` `ReadWrite` and only accept `DBOwner`. That does not
mean every runtime account should be owner. Check least runtime privilege
separately in SQL. Combine Account-view `DatabasePrivileges`, Database-view
Accounts, and a SQL proof; one empty field is not final.

## D07 A successful Logto seed is not a usable Logto runtime

Use dedicated owner and runtime accounts. Grant the owner temporary
role-creation only for init, then restore the original scope. Seed an empty
database once; if already initialized, inspect schema and migration state
instead of reseeding.

After seed, locate a runtime error to table, schema, database, and tenant
role. Missing shared-table read, tenant RLS, or CONNECT for generated tenant
roles can remain. Do not fix with blanket superuser or `BYPASSRLS`, and do not
revoke `PUBLIC` globally on a shared RDS.

## D08 SQL results must prove both allow and deny

Owner can migrate and runtime can run the business are different proofs. Check
that runtime lacks unnecessary DDL and access to other business databases. An
RLS deny may be a missing tenant context, not a missing GRANT. Finding data is
not proof of cross-tenant isolation.

## D09 Prisma up-to-date depends on the migration set you brought

Compare the frozen release's full migration names, checksums, the database
ledger, and the target schema. A partial migration set can still show
up-to-date, then an admin business API returns 500 on a missing column. Do not
fill a historical release with all pending migrations from current main, and
do not forge applied records to turn the status green.

## D10 Migration directory order can differ from the order a long-lived environment applied

Check dependencies and rebuilt versus long-lived database differences. A
late-merged parallel branch can apply an earlier-timestamp migration after a
later one; a matching final schema is not a general safety proof. Applied
migrations stay immutable. A rename of a new migration requires confirming no
environment has applied it, and must follow the project's migration rules.
Offline rehearsal uses a separate database and role; do not pollute a live
business database.

## D11 Backup success is not recoverable, and not a known restore time

Separately confirm the latest successful backup, retention, and PITR window.
Restoring to an independent target and verifying key tables, roles,
privileges, signed or tenant state, and app connect is the restore drill. A
system-disk snapshot does not replace an RDS backup.

A new PITR instance may bill; restore and cleanup need explicit target
authorization. Delete only confirmed drill resources. Restore point, migration
version, and app version must pair. Do not write "a backup exists" as
"zero-loss rollback is possible".

## D12 Keep connection and privilege evidence, not credential output

Record environment, target type, role names per project confidentiality, SSL
verification result, object counts, allow/deny conclusions, and operation
time. Do not save a plaintext password in a psql command, database dump
contents, a temporary download link, or a full connection string in an
ordinary report.

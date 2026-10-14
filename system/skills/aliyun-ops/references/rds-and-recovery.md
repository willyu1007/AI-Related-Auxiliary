# Databases and Recovery

Keywords: SSL, CA, password authentication failed, NOLOGIN, CREATEROLE, RLS,
Prisma, backup, PITR.

## D01 On password authentication failure, check account spelling before reset

Check the exact instance, port, database, username, and SSL target. Verify
changed credentials in a new connection, not an already-open DMS session.

If the user required keeping the password, do not rotate it for diagnosis. If
reset is required, use the originally authorized private input channel. Do not
put the password in an OpenAPI URL, chat, or a shell argument. Password
minimums follow the current service check and the user's choice.

## D02 A database URL does not mean the same thing in every tool

Use the target driver's parameter form; do not copy a Prisma URL with its
driver-specific parameters into `PGDATABASE`. Check encoding and supported
parameters before treating a tool failure as database downtime.

## D03 Enabling RDS SSL is a shared instance change, not one app's switch

Confirm the selected internal endpoint, instance, and change window. After
submit, confirm SSL enabled, the async modify finished, and the matching
ConnectionString. Enabling the capability is not forcing TLS on every
connection.

Configure the official CA and hostname verification in the application driver;
verify under D04. A local `openssl -starttls postgres` probe is not that proof.

## D04 `sslmode=require` alone does not prove certificate identity checks

Separately prove a valid connection succeeds, an untrusted certificate chain
is rejected, and a wrong hostname is rejected through the real application
driver. If a check is established by another mechanism, name the mechanism
and evidence. Finding `sslmode=require` in a string is not that proof. Check
how the deployed driver loads trust roots; use `NODE_EXTRA_CA_CERTS` only
where that runtime consumes it. Do not globally disable certificate checks.

## D05 A privileged admin is not necessarily the business-database owner

A platform-created RDS database may be owned by a platform role. `CREATE
ROLE`, a written password, or a displayed admin privilege do not prove the
current connection can seed. Check database owner, LOGIN, membership,
schema / table / sequence privileges, and an actual login.

## D06 Cloud-console grant enums are not PostgreSQL runtime privilege design

Check `GrantAccountPrivilege` enums for the target engine and instance type.
Do not infer that a runtime account should be owner from the console's grant
options. Verify least privilege in SQL; reconcile account-view and
database-view results with that proof rather than trusting one empty field.

## D07 A successful Logto seed is not a usable Logto runtime

Follow the approved owner/runtime role design. Grant temporary role-creation
only when the deployed version's initializer demonstrably requires it and
the grant is already authorized for that target. Limit its scope and duration,
then restore the original permissions. If required authority is missing,
report the prerequisite rather than expanding access. Seed an empty database
once; if already initialized, inspect schema and migration state instead of
reseeding.

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
ledger, and the target schema; do not accept an up-to-date result from a
partial migration set. Do not fill a historical release with pending
migrations from current main or forge applied records.

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
privileges, signed or tenant state, and app connect is the restore drill.
For system-disk snapshot coverage, see ecs-network-and-releases.md E01.

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

## D13 A restore session's search_path is not the original runtime's

Before restore, verify the exact target database and role against the approved
drill scope. Inspect physical schema names, referenced owner roles, and
function search-path assumptions; unqualified references that resolved in the
original runtime can fail here. Verify the restored behavior through the
application driver under the intended runtime role and connection settings.

A gap in the restore procedure stays inside the authorized restore. Only a
confirmed application defect enters the project's forward-migration process;
preserve applied migrations under D10. Do not grant blanket privileges to
clear a restore error. A successful logical restore does not prove PITR.

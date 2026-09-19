# Auth and Joint Staging

Keywords: OSS, 13002, localhost, 127.0.0.1, state mismatch, session missing,
HIBP, issuer, allowlist, campus principal.

## L01 Two "OSS" names are not the same thing

Logto OSS is the open-source self-hosted software. Aliyun OSS is object
storage. Logto needs a running service and a database; uploading to a bucket
is not an auth server. Self-hosting does not remove every external dependency.

## L02 A local Console that will not open is not proof the remote service is down

Locate by: local listen → forward process or Workbench session → ECS loopback
port → container health → public auth endpoint. `ERR_EMPTY_RESPONSE` can mean
the local port-forward dropped. Do not open the admin port to the public
internet to recover Console. After the port returns, a re-login may be
required. Reuse a few explicit tabs; do not send the user hunting across
localhost and 127 pages.

## L03 localhost versus 127.0.0.1 has been a real version issue

Check Console URL, service config, request Origin, and CORS response. Verify
OPTIONS and actual requests for an allowed origin, and that a disallowed
origin does not get ACAO. On Logto 1.43 multi-origin production config,
localhost and 127.0.0.1 are different origins — a localhost Console can render
while some APIs are rejected. Recheck the current version; do not generalize
to "every browser forbids localhost". Do not use a wide `*` or disable checks
in place of consistent config.

## L04 An "unknown error" needs the failing request; do not keep changing the password

For register or save-password errors, separate: request never reached the
service, CORS, HTTP 500, database privilege, and an external password check.
Take path, status, a redacted error, and time-correlated logs. Do not record
the password request body. The same friendly page text does not mean the same
root cause.

## L05 Self-hosted Logto can still call HIBP pwned-password checks

Recheck the actual version and config before reuse. The check may send a
SHA-1 prefix, not the plaintext password. Turning that dependency off does
not fix an underlying public-network fault.

Apply `rejects.pwned=false` only when this project's staging business tenant
and an explicit current approval already chose it. Keep the other constraints.
If a management-tenant change was temporary, restore it. Do not turn that
choice into disabling TLS checks, all password policy, or a prod change. When
changing policy, name the tenant, environment, and restore condition.

## L06 OAuth state mismatch is not necessarily "used an old account"

Restart from the product login entry and complete request plus callback in one
browser flow. A stale callback reload, a multi-tab flow, and origin or
session-storage mismatch can all fail state. A screenshot cannot uniquely
attribute it. Do not replay an old code. Do not turn off state, nonce, or PKCE
checks.

Hitting `/sign-in?app_id=...` directly can show "session not found" because
there was no valid authorization interaction. That is not proof the user is
missing. A Demo login proves the Demo flow only.

## L07 Console admin, business user, and campus principal are different authorization layers

Bind product identity to the real issuer and subject. A Logto
management-tenant account is not a business-tenant account. A platform global
admin is not automatically a campus principal (园长). The same email or
username on old Cloud and new OSS does not guarantee the same subject, and
does not mean the account was migrated.

Grant platform review, campus-creation approval, principal or admin, and
similar through the product authorization flow. Do not infer a backend admin
from a displayed email, and do not treat an allowlist as a role grant.

## L08 Switching issuer affects clients still using old tokens

Before switching, list Web, Admin, Native, and Workbench, and each client,
callback, audience, and allowed caller. After an API trusts the new OSS, old
Cloud mobile and admin clients may fail even if old accounts and keys remain.
Do not leak a client secret. Keeping an explicit rollback config is not
dual-issuer trust. Switch only in the authorized scope.

## L09 A successful login does not prove role business, database, or cross-product communication

Cover as needed: new user persisted, returning user login,
insufficient-privilege deny, admin page real API, campus association,
cross-service token, object storage, logout or refresh. Concurrent first login
can hit a unique-key conflict from a lookup/create race; login can also
succeed while a missing database column returns 500 on an admin business API.

Fix a race at the provider/subject consistency boundary and recheck. Do not
paper over it by widening privileges or retrying. Every real product client
needs its own acceptance. A health endpoint and Demo do not replace that.

## L10 The same ECS or RDS can be logically isolated; that is not physical isolation or HA

For staging versus prod, separately check database and schema policy and
accounts, issuer and tenant, client and callback, secret namespace, service
config, storage prefix, queue keyspace, logs, and backup or restore targets.
Shared instances must name the shared failure domain and resource contention.
A prod config template or later design is not prod deployed, load-tested,
restore-drilled, or sized. Do not create prod as a side effect of an
internal-test loop.

## L11 A `test_*` name is not a valid ID and not a wildcard grant

List actual variables from current deploy inputs and consuming code, and name
which owner an ID belongs to. Exact-set allowlists do not match `test_*` as a
wildcard. Do not reuse a count from an old report. Staging data may have TEST
in the display name, but IDs must be generated by the normal flow. Email
confirms a participant. A Logto subject identifies a user. Neither replaces
organization, institution, family, or child IDs.

## L12 Roster collection and environment prep can be separate; identities must not be prefabricated

First prepare the registration entry, admin instructions, invite or grant
flow, allowlist input, and verification method. After real participants
arrive: register, confirm identity, grant, create and bind business entities,
then fill real IDs.

When both products are in scope: My-Chat owns global family and child
identity; The-Nurture's local child ID must not stand in for a global child
ID. Family or child identity is created by an authorized parent or steward, or
under explicit authorization. Campus staff data does not automatically grant
that power. A routing bind does not grant Nurture data access.

## L13 A campus timezone policy must be written to an existing, exact campus

When this project's `set-institution-time-policy.mjs` is the writer, read this
run's parameters, default timezone, publish time, retry time, and idempotency
rules. The script validates an active institution, workspace, and exact name.
Do not run it against a fictional campus ID. Write to the real target and read
back. The same config must not create a new version. Steps may be prepared
before data exists; do not forge "write completed".

## L14 After the loop closes, handle external waits; do not treat polling as progress

An Aliyun support ticket and a scheduled check serve a specific open question.
If the original fault path is no longer a dependency, say whether the network
root cause is still unknown, and stop monitoring the user no longer wants. Do
not keep burning polls, and do not write "no longer blocking" as "the path is
fixed".

# Auth and Joint Staging

Keywords: OSS, localhost, 127.0.0.1, state mismatch, session missing,
HIBP, issuer, allowlist, business role, initialization.

## L01 Two "OSS" names are not the same thing

Resolve whether "OSS" means self-hosted Logto or Aliyun object storage before
selecting the target. Check external dependencies under
ecs-network-and-releases.md E05.

## L02 A local Console that will not open is not proof the remote service is down

Locate by: local listen → forward process or Workbench session → ECS loopback
port → container health → public auth endpoint. `ERR_EMPTY_RESPONSE` can mean
the local port-forward dropped. Do not open the admin port to the public
internet to recover Console. After the port returns, a re-login may be
required. A listening local socket alone does not prove a working forward:
check a real HTTP response from the expected service. With command-line
forwarding, verify the tool's authentication support and bind only the intended
loopback address. Inspect the actual listener: reaching `127.0.0.1` does not
prove that other interfaces are excluded. If the tool binds `*` and offers no
verified loopback option, stop the new forward and mark the private-tunnel
gate blocked; do not leave it running or relax firewall/origin controls.
Preserve the configured admin origin exactly (including
host and port); `localhost` is not a substitute for `127.0.0.1`. Do not kill an
unknown listener or create a competing forward to fix a stale window. For
channel selection and session preservation, see console-and-access.md C12–C14.

## L03 A rendered Console does not prove its API origin is allowed

Compare the Console URL, deployed origin configuration, and failing request's
Origin. Treat localhost and 127.0.0.1 as distinct origins. Verify OPTIONS and
actual requests for an allowed origin, and absence of ACAO for a disallowed
origin. Do not replace consistent configuration with `*` or disabled checks.

## L04 An "unknown error" needs the failing request; do not keep changing the password

For register or save-password errors, separate: request never reached the
service, CORS, HTTP 500, database privilege, and an external password check.
Take path, status, a redacted error, and time-correlated logs. Do not record
the password request body. The same friendly page text does not mean the same
root cause.

## L05 Self-hosted Logto can still call HIBP pwned-password checks

Check whether the deployed version enables HIBP and locate any failing
outbound request without collecting password payloads. Disabling that check
does not establish that the network fault is fixed.

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

## L07 Identity-provider admin, business user, and domain role are different authorization layers

Bind product identity to the real issuer and subject. A Logto
management-tenant account is not a business-tenant account. A platform global
admin does not automatically hold a domain role. The same email or
username on old Cloud and new OSS does not guarantee the same subject, and
does not mean the account was migrated.

Grant business roles and resource access through the product's authorized
flow. Do not infer backend administration rights from a displayed email, and
do not treat an allowlist as a role grant.

## L08 Switching issuer affects clients still using old tokens

Before switching, list Web, Admin, Native, and Workbench, and each client,
callback, audience, and allowed caller. Verify each client's token acceptance
against the proposed issuer before switching inside the authorized scope.
Keeping the old accounts, keys, or rollback config does not establish
dual-issuer trust.

## L09 A successful login does not prove role business, database, or cross-product communication

Cover as needed: new user persisted, returning user login,
insufficient-privilege deny, admin page real API, domain-resource association,
cross-service token, object storage, logout or refresh. Concurrent first login
can hit a unique-key conflict from a lookup/create race; login can also
succeed while a missing database column returns 500 on an admin business API.

Fix a race at the provider/subject consistency boundary and recheck. Do not
use wider privileges or blind retries as a substitute for the fix. A retry
after checking the original result must follow the operation's retry and
idempotency contract. Every real product client needs its own acceptance.
A health endpoint and Demo do not replace that.

## L10 The same ECS or RDS can be logically isolated; that is not physical isolation or HA

For staging versus prod, separately check database and schema policy and
accounts, issuer and tenant, client and callback, secret namespace, service
config, storage prefix, queue keyspace, logs, and backup or restore targets.
Shared instances must name the shared failure domain and resource contention.
A prod config template or later design is not prod deployed, load-tested,
restore-drilled, or sized. Do not create prod as a side effect of an
internal-test loop.

## L11 A test label is not an identity or a wildcard grant

List actual variables from current deploy inputs and consuming code, and name
which owner an ID belongs to. Exact-set allowlists do not match `test_*` as a
wildcard. Do not reuse a count from an old report. Staging data may have TEST
in the display name, but IDs must be generated by the normal flow. Email
can help confirm a participant. A Logto subject identifies a user within its
issuer. Neither substitutes for the product's domain-entity IDs.

## L12 Environment readiness does not establish participant identities

First prepare the registration entry, admin instructions, invite or grant
flow, allowlist input, and verification method. After real participants
arrive: register, confirm identity, grant, create and bind business entities,
then fill real IDs.

Across products, read the project's authoritative identity ownership and
authorization rules. Do not substitute a product-local ID for a shared
identity. Create identities and bindings only through the authorized flow;
a participant roster or routing bind does not itself grant identity-creation or
business-data access.

## L13 An initialization policy must be applied to the exact authorized target

Use the project's documented initialization writer and verify its target
selection, timezone and scheduling parameters, and idempotency rules. Confirm
the existing target, its lifecycle state, and applicable tenant or workspace
scope before writing; do not use a placeholder resource ID. Read back the
policy and version under that writer's contract; do not assume every writer
deduplicates identical input.
Steps may be prepared before data exists; do not forge "write completed".

## L14 After the loop closes, handle external waits; do not treat polling as progress

An Aliyun support ticket and a scheduled check serve a specific open question.
If the original fault path is no longer a dependency, say whether the network
root cause is still unknown, and stop monitoring the user no longer wants. Do
not keep burning polls, and do not write "no longer blocking" as "the path is
fixed".

## L15 Use OpenSSH for an explicit loopback bind when direct forwarding cannot

If the official Session Manager tool's direct forward binds all interfaces,
use an authorized OpenSSH `-L` connection through its documented SSH
ProxyCommand instead. The proxy supplies the private transport; OpenSSH owns
the local listener. Do not substitute an HTTP stream into the SSH proxy.

- Verify the target's SSH host public key through an authenticated independent
  channel. Use a dedicated known_hosts file and `StrictHostKeyChecking=yes`;
  do not accept an unverified key or disable checking.
- Check existing SSH authentication and forwarding support read-only. Where
  the installed instance already supports the official temporary-public-key
  flow, register a fresh local public key through `send_public_key` and connect
  within its validity window. Do not edit authorized_keys or sshd settings as
  an implicit part of tunnel recovery. Keep private keys outside shared files.
- Bind explicitly with `-L 127.0.0.1:<local-port>:127.0.0.1:<remote-port>` and
  use `-N -T`, `ExitOnForwardFailure=yes`, `BatchMode=yes` and keepalives.
  Match the remote port to the ECS host mapping, not the container port.
- Check the actual listener, a real HTTP response, the authenticated console
  page, and the allowed/disallowed origins. Confirm the host's non-loopback
  address cannot connect; do not infer isolation from a successful localhost
  request alone.
- Record the owning process and stop/reconnect method. Temporary key expiry
  does not close an established SSH tunnel. Delete one-use private key material
  once authentication is complete; reconnect with a fresh registration. Do not
  add an unattended reconnect service without a separate operational need.

References: [official SSH ProxyCommand example](https://developer.aliyun.com/article/1327179)
and [temporary public-key registration](https://www.alibabacloud.com/help/en/ecs/user-guide/register-a-public-key-and-connect-to-an-instance-with-the-key-by-using-ali-instance-cli).

# Console and Access

Keywords: blank page, SecurityError, OpenAPI, DMS, CloudShell, Workbench,
MissingParameter, Base64, change confirm, CLI, OAuth, RAM, stale screenshot,
Session Manager, port forwarding.

## C01 A blank login or a skeleton resource list is not a dead account or a missing resource

Wait for the required form or resource row. Do not treat `DOMContentLoaded` as
ready. Verify with a supported browser or client, or an authorized official
read-only Describe/List call. If a browser security policy blocks the page,
have the user continue on a normal page; do not bypass the policy. A total
instance count is not proof of engine, region, and target instance.

## C02 An installed CLI is not a logged-in, authorized client

Read caller identity (for example STS GetCallerIdentity where supported),
then use the smallest read-only call for the intended account, region and
resource. A profile name such as `default` is not a RAM username or a scope
restriction; ECS `root` is an OS user, not the cloud caller. Client credentials
and CLI credentials are not automatically the same. A successful Describe
call establishes read access only, not permission to deploy. An installed
`ossutil` or Aliyun CLI is not a logged-in client. Do not print a full profile. Docker login or pull access does not establish ACR
management-delete authority. Use credentials supported by that API and an
identity explicitly authorized for the exact operation and resources; do not
infer deletion authority from an existing application credential or ECS role.

## C03 Filling OpenAPI fields by global input index mis-assigns parameters

Locate fields by parameter name and container, not a global input or generated
element index. For permission changes, recheck the target identity, policy,
and optional scope fields; confirm the resulting binding with a List call.

## C04 A URL prefill, an empty `{}`, and a confirm dialog are not success

Wait for asynchronous prefills and verify actual field values. Identify the
current dialog and its exact submit control before submitting inside the
authorization. Read the final result and query status independently; an empty
`{}` or confirm dialog does not establish completion. Keep secrets out of
OpenAPI URLs.

## C05 A virtualized result pane showing one slice is not the full return

Do not treat a Monaco / `innerText` slice as the full return. Prefer a precise
API, such as listing entities bound to one policy, over walking every policy.
Use normal paging, scrolling, or copy when needed. Do not dump request headers
that contain a temporary signature.

## C06 `NotFound` or a generic error can come from the execution context

Describe the target in the same account, region, and channel. When that result
conflicts with `NotFound`, check parameters and service support, then use a
supported official channel. Do not rebuild or swap instances to clear the
error. For secret-store 404s, see secrets-and-oss.md S02.

## C07 A correct DMS SQL editor is not a correct change preview

If the change preview disagrees with the editor, cancel; do not execute.
`SET LOCAL ROLE` can be rewritten in preview. `CREATE DATABASE` and similar
have transaction limits. A single atomic `DO` block with dynamic role switch
is not a general SQL wrapper. Before execute, confirm `current_database()`,
`current_user` / `current_role`, and the target object. After execution, read
object state, result, and request records. For role creation, grants, and
migrations, define how to handle existing state before submitting.

## C08 A Workbench disconnect does not cancel a foreground operation

Confirm the process, runtime logs, exit status, and service state. A local
CLI timeout or lost session also leaves the remote outcome unknown. Retain
the invocation ID and target instance for Cloud Assistant; query that same
invocation before submitting another. Request acceptance is not command
completion. Check per-instance status, exit code, and application readback;
truncated output is not a full result.

For a long authorized task, use the existing release runner with durable,
redacted results and a recovery entry. Check service-specific timeout and
output limits before choosing the transport. A disconnected launcher must
not start a second runner; detached execution must retain the deployment's
single-executor and failure-recovery controls.

## C09 Upload failure and a working terminal can coexist

If Workbench upload fails but the terminal works, transfer a credential-free
script in chunks that fit the channel. Before execution, compare local and
remote SHA256 and check shell syntax. Decode, syntax-check, and hash nested
payloads separately. Do not embed credentials in command history.

## C10 Cloud Assistant content encoding must match the request declaration

Match `ContentEncoding` to the payload; declare `Base64` when sending encoded
content. Read the invocation result and exit code. For a disposable probe,
use `KeepCommand=false` where supported and verify no command remains.
Do not persist commands containing secrets.

## C11 CloudShell environment variables may already have a purpose

Give task variables distinct names; preserve CloudShell presets such as
`REGION`. On CLI failure, check parameters and environment before changing
permissions.

## C12 Keep few tabs, and name the exact field

Reuse one operation page. Tell the user the page title, field name, and
purpose. Continue only after login completes. If closing a tab would lose a
terminal, port-forward, or unsaved content, keep that state. Reread the live
form; do not pin a DOM index or guess a route.

## C13 Bound window recovery, then change channel

A Client or Workbench can report connected while its screenshot remains on
an old disconnect dialog, its accessibility tree shows a different tab, or
keystrokes fail to reach the terminal. Do not type a mutation into that state.

Refresh the observation and try one focused recovery: select the intended
window/tab, rebind the tool or raise/fullscreen it as appropriate. Check for
a fresh, task-specific read-only response. If the inconsistency remains,
stop repeating raise/fullscreen/reconnect loops and use a verified CLI/API
or Session Manager channel. Do not repeatedly ask the user to keep the window
in front. If no alternative is usable, name the missing access or user-bound
step, preserve the pending operation, and continue independent work.

Before closing or reconnecting a session, check whether it carries a running
operation or a private tunnel. Recover unknown command outcomes under C08;
changing channel is not permission to resubmit them.

## C14 Select and qualify the command-line replacement

| Need | Preferred channel when available and authorized |
|---|---|
| Resource inventory and cloud API operations | Aliyun CLI / official API |
| Bounded remote commands with retrievable results | Cloud Assistant via CLI/API |
| Interactive shell or private port forwarding | Official Session Manager command-line tooling |
| Container registry push/pull | Docker with ACR authentication |

Use current official documentation and installed-tool help for supported
commands, versions, authentication and region support. Aliyun CLI alone is
not a replacement for every interactive session or tunnel. Do not assume a
CLI OAuth profile is accepted by a separate Session Manager tool.

For a new machine, first prove cloud identity and target read access, then a
harmless remote command with a fresh marker and exit status; test the private
tunnel only if needed. Distinguish vendor-supported capability from a path
actually verified in this environment. Treat the replacement as a recommendation,
not an environment-qualified path, until those probes pass. Record machine,
time, tool version and channel verification in the project's operations record,
not as a global assumption in this skill.

Prefer OAuth or temporary credentials where supported. OAuth supports a main
account as well as RAM identities; main-account login does not limit access to
staging. Do not create a main-account AccessKey merely to avoid the GUI issue.
Use the authorized identity and keep effective privileges distinct from the
narrower task authorization; dedicated RAM access is preferable for recurring
operations. Do not print profiles or transfer browser sessions to another Mac.

Official references (recheck before setup):
- [CLI OAuth credentials](https://help.aliyun.com/zh/cli/oauth-credentials)
- [CLI quick start](https://help.aliyun.com/zh/cli/quickly-start-using-alibaba-cloud-cli)
- [Session Manager connections and forwarding](https://www.alibabacloud.com/help/en/ecs/user-guide/connect-to-an-instance-by-using-session-manager-2/)

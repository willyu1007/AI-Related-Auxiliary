# Console and Access

Keywords: blank page, SecurityError, OpenAPI, DMS, CloudShell, Workbench,
MissingParameter, Base64, change confirm.

## C01 A blank login or a skeleton resource list is not a dead account or a missing resource

Wait for the required form or resource row. Do not treat `DOMContentLoaded` as
ready. Verify with a supported browser or client, or an authorized official
read-only Describe/List call. If a browser security policy blocks the page,
have the user continue on a normal page; do not bypass the policy. A total
instance count is not proof of engine, region, and target instance.

## C02 An installed CLI is not a logged-in, authorized client

Prove identity and scope with the smallest read-only call for the needed
service. An installed `ossutil` or Aliyun CLI is not a logged-in client. Do
not print a full profile. Docker login or pull access does not establish ACR
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

Confirm the process, runtime logs, exit status, and service state. Do not
redeploy immediately. For a long authorized task, use an execution method that
can be checked across sessions, and keep a redacted result file, a completion
mark, and a rollback entry.

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

## C13 A connected terminal is not a readable result

A connected Workbench terminal can be reduced to an unreadable thumbnail.
Restore readability first. Before reconnecting, assess whether it would
interrupt a pending operation or port-forward. If the original result cannot
be recovered, verify the operation through an independent read-only channel
before resubmitting.

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
not print a full profile. Do not reuse Docker login material, an application
key, or an ECS runtime role for an ACR management delete.

## C03 Filling OpenAPI fields by global input index mis-assigns parameters

Locate fields by parameter name and their field container, not by global input
or `rc_select_*` index. Indexes differ across APIs; `AttachPolicyToUser`
values in `ResourceGroupId` return `EntityNotExists.ResourceGroup`. Recheck
target identity, policy name, and optional fields. After submit, confirm the
binding with an independent List call, not a success toast.

## C04 A URL prefill, an empty `{}`, and a confirm dialog are not success

Check actual field values → identify the current dialog or request stage →
submit inside the original authorization → read the final result → query
status independently. A click before async URL fill finishes can return
`MissingParameter`. `发起调用` and the confirm-dialog button can collide on
fuzzy match. If the result is unknown, query first; do not click again. Do
not put a password or other secret in an OpenAPI URL.

## C05 A virtualized result pane showing one slice is not the full return

Do not treat a Monaco / `innerText` slice as the full return. Prefer a precise
API, such as listing entities bound to one policy, over walking every policy.
Use normal paging, scrolling, or copy when needed. Do not dump request headers
that contain a temporary signature.

## C06 `NotFound` or a generic error can come from the execution context

Describe first in the same account, region, and channel. `CreateDatabase` can
return `InvalidDBInstanceId.NotFound` for an instance that exists. When
read-only evidence conflicts with the error, check parameters and service
support, then use a supported official channel. Do not rebuild or swap
instances to clear the error. A secret-store permission miss can also present
as 404; see secrets-and-oss.md S02.

## C07 A correct DMS SQL editor is not a correct change preview

If the change preview disagrees with the editor, cancel; do not execute.
`SET LOCAL ROLE` can be rewritten in preview. `CREATE DATABASE` and similar
have transaction limits. A single atomic `DO` block with dynamic role switch
is not a general SQL wrapper. Before execute, confirm `current_database()`,
`current_user` / `current_role`, and the target object. After execute, read
object state, result, and request records before retrying — automation clicks
and shortcuts can fail or double-submit. Role create, grant, and migrate need
an explicit already-exists branch. An error-free screenshot is not acceptance.

## C08 A Workbench disconnect does not cancel a foreground operation

Confirm the process, runtime logs, exit status, and service state. Do not
redeploy immediately. For a long authorized task, use an execution method that
can be checked across sessions, and keep a redacted result file, a completion
mark, and a rollback entry.

## C09 Upload failure and a working terminal can coexist

If Workbench upload returns `INTERNAL_SERVER_ERROR`, use the working terminal.
Transfer a small credential-free script in short encodings that fit the
channel. Over-long simulated input can corrupt content. Before execute, check
local and remote SHA256 and shell syntax. Decode, syntax-check, and hash
nested payloads on their own: an outer-script hash does not prove the inner
script, and a Node REPL top-level binding may be undefined off `globalThis`.
Do not embed credentials in command history.

## C10 Cloud Assistant content encoding must match the request declaration

Declare `ContentEncoding` to match the payload. Base64 without
`ContentEncoding=Base64` is treated as a filename, exits 126, and reports
`File name too long`. Read the invoke result and exit code. When a one-shot
probe must not remain, set `KeepCommand=false` and check for leftover
commands. Do not keep commands that contain secrets.

## C11 CloudShell environment variables may already have a purpose

Give task variables distinct names. Do not overwrite or delete CloudShell
presets such as `REGION` — unsetting it makes later CLI calls exit 3. On
failure, check parameters and environment first; do not widen permissions.

## C12 Keep few tabs, and name the exact field

Reuse one operation page. Tell the user the page title, field name, and
purpose. Continue only after login completes. Do not ask the user to send a
password or token in chat. If closing a tab would lose a terminal,
port-forward, or unsaved content, keep that state. Reread the live form; do
not pin a DOM index or guess a route.

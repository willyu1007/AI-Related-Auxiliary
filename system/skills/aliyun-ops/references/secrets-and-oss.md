# Secrets, Permissions, and Object Storage

Keywords: BWS, Bitwarden, 404, import, master password, tmpfs, RAM policy,
CORS, ETag, object upload.

## S01 A private operations document is for fetching values, not for displaying a whole page

Choose the fields and browser read scope before opening private material;
page state can expose secret-bearing URLs. Pass values only to their
authorized destination under [SKILL.md](../SKILL.md)'s evidence rules. Use a
Bitwarden master password only on its trusted unlock surface, never in import
JSON or an application/database credential field.

## S02 A BWS 404 does not mean the project is missing

Check the required project and the machine account's read/write capability
before regenerating tokens. A read-only machine account writing a secret can
return 404. Permission changes stay in the explicit authorized scope; if
temporary, restore the agreed scope after. Do not treat one 404 as a reason to
expand to org-admin.

## S03 Do not invent a root cause for a Bitwarden import unhandled error

On `An unhandled server error has occurred`, check whether the target was
created or updated and whether there is a duplicate. Do not keep
batch-importing, and do not invent a server cause. Single-item create or edit
can continue after a batch failure; still confirm the exact target, and do not
auto-overwrite other secrets.

## S04 A complete secret count is not usable or mutually matching secrets

Check unique keys, non-empty values, project association, runtime
machine-readable scope, and cross-service token pairs that must be equal.
Report equal or unequal, not the values. An offline manifest PASS proves
structure only, not cloud existence, readability, or runtime load. Do not
reuse a count from an old report. Use this release's manifest and the
capabilities actually enabled.

## S05 Creating a secret still leaves materialization and runtime consume

Follow the environment's approved secret source, injection, and consume path;
check any applicable loader allowlist. Do not substitute BWS or file mounts
for an approved role-based, managed-secret, or in-memory path. For optional
capabilities, verify the project's disabled-state contract rather than
requiring every secret reference to remain. A new vault value is not proof of
runtime consumption. When file mounts are used, see ecs-network-and-releases.md
E08 for bind-mount inode after atomic replace; when files live in tmpfs, see
E03 in that file for reboot recovery.

## S06 KMS showing Enabled does not mean the intended secret type is supported

Verify support for the intended secret type before collecting values. On
`UnsupportedOperation` or version-ID rejection, check the service capability
and current field constraints; do not shorten identifiers or change secret
types as a blind fix.

## S07 A RAM policy created is not attached, and not in use by ECS

Read back the policy document, the target-principal binding, the ECS role, and
the effective permissions. A new narrow policy only limits what it grants;
other attached policies may be wider. An existing object-prefix grant does not
cover another prefix. For each consumer, verify the exact bucket, prefix,
and actions instead of assuming another consumer's grant applies.

Match each action to its resource scope; bucket-level actions such as
`GetBucketVersioning` do not belong under an object-only resource.

## S08 OSS CORS does not grant object access

CORS only affects whether a browser may read a cross-origin response. It does
not replace RAM, signed URLs, a private bucket, app auth, or tenant
authorization. A CORS preflight pass does not prove ECS can write objects, and
does not prove cross-tenant object isolation.

Keep the existing bucket private and block-public-access policy. Opening
public-read or `*` origin so that upload works is not the default fix.

## S09 Bucket-level config affects every shared consumer

Before changing CORS, read the old rules, keep rules other apps need, and do
not overwrite the whole bucket with a new list. An origin includes scheme,
host, and port. HTTP and HTTPS, and localhost and 127.0.0.1, are different
origins.

Take methods, request headers, exposed response headers, and origins from the
actual clients and the environment's approved scope. Add only what they need;
do not copy staging origins or another client's CORS recipe unchanged.

## S10 An empty OpenAPI CORS result may mean nothing was written

After `PutBucketCors`, confirm with an independent `GetBucketCors`. An empty
`{}` on a debug page is not a write. Check array versus string parameters,
comma serialization, and async confirm. Locate the native OSS CORS page by
actual navigation, not a guessed path. Then test OPTIONS from an allowed
origin and refusal from a disallowed origin. Judge by observable result; do
not keep rewriting because propagation has not appeared yet.

## S11 An empty versioning query is not a failed request

A bucket with versioning off returns an empty `VersioningConfiguration` as
that state's representation. Separate HTTP status, error code, and a valid
empty result. Enabling versioning changes storage and delete behavior and
cost. Do not enable it so that the check has content.

## S12 A mock pass is not a real OSS SDK boundary

Check accepted upload types in the installed SDK. If the business-layer type
is unsupported, convert at the storage adapter boundary and verify an actual
SDK upload with that type; a mock accepting it is insufficient.

End-to-end accept at least: real write → verify object metadata and required
encryption state → authorized read → unauthorized deny → delete the test
object. Operate only on an explicit test prefix and objects. Automatic cleanup
must not sweep the whole bucket.

## S13 "No content moderation" is not "turn off media upload"

Apply the following only when this project's staging already chose it:
allow media uploads, skip content moderation, and complete the storage path
only. Do not extend that choice to prod.

Storage still needs size and type limits, private storage, upload and read
auth, encryption, and access isolation. If keys, CORS, and RAM are ready but
the product is unreleased or the upload loop is untested, write "base config
done, real upload not accepted".

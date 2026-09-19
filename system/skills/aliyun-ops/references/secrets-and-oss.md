# Secrets, Permissions, and Object Storage

Keywords: BWS, Bitwarden, 404, import, master password, tmpfs, RAM policy,
CORS, ETag, real photos.

## S01 A private operations document is for fetching values, not for displaying a whole page

Read only the current fields and pass them to the authorized destination. Do
not echo them in tool output, screenshots, logs, or this skill. A full browser
state can include an OpenAPI password URL; choose a safe target and read scope
first.

A Bitwarden master password unlocks the vault. It is not the RDS password and
not a BWS machine-account token. Use it only on the matching trusted input
surface. Do not have the user paste the master password into import JSON, a
database terminal, or chat.

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

Follow the existing BWS → temp file → `*_FILE` consume path and check the
loader allowlist. A full deploy overlay must keep optional secret references;
an unused capability may be empty but must not drop the contract. A new vault
value is not in effect. For bind-mount inode after atomic replace, see
ecs-network-and-releases.md E08. For tmpfs after reboot, see
ecs-network-and-releases.md E03.

## S06 KMS showing Enabled does not mean the intended secret type is supported

Check capability before collecting secrets. Creating a Generic secret can
return `UnsupportedOperation` while the console shows Enabled. Follow the
field's actual limits; a version may reject a UUID-style initial version ID
and accept a short version name. Do not shorten every identifier as a blind
fix.

## S07 A RAM policy created is not attached, and not in use by ECS

Read back the policy document, the target-principal binding, the ECS role, and
the effective permissions. A new narrow policy only limits what it grants;
other attached policies may be wider. An existing object-prefix grant does not
cover another prefix — when both products are in scope, a `family-growth`
prefix does not cover the other platform's media prefix.

Check the actual bucket or object prefix and actions. Object actions and
bucket-level actions have different resource scopes. Do not attach
`GetBucketVersioning` and similar under an object ARN.

## S08 OSS CORS does not grant object access

CORS only affects whether a browser may read a cross-origin response. It does
not replace RAM, signed URLs, a private bucket, app auth, or tenant
authorization. A CORS preflight pass does not prove ECS can write objects, and
does not prove other families cannot see photos.

Keep the existing bucket private and block-public-access policy. Opening
public-read or `*` origin so that upload works is not the default fix.

## S09 Bucket-level config affects every shared consumer

Before changing CORS, read the old rules, keep rules other apps need, and do
not overwrite the whole bucket with a new list. An origin includes scheme,
host, and port. HTTP and HTTPS, and localhost and 127.0.0.1, are different
origins.

Confirm the live request methods, headers, and origins, then add the minimum.
Apply the following only when this is the current project's staging and that
environment already chose it: GET, PUT, HEAD, the upload headers actually
used, ETag exposed, and staging origins only.

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

Recheck the SDK contract for the installed version. `ali-oss@6.23.0` `put`
rejects a business-layer `Uint8Array`; convert at the adapter boundary with
`Buffer.from(bytes)` and test the concrete type.

End-to-end accept at least: real write → object metadata or encryption →
authorized read → unauthorized deny → delete the test object. Operate only on
an explicit test prefix and objects. Automatic cleanup must not sweep the
whole bucket.

## S13 "No content moderation" is not "turn off photo upload"

Apply the following only when this project's staging already chose it:
allow real photos, skip content moderation, and complete the storage path
only. Do not extend that choice to prod.

Storage still needs size and type limits, private storage, upload and read
auth, encryption, and access isolation. If keys, CORS, and RAM are ready but
the product is unreleased or the photo loop is untested, write "base config
done, real upload not accepted".

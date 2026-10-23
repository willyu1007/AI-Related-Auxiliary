# ECS, Network, and Releases

Keywords: snapshot, vulnerability, tmpfs, NAT, TLS timeout, DockerHub, ACR,
image digest, rollback, shared deployment, prune, sidecar, symlink.

## E01 A system-disk snapshot is not a full restore

Before maintenance, read back snapshot completion, protected disks, retention,
and the database recovery basis. Then check that secrets can be restored after
reboot. A system-disk snapshot does not cover a separate RDS, external object
storage, or tmpfs secrets, and may auto-expire.

## E02 Installing a patch, booting a new kernel, and a vulnerability rescan are three results

After an update, confirm the running kernel, service recovery, and a Cloud
Security Center rescan as three separate results. Do not write "patch
installed" as "all vulnerabilities are zero". A newer RDS kernel being
available does not prove the current version has that CVE.

## E03 An ECS reboot clears tmpfs; a container restart policy does not restore secrets

When pull credentials or runtime secrets are materialized in tmpfs, reboot
removes those files. Restore them through the environment's approved secret
source and consume path before recovering affected services with the existing
scripts. Do not persist a machine token to disk or an image. Verify by the
business and protected requests, not container `Up`.

## E04 Public egress timeout to one site is not missing NAT

Separate DNS → route / source egress → TCP → TLS/SNI → HTTP → app upstream.
Confirm the real path of the existing EIP, public IP, NAT, or proxy. Laptop
success is not ECS success. Do not infer missing NAT or a specific network
root cause from one destination timing out while other HTTPS works.
Do not buy NAT when an egress path already exists. Build a redacted ticket
with time, target, source environment, and failure stage.

## E05 A self-hosted service can still depend on external networks

Treat DockerHub, GitHub Releases, vulnerability databases, model APIs, and
pwned-password checks as egress for self-hosted services. For Logto password
checks, see logto-and-joint-staging.md L05.

## E06 A Docker daemon mirror does not guarantee metadata or every tag

Check the actual registry, tag, manifest, and architecture; inspect fallback
when a mirror misses metadata or a tag. Use an approved private ACR source
when needed. Pin build-base, runtime-base, and service images under E12;
mutable subscription tags are discovery inputs, not rollback handles.
Check the shared-host impact before restarting Docker.

## E07 If tool distribution fails, do not guess a version or swap an unknown binary

Check the current official distribution. If direct download fails and the
vendor supplies an image containing the tool, record only the image identity
fields defined in E12; tool extraction does not require a release package.
Verify the version and platform, and extract it from a stopped container.
Do not substitute an unverified binary or historical tag.

## E08 Runtime checks produce false negatives

- `pgrep -f` can match the check command itself. Locate the real service
  process and its parent/child relationship.
- Docker `Env` without the secret can mean `*_FILE` mounts. Check file
  existence and the consume path; do not print contents.
- After an atomic secret-file replace, a bind mount may still reference the
  old inode. Restarting the process may not remount; recreate only the
  affected service when needed.

## E09 A Compose env file is not a shell script

Use Compose `--env-file` semantics. Do not `source` a Compose env file — a
legal value with spaces is not a shell command. If parsing is required, use an
existing parser and emit only non-secret fields. Do not log full
`docker compose config` output; it may expand secrets.

## E10 Local tool prep can disagree with the cloud environment

- After package-manager setup, verify the executable path and version in the
  target shell; enable the required shim when applicable.
- On an old ECS system Python, use a compatible parallel runtime. Do not
  overwrite the OS Python link.
- Exclude AppleDouble `._*` from the package and Docker context. Clean only
  confirmed sidecar files.

## E11 A dependency-audit pass is not a final-image security pass

Scan the final image candidate against the project's current security bar,
separately from the application dependency audit. A package manager that is
not needed must not enter the runtime image. Do not ignore alerts to get a
pass, and do not reuse a failed immutable tag.

## E12 A release package must be complete, not "what changed this time"

A release record must identify its source/build, actual deployment artifacts,
and effective runtime configuration. For container images, record the exact
registry/repository@digest, object type, and target platform. Include the
applicable service definitions (such as Compose or systemd), proxy config,
config version, and schema version; do not require components the deployment
does not use. Runtime health is not the next-boot state on disk. Use reviewed
per-service overrides; a global `IMAGE_TAG` can affect the wrong service. Do
not concatenate unknown versions. If config is prepared but not redeployed,
write "not in effect".

## E13 An old image is not a safe rollback after a breaking database change

A rollback plan must say how app, config, and database pair, or explicitly
choose a forward fix. Do not rehearse recovery on an unrelated business
database.

## E14 Do not mix ALB, EIP, and DNS evidence

- Check exact hostname, backend, and a business marker, not only the status
  code. A default ALB host rule can return 200 for an unrelated app.
- With ALB terminating TLS, backend HTTP/80 can be expected. An EIP-direct
  topology may differ; confirm topology first.
- Local UDP to an authoritative DNS can fail independently of the record;
  negative cache also delays observation. Use a normal resolver and an
  approved independent resolution path with strict TLS. Do not keep editing
  already-correct DNS.

## E15 An existing Redis or optional service is not permission to reuse it

Check user, prefix, policy, failure impact, and live load before reuse or
create. If creating, confirm region, zone, vswitch, engine, sku inventory, and
price now; do not silently downgrade. Distinguish disabled, fully configured,
and partially misconfigured optional integrations — a Worker that initializes
an unconfigured optional client can fail all startups. Do not reintroduce a
resource that the project's authoritative records mark as retired.

## E16 Builds and probes can check the wrong thing

- Run checks only after their input generation completes; bind them to the
  generated candidate rather than an earlier artifact.
- Package verification must cover the actual released assets, including schema
  static files. Do not treat `*` in package `exports` as a literal path.
- Accept the real provider, region, runtime, and target. A prod plan can PASS
  while still mockcloud/local.
- Dry-run lazy placeholders are only for offline structure checks. Do not mix
  them into live deploy secrets or default-allow config.

## E17 Shared-host handoff invalidates an earlier inventory

When another session is deploying, do not type into its terminal or clean
images, release paths, or build inputs it may use. After handoff, reread the
running and stopped containers, resolved current release, rollback references,
and relevant host services. A Docker list alone misses systemd applications.
Map Compose project/service labels and network dependencies before treating
container count as project count or deciding that a service is redundant.

When another machine takes over deployment, name one active executor and stop
writes from the previous machine. For an existing handoff, follow its ownership
and freeze protocol; a synced folder is not a lock. Verify artifact hashes,
copy executable inputs outside the synced folder, and reread live state before
resuming. Reauthenticate on the new machine instead of transferring sessions.
Keep secrets and database backups out of the shared handoff. A new transport
or machine does not waive maintenance, backup, or paired-recovery gates.

## E18 Reclaimable space is not a deletion allowlist

Protect images referenced by containers, images named by a frozen release
record, rollback configuration, and recovery tools. Untagged, old, or
Docker-reported reclaimable images can still be needed. Separate local cache
removal from remote ACR deletion. An object present in ACR does not make the
local image disposable, and a local cache that can be pulled again does not
make the remote original disposable.

For authorized cleanup, record exact candidates and why they are unused.
Recheck current use, rollback references, and whether the recorded
registry/repository@digest and target platform can actually be pulled again.
Remove only the listed objects without force or broad prune. Compare actual
disk space and service state afterward; summed image sizes double-count
shared layers. Keep volumes, backups, and unrelated projects outside an
image-cache cleanup.

## E19 An index digest is not a local image ID

An index, platform manifest, and image config have distinct digests. Using the
release reference recorded under E12, resolve an index to the intended
platform manifest; a direct manifest reference needs no index resolution.
Compare that manifest's config digest with the local image ID, not the index
digest. An index-to-image-ID mismatch is not an image mismatch.

## E20 Replacing a namespace provider can strand its sidecar

Inspect Compose network mode and runtime namespace dependencies before
recreating a service. A TLS sidecar using another container's network
namespace may need recreation with that provider. Recheck the dependent
internal request path as well as public health; public health alone can pass
while the sidecar still points at the old namespace. Limit recreation to the
verified dependency set.

## E21 A current symlink is not the frozen deployment entry point

Resolve the active release path and read that release's script contract before
invocation. Some scripts validate their physical path and reject invocation
through a current symlink. Do not bypass that guard or substitute a newer
main-branch script into an old release. Confirm source, config, and image
references belong to the same release before executing it.

# ECS, Network, and Releases

Keywords: snapshot, vulnerability, tmpfs, NAT, TLS timeout, DockerHub, ACR,
image digest, rollback.

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

After reboot, restore pull credentials and runtime secrets first — BWS
materialization in a memory directory is gone — then recover affected services
with the existing scripts. Do not persist a machine token to disk or an image.
Verify by the business and protected requests, not container `Up`.

## E04 Public egress timeout to one site is not missing NAT

Separate DNS → route / source egress → TCP → TLS/SNI → HTTP → app upstream.
Confirm the real path of the existing EIP, public IP, NAT, or proxy. Laptop
success is not ECS success. One-site TCP/TLS timeout, including Cloud Logto,
while other HTTPS works is not missing NAT, a patch, or one cross-border hop.
Do not buy NAT when an egress path already exists. Build a redacted ticket
with time, target, source environment, and failure stage.

## E05 A self-hosted service can still depend on external networks

Treat DockerHub, GitHub Releases, vulnerability databases, model APIs, and
pwned-password checks as egress even when the service is self-hosted in
Hangzhou. See logto-and-joint-staging.md L05.

## E06 A Docker daemon mirror does not guarantee metadata or every tag

Check the actual registry, tag, manifest, and architecture. A present mirror
can 404 a Node tag and fall back to DockerHub. Use a configured private ACR
source when needed; do not guess tags. Restarting Docker affects every
container on the shared host. Lock build-base, runtime-base, and service-image
digests as the release baseline. Subscription tags discover updates and can
change digest; they are not an immutable rollback handle.

## E07 If tool distribution fails, do not guess a version or swap an unknown binary

Reconfirm the current official distribution. A working path when a GitHub
Release times out: official image → lock a usable digest → verify the version
→ extract the tool from a stopped container. Do not write an old tag as a
standing instruction.

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

- After `corepack prepare --activate`, verify the real `pnpm` path and
  version; enable it explicitly when needed.
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

A release record must map to source SHA, image digest, complete Compose and
proxy config, config version, and schema version. Runtime health is not the
next-boot state on disk. Use reviewed per-service overrides; a global
`IMAGE_TAG` can affect the wrong service. Do not concatenate unknown versions.
If config is prepared but not redeployed, write "not in effect".

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
retired Convex instance.

## E16 Builds and probes can check the wrong thing

- Keep product dependency chains serial. A scan started beside plan generation
  can hit an old hostname.
- Package verification must cover the actual released assets, including schema
  static files. Do not treat `*` in package `exports` as a literal path.
- Accept the real provider, region, runtime, and target. A prod plan can PASS
  while still mockcloud/local.
- Dry-run lazy placeholders are only for offline structure checks. Do not mix
  them into live deploy secrets or default-allow config.

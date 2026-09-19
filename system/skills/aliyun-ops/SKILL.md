---
name: aliyun-ops
description: >-
  Use when diagnosing or performing Aliyun ECS, RDS, RAM, OSS, ACR, or their
  deploy path — including DMS, CloudShell, Workbench, OpenAPI, Bitwarden, BWS,
  CORS, self-hosted Logto, secret injection, and joint staging. Do not use for
  ordinary application work or as a substitute for current official product
  docs.
---

# Aliyun Ops

## Resolve the request

Separate explanation, diagnosis, and implementation. Lock the target
environment, resource, and which services may be affected. A question or
diagnosis does not authorize mutation.

## Load the matching reference

Read only the file that matches the symptom. Do not load the rest.

| Symptom / keywords | Reference |
|---|---|
| Blank console, DMS, OpenAPI, CloudShell, Workbench, unclear result | [console-and-access.md](references/console-and-access.md) |
| ECS vulnerability, snapshot, reboot, egress timeout, NAT, Docker, ACR, rollback | [ecs-network-and-releases.md](references/ecs-network-and-releases.md) |
| RDS SSL, password auth, owner/runtime, RLS, migration, backup restore | [rds-and-recovery.md](references/rds-and-recovery.md) |
| Private ops document, Bitwarden, BWS, RAM, OSS upload, CORS | [secrets-and-oss.md](references/secrets-and-oss.md) |
| Logto register/login, port-forward, OAuth, two-product staging | [logto-and-joint-staging.md](references/logto-and-joint-staging.md) |

## Judge every operation

1. **Prove each layer separately.** A filled form is not a submitted request.
   HTTP success is not an async job done. A correct config read-back is not a
   running process that loaded it. A health check is not an end-to-end business
   path. Report only layers that actually passed.
2. **Read back before retry.** After a timeout, empty response, or console
   error, inspect the target object, request/job status, or deploy result
   before creating another resource, running the SQL again, or re-importing
   secrets.
3. **Trace the real topology.** Collect evidence from the laptop, ECS host,
   container, RDS, object storage, and auth endpoint separately. Do not apply a
   historical ALB plan to a current EIP plan, or treat laptop reachability as
   ECS reachability.
4. **Name the blast radius of a shared resource.** Reusing ECS or RDS is not
   staging/prod isolation. A Docker restart, an RDS instance setting, or a
   bucket-level change can hit other services. A reboot, purchase, exposed
   port, or permission expansion outside the original authorization needs a
   new alignment.
5. **Keep credentials out of evidence.** From a private operations document,
   read only the fields this step needs. Report names, existence, uniqueness,
   and success. Do not print a DSN, a full env block, an Authorization header,
   a sensitive OpenAPI URL, a token, or secret-import contents.
6. **Treat these notes as hazards, not standing fix scripts.** Recheck
   applicability. Current parameters, versions, and billing come from official
   docs or a live read-only result.

## Stay in bounds

- When account access or credentials are required, follow the current
  environment's private-operations rules. This skill does not store credentials
  and does not ship default passwords.
- Database schema changes follow the project's migration source of truth. Do
  not alter business tables to work around a deploy problem.
- A read-only diagnosis does not require a task bundle, a new service, or a
  full release.

## Return the result

Keep the result short: what was verified, on what evidence, what is still
missing, and whether any temporary config must be restored. Do not treat the
original plan, an offline precheck, or a historical success as this run's
success.

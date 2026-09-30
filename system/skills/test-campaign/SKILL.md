---
name: test-campaign
description: >-
  Use when staging, pre-release, release-candidate, or other broad functional
  testing is requested. Do not use for a single case, a unit test, or a
  one-off reproduction.
---

## Identity

Confirm the identity, then read only that role.

- When the user asked for this test and the prompt assigned no other identity, you are the coordinator. Read `references/coordinator.md`.
- When the prompt says you are the collaborator, read `references/collaborator.md`. Do not act as the coordinator.
- When the prompt says you execute one part of a module, do that part and return the result. Do not open a package, launch a collaborator, or talk to the user.

## Documents

- Campaign record: `<repo-root>/dev-docs/active/<slug>/progress.md`, the progress record
- Human view: `<repo-root>/dev-docs/active/<slug>/progress.html`, that record for a person

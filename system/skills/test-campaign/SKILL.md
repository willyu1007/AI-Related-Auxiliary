---
name: test-campaign
description: >-
  Use when staging, pre-release, release-candidate, or other broad functional
  testing and fixing is requested. Do not use for a single case, a unit test,
  or a one-off reproduction.
---

## Terms

- **campaign**: the whole test-and-fix effort
- **module**: one independent slice of the campaign, and the unit of parallel work
- **environment**: the dedicated runtime for a module, such as its simulators, front end, back end, and database
- **blocker**: a module cannot proceed. A resource, a decision, or functionality that must land is a blocker

## Identity

Confirm the identity, then read only that role.

- When the user asked for this campaign and the prompt assigned no other identity, you are the coordinator. Read `references/coordinator.md`.
- When the prompt says you are the collaborator, read `references/collaborator.md`. Do not act as the coordinator.
- When the prompt says you execute one part of a module, do that part and return the result. Do not open a package, launch a collaborator, or talk to the user.

## Documents

- Campaign record: `<repo-root>/dev-docs/active/<slug>/progress.md`, the progress record for the coordinator. The coordinator writes it.
- Human view: `<repo-root>/dev-docs/active/<slug>/progress.html`, that record for a person. The coordinator writes it.

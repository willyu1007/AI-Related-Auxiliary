---
name: test-campaign
description: >-
  Use when staging, pre-release, release-candidate, or other broad functional
  testing and fixing is requested. Do not use for a single case, a unit test,
  or a one-off reproduction.
---

## Terms

- **campaign**: the whole test-and-fix effort
- **module**: one slice assigned to a collaborator, with its own boundary, goal, code line, and dedicated environment
- **environment**: a module's runtime, such as its simulators, front end, back end, and database; record the loaded baseline separately from committed code
- **current unit**: a bounded check or fix already in progress, not the whole module
- **blocker**: a missing resource, decision, or functionality that prevents a test item from proceeding; state whether it blocks the whole module
- **evidence qualification**: what the evidence actually establishes, such as a contract check, API integration, simulator-native behavior, a physical-device result, or a cross-module journey

## Identity

Confirm the identity, then read only that role.

- When the user asked for this campaign and the prompt assigned no other identity, you are the coordinator. Read [references/coordinator.md](references/coordinator.md).
- When the prompt says you are the collaborator, read [references/collaborator.md](references/collaborator.md). Do not act as the coordinator.
- When the prompt says you execute one part of a module, do that part and return the result to its collaborator. Do not create a module, launch a collaborator, write campaign records, or talk to the user.

## Coordination instructions

The coordinator sends these instructions; collaborators apply them to their modules and subagents.

- **Continue:** proceed with executable work under the existing assignment. Ordinary reports do not pause work or require a reply. This instruction does not clear a stop.
- **Finish the current unit and stop:** acknowledge, start no new assigned checks, fixes, or subagent tasks, and safely close already-started units. Report actual stopping, commits and uncommitted work, pending operations, and resource handback. Acknowledgment is not handback.
- **Integration / maintenance:** during a global integration stop, the coordinator may explicitly assign a bounded merge, environment update, necessary repair, or verification after safe resource handback. Execute only that assignment under existing permissions; other module work remains stopped. On completion, report the outcome and handback and return to the stopped state.
- **Change assignment:** the coordinator states the changed boundary, goal, dependency, environment, or code line and updates the module entry before the changed work begins. A change does not clear a stop.
- **Resume / global continue:** clear a stop only on this explicit instruction, after checking the latest assignment and actual environment readiness. A global update must be complete before business work resumes. Elapsed time, record edits, and routine replies do not clear a stop.

## Documents

Unless the user or repository specifies another location, use `<repo-root>/.ai/.tmp/test-campaign/<slug>/`.

- `progress.md` is the single campaign record. It contains the feature inventory, module assignments, environments, task mappings, results, and coordination state. Only the coordinator writes it.
- Each module entry contains its id, boundary, goal, current assignment, collaborator, environment, code line, and report channel.
- `progress.html` is the human view derived from that record. Only the coordinator writes it.
- Dispatch a module by its id and section in `progress.md`; do not create a second module package. Keep raw evidence separately and link it from the record.

The campaign record does not replace existing repository task documents. Preserve necessary records and evidence at a durable handoff or archive location before removing temporary files or worktrees.

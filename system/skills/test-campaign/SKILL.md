---
name: test-campaign
description: >-
  Use when staging, pre-release, release-candidate, or other broad functional
  testing and fixing is requested. Do not use for a single case, a unit test,
  or a one-off reproduction.
---

## Terms

- **module**: a slice assigned to one collaborator, with its own boundary, goal, code line, and dedicated environment
- **current unit**: a bounded check or fix already in progress, not the whole module
- **evidence qualification**: what a result establishes, such as a contract check, API integration, platform-specific simulator behavior, physical-device behavior, or a cross-module journey

## Identity

Read only your role.

- When the user requested the campaign and assigned no other identity, you are the coordinator. Read [references/coordinator.md](references/coordinator.md).
- When assigned as a collaborator, read [references/collaborator.md](references/collaborator.md). Do not act as the coordinator.
- When assigned one part of a module, execute that part and return to its collaborator. Do not create modules, launch collaborators, write campaign records, or talk to the user.

## Coordination instructions

The coordinator sends these instructions; collaborators apply them to their modules and subagents.

- **Continue:** proceed with executable assigned work after ordinary reports without awaiting a reply. A missing prerequisite blocks only dependent items. This instruction does not clear a stop.
- **Finish the current unit and stop:** acknowledge, start no new checks, fixes, or subagent tasks, and safely close already-started units. Report actual stopping, commits and uncommitted work, pending operations, and resource handback. Acknowledgment is not handback.
- **Integration / maintenance:** during a global integration stop, the coordinator may assign a bounded merge, environment update, necessary repair, or verification after safe handback. The instruction identifies that stop context, scope, resources, and completion conditions. Execute only that assignment under existing permissions; other work remains stopped. Report the outcome and handback, then return to the stopped state.
- **Change assignment:** update the module entry before changed work begins, specifying the changed boundary, goal, dependency, environment, or code line. A change does not clear a stop.
- **Resume / global continue:** clear a stop only on this explicit instruction, after checking the current assignment and actual environment readiness. Complete the global update before resuming business work. Time passing, record edits, and routine replies do not clear a stop.

Unknown write results remain pending under their original command identity and recovery context. Check the original operation; do not resend with a new identity or discard it for handback.

## Documents

Use `<repo-root>/.ai/.tmp/test-campaign/<slug>/` unless the user or repository specifies another location. Only the coordinator writes `progress.md` and its derived `progress.html`.

- `progress.md` is the single campaign record for features, module assignments, environments, existing-task mappings, results, and coordination state. Track loaded baselines separately from committed code.
- Each module entry includes id, boundary, goal, current assignment, collaborator, environment, code line, and report channel.
- Dispatch by module id and record section; do not create separate module packages. Keep raw evidence separately and link it.

The campaign record supplements existing repository task documents. Omit secrets, tokens, and private connection strings from records and reports. Before cleanup, durably preserve uncommitted and unpushed work, required records and evidence, and recovery information.

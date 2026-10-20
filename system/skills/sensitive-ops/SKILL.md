---
name: sensitive-ops
description: >-
  Use when a task needs private project-specific operational context such as
  credentials, access, permissions, deployment targets, or accounts; or
  contains sensitive setup steps bound to the user, such as secret entry,
  MFA, OAuth approval, authenticated UI work, or a physical device. Also use
  when the user explicitly requests a guided shell helper for those steps.
---

# Sensitive Ops

Use `~/Documents/LLM/sensitive-ops.md` unless the user supplies another private operations document. Read it as human-authored Markdown, not a schema or an authority to act. Do not add a companion state file.

## Establish scope

Identify the environment, resource, identity, and intended operation. Inspect the relevant project and available access before asking for missing information. Complete agent-operable work; difficulty or an unfamiliar interface does not make it user-bound.

A stored credential does not authorize access or mutation. Require an explicit current choice of production environment, host, or credential before production access. Once a target is authorized, do not reconfirm each read; changes retain their own authorization boundaries. A document-only task does not authorize live-system access.

Keep the document outside version control and restricted to the user. Check the destination before writing secrets; if confidentiality or tracking is unsafe, stop that write and name the conflict. Never print secrets, including backup contents, into chat, tool output, logs, screenshots, command arguments, or shell history. Do not ask the user to paste secrets into chat.

When using the default path and migration is needed, if only the legacy `~/Documents/LLM/project-ops.md` exists, rename it to the default path with its permissions preserved. If both exist, leave both intact and report the conflict; continue work that does not depend on choosing between them.

## Find and verify

Read this skill before inspecting private document contents; do not batch the skill and raw private files into one output. For discovery or reorganization, process private bytes in memory and emit only an allowlisted heading inventory or sanitized fields. Do not use whole-file dumps, raw matching lines, or raw diffs to inspect a private document.

1. Locate relevant headings in the document or known project sources, then read only the fields needed for the task. Consume secret values without echoing them.
2. Prefer stable identifiers, scoped by provider/account and environment. Then try known usernames, emails, endpoints, or aliases. Display names alone do not establish identity; an application account, identity-provider account, and organization membership are distinct objects. Record mappings only when evidenced.
3. Follow explicit references to the authoritative secret store, account register, or runbook. If necessary, inspect relevant historical records, then perform authorized read-only live checks. Do not scan unrelated disks, vault projects, or accounts.
4. Distinguish not found in a source from verified absent in the system. Report which source and scope were searched. Before creating a missing-value placeholder, exhaust the relevant document, project evidence, and accessible referenced sources; ask only for the specific unresolved fact or user-bound action.
5. Before using access or configuration, verify the target, identity mapping, effective permission, and loaded configuration as needed for that operation. A recorded value or successful login is not proof of effective access. Keep configured, observed, planned, and unverified facts distinct.

Resolve conflicts using evidence for the same object and environment, not merely the newest prose. Prefer an applicable live read-back over an unverified statement. If evidence cannot decide, retain the disagreement as 待核实 and stop only the dependent action. Record the source and last verification time when freshness affects the next operation; do not imply live verification from a document read.

When required information remains missing, put `<待填写：具体内容>` on its field or `<待完成：用户仍需完成的动作>` on the object. Return the heading path and an absolute clickable document link. Continue independent work while the dependent step waits.

## Maintain current objects

Use environment → resource → identity as the usual navigation, adapting to existing useful structure. Record provider, owning account, and consuming projects as fields when needed. Keep a shared resource once and link consumers to it; do not duplicate its credentials under each project. Add an identity heading only when it clarifies distinct permissions or credentials.

Before adding an entry, look for the same scoped identifier and update that object. Keep resource endpoints and shared configuration on the resource; keep permissions, secret references, and injection/consumption locations on the identity. Preserve evidence-backed aliases and cross-system mappings. Do not merge objects solely because their names, emails, or local IDs match.

Write only fields that have useful facts or need user input:

- 标识 / 提供方 / 使用项目 / 地址 — identify the object and its consumers.
- 当前配置 / 凭据来源 — current values or the authoritative store, secret name, and retrieval location. Prefer references for store-managed secrets; do not create a second credential copy. Preserve an existing sole-copy credential unless its replacement source has been verified.
- 权限 / 使用位置 — effective scope and where the value is consumed or injected.
- 核验 / 待核实 — evidence source, relevant time, and unresolved disagreement.
- 约束 / 恢复 / 待完成 — facts that still affect the next operation, an applicable recovery path, or an outstanding user action.

Use Chinese headings, labels, and placeholders; preserve literal identifiers, commands, endpoints, and credential bytes. Update current facts in place, not under dated task sections. Remove superseded copies only when equivalence and replacement are established. Do not rewrite the whole document for a lookup or one-field update. If an unedited historical section repeats the changed fact, identify that location rather than leaving an undisclosed conflict.

Keep private access facts, environment-specific differences, credential sources, and applicable recovery methods here. Link to verified repository documentation for general setup, startup commands, and configuration contracts; record only private overrides beside the link. Do not maintain a second tutorial or move private values into repository documentation.

Deployment history, incident narratives, task progress, and future work belong in project records. Extract any still-needed private fact before removing such prose; do not create a new archive merely to retain duplicates. Never retain one-time codes, temporary tokens, sessions, or transient output. For released resources, keep minimal identity/environment/status to prevent reuse; remove obsolete credentials and paths only after verifying that recovery no longer needs them.

For an explicitly requested whole-document reorganization, read [restructure.md](references/restructure.md). Ordinary updates do not require this workflow.

## User-bound steps and resume

Do not create a shell helper by default. Only when explicitly requested, read [the helper workflow](references/helper.md) and use [template.sh](template.sh).

After the user supplies missing information or completes a bound step, reread that object's relevant fields and verify the outcome before continuing through the project's normal configuration or secret-injection flow. Update durable facts at their existing object; do not save the session transcript or temporary authorization as operational state.

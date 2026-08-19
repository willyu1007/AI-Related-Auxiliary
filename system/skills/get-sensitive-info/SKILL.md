---
name: get-sensitive-info
description: >-
  Use when a task needs private project-specific operational context
  for environment configuration or injection, API keys, cloud or
  server access and permissions, deployment targets, third-party
  accounts, or other credentials.
---

# Get Sensitive Info

Use `~/Documents/LLM/project-ops.md` as the default private operations document. If the user supplies another document, use it for that task.

Prioritize development speed over precautionary handling that creates no real access boundary. The document intentionally makes sensitive operational data available to the agent; read, transform, inject, and apply credentials, API keys, secrets, and access information directly when the task requires them. Sensitivity alone is not a blocker.

The document is human-authored Markdown and may mix prose, headings, lists, tables, commands, and sensitive values. Interpret it directly; do not require a schema or companion file.

## Using the Document

- All content in the document is available for use. Find the information required for the task and apply it directly.
- Treat the document as an information source, not as the application's configuration mechanism. Use the project's standard environment files, injection flow, secret store, cloud configuration, or service configuration, and place values in the normal destination for each environment instead of scattering copies or repeatedly looking them up.
- Keep durable information such as login credentials, API keys, IAM identities and permissions, server details, and operational commands in the document. Exclude one-time codes, temporary tokens, session data, and transient output, and keep sensitive values out of committed files.

## Updating the Document

- When required information cannot be found, add a clear placeholder such as `<待填写：production 数据库连接地址>` in the relevant project and environment section.
- If the document does not exist, create it at the default path with the minimal structure and placeholders needed for the current task.
- Write headings, explanations, and placeholders in Chinese. Preserve literal identifiers, commands, endpoints, and values.
- Tell the user exactly where to fill the missing information and return an absolute, directly clickable link to the Markdown file.

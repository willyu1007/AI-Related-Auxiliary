---
name: using-powershell
description: Use when writing or running PowerShell commands on Windows, or when creating, modifying, reviewing, or troubleshooting `.ps1` files.
---

# Using PowerShell

Stay in the active PowerShell shell. Do not introduce Bash, WSL, or `cmd.exe`
syntax or wrappers. Do not rewrite project-owned bash, CI, or WSL scripts.

- Use PowerShell statements with explicit success handling. Do not use `&&`
  or `||`, including under PowerShell 7.
- Cmdlets: `-ErrorAction Stop` when failure must stop the operation;
  `try`/`catch` when recovery or context is needed. `$LASTEXITCODE` does not
  validate a cmdlet; `try`/`catch` does not make a native nonzero exit
  terminating.
- Native executables: `& $exe @argList`, one argument per array element;
  inspect `$LASTEXITCODE` immediately and throw or return it when nonzero
  is failure.
- Use `-LiteralPath` for a known path when the cmdlet supports it; use
  `-Path` only for intended wildcards. Keep file operations in PowerShell.
  Use `$null`, not `/dev/null`. Use `$env:NAME = value`, not `export`.
  Prefer cmdlets over `ls`, `cat`, `rm`, `cp`, and `mv`.
- Single quotes for literal text. No Bash escaping. No backtick continuation.
  Build JSON from objects with `ConvertTo-Json -Depth` set to the required
  depth; do not hand-escape JSON strings.
- Multiline logic, nested quoting, JSON, regular expressions, or several
  dependent steps go in a `.ps1` instead of a dense one-liner.

When creating, modifying, or reviewing a `.ps1`, read
[references/powershell-scripts.md](references/powershell-scripts.md), then
run this directory's `scripts/lint-powershell.ps1 -LiteralPath '<target.ps1>'`.
Treat findings as blockers. The lint does not execute the target. Run a
non-destructive path of the target only when execution is authorized, a
non-destructive path exists, and the task needs behavioral evidence. Use
the PowerShell runtime the task actually targets.

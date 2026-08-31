---
name: using-powershell
description: Use when writing or running PowerShell commands on Windows, or when creating, modifying, reviewing, or troubleshooting `.ps1` files.
---

# Using PowerShell

Stay in the active PowerShell shell. Do not introduce Bash, WSL, or `cmd.exe` syntax or wrappers.

- Use PowerShell statements with explicit success handling; do not use `&&` or `||`, including under PowerShell 7.
- For cmdlets, request terminating errors with `-ErrorAction Stop` when failure must stop the operation, then use `try`/`catch` where recovery or context is needed.
- For native executables, use `& $exe @argList`, put each argument in its own array element, and inspect `$LASTEXITCODE` immediately.
- Use `-LiteralPath` for concrete paths when the cmdlet supports it. Keep file operations in PowerShell rather than passing paths through another shell.
- Use single quotes for literal text. Avoid Bash escaping and backtick line continuation.
- Put multiline logic, nested quoting, JSON, regular expressions, or several dependent steps in a `.ps1` file instead of a dense one-liner.

When creating, modifying, or reviewing a `.ps1` file, read [references/powershell-scripts.md](references/powershell-scripts.md), then run `scripts/Test-PowerShell.ps1 -LiteralPath '.\script.ps1'` from this Skill directory.

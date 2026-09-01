# PowerShell Scripts

## Contract

Give executable scripts that accept input a typed parameter contract.
Use types and validation only where invalid input would otherwise reach a
mutation or produce a confusing failure. Add `Set-StrictMode -Version Latest`
and `$ErrorActionPreference = 'Stop'` only when this script owns error
policy — not fragments, dot-sourced configuration, or a host that already
owns error policy.

The following shows where the scaffold goes, not a required parameter shape:

```powershell
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$LiteralPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
```

## Paths and errors

- Resolve script-owned files from `$PSScriptRoot` with `Join-Path`.
- Do not use `$args` as a custom argument-array name.
- When rethrowing, add context and keep the original exception as inner
  evidence when practical.
- `exit` only at an executable script boundary. Functions return or throw.
- Preserve an existing file's encoding. For new files, choose encoding for
  the consumer; Windows PowerShell 5.1 and PowerShell 7 interpret `utf8`
  differently.

## Output

Emit pipeline data with `Write-Output` or a bare expression, diagnostics
with `Write-Verbose` / `Write-Warning`, and errors with `Write-Error` or
`throw`.

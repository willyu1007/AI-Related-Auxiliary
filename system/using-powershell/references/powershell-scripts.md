# PowerShell Scripts

## Contract

Start executable scripts with a parameter contract when they accept input. Use types and validation only where invalid input would otherwise reach a mutation or produce a confusing failure.

```powershell
[CmdletBinding()]
param(
    [Parameter(Mandatory)]
    [string]$LiteralPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
```

Do not add this scaffold mechanically to fragments, dot-sourced configuration, or scripts whose host owns error policy.

## Paths and invocation

- Resolve script-owned files from `$PSScriptRoot`; combine segments with `Join-Path`.
- Use `-LiteralPath` for a known path and `-Path` only when wildcard expansion is intended or the cmdlet lacks `-LiteralPath`.
- Invoke a native executable with `& $exe @argList`. Capture `$LASTEXITCODE` before running another native command and throw or return it when nonzero is failure.
- Do not use `$args` as a custom argument-array name; it is an automatic variable.

## Failures and output

- Cmdlets and native executables have different failure models. `$LASTEXITCODE` does not validate a cmdlet; `try`/`catch` does not make a native nonzero exit terminating.
- Add context when rethrowing an error, but preserve the original exception as the inner evidence when practical.
- Emit pipeline data with `Write-Output` or bare expressions, diagnostics with `Write-Verbose`/`Write-Warning`, and errors with `Write-Error` or `throw`.
- Keep `exit` at an executable script boundary; reusable functions should return values or throw.

## Text and structured data

- Use single-quoted strings and here-strings for literal content; use double quotes only for intentional interpolation.
- Build JSON from objects with `ConvertTo-Json -Depth <required-depth>` instead of hand-escaped strings.
- Preserve an existing file's encoding. For new files, choose encoding for the consumer explicitly; PowerShell 5.1 and 7 interpret `utf8` differently.
- Avoid backtick continuation. Prefer splatting, arrays, parentheses, and natural line breaks after pipes or commas.

## Verify

Run the Skill's validator from its directory:

```powershell
& './scripts/Test-PowerShell.ps1' -LiteralPath '.\script.ps1'
```

Then execute the script's non-destructive path under every supported PowerShell runtime available for the task.

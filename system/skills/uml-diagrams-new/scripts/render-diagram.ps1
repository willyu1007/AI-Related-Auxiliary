param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
    [Parameter(Mandatory = $true)]
    [ValidateSet('flowchart', 'class', 'sequence', 'state-machine', 'structure')]
    [string]$DiagramType,
    [string]$OutputDrawio,
    [string]$LayoutJson,
    [switch]$DocExport,
    [string]$OutputPng
)

$ErrorActionPreference = 'Stop'
$skillRoot = Split-Path $PSScriptRoot -Parent
$drawio = & "$PSScriptRoot/find-drawio.ps1"
if (-not $drawio) {
    Write-Error 'draw.io desktop CLI not found. Install draw.io or add draw.io.exe to PATH.'
}

function Invoke-DrawioAndWait {
    param([string[]]$Arguments, [string]$ExpectedOutput)

    $oldWriteTime = if (Test-Path -LiteralPath $ExpectedOutput) {
        (Get-Item -LiteralPath $ExpectedOutput).LastWriteTimeUtc
    } else {
        [datetime]::MinValue
    }

    & $drawio @Arguments
    $deadline = [datetime]::UtcNow.AddSeconds(20)
    while ([datetime]::UtcNow -lt $deadline) {
        if (Test-Path -LiteralPath $ExpectedOutput) {
            $output = Get-Item -LiteralPath $ExpectedOutput
            if ($output.Length -gt 0 -and $output.LastWriteTimeUtc -gt $oldWriteTime) { return }
        }
        Start-Sleep -Milliseconds 250
    }

    $fallback = @($Arguments[0], '--disable-gpu') + $Arguments[1..($Arguments.Length - 1)]
    & $drawio @fallback
    $deadline = [datetime]::UtcNow.AddSeconds(20)
    while ([datetime]::UtcNow -lt $deadline) {
        if (Test-Path -LiteralPath $ExpectedOutput) {
            $output = Get-Item -LiteralPath $ExpectedOutput
            if ($output.Length -gt 0 -and $output.LastWriteTimeUtc -gt $oldWriteTime) { return }
        }
        Start-Sleep -Milliseconds 250
    }
    throw "draw.io did not produce $ExpectedOutput"
}

if (-not $OutputDrawio) {
    $OutputDrawio = [System.IO.Path]::ChangeExtension($InputPath, '.drawio')
}

$ext = [System.IO.Path]::GetExtension($InputPath).ToLowerInvariant()
if ($ext -eq '.mmd') {
    Invoke-DrawioAndWait @('-x', '-f', 'xml', '-o', $OutputDrawio, $InputPath) $OutputDrawio
} elseif ($ext -in '.drawio', '.xml') {
    $OutputDrawio = $InputPath
} else {
    Write-Error "Unsupported input: $InputPath (use .mmd or .drawio)"
}

if ($LayoutJson) {
    $layoutPath = if ([System.IO.Path]::IsPathRooted($LayoutJson)) { $LayoutJson } else { Join-Path $skillRoot $LayoutJson }
    Invoke-DrawioAndWait @('-x', '-f', 'xml', '--layout', $layoutPath, '-o', $OutputDrawio, $OutputDrawio) $OutputDrawio
}

& "$PSScriptRoot/apply-diagram-style.ps1" -InputPath $OutputDrawio -DiagramType $DiagramType

if ($DocExport -or $OutputPng) {
    if (-not $OutputPng) {
        $OutputPng = "$OutputDrawio.png"
    }
    $args = @('-x', '-f', 'png', '-e', '-b', '10', '-s', '3', '--crop', '-o', $OutputPng, $OutputDrawio)
    Invoke-DrawioAndWait $args $OutputPng
    Write-Output $OutputPng
} else {
    Write-Output $OutputDrawio
}

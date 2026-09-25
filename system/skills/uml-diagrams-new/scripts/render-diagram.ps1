param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
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

if (-not $OutputDrawio) {
    $OutputDrawio = [System.IO.Path]::ChangeExtension($InputPath, '.drawio')
}

$ext = [System.IO.Path]::GetExtension($InputPath).ToLowerInvariant()
if ($ext -eq '.mmd') {
    & $drawio -x -f xml -o $OutputDrawio $InputPath
} elseif ($ext -in '.drawio', '.xml') {
    $OutputDrawio = $InputPath
} else {
    Write-Error "Unsupported input: $InputPath (use .mmd or .drawio)"
}

if ($LayoutJson) {
    $layoutPath = if ([System.IO.Path]::IsPathRooted($LayoutJson)) { $LayoutJson } else { Join-Path $skillRoot $LayoutJson }
    & $drawio -x -f xml --layout $layoutPath -o $OutputDrawio $OutputDrawio
}

if ($DocExport -or $OutputPng) {
    if (-not $OutputPng) {
        $OutputPng = "$OutputDrawio.png"
    }
    $args = @('-x', '-f', 'png', '-e', '-b', '10', '-s', '3', '--crop', '-o', $OutputPng, $OutputDrawio)
    & $drawio @args
    Write-Output $OutputPng
} else {
    Write-Output $OutputDrawio
}

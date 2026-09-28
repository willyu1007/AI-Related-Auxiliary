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
if (-not $drawio) { throw '未找到 draw.io 桌面版 CLI。' }

function Invoke-DrawioAndWait {
    param([string[]]$Arguments, [string]$ExpectedOutput)

    $oldWriteTime = if (Test-Path -LiteralPath $ExpectedOutput) {
        (Get-Item -LiteralPath $ExpectedOutput).LastWriteTimeUtc
    } else { [datetime]::MinValue }

    & $drawio '--disable-gpu' @Arguments
    $deadline = [datetime]::UtcNow.AddSeconds(20)
    while ([datetime]::UtcNow -lt $deadline) {
        if (Test-Path -LiteralPath $ExpectedOutput) {
            $output = Get-Item -LiteralPath $ExpectedOutput
            if ($output.Length -gt 0 -and $output.LastWriteTimeUtc -gt $oldWriteTime) { return }
        }
        Start-Sleep -Milliseconds 250
    }

    throw "draw.io 未生成文件：$ExpectedOutput"
}

if (-not $OutputDrawio) { $OutputDrawio = [System.IO.Path]::ChangeExtension($InputPath, '.drawio') }
$extension = [System.IO.Path]::GetExtension($InputPath).ToLowerInvariant()
if ($extension -eq '.mmd') {
    Invoke-DrawioAndWait @('-x', '-f', 'xml', '-o', $OutputDrawio, $InputPath) $OutputDrawio
} elseif ($extension -in '.drawio', '.xml') {
    $OutputDrawio = $InputPath
} else {
    throw "不支持的输入文件：$InputPath（请使用 .mmd 或 .drawio）"
}

if ($LayoutJson -and $extension -eq '.mmd') {
    throw '布局 JSON 只能用于已转换并在 draw.io 中 Ungroup 的 .drawio 文件。'
}

if ($LayoutJson) {
    $layoutPath = if ([System.IO.Path]::IsPathRooted($LayoutJson)) { $LayoutJson } else { Join-Path $skillRoot $LayoutJson }
    Invoke-DrawioAndWait @('-x', '-f', 'xml', '--layout', $layoutPath, '-o', $OutputDrawio, $OutputDrawio) $OutputDrawio
}

& "$PSScriptRoot/apply-diagram-style.ps1" -InputPath $OutputDrawio -DiagramType $DiagramType

if ($DocExport -or $OutputPng) {
    if (-not $OutputPng) { $OutputPng = "$OutputDrawio.png" }
    $arguments = @('-x', '-f', 'png', '-e', '-b', '10', '-s', '3', '--crop', '-o', $OutputPng, $OutputDrawio)
    Invoke-DrawioAndWait $arguments $OutputPng
    Write-Output $OutputPng
} else {
    Write-Output $OutputDrawio
}

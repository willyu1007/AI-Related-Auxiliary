param(
    [Parameter(Mandatory = $true)][string]$InputPath,
    [Parameter(Mandatory = $true)]
    [ValidateSet('flowchart', 'class', 'sequence', 'state-machine', 'structure')]
    [string]$DiagramType,
    [string]$OutputDrawio,
    [string]$LayoutJson,
    [switch]$DocExport,
    [string]$OutputPng,
    [string]$GeometryReport,
    [string]$GeometryPreview,
    [string]$BrowserExecutable,
    [string]$NodeExecutable = 'node'
)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
$skillRoot = Split-Path $PSScriptRoot -Parent
$sourcePath = (Resolve-Path -LiteralPath $InputPath).ProviderPath
$extension = [System.IO.Path]::GetExtension($sourcePath).ToLowerInvariant()
if ($extension -notin '.mmd', '.drawio', '.xml') { throw '输入必须为 .mmd、.drawio 或 .xml。' }
if ($LayoutJson -and $extension -eq '.mmd') { throw 'Mermaid 在生成时应用类型配置；-LayoutJson 仅用于现有 draw.io 的明确布局修复。' }
if (-not $OutputDrawio) {
    $OutputDrawio = if ($extension -eq '.mmd') { [System.IO.Path]::ChangeExtension($sourcePath, '.drawio') }
    else { [System.IO.Path]::ChangeExtension($sourcePath, '.checked.drawio') }
}
$OutputDrawio = [System.IO.Path]::GetFullPath($OutputDrawio)
if (-not $GeometryReport) { $GeometryReport = "$OutputDrawio.geometry.json" }
$outputSvg = "$OutputDrawio.svg"
if (($DocExport -or $OutputPng) -and -not $OutputPng) { $OutputPng = "$OutputDrawio.png" }
$outputPaths = @($OutputDrawio, $outputSvg, $GeometryReport, $GeometryPreview, $OutputPng) |
    Where-Object { $_ } | ForEach-Object { [System.IO.Path]::GetFullPath($_) }
if ($sourcePath -in $outputPaths -or @($outputPaths | Select-Object -Unique).Count -ne $outputPaths.Count) {
    throw '输出路径必须互不相同，并且不能覆盖输入。'
}
$drawio = & "$PSScriptRoot/find-drawio.ps1"
if (-not $drawio) { throw '未找到 draw.io 桌面版 CLI。' }
$layoutPath = $null
if ($LayoutJson) {
    $layoutPath = if ([System.IO.Path]::IsPathRooted($LayoutJson)) { $LayoutJson } else { Join-Path $skillRoot $LayoutJson }
    $layoutPath = (Resolve-Path -LiteralPath $layoutPath).ProviderPath
}
function Invoke-DrawioAndWait {
    param([string[]]$Arguments, [string]$ExpectedOutput)
    $oldWriteTime = if (Test-Path -LiteralPath $ExpectedOutput) {
        (Get-Item -LiteralPath $ExpectedOutput).LastWriteTimeUtc
    } else { [datetime]::MinValue }
    $processArguments = @('--disable-gpu') + $Arguments | ForEach-Object { '"' + $_ + '"' }
    $process = Start-Process -FilePath $drawio -ArgumentList $processArguments -WindowStyle Hidden -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "draw.io 退出码：$($process.ExitCode)" }
    $deadline = [datetime]::UtcNow.AddSeconds(20)
    while ([datetime]::UtcNow -lt $deadline) {
        if (Test-Path -LiteralPath $ExpectedOutput) {
            $output = Get-Item -LiteralPath $ExpectedOutput
            if ($output.Length -gt 0 -and $output.LastWriteTimeUtc -gt $oldWriteTime) { return }
        }
        Start-Sleep -Milliseconds 250
    }
    throw "draw.io 未生成新文件：$ExpectedOutput"
}
$temporaryRoot = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
$workDirectory = Join-Path $temporaryRoot ('uml-render-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $workDirectory | Out-Null
$checkExitCode = 2
try {
    if ($extension -eq '.mmd') {
        $preparedSource = Join-Path $workDirectory 'prepared.mmd'
        & $NodeExecutable "$PSScriptRoot/prepare-mermaid.mjs" --input $sourcePath --output $preparedSource --type $DiagramType
        if ($LASTEXITCODE -ne 0) { throw 'Mermaid 生成配置失败。' }
        Invoke-DrawioAndWait @('-x', '-f', 'xml', '-o', $OutputDrawio, $preparedSource) $OutputDrawio
    } else {
        Copy-Item -LiteralPath $sourcePath -Destination $OutputDrawio
    }
    if ($layoutPath) {
        $relayout = Join-Path $workDirectory 'relayout.drawio'
        Invoke-DrawioAndWait @('-x', '-f', 'xml', '--layout', $layoutPath, '-o', $relayout, $OutputDrawio) $relayout
        Copy-Item -LiteralPath $relayout -Destination $OutputDrawio
    }
    $null = & "$PSScriptRoot/apply-diagram-style.ps1" -InputPath $OutputDrawio -DiagramType $DiagramType
    Invoke-DrawioAndWait @('-x', '-f', 'svg', '-e', '-o', $outputSvg, $OutputDrawio) $outputSvg
    $checkArguments = @("$PSScriptRoot/check-diagram-geometry.mjs", '--drawio', $OutputDrawio, '--svg', $outputSvg, '--report', $GeometryReport)
    if ($BrowserExecutable) { $checkArguments += @('--browser', $BrowserExecutable) }
    if ($GeometryPreview) { $checkArguments += @('--preview', $GeometryPreview) }
    & $NodeExecutable @checkArguments
    $checkExitCode = $LASTEXITCODE
    if ($checkExitCode -eq 0 -and $OutputPng) {
        Invoke-DrawioAndWait @('-x', '-f', 'png', '-e', '-b', '10', '-s', '3', '--crop', '-o', $OutputPng, $OutputDrawio) $OutputPng
        Write-Output $OutputPng
    }
    Write-Output $OutputDrawio
    Write-Output "Geometry report: $GeometryReport (exit $checkExitCode)"
    if ($checkExitCode -ne 0) { Write-Warning '成品未通过几何验收；查看报告，修复并重新导出检查。' }
} finally {
    $resolvedWork = [System.IO.Path]::GetFullPath($workDirectory)
    if (-not $resolvedWork.StartsWith($temporaryRoot, [System.StringComparison]::OrdinalIgnoreCase) -or $resolvedWork -eq $temporaryRoot) {
        throw '临时目录不在预期范围内。'
    }
    Remove-Item -LiteralPath $resolvedWork -Recurse -Force
}
exit $checkExitCode
} catch {
    [Console]::Error.WriteLine($_.Exception.Message)
    exit 2
}

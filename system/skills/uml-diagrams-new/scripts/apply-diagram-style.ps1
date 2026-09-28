param(
    [Parameter(Mandatory = $true)]
    [string]$InputPath,
    [Parameter(Mandatory = $true)]
    [ValidateSet('flowchart', 'class', 'sequence', 'state-machine', 'structure')]
    [string]$DiagramType,
    [string]$OutputPath
)

$ErrorActionPreference = 'Stop'
if (-not $OutputPath) { $OutputPath = $InputPath }

$xml = [xml](Get-Content -Raw -LiteralPath $InputPath)

function Set-StyleProperty {
    param([System.Collections.IDictionary]$Style, [string]$Name, [string]$Value)
    $Style[$Name] = $Value
}

function ConvertTo-StyleString {
    param([System.Collections.IDictionary]$Style)
    return (($Style.GetEnumerator() | ForEach-Object { if ($null -eq $_.Value) { $_.Key } else { "$($_.Key)=$($_.Value)" } }) -join ';') + ';'
}

foreach ($cell in $xml.SelectNodes('//mxCell')) {
    $style = [ordered]@{}
    foreach ($part in $cell.GetAttribute('style').Split(';')) {
        $separator = $part.IndexOf('=')
        if ($separator -gt 0) { $style[$part.Substring(0, $separator)] = $part.Substring($separator + 1) }
        elseif ($part) { $style[$part] = $null }
    }

    $owner = $cell.ParentNode
    $mermaidId = if ($owner.Name -eq 'UserObject') { $owner.GetAttribute('mermaidId') } else { '' }
    $isEdge = $cell.GetAttribute('edge') -eq '1'
    $isVertex = $cell.GetAttribute('vertex') -eq '1'

    Set-StyleProperty $style 'fontFamily' 'Microsoft YaHei'
    if (-not $style.Contains('fontSize') -or [double]$style['fontSize'] -lt 14) { Set-StyleProperty $style 'fontSize' '14' }
    Set-StyleProperty $style 'fontColor' '#000000'

    foreach ($key in @('fillColor', 'swimlaneFillColor', 'strokeColor', 'lifelineColor')) {
        if ($style.Contains($key) -and $style[$key] -like 'light-dark(*)') {
            $style[$key] = if ($key -in @('strokeColor', 'lifelineColor')) { '#333333' } else { '#ffffff' }
        }
    }

    if ($isVertex) {
        if ($style.Contains('fillColor') -and $style['fillColor'] -notin @('none', 'inherit')) { Set-StyleProperty $style 'fillColor' '#ffffff' }
        if ($style.Contains('strokeColor') -and $style['strokeColor'] -notin @('none', 'inherit')) { Set-StyleProperty $style 'strokeColor' '#333333' }
        if (-not $style.Contains('strokeColor') -and $style.Contains('shape')) { Set-StyleProperty $style 'strokeColor' '#333333' }
        if (-not $style.Contains('strokeWidth') -or [double]$style['strokeWidth'] -lt 2) { Set-StyleProperty $style 'strokeWidth' '2' }
    }

    if ($isEdge) {
        Set-StyleProperty $style 'strokeColor' '#333333'
        Set-StyleProperty $style 'strokeWidth' '2'
        Set-StyleProperty $style 'labelBackgroundColor' '#ffffff'
        if ($DiagramType -in @('flowchart', 'structure', 'state-machine')) {
            Set-StyleProperty $style 'edgeStyle' 'orthogonalEdgeStyle'
            Set-StyleProperty $style 'rounded' '0'
            Set-StyleProperty $style 'curved' '0'
        }
    }

    if ($DiagramType -eq 'structure' -and $isVertex -and $style.Contains('swimlane')) {
        Set-StyleProperty $style 'fillColor' 'none'
        Set-StyleProperty $style 'swimlaneFillColor' 'none'
    }

    if ($DiagramType -eq 'sequence' -and $mermaidId.StartsWith('n:')) {
        Set-StyleProperty $style 'fillColor' '#ffffff'
        Set-StyleProperty $style 'strokeColor' '#333333'
        Set-StyleProperty $style 'strokeWidth' '2'
        Set-StyleProperty $style 'lifelineColor' '#333333'
        Set-StyleProperty $style 'lifelineDashed' '1'
        Set-StyleProperty $style 'lifelineMirror' '0'
    }

    if ($DiagramType -eq 'state-machine' -and $mermaidId -in @('n:root_start', 'n:root_end')) {
        $label = if ($mermaidId -eq 'n:root_start') { '开始' } else { '结束' }
        $owner.SetAttribute('label', $label)
        $owner.SetAttribute('mermaidBaseValue', $label)
        $style = [ordered]@{
            ellipse = $null
            html = '1'
            whiteSpace = 'wrap'
            fillColor = '#ffffff'
            strokeColor = '#333333'
            strokeWidth = '2'
            fontFamily = 'Microsoft YaHei'
            fontSize = '14'
            fontColor = '#000000'
            align = 'center'
            verticalAlign = 'middle'
        }
        $geometry = $cell.SelectSingleNode('./mxGeometry')
        if ($geometry) {
            $oldWidth = [double]$geometry.GetAttribute('width')
            if ($oldWidth -le 14) {
                $geometry.SetAttribute('x', ([double]$geometry.GetAttribute('x') - 38).ToString([Globalization.CultureInfo]::InvariantCulture))
                $geometry.SetAttribute('width', '90')
                $geometry.SetAttribute('height', '36')
            }
        }
    }

    $cell.SetAttribute('style', (ConvertTo-StyleString $style))
    if ($owner.Name -eq 'UserObject') { $owner.SetAttribute('mermaidBaseStyle', (ConvertTo-StyleString $style)) }
}

$settings = [System.Xml.XmlWriterSettings]::new()
$settings.Encoding = [System.Text.UTF8Encoding]::new($false)
$settings.Indent = $true
$writer = [System.Xml.XmlWriter]::Create($OutputPath, $settings)
try { $xml.Save($writer) } finally { $writer.Dispose() }
Write-Output $OutputPath

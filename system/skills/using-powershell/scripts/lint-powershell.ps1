[CmdletBinding()]
param(
    [Parameter(Mandatory, Position = 0)]
    [string]$LiteralPath
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

try {
    $resolvedPath = (Resolve-Path -LiteralPath $LiteralPath -ErrorAction Stop).ProviderPath
    if (-not (Test-Path -LiteralPath $resolvedPath -PathType Leaf)) {
        throw "Not a file: $LiteralPath"
    }
}
catch {
    [Console]::Error.WriteLine("lint-powershell: unable to read '$LiteralPath': $($_.Exception.Message)")
    exit 2
}

$tokens = $null
$parseErrors = $null

try {
    $ast = [System.Management.Automation.Language.Parser]::ParseFile(
        $resolvedPath,
        [ref]$tokens,
        [ref]$parseErrors
    )
}
catch {
    [Console]::Error.WriteLine("lint-powershell: unable to analyze '$resolvedPath': $($_.Exception.Message)")
    exit 2
}

$findings = New-Object 'System.Collections.Generic.List[object]'

function Add-Finding {
    param(
        [System.Management.Automation.Language.IScriptExtent]$Extent,
        [string]$Category,
        [string]$Message
    )

    $findings.Add([pscustomobject]@{
        Offset   = $Extent.StartOffset
        Line     = $Extent.StartLineNumber
        Column   = $Extent.StartColumnNumber
        Category = $Category
        Message  = $Message
    }) | Out-Null
}

foreach ($parseError in $parseErrors) {
    Add-Finding -Extent $parseError.Extent -Category 'parse' -Message $parseError.Message
}

$lineContinuation = [System.Management.Automation.Language.TokenKind]::LineContinuation

foreach ($token in $tokens) {
    if ($token.Kind -eq $lineContinuation) {
        Add-Finding -Extent $token.Extent -Category 'continuation' -Message 'Do not use backtick line continuation.'
    }
    elseif ($token.Extent.Text -in @('&&', '||')) {
        Add-Finding -Extent $token.Extent -Category 'bash' -Message "Use PowerShell statements and explicit success handling instead of '$($token.Extent.Text)'."
    }
    elseif ($token.Extent.Text -eq '/dev/null') {
        Add-Finding -Extent $token.Extent -Category 'bash' -Message 'Use $null instead of /dev/null.'
    }
}

$aliases = @('ls', 'cat', 'rm', 'cp', 'mv')
$commands = $ast.FindAll({ param($node) $node -is [System.Management.Automation.Language.CommandAst] }, $true)

foreach ($command in $commands) {
    $commandName = $command.GetCommandName()
    if ($commandName -and $commandName -in $aliases) {
        Add-Finding -Extent $command.CommandElements[0].Extent -Category 'alias' -Message "Use an unambiguous PowerShell cmdlet instead of '$commandName'."
    }

    if ($commandName -eq 'export') {
        Add-Finding -Extent $command.CommandElements[0].Extent -Category 'bash' -Message 'Use $env:NAME = value instead of Bash export syntax.'
    }
}

$argUses = $ast.FindAll({
    param($node)
    (
        $node -is [System.Management.Automation.Language.AssignmentStatementAst] -and
        $node.Left -is [System.Management.Automation.Language.VariableExpressionAst] -and
        $node.Left.VariablePath.UserPath -eq 'args'
    ) -or (
        $node -is [System.Management.Automation.Language.ParameterAst] -and
        $node.Name.VariablePath.UserPath -eq 'args'
    )
}, $true)

foreach ($argUse in $argUses) {
    $extent = if ($argUse -is [System.Management.Automation.Language.ParameterAst]) {
        $argUse.Name.Extent
    }
    else {
        $argUse.Left.Extent
    }
    Add-Finding -Extent $extent -Category 'args' -Message 'Do not use $args as a custom argument-array name.'
}

$findings |
    Sort-Object Offset, Category, Message -Unique |
    ForEach-Object {
        '{0}:{1}:{2} [{3}] {4}' -f $resolvedPath, $_.Line, $_.Column, $_.Category, $_.Message
    }

if ($findings.Count -gt 0) {
    exit 1
}

exit 0

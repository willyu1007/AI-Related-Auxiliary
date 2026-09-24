# Locate draw.io desktop CLI on Windows. Prints first executable path or nothing.
$c = @()
$c += (where.exe draw.io 2>$null)
$c += "$env:ProgramFiles\draw.io\draw.io.exe", "$env:LOCALAPPDATA\Programs\draw.io\draw.io.exe"
$c += Get-ItemProperty 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
                       'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
                       'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*' -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like '*draw.io*' } |
    ForEach-Object {
        if ($_.InstallLocation) { Join-Path $_.InstallLocation 'draw.io.exe' }
        else { ($_.DisplayIcon -split ',')[0] }
    }
$c += (Get-PSDrive -PSProvider FileSystem).Root | ForEach-Object { Join-Path $_ 'Program Files\draw.io\draw.io.exe' }
$c | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1

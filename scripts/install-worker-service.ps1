[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ServiceName,

    [Parameter(Mandatory = $true)]
    [string]$DisplayName,

    [Parameter(Mandatory = $true)]
    [string]$ExecutablePath,

    [string]$Description = "PulsCRM background worker service.",

    [ValidateSet("Automatic", "Manual", "Disabled")]
    [string]$StartupType = "Automatic"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (-not (Test-Path -LiteralPath $ExecutablePath -PathType Leaf)) {
    throw "Executable was not found: $ExecutablePath"
}

$binaryPath = "`"$ExecutablePath`""
$existingService = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue
$scStartupType = switch ($StartupType) {
    "Automatic" { "auto" }
    "Manual" { "demand" }
    "Disabled" { "disabled" }
    default { throw "Unsupported startup type: $StartupType" }
}

if ($null -eq $existingService) {
    New-Service `
        -Name $ServiceName `
        -BinaryPathName $binaryPath `
        -DisplayName $DisplayName `
        -Description $Description `
        -StartupType $StartupType

    Write-Host "Created service $ServiceName"
}
else {
    & sc.exe config $ServiceName binPath= $binaryPath start= $scStartupType | Out-Null
    Write-Host "Updated service $ServiceName"
}

& sc.exe description $ServiceName $Description | Out-Null

Write-Host "Service executable: $ExecutablePath"
Write-Host "If SQL Server or network shares require a domain/service account, change the Log On account before starting the service."

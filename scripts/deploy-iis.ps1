[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ApiSourcePath,

    [Parameter(Mandatory = $true)]
    [string]$ApiTargetPath,

    [Parameter(Mandatory = $true)]
    [string]$WebSourcePath,

    [Parameter(Mandatory = $true)]
    [string]$WebTargetPath,

    [string]$ApiConfigSourcePath,
    [string]$HealthcheckUrl,
    [string[]]$WarmupUrls = @(),
    [string]$ApiAppPoolName = "PulsCRM.Api",
    [string]$BackupRootPath,
    [int]$BackupRetention = 5,
    [switch]$SkipBackup
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-Directory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        throw "$Label path is empty."
    }

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        throw "$Label directory was not found: $Path"
    }
}

function Ensure-Directory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Container)) {
        New-Item -ItemType Directory -Path $Path -Force | Out-Null
    }
}

function Copy-OptionalConfig {
    param(
        [string]$SourcePath,

        [Parameter(Mandatory = $true)]
        [string]$TargetDirectory
    )

    if ([string]::IsNullOrWhiteSpace($SourcePath)) {
        return
    }

    if (-not (Test-Path -LiteralPath $SourcePath -PathType Leaf)) {
        throw "Config file was not found: $SourcePath"
    }

    $targetPath = Join-Path $TargetDirectory "appsettings.Production.json"
    Copy-Item -LiteralPath $SourcePath -Destination $targetPath -Force
    Write-Host "Copied config file to $targetPath"
}

function Set-WebConfigEnvironmentVariable {
    param(
        [Parameter(Mandatory = $true)]
        [xml]$WebConfig,

        [Parameter(Mandatory = $true)]
        [System.Xml.XmlElement]$EnvironmentVariables,

        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $existing = @($EnvironmentVariables.SelectNodes("environmentVariable[@name='$Name']"))
    foreach ($node in $existing) {
        [void]$EnvironmentVariables.RemoveChild($node)
    }

    $item = $WebConfig.CreateElement("environmentVariable")
    [void]$item.SetAttribute("name", $Name)
    [void]$item.SetAttribute("value", $Value)
    [void]$EnvironmentVariables.AppendChild($item)
}

function Sync-ConnectionStringsToWebConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath,

        [Parameter(Mandatory = $true)]
        [string]$WebConfigPath
    )

    if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
        Write-Warning "Connection strings were not synced to web.config: config file was not found: $ConfigPath"
        return
    }

    if (-not (Test-Path -LiteralPath $WebConfigPath -PathType Leaf)) {
        Write-Warning "Connection strings were not synced to web.config: web.config was not found: $WebConfigPath"
        return
    }

    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if ($null -eq $config.ConnectionStrings) {
        Write-Warning "Connection strings were not synced to web.config: ConnectionStrings section was not found in $ConfigPath"
        return
    }

    [xml]$webConfig = Get-Content -LiteralPath $WebConfigPath -Raw
    $aspNetCore = $webConfig.SelectSingleNode("/configuration/system.webServer/aspNetCore")
    if ($null -eq $aspNetCore) {
        Write-Warning "Connection strings were not synced to web.config: aspNetCore element was not found in $WebConfigPath"
        return
    }

    $environmentVariables = $aspNetCore.SelectSingleNode("environmentVariables")
    if ($null -eq $environmentVariables) {
        $environmentVariables = $webConfig.CreateElement("environmentVariables")
        [void]$aspNetCore.AppendChild($environmentVariables)
    }

    Set-WebConfigEnvironmentVariable -WebConfig $webConfig -EnvironmentVariables $environmentVariables -Name "ASPNETCORE_ENVIRONMENT" -Value "Production"

    $synced = 0
    foreach ($property in $config.ConnectionStrings.PSObject.Properties) {
        $value = [string]$property.Value
        if ([string]::IsNullOrWhiteSpace($property.Name) -or [string]::IsNullOrWhiteSpace($value)) {
            continue
        }

        Set-WebConfigEnvironmentVariable -WebConfig $webConfig -EnvironmentVariables $environmentVariables -Name "ConnectionStrings__$($property.Name)" -Value $value
        $synced += 1
    }

    $webConfig.Save($WebConfigPath)
    Write-Host "Synced $synced connection string environment variable(s) to $WebConfigPath"
}

function Invoke-RobocopyMirror {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,

        [Parameter(Mandatory = $true)]
        [string]$Target
    )

    Ensure-Directory -Path $Target

    & robocopy $Source $Target /MIR /R:2 /W:5 /NFL /NDL /NP /XF app_offline.htm /XD logs
    $exitCode = $LASTEXITCODE

    if ($exitCode -ge 8) {
        throw "robocopy failed with exit code $exitCode"
    }

    $global:LASTEXITCODE = 0
}

function Resolve-BackupRootPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiPath,

        [string]$ConfiguredPath
    )

    if (-not [string]::IsNullOrWhiteSpace($ConfiguredPath)) {
        return $ConfiguredPath
    }

    $apiParent = Split-Path -Path $ApiPath -Parent
    if ([string]::IsNullOrWhiteSpace($apiParent)) {
        throw "Cannot resolve backup root from API target path: $ApiPath"
    }

    return Join-Path $apiParent "Backups"
}

function New-DeploymentBackup {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupPath,

        [Parameter(Mandatory = $true)]
        [string]$ApiPath,

        [Parameter(Mandatory = $true)]
        [string]$WebPath
    )

    $apiBackupPath = Join-Path $backupPath "Api"
    $webBackupPath = Join-Path $backupPath "Web"

    Ensure-Directory -Path $backupPath

    Write-Host "Creating deployment backup: $backupPath"

    if (Test-Path -LiteralPath $ApiPath -PathType Container) {
        Invoke-RobocopyMirror -Source $ApiPath -Target $apiBackupPath
    }
    else {
        Ensure-Directory -Path $apiBackupPath
        Write-Warning "API target directory does not exist yet. Empty API backup was created."
    }

    if (Test-Path -LiteralPath $WebPath -PathType Container) {
        Invoke-RobocopyMirror -Source $WebPath -Target $webBackupPath
    }
    else {
        Ensure-Directory -Path $webBackupPath
        Write-Warning "Web target directory does not exist yet. Empty Web backup was created."
    }

    $manifestPath = Join-Path $backupPath "manifest.json"
    $manifest = [ordered]@{
        createdAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        apiTargetPath = $ApiPath
        webTargetPath = $WebPath
        apiBackupPath = $apiBackupPath
        webBackupPath = $webBackupPath
        machineName = $env:COMPUTERNAME
    }

    $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
    Write-Host "Backup manifest created: $manifestPath"
}

function Remove-OldDeploymentBackups {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BackupRoot,

        [int]$Retention
    )

    if ($Retention -le 0) {
        Write-Host "Backup cleanup skipped: retention is $Retention."
        return
    }

    if (-not (Test-Path -LiteralPath $BackupRoot -PathType Container)) {
        return
    }

    $backups = Get-ChildItem -LiteralPath $BackupRoot -Directory |
        Where-Object { $_.Name -match "^\d{8}-\d{6}$" } |
        Sort-Object Name -Descending

    $oldBackups = $backups | Select-Object -Skip $Retention
    foreach ($backup in $oldBackups) {
        Write-Host "Removing old deployment backup: $($backup.FullName)"
        Remove-Item -LiteralPath $backup.FullName -Recurse -Force
    }
}

function Invoke-AppCmd {
    param(
        [Parameter(Mandatory = $true)]
        [string[]]$Arguments
    )

    $appCmdPath = Join-Path $env:windir "system32\inetsrv\appcmd.exe"
    if (-not (Test-Path -LiteralPath $appCmdPath -PathType Leaf)) {
        throw "IIS appcmd.exe was not found: $appCmdPath"
    }

    & $appCmdPath @Arguments
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        throw "appcmd failed with exit code $exitCode. Arguments: $($Arguments -join ' ')"
    }

    $global:LASTEXITCODE = 0
}

function Stop-AppPoolIfConfigured {
    param(
        [string]$Name
    )

    if ([string]::IsNullOrWhiteSpace($Name)) {
        return
    }

    Write-Host "Stopping app pool $Name"
    try {
        Invoke-AppCmd -Arguments @("stop", "apppool", $Name)
    }
    catch {
        $message = $_.Exception.Message
        if ($message -match "is already stopped|Cannot find") {
            Write-Warning $message
            return
        }

        throw
    }
}

function Start-AppPoolIfConfigured {
    param(
        [string]$Name
    )

    if ([string]::IsNullOrWhiteSpace($Name)) {
        return
    }

    Write-Host "Starting app pool $Name"
    Invoke-AppCmd -Arguments @("start", "apppool", $Name)
}

function Wait-ForHealthcheck {
    param(
        [string]$Url,

        [int]$Attempts = 12,
        [int]$DelaySeconds = 5
    )

    if ([string]::IsNullOrWhiteSpace($Url)) {
        return
    }

    $lastError = $null

    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                Write-Host "Healthcheck passed: $Url"
                return
            }

            $lastError = "Unexpected status code: $($response.StatusCode)"
        }
        catch {
            $lastError = $_.Exception.Message
        }

        if ($attempt -lt $Attempts) {
            Start-Sleep -Seconds $DelaySeconds
        }
    }

    throw "Healthcheck failed for $Url. Last error: $lastError"
}

function Invoke-WarmupUrls {
    param(
        [string[]]$Urls,
        [int]$Attempts = 3,
        [int]$DelaySeconds = 2
    )

    foreach ($url in $Urls) {
        if ([string]::IsNullOrWhiteSpace($url)) {
            continue
        }

        $lastError = $null
        for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
            try {
                $response = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 30
                if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
                    Write-Host "Warmup passed: $url"
                    $lastError = $null
                    break
                }

                $lastError = "Unexpected status code: $($response.StatusCode)"
            }
            catch {
                $lastError = $_.Exception.Message
            }

            if ($attempt -lt $Attempts) {
                Start-Sleep -Seconds $DelaySeconds
            }
        }

        if ($null -ne $lastError) {
            Write-Warning "Warmup failed for $url. Last error: $lastError"
        }
    }
}

Assert-Directory -Path $ApiSourcePath -Label "API source"
Assert-Directory -Path $WebSourcePath -Label "Web source"

Copy-OptionalConfig -SourcePath $ApiConfigSourcePath -TargetDirectory $ApiSourcePath
$publishedConfigPath = Join-Path $ApiSourcePath "appsettings.Production.json"
$publishedWebConfigPath = Join-Path $ApiSourcePath "web.config"
Sync-ConnectionStringsToWebConfig -ConfigPath $publishedConfigPath -WebConfigPath $publishedWebConfigPath

Ensure-Directory -Path $ApiTargetPath
$appOfflinePath = Join-Path $ApiTargetPath "app_offline.htm"
Set-Content -LiteralPath $appOfflinePath -Value "<html><body>Maintenance</body></html>" -Encoding UTF8

try {
    Stop-AppPoolIfConfigured -Name $ApiAppPoolName
    if ($SkipBackup) {
        Write-Warning "Deployment backup skipped by parameter."
    }
    else {
        $resolvedBackupRootPath = Resolve-BackupRootPath -ApiPath $ApiTargetPath -ConfiguredPath $BackupRootPath
        Ensure-Directory -Path $resolvedBackupRootPath
        $backupPath = Join-Path $resolvedBackupRootPath (Get-Date -Format "yyyyMMdd-HHmmss")
        New-DeploymentBackup -BackupPath $backupPath -ApiPath $ApiTargetPath -WebPath $WebTargetPath
        Remove-OldDeploymentBackups -BackupRoot $resolvedBackupRootPath -Retention $BackupRetention
        Write-Host "Rollback source: $backupPath"
    }

    Write-Host "Deploying API to $ApiTargetPath"
    Invoke-RobocopyMirror -Source $ApiSourcePath -Target $ApiTargetPath
}
finally {
    if (Test-Path -LiteralPath $appOfflinePath) {
        Remove-Item -LiteralPath $appOfflinePath -Force -ErrorAction SilentlyContinue
    }

    Start-AppPoolIfConfigured -Name $ApiAppPoolName
}

Write-Host "Deploying frontend to $WebTargetPath"
Invoke-RobocopyMirror -Source $WebSourcePath -Target $WebTargetPath

Wait-ForHealthcheck -Url $HealthcheckUrl
Invoke-WarmupUrls -Urls $WarmupUrls

Write-Host "Deployment completed successfully."
$global:LASTEXITCODE = 0

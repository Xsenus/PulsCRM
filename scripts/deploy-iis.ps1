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
    [string]$ApiAppPoolName = "PulsCRM.Api"
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
        [Parameter(Mandatory = $true)]
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
        [Parameter(Mandatory = $true)]
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

Ensure-Directory -Path $ApiTargetPath
$appOfflinePath = Join-Path $ApiTargetPath "app_offline.htm"
Set-Content -LiteralPath $appOfflinePath -Value "<html><body>Maintenance</body></html>" -Encoding UTF8

try {
    Stop-AppPoolIfConfigured -Name $ApiAppPoolName
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

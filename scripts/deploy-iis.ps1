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

    [Parameter(Mandatory = $true)]
    [string]$WorkerSourcePath,

    [Parameter(Mandatory = $true)]
    [string]$WorkerTargetPath,

    [string]$ApiConfigSourcePath,
    [string]$WorkerConfigSourcePath,
    [string]$WorkerServiceName,
    [string]$HealthcheckUrl
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

Assert-Directory -Path $ApiSourcePath -Label "API source"
Assert-Directory -Path $WebSourcePath -Label "Web source"
Assert-Directory -Path $WorkerSourcePath -Label "Worker source"

Copy-OptionalConfig -SourcePath $ApiConfigSourcePath -TargetDirectory $ApiSourcePath
Copy-OptionalConfig -SourcePath $WorkerConfigSourcePath -TargetDirectory $WorkerSourcePath

$workerService = $null
if (-not [string]::IsNullOrWhiteSpace($WorkerServiceName)) {
    $workerService = Get-Service -Name $WorkerServiceName -ErrorAction SilentlyContinue

    if ($null -eq $workerService) {
        Write-Warning "Worker service '$WorkerServiceName' was not found. Deployment will continue without restart."
    }
    elseif ($workerService.Status -ne [System.ServiceProcess.ServiceControllerStatus]::Stopped) {
        Write-Host "Stopping worker service $WorkerServiceName"
        Stop-Service -Name $WorkerServiceName -Force -ErrorAction Stop
        $workerService.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Stopped, [TimeSpan]::FromSeconds(30))
    }
}

Ensure-Directory -Path $ApiTargetPath
$appOfflinePath = Join-Path $ApiTargetPath "app_offline.htm"
Set-Content -LiteralPath $appOfflinePath -Value "<html><body>Maintenance</body></html>" -Encoding UTF8

try {
    Write-Host "Deploying API to $ApiTargetPath"
    Invoke-RobocopyMirror -Source $ApiSourcePath -Target $ApiTargetPath
}
finally {
    if (Test-Path -LiteralPath $appOfflinePath) {
        Remove-Item -LiteralPath $appOfflinePath -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "Deploying frontend to $WebTargetPath"
Invoke-RobocopyMirror -Source $WebSourcePath -Target $WebTargetPath

Write-Host "Deploying worker to $WorkerTargetPath"
Invoke-RobocopyMirror -Source $WorkerSourcePath -Target $WorkerTargetPath

if ($null -ne $workerService) {
    Write-Host "Starting worker service $WorkerServiceName"
    Start-Service -Name $WorkerServiceName
    $workerService.WaitForStatus([System.ServiceProcess.ServiceControllerStatus]::Running, [TimeSpan]::FromSeconds(30))
}

Wait-ForHealthcheck -Url $HealthcheckUrl

Write-Host "Deployment completed successfully."

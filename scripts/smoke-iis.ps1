[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$HealthcheckUrl,

    [string]$FrontendUrl = "http://localhost:8080/",
    [string]$AuthUsersUrl,
    [string]$ApiConfigPath,
    [string]$PublishedApiConfigPath,
    [string]$ProductionApiUrl,
    [int]$Attempts = 12,
    [int]$DelaySeconds = 5
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Assert-HttpUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Url,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    $uri = $null
    if (-not [Uri]::TryCreate($Url, [UriKind]::Absolute, [ref]$uri)) {
        throw "$Label is not a valid absolute URL: $Url"
    }

    if ($uri.Scheme -ne "http" -and $uri.Scheme -ne "https") {
        throw "$Label must use http or https: $Url"
    }
}

function Join-WebUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseUrl,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $base = $BaseUrl
    if (-not $base.EndsWith("/")) {
        $base = "$base/"
    }

    return ([Uri]::new([Uri]::new($base), $Path)).AbsoluteUri
}

function Invoke-SmokeRequest {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Label,

        [Parameter(Mandatory = $true)]
        [string]$Url,

        [int]$ExpectedMinStatusCode = 200,
        [int]$ExpectedMaxStatusCode = 399
    )

    Assert-HttpUrl -Url $Url -Label $Label

    $lastError = $null
    for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
        try {
            $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 30
            if ($response.StatusCode -ge $ExpectedMinStatusCode -and $response.StatusCode -le $ExpectedMaxStatusCode) {
                Write-Host "Smoke passed: $Label [$($response.StatusCode)] $Url"
                return $response
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

    throw "Smoke failed: $Label $Url. Last error: $lastError"
}

function Assert-HealthResponse {
    param(
        [Parameter(Mandatory = $true)]
        $Response
    )

    if ([string]::IsNullOrWhiteSpace($Response.Content)) {
        throw "Healthcheck returned empty response."
    }

    try {
        $json = $Response.Content | ConvertFrom-Json
        if ($json.PSObject.Properties.Name -contains "status" -and $json.status -ne "ok") {
            throw "Unexpected health status: $($json.status)"
        }
    }
    catch {
        throw "Healthcheck returned invalid JSON or bad status. Response: $($Response.Content)"
    }
}

function Get-FrontendAssetPath {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Html
    )

    $scriptMatch = [regex]::Match($Html, '<script[^>]+src="([^"]+)"', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($scriptMatch.Success) {
        return $scriptMatch.Groups[1].Value
    }

    $styleMatch = [regex]::Match($Html, '<link[^>]+href="([^"]+\.css[^"]*)"', [Text.RegularExpressions.RegexOptions]::IgnoreCase)
    if ($styleMatch.Success) {
        return $styleMatch.Groups[1].Value
    }

    return $null
}

function Assert-FileExists {
    param(
        [string]$Path,

        [Parameter(Mandatory = $true)]
        [string]$Label
    )

    if ([string]::IsNullOrWhiteSpace($Path)) {
        return
    }

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        throw "$Label was not found: $Path"
    }

    Write-Host "$Label exists: $Path"
}

Write-Host "Production API URL: $ProductionApiUrl"
Write-Host "Healthcheck URL: $HealthcheckUrl"
Write-Host "Frontend URL: $FrontendUrl"

Assert-FileExists -Path $ApiConfigPath -Label "API production config source"
Assert-FileExists -Path $PublishedApiConfigPath -Label "Published API production config"

$healthResponse = Invoke-SmokeRequest -Label "API health" -Url $HealthcheckUrl
Assert-HealthResponse -Response $healthResponse

$frontendResponse = Invoke-SmokeRequest -Label "frontend root" -Url $FrontendUrl
if ([string]::IsNullOrWhiteSpace($frontendResponse.Content) -or $frontendResponse.Content -notmatch '<html|<div[^>]+id="root"|<script') {
    throw "Frontend root does not look like an application HTML page."
}

$assetPath = Get-FrontendAssetPath -Html $frontendResponse.Content
if ([string]::IsNullOrWhiteSpace($assetPath)) {
    throw "Frontend bundle reference was not found in root HTML."
}

$assetUrl = Join-WebUrl -BaseUrl $FrontendUrl -Path $assetPath
[void](Invoke-SmokeRequest -Label "frontend bundle" -Url $assetUrl)

if (-not [string]::IsNullOrWhiteSpace($AuthUsersUrl)) {
    $authUsersResponse = Invoke-SmokeRequest -Label "public auth users API" -Url $AuthUsersUrl
    try {
        $users = $authUsersResponse.Content | ConvertFrom-Json
        if ($null -eq $users) {
            throw "Auth users response is empty."
        }
    }
    catch {
        throw "Auth users endpoint returned invalid JSON. Response: $($authUsersResponse.Content)"
    }
}
else {
    Write-Host "Public auth users API smoke skipped: AuthUsersUrl is empty."
}

Write-Host "IIS smoke completed successfully."
$global:LASTEXITCODE = 0

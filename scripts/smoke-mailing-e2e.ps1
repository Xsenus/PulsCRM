[CmdletBinding()]
param(
    [string]$ApiBaseUrl = "http://127.0.0.1:5152",
    [string]$AccessToken,
    [string]$Login,
    [string]$Password,
    [switch]$UseDevelopmentToken,
    [string]$DevelopmentSigningKey = "DEV_ONLY_CHANGE_ME_TO_A_LONG_RANDOM_SECRET_KEY_64_PLUS_CHARS",
    [string]$RecipientEmail = "pulscrm-smoke@example.test",
    [int]$SmtpPort = 2525,
    [int]$TimeoutSeconds = 60,
    [switch]$KeepArtifacts
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Join-ApiUrl {
    param(
        [Parameter(Mandatory = $true)]
        [string]$BaseUrl,

        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    $base = $BaseUrl.TrimEnd("/") + "/"
    return ([Uri]::new([Uri]::new($base), $Path.TrimStart("/"))).AbsoluteUri
}

function ConvertTo-Base64Url {
    param(
        [Parameter(Mandatory = $true)]
        [byte[]]$Bytes
    )

    return [Convert]::ToBase64String($Bytes).TrimEnd("=").Replace("+", "-").Replace("/", "_")
}

function New-DevelopmentJwt {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ApiUrl,

        [Parameter(Mandatory = $true)]
        [string]$SigningKey
    )

    $usersResponse = Invoke-WebRequest -Uri (Join-ApiUrl -BaseUrl $ApiUrl -Path "api/auth/users?take=1") -Method Get -UseBasicParsing -TimeoutSec 30
    $users = @($usersResponse.Content | ConvertFrom-Json)
    if ($users.Count -lt 1) {
        throw "No auth users were returned by $ApiUrl."
    }

    $user = $users[0]
    $now = [DateTimeOffset]::UtcNow
    $header = @{
        alg = "HS256"
        typ = "JWT"
    }
    $payload = @{
        sub = [string]$user.id
        unique_name = [string]$user.login
        nbf = $now.ToUnixTimeSeconds()
        exp = $now.AddMinutes(30).ToUnixTimeSeconds()
        iss = "PulsNext.Api"
        aud = "PulsNext.Web"
    }

    $headerPart = ConvertTo-Base64Url -Bytes ([Text.Encoding]::UTF8.GetBytes(($header | ConvertTo-Json -Compress)))
    $payloadPart = ConvertTo-Base64Url -Bytes ([Text.Encoding]::UTF8.GetBytes(($payload | ConvertTo-Json -Compress)))
    $hmac = New-Object System.Security.Cryptography.HMACSHA256
    $hmac.Key = [Text.Encoding]::UTF8.GetBytes($SigningKey)
    $signaturePart = ConvertTo-Base64Url -Bytes ($hmac.ComputeHash([Text.Encoding]::UTF8.GetBytes("$headerPart.$payloadPart")))

    return "$headerPart.$payloadPart.$signaturePart"
}

function Get-ApiAccessToken {
    if (-not [string]::IsNullOrWhiteSpace($AccessToken)) {
        return $AccessToken
    }

    if (-not [string]::IsNullOrWhiteSpace($Login) -and -not [string]::IsNullOrWhiteSpace($Password)) {
        $loginWebResponse = Invoke-WebRequest `
            -Uri (Join-ApiUrl -BaseUrl $ApiBaseUrl -Path "api/auth/login") `
            -Method Post `
            -UseBasicParsing `
            -ContentType "application/json; charset=utf-8" `
            -Body (@{ login = $Login; password = $Password } | ConvertTo-Json -Compress) `
            -TimeoutSec 30
        $loginResponse = $loginWebResponse.Content | ConvertFrom-Json

        if ([string]::IsNullOrWhiteSpace($loginResponse.accessToken)) {
            throw "Login succeeded but accessToken was not returned."
        }

        return [string]$loginResponse.accessToken
    }

    if ($UseDevelopmentToken) {
        return New-DevelopmentJwt -ApiUrl $ApiBaseUrl -SigningKey $DevelopmentSigningKey
    }

    throw "Specify -AccessToken, -Login/-Password, or -UseDevelopmentToken."
}

function Invoke-Api {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Method,

        [Parameter(Mandatory = $true)]
        [string]$Path,

        [object]$Body,

        [Parameter(Mandatory = $true)]
        [string]$Token
    )

    $parameters = @{
        Uri = Join-ApiUrl -BaseUrl $ApiBaseUrl -Path $Path
        Method = $Method
        Headers = @{ Authorization = "Bearer $Token" }
        TimeoutSec = 30
    }

    if ($null -ne $Body) {
        $parameters.ContentType = "application/json; charset=utf-8"
        $parameters.Body = $Body | ConvertTo-Json -Depth 8 -Compress
    }

    $response = Invoke-WebRequest @parameters -UseBasicParsing
    if ([string]::IsNullOrWhiteSpace($response.Content)) {
        return $null
    }

    return $response.Content | ConvertFrom-Json
}

function Start-LocalSmtpCatcher {
    param(
        [Parameter(Mandatory = $true)]
        [int]$Port,

        [Parameter(Mandatory = $true)]
        [string]$OutputPath,

        [Parameter(Mandatory = $true)]
        [int]$WaitSeconds
    )

    return Start-Job -Name "PulsCRM-SMTP-Catcher-$Port" -ScriptBlock {
        param($JobPort, $JobOutputPath, $JobWaitSeconds)

        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $JobPort)
        $listener.Start()

        try {
            $acceptTask = $listener.AcceptTcpClientAsync()
            if (-not $acceptTask.Wait([TimeSpan]::FromSeconds($JobWaitSeconds))) {
                throw "SMTP catcher timed out waiting for client."
            }

            $client = $acceptTask.Result
            try {
                $stream = $client.GetStream()
                $reader = [System.IO.StreamReader]::new($stream, [Text.Encoding]::ASCII)
                $writer = [System.IO.StreamWriter]::new($stream, [Text.Encoding]::ASCII)
                $writer.NewLine = "`r`n"
                $writer.AutoFlush = $true
                $writer.WriteLine("220 localhost PulsCRM smoke catcher")

                $messageLines = New-Object System.Collections.Generic.List[string]
                while ($true) {
                    $line = $reader.ReadLine()
                    if ($null -eq $line) {
                        break
                    }

                    if ($line -match "^(EHLO|HELO)\b") {
                        $writer.WriteLine("250-localhost")
                        $writer.WriteLine("250 OK")
                    }
                    elseif ($line -match "^MAIL FROM:" -or $line -match "^RCPT TO:") {
                        $writer.WriteLine("250 OK")
                    }
                    elseif ($line -match "^DATA\b") {
                        $writer.WriteLine("354 End data with <CR><LF>.<CR><LF>")
                        while ($true) {
                            $dataLine = $reader.ReadLine()
                            if ($null -eq $dataLine -or $dataLine -eq ".") {
                                break
                            }

                            $messageLines.Add($dataLine)
                        }

                        [System.IO.File]::WriteAllLines($JobOutputPath, $messageLines, [Text.Encoding]::UTF8)
                        $writer.WriteLine("250 OK queued")
                    }
                    elseif ($line -match "^QUIT\b") {
                        $writer.WriteLine("221 Bye")
                        break
                    }
                    else {
                        $writer.WriteLine("250 OK")
                    }
                }
            }
            finally {
                $client.Dispose()
            }
        }
        finally {
            $listener.Stop()
        }
    } -ArgumentList $Port, $OutputPath, $WaitSeconds
}

function Wait-Until {
    param(
        [Parameter(Mandatory = $true)]
        [scriptblock]$Condition,

        [Parameter(Mandatory = $true)]
        [string]$FailureMessage,

        [int]$WaitSeconds = 60,
        [int]$DelayMilliseconds = 1000
    )

    $deadline = [DateTimeOffset]::UtcNow.AddSeconds($WaitSeconds)
    do {
        if (& $Condition) {
            return
        }

        Start-Sleep -Milliseconds $DelayMilliseconds
    } while ([DateTimeOffset]::UtcNow -lt $deadline)

    throw $FailureMessage
}

$smtpOutputPath = Join-Path ([System.IO.Path]::GetTempPath()) ("pulscrm-smoke-mail-" + [Guid]::NewGuid().ToString("N") + ".eml")
$smtpJob = $null
$profileId = $null
$campaignId = $null
$token = $null

try {
    $healthResponse = Invoke-WebRequest -Uri (Join-ApiUrl -BaseUrl $ApiBaseUrl -Path "health") -Method Get -UseBasicParsing -TimeoutSec 30
    $health = $healthResponse.Content | ConvertFrom-Json
    if ($health.status -ne "ok") {
        throw "API health returned unexpected status: $($health.status)"
    }

    $token = Get-ApiAccessToken
    $smtpJob = Start-LocalSmtpCatcher -Port $SmtpPort -OutputPath $smtpOutputPath -WaitSeconds $TimeoutSeconds

    Start-Sleep -Milliseconds 500
    if ($smtpJob.State -eq "Failed") {
        Receive-Job -Job $smtpJob -ErrorAction SilentlyContinue | Out-Host
        throw "SMTP catcher failed to start."
    }

    $stamp = Get-Date -Format "yyyyMMdd-HHmmss"
    $profile = Invoke-Api -Method Post -Path "api/transport-profiles" -Token $token -Body @{
        name = "Smoke SMTP $stamp"
        host = "127.0.0.1"
        port = $SmtpPort
        useSsl = $false
        username = $null
        password = $null
        senderEmail = "smoke@pulscrm.local"
        senderName = "PulsCRM Smoke"
        replyToEmail = "smoke@pulscrm.local"
        maxConnections = 1
        messagesPerMinute = 60
        isDefault = $false
        isEnabled = $true
    }
    $profileId = [int]$profile.id
    Write-Host "Created temporary SMTP profile: $profileId"

    $campaignBody = @{
        name = "Smoke mailing E2E $stamp"
        subject = "PulsCRM smoke mailing $stamp"
        htmlBody = "<p>PulsCRM smoke mailing $stamp</p>"
        plainTextBody = "PulsCRM smoke mailing $stamp"
        status = 1
        transportProfileId = $profileId
        scheduleKind = 0
        timeZoneId = "UTC"
        startAtUtc = ([DateTimeOffset]::UtcNow.ToString("o"))
        intervalMinutes = 2
        randomIntervalMinMinutes = 1
        randomIntervalMaxMinutes = 5
        maxRecipientsPerRun = 0
        maxAttempts = 1
        useOrgPrimaryEmail = $false
        useContactEmails = $false
        useSalaryEmail = $false
        useOneCEmail = $false
        useSiteEmail = $false
        useDirectorEmail = $false
        manualRecipientsCsv = $RecipientEmail
        targetOrganizationIds = @()
        attachments = @()
    }

    $readiness = Invoke-Api -Method Post -Path "api/campaigns/readiness" -Token $token -Body $campaignBody
    if (-not $readiness.isReady) {
        throw "Campaign readiness has blocking errors: $($readiness.items | ConvertTo-Json -Depth 5 -Compress)"
    }

    $campaign = Invoke-Api -Method Post -Path "api/campaigns" -Token $token -Body $campaignBody
    $campaignId = [int]$campaign.id
    Write-Host "Created temporary campaign: $campaignId"

    $batch = Invoke-Api -Method Post -Path "api/campaigns/$campaignId/run" -Token $token -Body @{
        scheduledAtUtc = ([DateTimeOffset]::UtcNow.ToString("o"))
        comment = "PulsCRM smoke mailing E2E"
    }
    Write-Host "Created dispatch batch: $($batch.id)"

    Wait-Until `
        -WaitSeconds $TimeoutSeconds `
        -FailureMessage "SMTP catcher did not receive a message in $TimeoutSeconds seconds." `
        -Condition { Test-Path -LiteralPath $smtpOutputPath -PathType Leaf }

    $message = Get-Content -LiteralPath $smtpOutputPath -Raw
    if ($message -notmatch [regex]::Escape($RecipientEmail) -or $message -notmatch "PulsCRM smoke mailing") {
        throw "Captured SMTP message does not contain expected recipient or body."
    }

    Wait-Until `
        -WaitSeconds $TimeoutSeconds `
        -FailureMessage "Campaign statistics did not report sent item in $TimeoutSeconds seconds." `
        -Condition {
            $stats = Invoke-Api -Method Get -Path "api/campaigns/$campaignId/stats" -Token $token
            return $stats.sent -ge 1
        }

    $finalStats = Invoke-Api -Method Get -Path "api/campaigns/$campaignId/stats" -Token $token
    [pscustomobject]@{
        Status = "ok"
        CampaignId = $campaignId
        TransportProfileId = $profileId
        BatchId = $batch.id
        RecipientEmail = $RecipientEmail
        Sent = $finalStats.sent
        Failed = $finalStats.failed
        CapturedMessagePath = $smtpOutputPath
    } | ConvertTo-Json -Depth 5
}
finally {
    if ($smtpJob -ne $null) {
        if ($smtpJob.State -eq "Running") {
            Stop-Job -Job $smtpJob -ErrorAction SilentlyContinue
        }

        Receive-Job -Job $smtpJob -ErrorAction SilentlyContinue | Out-Null
        Remove-Job -Job $smtpJob -Force -ErrorAction SilentlyContinue
    }

    if (-not $KeepArtifacts -and -not [string]::IsNullOrWhiteSpace($token)) {
        if ($campaignId -ne $null) {
            try {
                Invoke-Api -Method Delete -Path "api/campaigns/$campaignId" -Token $token | Out-Null
                Write-Host "Deleted temporary campaign: $campaignId"
            }
            catch {
                Write-Warning "Failed to delete temporary campaign ${campaignId}: $($_.Exception.Message)"
            }
        }

        if ($profileId -ne $null) {
            try {
                Invoke-Api -Method Delete -Path "api/transport-profiles/$profileId" -Token $token | Out-Null
                Write-Host "Deleted temporary SMTP profile: $profileId"
            }
            catch {
                Write-Warning "Failed to delete temporary SMTP profile ${profileId}: $($_.Exception.Message)"
            }
        }

        if (Test-Path -LiteralPath $smtpOutputPath -PathType Leaf) {
            Remove-Item -LiteralPath $smtpOutputPath -Force -ErrorAction SilentlyContinue
        }
    }
}

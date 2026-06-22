[CmdletBinding()]
param(
    [string]$ApiConfigPath,
    [string]$ConnectionString,
    [string]$ConnectionStringName = "MailingDb",
    [int]$CommandTimeoutSeconds = 30,
    [long]$MaxQueueDepth = -1,
    [long]$MaxFailedDispatchItems = -1,
    [switch]$RequireTransportProfile,
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Data

if ($MaxQueueDepth -lt -1) {
    throw "MaxQueueDepth must be -1 or greater."
}

if ($MaxFailedDispatchItems -lt -1) {
    throw "MaxFailedDispatchItems must be -1 or greater."
}

$expectedTables = @(
    "MailCampaign",
    "MailCampaignAttachment",
    "MailCampaignTargetOrganization",
    "MailDispatchBatch",
    "MailDispatchItem",
    "MailStoredFile",
    "MailTransportProfile"
)

$campaignStatusNames = @{
    "0" = "Draft"
    "1" = "Active"
    "2" = "Paused"
    "3" = "Completed"
    "4" = "Archived"
}

$dispatchStatusNames = @{
    "0" = "Queued"
    "1" = "Processing"
    "2" = "Sent"
    "3" = "Failed"
    "4" = "Cancelled"
    "5" = "Deferred"
}

function Get-ConnectionStringFromConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath,

        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
        throw "API config file was not found: $ConfigPath"
    }

    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if ($null -eq $config.ConnectionStrings) {
        throw "ConnectionStrings section was not found in $ConfigPath"
    }

    $property = $config.ConnectionStrings.PSObject.Properties[$Name]
    if ($null -eq $property -or [string]::IsNullOrWhiteSpace([string]$property.Value)) {
        throw "Connection string '$Name' was not found in $ConfigPath"
    }

    return [string]$property.Value
}

function ConvertFrom-XpoConnectionString {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    $parts = @()
    foreach ($part in ($Value -split ";")) {
        if ([string]::IsNullOrWhiteSpace($part)) {
            continue
        }

        $trimmed = $part.Trim()
        if ($trimmed -match "^\s*XpoProvider\s*=") {
            continue
        }

        if ($parts.Count -eq 0 -and $trimmed -notmatch "=") {
            continue
        }

        $parts += $trimmed
    }

    $sqlConnectionString = ($parts -join ";")
    if ([string]::IsNullOrWhiteSpace($sqlConnectionString)) {
        throw "Connection string does not contain SQL Server settings after removing XPO provider token."
    }

    return [System.Data.SqlClient.SqlConnectionStringBuilder]::new($sqlConnectionString)
}

function Test-ConnectionStringHasSqlSettings {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    foreach ($part in ($Value -split ";")) {
        if ([string]::IsNullOrWhiteSpace($part)) {
            continue
        }

        $trimmed = $part.Trim()
        if ($trimmed -match "^\s*XpoProvider\s*=") {
            continue
        }

        if ($trimmed -match "=") {
            return $true
        }
    }

    return $false
}

function Format-SqlStringLiteral {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return "'" + $Value.Replace("'", "''") + "'"
}

function Format-SqlName {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return "[" + $Value.Replace("]", "]]") + "]"
}

function Format-QualifiedTableName {
    param(
        [Parameter(Mandatory = $true)]
        [string]$SchemaName,

        [Parameter(Mandatory = $true)]
        [string]$TableName
    )

    return "$(Format-SqlName -Value $SchemaName).$(Format-SqlName -Value $TableName)"
}

function Invoke-SqlDataTable {
    param(
        [Parameter(Mandatory = $true)]
        [System.Data.SqlClient.SqlConnection]$Connection,

        [Parameter(Mandatory = $true)]
        [string]$CommandText
    )

    $command = $Connection.CreateCommand()
    $command.CommandText = $CommandText
    $command.CommandTimeout = $CommandTimeoutSeconds

    $table = New-Object System.Data.DataTable
    $reader = $command.ExecuteReader()
    try {
        $table.Load($reader)
    }
    finally {
        $reader.Dispose()
        $command.Dispose()
    }

    Write-Output -NoEnumerate $table
}

function Invoke-SqlScalar {
    param(
        [Parameter(Mandatory = $true)]
        [System.Data.SqlClient.SqlConnection]$Connection,

        [Parameter(Mandatory = $true)]
        [string]$CommandText
    )

    $command = $Connection.CreateCommand()
    $command.CommandText = $CommandText
    $command.CommandTimeout = $CommandTimeoutSeconds

    try {
        return $command.ExecuteScalar()
    }
    finally {
        $command.Dispose()
    }
}

function Convert-StatusCounts {
    param(
        [Parameter(Mandatory = $true)]
        [System.Data.DataTable]$Rows,

        [Parameter(Mandatory = $true)]
        [hashtable]$Names
    )

    $items = @()
    foreach ($row in $Rows.Rows) {
        $statusKey = [string]$row["Status"]
        $items += [pscustomobject]@{
            Status = [int]$row["Status"]
            Name = if ($Names.ContainsKey($statusKey)) { $Names[$statusKey] } else { "Unknown" }
            Count = [int64]$row["Count"]
        }
    }

    return $items
}

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    if ([string]::IsNullOrWhiteSpace($ApiConfigPath)) {
        throw "Specify either -ConnectionString or -ApiConfigPath."
    }

    $ConnectionString = Get-ConnectionStringFromConfig -ConfigPath $ApiConfigPath -Name $ConnectionStringName
    if (-not (Test-ConnectionStringHasSqlSettings -Value $ConnectionString) -and $ConnectionStringName -ne "LegacyDb") {
        $fallbackConnectionString = Get-ConnectionStringFromConfig -ConfigPath $ApiConfigPath -Name "LegacyDb"
        if (Test-ConnectionStringHasSqlSettings -Value $fallbackConnectionString) {
            Write-Host "Connection string '$ConnectionStringName' does not contain SQL Server settings. Falling back to 'LegacyDb'."
            $ConnectionString = $fallbackConnectionString
        }
    }
}

$builder = ConvertFrom-XpoConnectionString -Value $ConnectionString
$connection = New-Object System.Data.SqlClient.SqlConnection $builder.ConnectionString

try {
    $connection.Open()

    $expectedTableList = ($expectedTables | ForEach-Object { Format-SqlStringLiteral -Value $_ }) -join ", "
    $tableRows = Invoke-SqlDataTable -Connection $connection -CommandText @"
SELECT TABLE_SCHEMA, TABLE_NAME
FROM INFORMATION_SCHEMA.TABLES
WHERE TABLE_TYPE = 'BASE TABLE'
  AND TABLE_NAME IN ($expectedTableList)
ORDER BY TABLE_NAME;
"@

    $tableMap = @{}
    foreach ($row in $tableRows.Rows) {
        $tableMap[[string]$row["TABLE_NAME"]] = [pscustomobject]@{
            Schema = [string]$row["TABLE_SCHEMA"]
            Name = [string]$row["TABLE_NAME"]
        }
    }

    $missingTables = @($expectedTables | Where-Object { -not $tableMap.ContainsKey($_) })
    $tableSummaries = @()
    foreach ($tableName in $expectedTables) {
        if ($tableMap.ContainsKey($tableName)) {
            $tableInfo = $tableMap[$tableName]
            $count = Invoke-SqlScalar -Connection $connection -CommandText "SELECT COUNT_BIG(*) FROM $(Format-QualifiedTableName -SchemaName $tableInfo.Schema -TableName $tableInfo.Name);"
            $tableSummaries += [pscustomobject]@{
                Table = $tableName
                Schema = $tableInfo.Schema
                Exists = $true
                Count = [int64]$count
            }
        }
        else {
            $tableSummaries += [pscustomobject]@{
                Table = $tableName
                Schema = $null
                Exists = $false
                Count = $null
            }
        }
    }

    $transportProfiles = [pscustomobject]@{
        Total = 0
        Enabled = 0
        Default = 0
    }

    if ($tableMap.ContainsKey("MailTransportProfile")) {
        $tableInfo = $tableMap["MailTransportProfile"]
        $profileTable = Format-QualifiedTableName -SchemaName $tableInfo.Schema -TableName $tableInfo.Name
        $transportProfiles = [pscustomobject]@{
            Total = [int](Invoke-SqlScalar -Connection $connection -CommandText "SELECT COUNT_BIG(*) FROM $profileTable;")
            Enabled = [int](Invoke-SqlScalar -Connection $connection -CommandText "SELECT COUNT_BIG(*) FROM $profileTable WHERE [IsEnabled] = 1;")
            Default = [int](Invoke-SqlScalar -Connection $connection -CommandText "SELECT COUNT_BIG(*) FROM $profileTable WHERE [IsDefault] = 1;")
        }
    }

    $campaignCounts = @()
    if ($tableMap.ContainsKey("MailCampaign")) {
        $tableInfo = $tableMap["MailCampaign"]
        $campaignCounts = Convert-StatusCounts `
            -Rows (Invoke-SqlDataTable -Connection $connection -CommandText "SELECT [Status], COUNT_BIG(*) AS [Count] FROM $(Format-QualifiedTableName -SchemaName $tableInfo.Schema -TableName $tableInfo.Name) GROUP BY [Status] ORDER BY [Status];") `
            -Names $campaignStatusNames
    }

    $dispatchCounts = @()
    $queueDepth = 0
    $failedCount = 0
    $recentFailures = @()
    if ($tableMap.ContainsKey("MailDispatchItem")) {
        $tableInfo = $tableMap["MailDispatchItem"]
        $dispatchTable = Format-QualifiedTableName -SchemaName $tableInfo.Schema -TableName $tableInfo.Name

        $dispatchCounts = Convert-StatusCounts `
            -Rows (Invoke-SqlDataTable -Connection $connection -CommandText "SELECT [Status], COUNT_BIG(*) AS [Count] FROM $dispatchTable GROUP BY [Status] ORDER BY [Status];") `
            -Names $dispatchStatusNames

        $queueDepth = [int64](Invoke-SqlScalar -Connection $connection -CommandText "SELECT COUNT_BIG(*) FROM $dispatchTable WHERE [Status] IN (0, 1, 5);")
        $failedCount = [int64](Invoke-SqlScalar -Connection $connection -CommandText "SELECT COUNT_BIG(*) FROM $dispatchTable WHERE [Status] = 3;")

        $failureRows = Invoke-SqlDataTable -Connection $connection -CommandText @"
SELECT TOP (5)
    [Oid],
    [RecipientEmail],
    [LegacyOrgName],
    [AttemptCount],
    [ErrorMessage],
    [SmtpResponse],
    [FailedAtUtc]
FROM $dispatchTable
WHERE [Status] = 3
ORDER BY [FailedAtUtc] DESC, [Oid] DESC;
"@

        foreach ($row in $failureRows.Rows) {
            $recentFailures += [pscustomobject]@{
                Id = [int]$row["Oid"]
                RecipientEmail = [string]$row["RecipientEmail"]
                LegacyOrgName = [string]$row["LegacyOrgName"]
                AttemptCount = [int]$row["AttemptCount"]
                ErrorMessage = [string]$row["ErrorMessage"]
                SmtpResponse = [string]$row["SmtpResponse"]
                FailedAtUtc = $row["FailedAtUtc"]
            }
        }
    }

    $issues = @()
    if ($missingTables.Count -gt 0) {
        $issues += [pscustomobject]@{
            Code = "MissingTables"
            Message = "Missing mailing tables: $($missingTables -join ', ')"
        }
    }

    if ($RequireTransportProfile -and $transportProfiles.Total -lt 1) {
        $issues += [pscustomobject]@{
            Code = "MissingTransportProfile"
            Message = "No SMTP transport profiles found in MailTransportProfile."
        }
    }

    if ($MaxQueueDepth -ge 0 -and $queueDepth -gt $MaxQueueDepth) {
        $issues += [pscustomobject]@{
            Code = "QueueDepthExceeded"
            Message = "Queue depth $queueDepth exceeds configured limit $MaxQueueDepth."
        }
    }

    if ($MaxFailedDispatchItems -ge 0 -and $failedCount -gt $MaxFailedDispatchItems) {
        $issues += [pscustomobject]@{
            Code = "FailedDispatchItemsExceeded"
            Message = "Failed dispatch items $failedCount exceeds configured limit $MaxFailedDispatchItems."
        }
    }

    $status = if ($issues.Count -eq 0) { "ok" } else { "error" }

    $result = [pscustomobject]@{
        Status = $status
        CheckedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        Server = $builder.DataSource
        Database = $builder.InitialCatalog
        Issues = $issues
        Limits = [pscustomobject]@{
            MaxQueueDepth = $MaxQueueDepth
            MaxFailedDispatchItems = $MaxFailedDispatchItems
            RequireTransportProfile = [bool]$RequireTransportProfile
        }
        MissingTables = $missingTables
        Tables = $tableSummaries
        TransportProfiles = $transportProfiles
        CampaignsByStatus = $campaignCounts
        Dispatch = [pscustomobject]@{
            QueueDepth = $queueDepth
            FailedCount = $failedCount
            ByStatus = $dispatchCounts
            RecentFailures = $recentFailures
        }
    }

    if ($Json) {
        $result | ConvertTo-Json -Depth 8
    }
    else {
        Write-Host "Mailing DB check status: $($result.Status)"
        Write-Host "Server: $($result.Server)"
        Write-Host "Database: $($result.Database)"
        Write-Host "Missing tables: $(if ($missingTables.Count -eq 0) { 'none' } else { $missingTables -join ', ' })"
        Write-Host "Transport profiles: total=$($transportProfiles.Total), enabled=$($transportProfiles.Enabled), default=$($transportProfiles.Default)"
        Write-Host "Queue depth: $queueDepth"
        Write-Host "Failed dispatch items: $failedCount"
        Write-Host "Limits: maxQueueDepth=$MaxQueueDepth, maxFailedDispatchItems=$MaxFailedDispatchItems, requireTransportProfile=$([bool]$RequireTransportProfile)"
        Write-Host ""
        Write-Host "Table counts:"
        $tableSummaries | Format-Table -AutoSize

        if ($dispatchCounts.Count -gt 0) {
            Write-Host "Dispatch counts:"
            $dispatchCounts | Format-Table -AutoSize
        }

        if ($issues.Count -gt 0) {
            Write-Host "Issues:"
            $issues | Format-Table -AutoSize
        }
    }

    if ($issues.Count -gt 0) {
        $issueMessages = @($issues | ForEach-Object { $_.Message })
        throw "Mailing DB check failed: $($issueMessages -join '; ')"
    }

    $global:LASTEXITCODE = 0
}
finally {
    $connection.Dispose()
}

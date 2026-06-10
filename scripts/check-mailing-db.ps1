[CmdletBinding()]
param(
    [string]$ApiConfigPath,
    [string]$ConnectionString,
    [string]$ConnectionStringName = "MailingDb",
    [int]$CommandTimeoutSeconds = 30,
    [switch]$RequireTransportProfile,
    [switch]$Json
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Add-Type -AssemblyName System.Data

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

    $parts = $Value -split ";" |
        Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
        Where-Object { $_ -notmatch "^\s*XpoProvider\s*=" }

    $sqlConnectionString = ($parts -join ";")
    return [System.Data.SqlClient.SqlConnectionStringBuilder]::new($sqlConnectionString)
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

    $status = if ($missingTables.Count -eq 0) { "ok" } else { "error" }
    if ($RequireTransportProfile -and $transportProfiles.Total -lt 1) {
        $status = "error"
    }

    $result = [pscustomobject]@{
        Status = $status
        CheckedAtUtc = (Get-Date).ToUniversalTime().ToString("o")
        Server = $builder.DataSource
        Database = $builder.InitialCatalog
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
        Write-Host ""
        Write-Host "Table counts:"
        $tableSummaries | Format-Table -AutoSize

        if ($dispatchCounts.Count -gt 0) {
            Write-Host "Dispatch counts:"
            $dispatchCounts | Format-Table -AutoSize
        }
    }

    if ($missingTables.Count -gt 0) {
        throw "Missing mailing tables: $($missingTables -join ', ')"
    }

    if ($RequireTransportProfile -and $transportProfiles.Total -lt 1) {
        throw "No SMTP transport profiles found in MailTransportProfile."
    }

    $global:LASTEXITCODE = 0
}
finally {
    $connection.Dispose()
}

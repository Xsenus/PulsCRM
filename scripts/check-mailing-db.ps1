[CmdletBinding()]
param(
    [string]$ApiConfigPath,
    [string]$PublishedWebConfigPath,
    [string]$AppPoolName,
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

function New-ConnectionStringEntry {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Source,

        [Parameter(Mandatory = $true)]
        [string]$Name,

        [Parameter(Mandatory = $true)]
        [string]$Value
    )

    return [pscustomobject]@{
        Source = $Source
        Name = $Name
        Value = $Value
    }
}

function Get-ConnectionStringEntriesFromConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$ConfigPath
    )

    if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
        throw "API config file was not found: $ConfigPath"
    }

    $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
    if ($null -eq $config.ConnectionStrings) {
        throw "ConnectionStrings section was not found in $ConfigPath"
    }

    $entries = @()
    foreach ($property in $config.ConnectionStrings.PSObject.Properties) {
        $value = [string]$property.Value
        if (-not [string]::IsNullOrWhiteSpace($value)) {
            $entries += New-ConnectionStringEntry -Source "config:$ConfigPath" -Name $property.Name -Value $value
        }
    }

    return $entries
}

function Get-ConnectionStringEntriesFromNamedValues {
    param(
        [Parameter(Mandatory = $true)]
        [AllowEmptyCollection()]
        [object[]]$Variables,

        [Parameter(Mandatory = $true)]
        [string]$Source
    )

    $entries = @()
    foreach ($variable in $Variables) {
        $name = [string]$variable.Name
        $value = [string]$variable.Value
        if ([string]::IsNullOrWhiteSpace($name) -or [string]::IsNullOrWhiteSpace($value)) {
            continue
        }

        $connectionName = $null
        if ($name -match "^ConnectionStrings__(.+)$") {
            $connectionName = $Matches[1]
        }
        elseif ($name -match "^ConnectionStrings:(.+)$") {
            $connectionName = $Matches[1]
        }
        elseif ($name -match "^(?:SQLCONNSTR|SQLAZURECONNSTR|CUSTOMCONNSTR)_(.+)$") {
            $connectionName = $Matches[1]
        }

        if (-not [string]::IsNullOrWhiteSpace($connectionName)) {
            $entries += New-ConnectionStringEntry -Source $Source -Name $connectionName -Value $value
        }
    }

    return $entries
}

function Get-ConnectionStringEntriesFromEnvironment {
    $variables = @(Get-ChildItem Env:)
    return Get-ConnectionStringEntriesFromNamedValues -Variables $variables -Source "environment"
}

function Get-ConnectionStringEntriesFromWebConfig {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path
    )

    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
        return @()
    }

    [xml]$xml = Get-Content -LiteralPath $Path -Raw
    $variables = @()
    foreach ($node in @($xml.SelectNodes("//environmentVariable"))) {
        $variables += [pscustomobject]@{
            Name = [string]$node.name
            Value = [string]$node.value
        }
    }

    return Get-ConnectionStringEntriesFromNamedValues -Variables $variables -Source "web.config:$Path"
}

function Get-ConnectionStringEntriesFromIisAppPool {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $appCmdPath = Join-Path $env:windir "system32\inetsrv\appcmd.exe"
    if (-not (Test-Path -LiteralPath $appCmdPath -PathType Leaf)) {
        return @()
    }

    try {
        $xmlText = (& $appCmdPath list apppool $Name /config /xml) -join [Environment]::NewLine
        if ([string]::IsNullOrWhiteSpace($xmlText)) {
            return @()
        }

        [xml]$xml = $xmlText
        $variables = @()
        foreach ($node in @($xml.SelectNodes("//environmentVariable"))) {
            $variables += [pscustomobject]@{
                Name = [string]$node.name
                Value = [string]$node.value
            }
        }

        return Get-ConnectionStringEntriesFromNamedValues -Variables $variables -Source "iis-app-pool:$Name"
    }
    catch {
        Write-Warning "Could not read IIS app pool environment variables for '$Name': $($_.Exception.Message)"
        return @()
    }
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

    try {
        $builder = ConvertFrom-XpoConnectionString -Value $Value
        return -not [string]::IsNullOrWhiteSpace($builder.DataSource) -and
            -not [string]::IsNullOrWhiteSpace($builder.InitialCatalog)
    }
    catch {
        return $false
    }
}

function Select-ConnectionStringEntry {
    param(
        [Parameter(Mandatory = $true)]
        [object[]]$Entries,

        [Parameter(Mandatory = $true)]
        [string]$PreferredName
    )

    $orderedEntries = @()
    $preferredNames = @($PreferredName, "LegacyDb", "DefaultConnection", "Default")
    foreach ($name in ($preferredNames | Select-Object -Unique)) {
        $orderedEntries += @($Entries | Where-Object { [string]::Equals([string]$_.Name, $name, [StringComparison]::OrdinalIgnoreCase) })
    }

    $orderedEntries += @($Entries | Where-Object {
        $entryName = [string]$_.Name
        -not @($preferredNames | Where-Object { [string]::Equals($_, $entryName, [StringComparison]::OrdinalIgnoreCase) }).Count
    })

    $checked = @()
    foreach ($entry in $orderedEntries) {
        $label = "$($entry.Source):$($entry.Name)"
        $checked += $label
        if (Test-ConnectionStringHasSqlSettings -Value ([string]$entry.Value)) {
            return $entry
        }
    }

    $checkedLabel = if ($checked.Count -gt 0) { $checked -join ", " } else { "none" }
    throw "No SQL Server connection string with Data Source and Initial Catalog was found. Checked entries: $checkedLabel."
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
    $entries = @()
    if (-not [string]::IsNullOrWhiteSpace($ApiConfigPath)) {
        $entries += @(Get-ConnectionStringEntriesFromConfig -ConfigPath $ApiConfigPath)
    }

    $entries += @(Get-ConnectionStringEntriesFromEnvironment)

    if (-not [string]::IsNullOrWhiteSpace($PublishedWebConfigPath)) {
        $entries += @(Get-ConnectionStringEntriesFromWebConfig -Path $PublishedWebConfigPath)
    }

    if (-not [string]::IsNullOrWhiteSpace($AppPoolName)) {
        $entries += @(Get-ConnectionStringEntriesFromIisAppPool -Name $AppPoolName)
    }

    $selectedEntry = Select-ConnectionStringEntry -Entries $entries -PreferredName $ConnectionStringName
    Write-Host "Using connection string '$($selectedEntry.Name)' from $($selectedEntry.Source) for mailing DB check."
    $ConnectionString = [string]$selectedEntry.Value
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
        $campaignCounts = @(Convert-StatusCounts `
            -Rows (Invoke-SqlDataTable -Connection $connection -CommandText "SELECT [Status], COUNT_BIG(*) AS [Count] FROM $(Format-QualifiedTableName -SchemaName $tableInfo.Schema -TableName $tableInfo.Name) GROUP BY [Status] ORDER BY [Status];") `
            -Names $campaignStatusNames)
    }

    $dispatchCounts = @()
    $queueDepth = 0
    $failedCount = 0
    $recentFailures = @()
    if ($tableMap.ContainsKey("MailDispatchItem")) {
        $tableInfo = $tableMap["MailDispatchItem"]
        $dispatchTable = Format-QualifiedTableName -SchemaName $tableInfo.Schema -TableName $tableInfo.Name

        $dispatchCounts = @(Convert-StatusCounts `
            -Rows (Invoke-SqlDataTable -Connection $connection -CommandText "SELECT [Status], COUNT_BIG(*) AS [Count] FROM $dispatchTable GROUP BY [Status] ORDER BY [Status];") `
            -Names $dispatchStatusNames)

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

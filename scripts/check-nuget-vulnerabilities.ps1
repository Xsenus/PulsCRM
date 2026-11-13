[CmdletBinding()]
param(
    # Solution to scan. Ignored when -JsonPath is given.
    [string]$SolutionPath = "backend/PulsNextMailing.sln",

    # Existing output of `dotnet list package --vulnerable --include-transitive --format json`
    # (used by the self-test in CI; normally the script runs dotnet itself).
    [string]$JsonPath,

    # Lowest severity that fails the check. Lower severities are only reported as warnings.
    [ValidateSet("Low", "Moderate", "High", "Critical")]
    [string]$MinimumSeverity = "High"
)

# Fails (exit 1) when any direct or transitive NuGet package has a known vulnerability
# of $MinimumSeverity or higher. `dotnet list package --vulnerable` alone always exits 0,
# so without this gate vulnerable packages silently pass CI and deploy.

$ErrorActionPreference = "Stop"

$severityRank = @{ "Low" = 1; "Moderate" = 2; "High" = 3; "Critical" = 4 }
$threshold = $severityRank[$MinimumSeverity]

if ([string]::IsNullOrWhiteSpace($JsonPath)) {
    Write-Host "Scanning $SolutionPath for vulnerable NuGet packages (including transitive)..."
    # Only stdout is captured: with ErrorActionPreference=Stop, Windows PowerShell 5.1 would turn
    # any stderr line of a native command redirected with 2>&1 into a terminating error.
    $raw = & dotnet list $SolutionPath package --vulnerable --include-transitive --format json
    if ($LASTEXITCODE -ne 0) {
        Write-Host ($raw | Out-String)
        throw "dotnet list package failed with exit code $LASTEXITCODE."
    }

    $json = @($raw) -join [Environment]::NewLine
}
else {
    Write-Host "Reading vulnerability report from $JsonPath..."
    $json = Get-Content -LiteralPath $JsonPath -Raw
}

$start = $json.IndexOf("{")
if ($start -lt 0) {
    throw "Unexpected output of dotnet list package: JSON report not found."
}

$report = $json.Substring($start) | ConvertFrom-Json

$findings = @()
foreach ($project in @($report.projects)) {
    if ($null -eq $project) { continue }
    $projectName = [System.IO.Path]::GetFileNameWithoutExtension([string]$project.path)

    foreach ($framework in @($project.frameworks)) {
        if ($null -eq $framework) { continue }

        $groups = @(
            @{ Kind = "direct"; Packages = @($framework.topLevelPackages) },
            @{ Kind = "transitive"; Packages = @($framework.transitivePackages) }
        )

        foreach ($group in $groups) {
            foreach ($package in $group.Packages) {
                if ($null -eq $package) { continue }

                foreach ($vulnerability in @($package.vulnerabilities)) {
                    if ($null -eq $vulnerability) { continue }

                    $severity = [string]$vulnerability.severity
                    $rank = $severityRank[$severity]
                    if ($null -eq $rank) { $rank = 4 }

                    $findings += [pscustomobject]@{
                        Project   = $projectName
                        Framework = [string]$framework.framework
                        Package   = [string]$package.id
                        Version   = [string]$package.resolvedVersion
                        Kind      = $group.Kind
                        Severity  = $severity
                        Rank      = $rank
                        Advisory  = [string]$vulnerability.advisoryurl
                    }
                }
            }
        }
    }
}

if ($findings.Count -eq 0) {
    Write-Host "No vulnerable NuGet packages found."
    exit 0
}

$findings |
    Sort-Object -Property @{ Expression = "Rank"; Descending = $true }, Package, Project |
    Format-Table -AutoSize Severity, Package, Version, Kind, Project, Advisory |
    Out-String -Width 400 |
    Write-Host

$blocking = @($findings | Where-Object { $_.Rank -ge $threshold })
if ($blocking.Count -gt 0) {
    $packages = ($blocking | ForEach-Object { "$($_.Package) $($_.Version) ($($_.Severity))" } | Sort-Object -Unique) -join ", "
    Write-Host "::error::Vulnerable NuGet packages with severity $MinimumSeverity or higher: $packages. Update them (see advisories above)."
    exit 1
}

Write-Host "::warning::Vulnerable NuGet packages below $MinimumSeverity were found (see above). They do not fail the build, but should be updated."
exit 0

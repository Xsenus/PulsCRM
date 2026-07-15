using DevExpress.Xpo;
using PulsNext.Domain.Legacy;

namespace PulsNext.Infrastructure;

public interface IParusLicenseAnalyticsService
{
    Task<ParusLicenseAnalyticsDto> GetAsync(
        DateTime dateFromUtc,
        DateTime dateToUtc,
        string? groupSearch,
        string? groupStatus,
        int groupSkip,
        int groupTake,
        CancellationToken cancellationToken);
    Task<ParusLicenseFileDto?> GetLicenseFileAsync(int clientId, CancellationToken cancellationToken);
}

public sealed class ParusLicenseAnalyticsService(LegacyUnitOfWork legacyUnitOfWork) : IParusLicenseAnalyticsService
{
    public Task<ParusLicenseAnalyticsDto> GetAsync(
        DateTime dateFromUtc,
        DateTime dateToUtc,
        string? groupSearch,
        string? groupStatus,
        int groupSkip,
        int groupTake,
        CancellationToken cancellationToken)
    {
        var range = NormalizeRange(dateFromUtc, dateToUtc);
        var records = new XPQuery<LegacyZPParusLicenseInfo>(legacyUnitOfWork)
            .ToList()
            .Where(IsTargetProduct)
            .Select(ToRecord)
            .Where(record => record is not null)
            .Select(record => record!)
            .ToArray();

        var groups = records
            .GroupBy(record => record.GroupKey, StringComparer.OrdinalIgnoreCase)
            .Select(group => new LicenseGroup(group.Key, group.OrderBy(x => x.DateSinceUtc).ThenBy(x => x.DateToUtc).ThenBy(x => x.Id).ToArray()))
            .ToArray();

        var summary = BuildSummary(groups, range.From, range.To);
        var allOrganizationGroups = BuildOrganizationGroupRows(groups, range.From, range.To)
            .OrderBy(group => group.Group.DisplayClientName)
            .ThenBy(group => group.Group.DisplayBaseNumber, StringComparer.OrdinalIgnoreCase)
            .ToArray();
        var filteredOrganizationGroups = FilterOrganizationGroups(allOrganizationGroups, groupSearch, groupStatus, range.From, range.To).ToArray();
        var organizationGroups = filteredOrganizationGroups
            .Skip(Math.Max(0, groupSkip))
            .Take(NormalizeTake(groupTake))
            .Select(group => BuildOrganizationGroupDto(group, range.From, range.To))
            .ToArray();

        var periods = BuildYearRanges(range.From, range.To)
            .Select(yearRange =>
            {
                var periodSummary = BuildSummary(groups, yearRange.From, yearRange.To);
                return new ParusLicenseAnalyticsPeriodDto
                {
                    Year = yearRange.Year,
                    DateFromUtc = yearRange.From,
                    DateToUtc = yearRange.To,
                    LicenseGroups = periodSummary.LicenseGroups,
                    LicenseRecords = periodSummary.LicenseRecords,
                    Clients = periodSummary.Clients,
                    ActiveAtPeriodEnd = periodSummary.ActiveAtPeriodEnd,
                    ExpiredAtPeriodEnd = periodSummary.ExpiredAtPeriodEnd,
                    Renewed = periodSummary.Renewed,
                    WithoutRenewal = periodSummary.WithoutRenewal,
                    ExpiringInPeriod = periodSummary.ExpiringInPeriod,
                    NewLicenses = periodSummary.NewLicenses,
                    Lost = periodSummary.Lost
                };
            })
            .ToArray();

        return Task.FromResult(new ParusLicenseAnalyticsDto
        {
            DateFromUtc = range.From,
            DateToUtc = range.To,
            Summary = summary,
            Periods = periods,
            Products = Array.Empty<ParusLicenseAnalyticsProductDto>(),
            Groups = Array.Empty<ParusLicenseAnalyticsGroupDto>(),
            OrganizationGroupsTotalCount = filteredOrganizationGroups.Length,
            OrganizationGroups = organizationGroups
        });
    }

    public Task<ParusLicenseFileDto?> GetLicenseFileAsync(int clientId, CancellationToken cancellationToken)
    {
        var fileInfo = ResolveLicenseFile(clientId);
        if (fileInfo is null)
        {
            return Task.FromResult<ParusLicenseFileDto?>(null);
        }

        return Task.FromResult<ParusLicenseFileDto?>(new ParusLicenseFileDto
        {
            FileName = fileInfo.Value.FileName,
            ContentType = ResolveContentType(fileInfo.Value.FileName),
            Content = fileInfo.Value.Content
        });
    }

    private static (DateTime From, DateTime To) NormalizeRange(DateTime dateFromUtc, DateTime dateToUtc)
    {
        var from = dateFromUtc.Date;
        var to = dateToUtc.Date;

        if (from == DateTime.MinValue.Date)
        {
            from = new DateTime(DateTime.UtcNow.Year, 1, 1);
        }

        if (to == DateTime.MinValue.Date)
        {
            to = new DateTime(from.Year, 12, 31);
        }

        if (to < from)
        {
            (from, to) = (to, from);
        }

        return (DateTime.SpecifyKind(from, DateTimeKind.Utc), DateTime.SpecifyKind(to, DateTimeKind.Utc));
    }

    private static bool IsTargetProduct(LegacyZPParusLicenseInfo license)
    {
        var source = $"{license.Nomenclature} {license.Modification}";
        return source.Contains("Парус 10", StringComparison.OrdinalIgnoreCase)
            || source.Contains("Парус10", StringComparison.OrdinalIgnoreCase)
            || source.Contains("PARUS 10", StringComparison.OrdinalIgnoreCase)
            || source.Contains("PARUS10", StringComparison.OrdinalIgnoreCase)
            || source.Contains("Торнадо", StringComparison.OrdinalIgnoreCase)
            || source.Contains("Tornado", StringComparison.OrdinalIgnoreCase);
    }

    private static LicenseRecord? ToRecord(LegacyZPParusLicenseInfo license)
    {
        var dateSince = NullIfMin(license.DateSince);
        var dateTo = NullIfMin(license.DateTo);
        if (dateSince is null || dateTo is null)
        {
            return null;
        }

        var clientId = license.Org?.Oid ?? 0;
        var clientName = license.Org?.Name ?? license.Org?.FullName ?? license.MnemoOrg ?? "Без организации";
        var baseNumber = ResolveBaseLicenseNumber(license);
        var number = FirstNotEmpty(license.RegNumberAbonement, license.RegNumberClient, baseNumber, license.Oid.ToString());
        var groupKey = $"{clientId}:{baseNumber.ToUpperInvariant()}";
        var otherInfo = license.Org?.OrgInfoOther;

        return new LicenseRecord(
            license.Oid,
            groupKey.Trim().ToUpperInvariant(),
            number.Trim(),
            baseNumber,
            clientId,
            clientName,
            NullIfWhiteSpace(license.INN),
            NullIfWhiteSpace(license.MnemoOrg),
            NullIfWhiteSpace(license.Payer),
            NullIfWhiteSpace(license.RegNumberClient),
            NullIfWhiteSpace(license.RegNumberAbonement),
            NullIfWhiteSpace(license.Number),
            NullIfWhiteSpace(otherInfo?.ZpLicSostav),
            Math.Max(0, otherInfo?.ZpNumOfBases ?? 0),
            Math.Max(0, otherInfo?.CountOrganizationsInDataBases ?? 0),
            Math.Max(0, otherInfo?.ZpNumDopPlaces ?? 0),
            dateSince.Value,
            dateTo.Value,
            NullIfWhiteSpace(license.Nomenclature),
            NullIfWhiteSpace(license.Modification),
            ResolveProductName(license));
    }

    private static string ResolveProductName(LegacyZPParusLicenseInfo license)
    {
        var source = FirstNotEmpty(license.Modification, license.Nomenclature, "Парус");
        if (source.Contains("Торнадо", StringComparison.OrdinalIgnoreCase) || source.Contains("Tornado", StringComparison.OrdinalIgnoreCase))
        {
            return "Парус Торнадо";
        }

        if (source.Contains("Парус 10", StringComparison.OrdinalIgnoreCase) || source.Contains("Парус10", StringComparison.OrdinalIgnoreCase))
        {
            return "Парус 10";
        }

        if (source.Contains("PARUS 10", StringComparison.OrdinalIgnoreCase) || source.Contains("PARUS10", StringComparison.OrdinalIgnoreCase))
        {
            return "Парус 10";
        }

        return source;
    }

    private static ParusLicenseAnalyticsSummaryDto BuildSummary(IReadOnlyCollection<LicenseGroup> groups, DateTime from, DateTime to)
    {
        var activeGroups = groups.Where(group => HasPeriodActivity(group, from, to)).ToArray();

        return new ParusLicenseAnalyticsSummaryDto
        {
            LicenseGroups = activeGroups.Length,
            LicenseRecords = activeGroups.Sum(group => group.Records.Count(record => Overlaps(record, from, to))),
            Clients = activeGroups.Select(group => group.ClientId).Distinct().Count(),
            ActiveAtPeriodEnd = activeGroups.Count(group => IsActiveAt(group, to)),
            ExpiredAtPeriodEnd = activeGroups.Count(group => IsExpiredAtPeriodEnd(group, to)),
            Renewed = activeGroups.Count(group => HasRenewalInPeriod(group, from, to)),
            WithoutRenewal = activeGroups.Count(group => IsWithoutRenewalInPeriod(group, from, to)),
            ExpiringInPeriod = activeGroups.Count(group => IsFinalExpirationInPeriod(group, from, to)),
            NewLicenses = activeGroups.Count(group => IsNewInPeriod(group, from, to)),
            Lost = activeGroups.Count(group => IsLostInPeriod(group, from, to))
        };
    }

    private static IEnumerable<OrganizationGroupRow> BuildOrganizationGroupRows(IReadOnlyCollection<LicenseGroup> groups, DateTime from, DateTime to)
    {
        foreach (var lifecycleGroup in groups.Where(group => HasPeriodActivity(group, from, to)))
        {
            var periodGroups = BuildPeriodRecordGroups(lifecycleGroup, from, to).ToArray();
            var latest = lifecycleGroup.Records
                .Where(record => Overlaps(record, from, to))
                .OrderByDescending(record => record.DateToUtc)
                .ThenByDescending(record => record.DateSinceUtc)
                .First();

            yield return new OrganizationGroupRow(
                lifecycleGroup,
                latest,
                lifecycleGroup.Records
                    .Select(record => record.LicenseComposition)
                    .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)),
                lifecycleGroup.Records.Max(record => record.DatabaseCount),
                lifecycleGroup.Records.Max(record => record.OrganizationCount),
                lifecycleGroup.Records.Max(record => record.ExtraWorkplaces),
                periodGroups.Length,
                periodGroups.Sum(period => period.Length),
                IsActiveAt(lifecycleGroup, to),
                IsExpiredAtPeriodEnd(lifecycleGroup, to),
                HasRenewalInPeriod(lifecycleGroup, from, to),
                IsWithoutRenewalInPeriod(lifecycleGroup, from, to),
                IsFinalExpirationInPeriod(lifecycleGroup, from, to),
                IsNewInPeriod(lifecycleGroup, from, to),
                IsLostInPeriod(lifecycleGroup, from, to));
        }
    }

    private ParusLicenseAnalyticsOrganizationGroupDto BuildOrganizationGroupDto(OrganizationGroupRow row, DateTime from, DateTime to)
    {
        var fileInfo = ResolveLicenseFile(row.Group.ClientId);
        var periodDtos = BuildPeriodRecordGroups(row.Group, from, to)
            .OrderByDescending(group => group.Max(record => record.DateToUtc))
            .ThenByDescending(group => group.Max(record => record.DateSinceUtc))
            .ThenBy(group => group.First().PeriodNumber, StringComparer.OrdinalIgnoreCase)
            .Select(periodGroup =>
            {
                var components = periodGroup
                    .OrderBy(record => record.Number, StringComparer.OrdinalIgnoreCase)
                    .ThenBy(record => record.Modification, StringComparer.OrdinalIgnoreCase)
                    .Select(ToComponentDto)
                    .ToArray();
                var first = periodGroup.First();

                return new ParusLicenseAnalyticsLicensePeriodDto
                {
                    Key = $"{row.Group.Key}:{first.PeriodNumber.ToUpperInvariant()}:{first.DateSinceUtc:yyyyMMdd}:{first.DateToUtc:yyyyMMdd}",
                    LicenseNumber = first.PeriodNumber,
                    DateSinceUtc = first.DateSinceUtc,
                    DateToUtc = first.DateToUtc,
                    ComponentsCount = components.Length,
                    ActiveAtPeriodEnd = first.DateSinceUtc <= to && first.DateToUtc >= to,
                    ExpiredAtPeriodEnd = first.DateToUtc < to,
                    HasLicenseFile = fileInfo is not null,
                    LicenseFileName = fileInfo?.FileName,
                    Components = components
                };
            })
            .ToArray();

        return new ParusLicenseAnalyticsOrganizationGroupDto
        {
            Key = row.Group.Key,
            ClientId = row.Group.ClientId,
            ClientName = row.Group.DisplayClientName,
            Inn = row.Latest.Inn,
            MnemoOrg = row.Latest.MnemoOrg,
            LicenseNumber = row.Group.DisplayBaseNumber,
            LicenseComposition = row.LicenseComposition,
            DatabaseCount = row.DatabaseCount,
            OrganizationCount = row.OrganizationCount,
            ExtraWorkplaces = row.ExtraWorkplaces,
            PeriodsCount = row.PeriodsCount,
            ComponentsCount = row.ComponentsCount,
            ActiveAtPeriodEnd = row.ActiveAtPeriodEnd,
            ExpiredAtPeriodEnd = row.ExpiredAtPeriodEnd,
            RenewedInPeriod = row.RenewedInPeriod,
            WithoutRenewal = row.WithoutRenewal,
            ExpiringInPeriod = row.ExpiringInPeriod,
            NewInPeriod = row.NewInPeriod,
            LostInPeriod = row.LostInPeriod,
            Periods = periodDtos
        };
    }

    private static LicenseRecord[][] BuildPeriodRecordGroups(LicenseGroup lifecycleGroup, DateTime from, DateTime to)
        => lifecycleGroup.Records
            .Where(record => Overlaps(record, from, to))
            .GroupBy(record => $"{record.PeriodNumber.ToUpperInvariant()}|{record.DateSinceUtc:yyyyMMdd}|{record.DateToUtc:yyyyMMdd}", StringComparer.OrdinalIgnoreCase)
            .Select(group => group.ToArray())
            .ToArray();

    private static IEnumerable<OrganizationGroupRow> FilterOrganizationGroups(
        IEnumerable<OrganizationGroupRow> groups,
        string? search,
        string? status,
        DateTime from,
        DateTime to)
    {
        var result = groups;
        var normalizedStatus = NormalizeGroupStatus(status);
        if (!string.IsNullOrWhiteSpace(normalizedStatus) && normalizedStatus != "all")
        {
            result = result.Where(group => MatchesStatus(group, normalizedStatus));
        }

        var term = NullIfWhiteSpace(search);
        if (!string.IsNullOrWhiteSpace(term))
        {
            result = result.Where(group => BuildGroupSearchText(group, from, to).Contains(term, StringComparison.OrdinalIgnoreCase));
        }

        return result;
    }

    private static string NormalizeGroupStatus(string? status)
        => NullIfWhiteSpace(status)?.Trim().ToLowerInvariant() ?? "all";

    private static bool MatchesStatus(OrganizationGroupRow group, string status)
        => status switch
        {
            "active" => group.ActiveAtPeriodEnd,
            "expired" => group.ExpiredAtPeriodEnd,
            "renewed" => group.RenewedInPeriod,
            "without-renewal" => group.WithoutRenewal,
            "expiring" => group.ExpiringInPeriod,
            "new" => group.NewInPeriod,
            "lost" => group.LostInPeriod,
            _ => true
        };

    private static string BuildGroupSearchText(OrganizationGroupRow group, DateTime from, DateTime to)
    {
        var values = new List<string?>
        {
            group.Group.DisplayClientName,
            group.Latest.Inn,
            group.Latest.MnemoOrg,
            group.Group.DisplayBaseNumber,
            group.LicenseComposition
        };

        foreach (var record in group.Group.Records.Where(record => Overlaps(record, from, to)))
        {
            values.Add(record.PeriodNumber);
            values.Add(record.Number);
            values.Add(record.RegNumberAbonement);
            values.Add(record.RegNumberClient);
            values.Add(record.Nomenclature);
            values.Add(record.Modification);
            values.Add(record.Product);
        }

        return string.Join(' ', values.Where(value => !string.IsNullOrWhiteSpace(value)));
    }

    private static int NormalizeTake(int take)
        => Math.Clamp(take <= 0 ? 10 : take, 1, 100);

    private static ParusLicenseAnalyticsComponentDto ToComponentDto(LicenseRecord record)
    {
        return new ParusLicenseAnalyticsComponentDto
        {
            Id = record.Id,
            Number = record.Number,
            Quantity = record.Quantity,
            RegNumberAbonement = record.RegNumberAbonement,
            RegNumberClient = record.RegNumberClient,
            Nomenclature = record.Nomenclature,
            Modification = record.Modification,
            Product = record.Product
        };
    }

    private static bool HasPeriodActivity(LicenseGroup group, DateTime from, DateTime to)
        => group.Records.Any(record => Overlaps(record, from, to));

    private static bool Overlaps(LicenseRecord record, DateTime from, DateTime to)
        => record.DateSinceUtc <= to && record.DateToUtc >= from;

    private static bool IsActiveAt(LicenseGroup group, DateTime date)
        => group.Records.Any(record => record.DateSinceUtc <= date && record.DateToUtc >= date);

    private static bool IsExpiredAtPeriodEnd(LicenseGroup group, DateTime to)
        => GetLifecyclePeriods(group).Max(record => record.DateToUtc) < to;

    private static bool HasRenewalInPeriod(LicenseGroup group, DateTime from, DateTime to)
        => GetLifecyclePeriods(group)
            .Select((record, index) => new { record, index })
            .Any(item => item.index > 0 && item.record.DateSinceUtc >= from && item.record.DateSinceUtc <= to);

    private static bool IsWithoutRenewalInPeriod(LicenseGroup group, DateTime from, DateTime to)
    {
        var latest = GetLifecyclePeriods(group).OrderBy(record => record.DateToUtc).ThenBy(record => record.DateSinceUtc).Last();
        return latest.DateToUtc >= from && latest.DateToUtc <= to;
    }

    private static bool IsLostInPeriod(LicenseGroup group, DateTime from, DateTime to)
        => IsWithoutRenewalInPeriod(group, from, to);

    private static bool IsFinalExpirationInPeriod(LicenseGroup group, DateTime from, DateTime to)
        => IsWithoutRenewalInPeriod(group, from, to);

    private static bool IsNewInPeriod(LicenseGroup group, DateTime from, DateTime to)
    {
        var first = GetLifecyclePeriods(group).OrderBy(record => record.DateSinceUtc).ThenBy(record => record.Id).First();
        return first.DateSinceUtc >= from && first.DateSinceUtc <= to;
    }

    private static LicenseRecord[] GetLifecyclePeriods(LicenseGroup group)
        => group.Records
            .GroupBy(record => $"{record.PeriodNumber.ToUpperInvariant()}|{record.DateSinceUtc:yyyyMMdd}|{record.DateToUtc:yyyyMMdd}", StringComparer.OrdinalIgnoreCase)
            .Select(periodGroup => periodGroup.OrderBy(record => record.Id).First())
            .OrderBy(record => record.DateSinceUtc)
            .ThenBy(record => record.DateToUtc)
            .ThenBy(record => record.PeriodNumber, StringComparer.OrdinalIgnoreCase)
            .ToArray();

    private static IEnumerable<(int Year, DateTime From, DateTime To)> BuildYearRanges(DateTime from, DateTime to)
    {
        for (var year = from.Year; year <= to.Year; year += 1)
        {
            var yearFrom = new DateTime(year, 1, 1);
            var yearTo = new DateTime(year, 12, 31);

            yield return (
                year,
                DateTime.SpecifyKind(from > yearFrom ? from : yearFrom, DateTimeKind.Utc),
                DateTime.SpecifyKind(to < yearTo ? to : yearTo, DateTimeKind.Utc));
        }
    }

    private static DateTime? NullIfMin(DateTime value)
        => value == DateTime.MinValue ? null : DateTime.SpecifyKind(value.Date, DateTimeKind.Utc);

    private static string FirstNotEmpty(params string?[] values)
        => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? string.Empty;

    private static string? NullIfWhiteSpace(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string ResolveBaseLicenseNumber(LegacyZPParusLicenseInfo license)
    {
        var clientNumber = NullIfWhiteSpace(license.RegNumberClient);
        if (!string.IsNullOrWhiteSpace(clientNumber))
        {
            return NormalizeBaseLicenseNumber(clientNumber);
        }

        return NormalizeBaseLicenseNumber(FirstNotEmpty(license.RegNumberAbonement, license.INN, license.Oid.ToString()));
    }

    private (string FileName, byte[] Content)? ResolveLicenseFile(int clientId)
        => ResolveLicenseFile(legacyUnitOfWork.GetObjectByKey<LegacyOrg>(clientId));

    private static (string FileName, byte[] Content)? ResolveLicenseFile(LegacyOrg? org)
    {
        if (org is null)
        {
            return null;
        }

        var ownFile = ResolveLicenseFile(org.OrgInfoOther);
        if (ownFile is not null)
        {
            return ownFile;
        }

        return ResolveLicenseFile(org.OrgInfoOther?.OrgParusLicense?.OrgInfoOther);
    }

    private static (string FileName, byte[] Content)? ResolveLicenseFile(LegacyOrgInfoOther? other)
    {
        if (other?.ParusLicenseFileData is null || other.ParusLicenseFileData.Length == 0)
        {
            return null;
        }

        var fileName = NullIfWhiteSpace(other.ParusLicenseFileName) ?? "parus-license.dat";
        return (fileName, other.ParusLicenseFileData);
    }

    private static string ResolveContentType(string fileName)
        => Path.GetExtension(fileName).ToLowerInvariant() switch
        {
            ".pdf" => "application/pdf",
            ".zip" => "application/zip",
            ".rar" => "application/vnd.rar",
            ".txt" => "text/plain",
            ".lic" => "application/octet-stream",
            _ => "application/octet-stream"
        };

    private static string NormalizeBaseLicenseNumber(string value)
    {
        var trimmed = value.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return string.Empty;
        }

        var withoutSpaces = new string(trimmed.Where(ch => !char.IsWhiteSpace(ch)).ToArray());
        var parts = withoutSpaces.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        return parts.Length >= 2 ? $"{parts[0]}{parts[1]}" : withoutSpaces.Replace("-", string.Empty);
    }

    private sealed record LicenseRecord(
        int Id,
        string GroupKey,
        string Number,
        string BaseNumber,
        int ClientId,
        string ClientName,
        string? Inn,
        string? MnemoOrg,
        string? Payer,
        string? RegNumberClient,
        string? RegNumberAbonement,
        string? Quantity,
        string? LicenseComposition,
        int DatabaseCount,
        int OrganizationCount,
        int ExtraWorkplaces,
        DateTime DateSinceUtc,
        DateTime DateToUtc,
        string? Nomenclature,
        string? Modification,
        string Product)
    {
        public string PeriodNumber => FirstNotEmpty(RegNumberAbonement, BaseNumber, GroupKey);
    }

    private sealed record LicenseGroup(string Key, IReadOnlyList<LicenseRecord> Records)
    {
        public int ClientId => Records.First().ClientId;
        public string DisplayClientName => Records.First().ClientName;
        public string DisplayBaseNumber => FirstNotEmpty(Records.First().BaseNumber, Key);
        public string DisplayNumber => FirstNotEmpty(Records.First().RegNumberAbonement, Records.First().Number, Key);
    }

    private sealed record OrganizationGroupRow(
        LicenseGroup Group,
        LicenseRecord Latest,
        string? LicenseComposition,
        int DatabaseCount,
        int OrganizationCount,
        int ExtraWorkplaces,
        int PeriodsCount,
        int ComponentsCount,
        bool ActiveAtPeriodEnd,
        bool ExpiredAtPeriodEnd,
        bool RenewedInPeriod,
        bool WithoutRenewal,
        bool ExpiringInPeriod,
        bool NewInPeriod,
        bool LostInPeriod);
}

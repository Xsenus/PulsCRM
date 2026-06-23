using DevExpress.Xpo;
using PulsNext.Domain.Legacy;

namespace PulsNext.Infrastructure;

public interface IParusLicenseAnalyticsService
{
    Task<ParusLicenseAnalyticsDto> GetAsync(DateTime dateFromUtc, DateTime dateToUtc, CancellationToken cancellationToken);
    Task<ParusLicenseFileDto?> GetLicenseFileAsync(int clientId, CancellationToken cancellationToken);
}

public sealed class ParusLicenseAnalyticsService(LegacyUnitOfWork legacyUnitOfWork) : IParusLicenseAnalyticsService
{
    public Task<ParusLicenseAnalyticsDto> GetAsync(DateTime dateFromUtc, DateTime dateToUtc, CancellationToken cancellationToken)
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
        var analyticsGroups = BuildPeriodGroups(groups, range.From, range.To)
            .OrderBy(group => group.ClientName)
            .ThenBy(group => group.Number, StringComparer.OrdinalIgnoreCase)
            .ThenBy(group => group.FirstDateSinceUtc)
            .ToArray();
        var organizationGroups = BuildOrganizationGroups(groups, range.From, range.To)
            .OrderBy(group => group.ClientName)
            .ThenBy(group => group.LicenseNumber, StringComparer.OrdinalIgnoreCase)
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

        var products = BuildProductSummary(groups, range.From, range.To);

        return Task.FromResult(new ParusLicenseAnalyticsDto
        {
            DateFromUtc = range.From,
            DateToUtc = range.To,
            Summary = summary,
            Periods = periods,
            Products = products,
            Groups = analyticsGroups,
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
        var number = FirstNotEmpty(license.RegNumberAbonement, license.Number, license.RegNumberClient, baseNumber, license.Oid.ToString());
        var groupNumber = ResolveLicenseGroupNumber(license, number);
        var groupKey = $"{clientId}:{groupNumber}";

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
            ExpiringInPeriod = activeGroups.Count(group => HasExpirationInPeriod(group, from, to)),
            NewLicenses = activeGroups.Count(group => IsNewInPeriod(group, from, to)),
            Lost = activeGroups.Count(group => IsLostInPeriod(group, from, to))
        };
    }

    private static ParusLicenseAnalyticsProductDto[] BuildProductSummary(IReadOnlyCollection<LicenseGroup> groups, DateTime from, DateTime to)
    {
        return groups
            .Where(group => HasPeriodActivity(group, from, to))
            .GroupBy(group => ResolveGroupProduct(group, from, to))
            .Select(group => new ParusLicenseAnalyticsProductDto
            {
                Name = group.Key,
                LicenseGroups = group.Count(),
                LicenseRecords = group.Sum(item => item.Records.Count(record => Overlaps(record, from, to))),
                Clients = group.Select(item => item.ClientId).Distinct().Count(),
                ActiveAtPeriodEnd = group.Count(item => IsActiveAt(item, to)),
                ExpiredAtPeriodEnd = group.Count(item => IsExpiredAtPeriodEnd(item, to)),
                Renewed = group.Count(item => HasRenewalInPeriod(item, from, to)),
                WithoutRenewal = group.Count(item => IsWithoutRenewalInPeriod(item, from, to)),
                Lost = group.Count(item => IsLostInPeriod(item, from, to))
            })
            .OrderBy(x => x.Name, StringComparer.OrdinalIgnoreCase)
            .ToArray();
    }

    private static string ResolveGroupProduct(LicenseGroup group, DateTime from, DateTime to)
        => group.Records
            .Where(record => Overlaps(record, from, to))
            .OrderByDescending(record => record.DateToUtc)
            .ThenByDescending(record => record.DateSinceUtc)
            .Select(record => record.Product)
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value)) ?? "Без продукта";

    private static IEnumerable<ParusLicenseAnalyticsGroupDto> BuildPeriodGroups(IReadOnlyCollection<LicenseGroup> groups, DateTime from, DateTime to)
    {
        foreach (var lifecycleGroup in groups.Where(group => HasPeriodActivity(group, from, to)))
        {
            var periodGroups = lifecycleGroup.Records
                .Where(record => Overlaps(record, from, to))
                .GroupBy(record => $"{record.Number.ToUpperInvariant()}|{record.DateSinceUtc:yyyyMMdd}|{record.DateToUtc:yyyyMMdd}", StringComparer.OrdinalIgnoreCase);

            foreach (var periodGroup in periodGroups)
            {
                yield return ToGroupDto(lifecycleGroup, periodGroup.ToArray(), from, to);
            }
        }
    }

    private IEnumerable<ParusLicenseAnalyticsOrganizationGroupDto> BuildOrganizationGroups(IReadOnlyCollection<LicenseGroup> groups, DateTime from, DateTime to)
    {
        foreach (var lifecycleGroup in groups.Where(group => HasPeriodActivity(group, from, to)))
        {
            var fileInfo = ResolveLicenseFile(lifecycleGroup.ClientId);
            var periodDtos = lifecycleGroup.Records
                .Where(record => Overlaps(record, from, to))
                .GroupBy(record => $"{record.DateSinceUtc:yyyyMMdd}|{record.DateToUtc:yyyyMMdd}")
                .OrderByDescending(group => group.Key)
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
                        Key = $"{lifecycleGroup.Key}:{first.DateSinceUtc:yyyyMMdd}:{first.DateToUtc:yyyyMMdd}",
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

            var latest = lifecycleGroup.Records
                .Where(record => Overlaps(record, from, to))
                .OrderByDescending(record => record.DateToUtc)
                .ThenByDescending(record => record.DateSinceUtc)
                .First();

            yield return new ParusLicenseAnalyticsOrganizationGroupDto
            {
                Key = lifecycleGroup.Key,
                ClientId = lifecycleGroup.ClientId,
                ClientName = lifecycleGroup.DisplayClientName,
                Inn = latest.Inn,
                MnemoOrg = latest.MnemoOrg,
                LicenseNumber = lifecycleGroup.DisplayNumber,
                PeriodsCount = periodDtos.Length,
                ComponentsCount = periodDtos.Sum(period => period.ComponentsCount),
                ActiveAtPeriodEnd = IsActiveAt(lifecycleGroup, to),
                ExpiredAtPeriodEnd = IsExpiredAtPeriodEnd(lifecycleGroup, to),
                RenewedInPeriod = HasRenewalInPeriod(lifecycleGroup, from, to),
                WithoutRenewal = IsWithoutRenewalInPeriod(lifecycleGroup, from, to),
                Periods = periodDtos
            };
        }
    }

    private static ParusLicenseAnalyticsComponentDto ToComponentDto(LicenseRecord record)
    {
        return new ParusLicenseAnalyticsComponentDto
        {
            Id = record.Id,
            Number = record.Number,
            RegNumberAbonement = record.RegNumberAbonement,
            RegNumberClient = record.RegNumberClient,
            Nomenclature = record.Nomenclature,
            Modification = record.Modification,
            Product = record.Product
        };
    }

    private static ParusLicenseAnalyticsGroupDto ToGroupDto(LicenseGroup lifecycleGroup, IReadOnlyCollection<LicenseRecord> periodRecords, DateTime from, DateTime to)
    {
        var latest = periodRecords
            .OrderBy(record => record.DateToUtc)
            .ThenBy(record => record.DateSinceUtc)
            .Last();

        return new ParusLicenseAnalyticsGroupDto
        {
            Key = $"{lifecycleGroup.Key}:{latest.DateSinceUtc:yyyyMMdd}:{latest.DateToUtc:yyyyMMdd}",
            Number = latest.Number,
            Nomenclature = latest.Nomenclature,
            Modification = latest.Modification,
            Product = latest.Product,
            ClientId = lifecycleGroup.ClientId,
            ClientName = lifecycleGroup.DisplayClientName,
            Inn = latest.Inn,
            MnemoOrg = latest.MnemoOrg,
            Payer = latest.Payer,
            RegNumberClient = latest.RegNumberClient,
            RegNumberAbonement = latest.RegNumberAbonement,
            FirstDateSinceUtc = latest.DateSinceUtc,
            LastDateToUtc = latest.DateToUtc,
            Records = periodRecords.Count,
            ActiveAtPeriodEnd = periodRecords.Any(record => record.DateSinceUtc <= to && record.DateToUtc >= to),
            ExpiredAtPeriodEnd = periodRecords.All(record => record.DateToUtc < to),
            RenewedInPeriod = HasRenewalInPeriod(lifecycleGroup, from, to),
            WithoutRenewal = IsWithoutRenewalInPeriod(lifecycleGroup, from, to)
        };
    }

    private static bool HasPeriodActivity(LicenseGroup group, DateTime from, DateTime to)
        => group.Records.Any(record => Overlaps(record, from, to));

    private static bool Overlaps(LicenseRecord record, DateTime from, DateTime to)
        => record.DateSinceUtc <= to && record.DateToUtc >= from;

    private static bool IsActiveAt(LicenseGroup group, DateTime date)
        => group.Records.Any(record => record.DateSinceUtc <= date && record.DateToUtc >= date);

    private static bool IsExpiredAtPeriodEnd(LicenseGroup group, DateTime to)
        => group.Records.Max(record => record.DateToUtc) < to;

    private static bool HasRenewalInPeriod(LicenseGroup group, DateTime from, DateTime to)
        => group.Records
            .Select((record, index) => new { record, index })
            .Any(item => item.index > 0 && item.record.DateSinceUtc >= from && item.record.DateSinceUtc <= to);

    private static bool IsWithoutRenewalInPeriod(LicenseGroup group, DateTime from, DateTime to)
    {
        var latest = group.Records.OrderBy(record => record.DateToUtc).ThenBy(record => record.DateSinceUtc).Last();
        return latest.DateToUtc >= from && latest.DateToUtc <= to;
    }

    private static bool IsLostInPeriod(LicenseGroup group, DateTime from, DateTime to)
        => IsWithoutRenewalInPeriod(group, from, to);

    private static bool HasExpirationInPeriod(LicenseGroup group, DateTime from, DateTime to)
        => group.Records.Any(record => record.DateToUtc >= from && record.DateToUtc <= to);

    private static bool IsNewInPeriod(LicenseGroup group, DateTime from, DateTime to)
    {
        var first = group.Records.OrderBy(record => record.DateSinceUtc).ThenBy(record => record.Id).First();
        return first.DateSinceUtc >= from && first.DateSinceUtc <= to;
    }

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

        return NormalizeBaseLicenseNumber(FirstNotEmpty(license.RegNumberAbonement, license.Number, license.INN, license.Oid.ToString()));
    }

    private static string ResolveLicenseGroupNumber(LegacyZPParusLicenseInfo license, string displayNumber)
    {
        var fullNumber = FirstNotEmpty(license.RegNumberAbonement, license.Number, displayNumber, license.RegNumberClient, license.Oid.ToString());
        return NormalizeLicenseGroupNumber(fullNumber);
    }

    private static string NormalizeLicenseGroupNumber(string value)
    {
        var trimmed = value.Trim();
        if (string.IsNullOrWhiteSpace(trimmed))
        {
            return string.Empty;
        }

        return new string(trimmed
            .Where(ch => !char.IsWhiteSpace(ch) && ch != '-')
            .Select(char.ToUpperInvariant)
            .ToArray());
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
        DateTime DateSinceUtc,
        DateTime DateToUtc,
        string? Nomenclature,
        string? Modification,
        string Product);

    private sealed record LicenseGroup(string Key, IReadOnlyList<LicenseRecord> Records)
    {
        public int ClientId => Records.First().ClientId;
        public string DisplayClientName => Records.First().ClientName;
        public string DisplayBaseNumber => FirstNotEmpty(Records.First().BaseNumber, Key);
        public string DisplayNumber => FirstNotEmpty(Records.First().RegNumberAbonement, Records.First().Number, Key);
    }
}

using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Legacy;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class ParusLicenseAnalyticsServiceTests
{
    [Fact]
    public async Task GetAsync_ReturnsSummaryByPeriodAndYears()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var firstClient = new LegacyOrg(legacyUnitOfWork) { Name = "Клиент 1" };
        var secondClient = new LegacyOrg(legacyUnitOfWork) { Name = "Клиент 2" };
        var ignoredClient = new LegacyOrg(legacyUnitOfWork) { Name = "Клиент 3" };

        CreateLicense(legacyUnitOfWork, firstClient, "AB-1", new DateTime(2024, 1, 1), new DateTime(2024, 12, 31));
        CreateLicense(legacyUnitOfWork, firstClient, "AB-1", new DateTime(2025, 1, 1), new DateTime(2025, 12, 31));
        CreateLicense(legacyUnitOfWork, firstClient, "AB-1", new DateTime(2026, 1, 1), new DateTime(2026, 12, 31));
        CreateLicense(legacyUnitOfWork, secondClient, "AB-2", new DateTime(2025, 1, 1), new DateTime(2025, 6, 30), "Парус Торнадо");
        CreateLicense(legacyUnitOfWork, ignoredClient, "AB-3", new DateTime(2025, 1, 1), new DateTime(2025, 12, 31), "Другой продукт");
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseAnalyticsService(legacyUnitOfWork);
        var result = await service.GetAsync(new DateTime(2025, 1, 1), new DateTime(2026, 12, 31), CancellationToken.None);

        Assert.Equal(2, result.Summary.LicenseGroups);
        Assert.Equal(3, result.Summary.LicenseRecords);
        Assert.Equal(2, result.Summary.Clients);
        Assert.Equal(1, result.Summary.ActiveAtPeriodEnd);
        Assert.Equal(1, result.Summary.ExpiredAtPeriodEnd);
        Assert.Equal(2, result.Summary.WithoutRenewal);
        Assert.Equal(2, result.Summary.Lost);
        Assert.Equal(1, result.Summary.NewLicenses);
        Assert.Equal(2, result.Periods.Count);

        var year2025 = result.Periods.Single(x => x.Year == 2025);
        Assert.Equal(2, year2025.LicenseGroups);
        Assert.Equal(1, year2025.Renewed);
        Assert.Equal(1, year2025.WithoutRenewal);
        Assert.Equal(1, year2025.Lost);

        var year2026 = result.Periods.Single(x => x.Year == 2026);
        Assert.Equal(1, year2026.LicenseGroups);
        Assert.Equal(1, year2026.Renewed);
        Assert.Equal(1, year2026.ActiveAtPeriodEnd);
        Assert.Equal(1, year2026.Lost);

        Assert.Contains(result.Products, x => x.Name == "Парус 10" && x.LicenseGroups == 1);
        Assert.Contains(result.Products, x => x.Name == "Парус Торнадо" && x.LicenseGroups == 1);
    }

    [Fact]
    public async Task GetAsync_GroupsLicensesByFullAbonementNumber()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var client = new LegacyOrg(legacyUnitOfWork) { Name = "Клиент" };

        CreateLicense(legacyUnitOfWork, client, "HA2360-2-10", new DateTime(2026, 1, 1), new DateTime(2026, 12, 31));
        CreateLicense(legacyUnitOfWork, client, "HA2360-2-11", new DateTime(2026, 1, 1), new DateTime(2026, 12, 31));
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseAnalyticsService(legacyUnitOfWork);
        var result = await service.GetAsync(new DateTime(2026, 1, 1), new DateTime(2026, 12, 31), CancellationToken.None);

        Assert.Equal(2, result.Summary.LicenseGroups);
        Assert.Equal(2, result.OrganizationGroups.Count);
        Assert.Contains(result.OrganizationGroups, group => group.LicenseNumber == "HA2360-2-10");
        Assert.Contains(result.OrganizationGroups, group => group.LicenseNumber == "HA2360-2-11");
    }

    private static LegacyUnitOfWork CreateLegacyUnitOfWork()
    {
        var dataLayer = new SimpleDataLayer(new InMemoryDataStore());
        return new LegacyUnitOfWork(dataLayer);
    }

    private static void CreateLicense(
        LegacyUnitOfWork unitOfWork,
        LegacyOrg org,
        string abonementNumber,
        DateTime dateSince,
        DateTime dateTo,
        string modification = "Парус 10")
    {
        _ = new LegacyZPParusLicenseInfo(unitOfWork)
        {
            Org = org,
            RegNumberAbonement = abonementNumber,
            RegNumberClient = $"CLIENT-{org.Oid}",
            DateSince = dateSince,
            DateTo = dateTo,
            Modification = modification,
            Number = abonementNumber
        };
    }
}

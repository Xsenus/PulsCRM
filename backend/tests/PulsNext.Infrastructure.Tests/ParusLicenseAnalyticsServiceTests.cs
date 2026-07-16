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
        var result = await service.GetAsync(new DateTime(2025, 1, 1), new DateTime(2026, 12, 31), null, null, false, 0, 10, CancellationToken.None);

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

        Assert.Empty(result.Products);
        Assert.Empty(result.Groups);
    }

    [Fact]
    public async Task GetAsync_GroupsLicensesByBaseClientNumberAndShowsAbonementPeriods()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var raion = new LegacyRaion(legacyUnitOfWork) { Name = "Central district" };
        var client = new LegacyOrg(legacyUnitOfWork) { Name = "Клиент", Raion = raion };

        CreateLicense(legacyUnitOfWork, client, "HA2360-2-10", new DateTime(2025, 1, 1), new DateTime(2025, 12, 31), clientNumber: "HA-2360");
        CreateLicense(legacyUnitOfWork, client, "HA2360-2-11", new DateTime(2026, 1, 1), new DateTime(2026, 12, 31), clientNumber: "HA-2360");
        CreateLicense(legacyUnitOfWork, client, "HA2360-2-11", new DateTime(2026, 1, 1), new DateTime(2026, 12, 31), clientNumber: "HA-2360");
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseAnalyticsService(legacyUnitOfWork);
        var result = await service.GetAsync(new DateTime(2025, 1, 1), new DateTime(2026, 12, 31), null, null, false, 0, 10, CancellationToken.None);

        Assert.Equal(1, result.Summary.LicenseGroups);
        Assert.Equal(3, result.Summary.LicenseRecords);
        Assert.Equal(1, result.Summary.NewLicenses);
        Assert.Equal(1, result.Summary.Renewed);

        var year2025 = result.Periods.Single(x => x.Year == 2025);
        Assert.Equal(1, year2025.NewLicenses);
        Assert.Equal(0, year2025.Renewed);

        var year2026 = result.Periods.Single(x => x.Year == 2026);
        Assert.Equal(0, year2026.NewLicenses);
        Assert.Equal(1, year2026.Renewed);

        var group = Assert.Single(result.OrganizationGroups);
        Assert.Equal("HA2360", group.LicenseNumber);
        Assert.Equal("Central district", group.Raion);
        Assert.Equal(new DateTime(2026, 12, 31), group.LastDateToUtc);
        Assert.Equal(2, group.Periods.Count);
        Assert.Contains(group.Periods, period => period.LicenseNumber == "HA2360-2-10");
        Assert.Contains(group.Periods, period => period.LicenseNumber == "HA2360-2-11" && period.ComponentsCount == 2);
    }

    [Fact]
    public async Task GetAsync_UsesLicenseNumberColumnAsComponentQuantity()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var client = new LegacyOrg(legacyUnitOfWork) { Name = "Клиент" };
        CreateLicense(
            legacyUnitOfWork,
            client,
            "HA2360-2-11",
            new DateTime(2026, 1, 1),
            new DateTime(2026, 12, 31),
            clientNumber: "HA-2360",
            quantity: "5");
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseAnalyticsService(legacyUnitOfWork);
        var result = await service.GetAsync(new DateTime(2026, 1, 1), new DateTime(2026, 12, 31), null, null, false, 0, 10, CancellationToken.None);

        var group = Assert.Single(result.OrganizationGroups);
        var period = Assert.Single(group.Periods);
        var component = Assert.Single(period.Components);
        Assert.Equal("HA2360-2-11", component.Number);
        Assert.Equal("5", component.Quantity);
    }

    [Fact]
    public async Task GetAsync_FiltersAndPaginatesOrganizationGroupsOnServer()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var activeClient = new LegacyOrg(legacyUnitOfWork) { Name = "Active client" };
        var expiredClient = new LegacyOrg(legacyUnitOfWork) { Name = "Expired client" };

        CreateLicense(legacyUnitOfWork, activeClient, "ACTIVE-1", new DateTime(2026, 1, 1), new DateTime(2026, 12, 31), clientNumber: "ACTIVE");
        CreateLicense(legacyUnitOfWork, expiredClient, "EXPIRED-1", new DateTime(2025, 1, 1), new DateTime(2025, 12, 31), clientNumber: "EXPIRED");
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseAnalyticsService(legacyUnitOfWork);
        var result = await service.GetAsync(new DateTime(2025, 1, 1), new DateTime(2026, 12, 31), null, "active", false, 0, 1, CancellationToken.None);

        Assert.Equal(1, result.OrganizationGroupsTotalCount);

        var group = Assert.Single(result.OrganizationGroups);
        Assert.Equal("ACTIVE", group.LicenseNumber);
        Assert.True(group.ActiveAtPeriodEnd);
    }

    [Fact]
    public async Task GetAsync_FiltersOrganizationGroupsByNewLostAndExpiringStatuses()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var newClient = new LegacyOrg(legacyUnitOfWork) { Name = "New client" };
        var lostClient = new LegacyOrg(legacyUnitOfWork) { Name = "Lost client" };
        var renewedClient = new LegacyOrg(legacyUnitOfWork) { Name = "Renewed client" };

        CreateLicense(legacyUnitOfWork, newClient, "NEW-1", new DateTime(2026, 1, 1), new DateTime(2027, 12, 31), clientNumber: "NEW");
        CreateLicense(legacyUnitOfWork, lostClient, "LOST-1", new DateTime(2024, 1, 1), new DateTime(2025, 6, 30), clientNumber: "LOST");
        CreateLicense(legacyUnitOfWork, renewedClient, "RENEWED-1", new DateTime(2024, 1, 1), new DateTime(2025, 12, 31), clientNumber: "RENEWED");
        CreateLicense(legacyUnitOfWork, renewedClient, "RENEWED-2", new DateTime(2026, 1, 1), new DateTime(2026, 12, 31), clientNumber: "RENEWED");
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseAnalyticsService(legacyUnitOfWork);

        var newResult = await service.GetAsync(new DateTime(2025, 1, 1), new DateTime(2026, 12, 31), null, "new", false, 0, 10, CancellationToken.None);
        var newGroup = Assert.Single(newResult.OrganizationGroups);
        Assert.Equal("NEW", newGroup.LicenseNumber);
        Assert.True(newGroup.NewInPeriod);

        var lostResult = await service.GetAsync(new DateTime(2025, 1, 1), new DateTime(2025, 12, 31), null, "lost", false, 0, 10, CancellationToken.None);
        var lostGroup = Assert.Single(lostResult.OrganizationGroups);
        Assert.Equal("LOST", lostGroup.LicenseNumber);
        Assert.True(lostGroup.LostInPeriod);

        var expiringResult = await service.GetAsync(new DateTime(2025, 1, 1), new DateTime(2025, 12, 31), null, "expiring", false, 0, 10, CancellationToken.None);
        var expiringGroup = Assert.Single(expiringResult.OrganizationGroups);
        Assert.Equal("LOST", expiringGroup.LicenseNumber);
        Assert.True(expiringGroup.ExpiringInPeriod);
        Assert.Equal(1, expiringResult.Summary.ExpiringInPeriod);
    }

    [Fact]
    public async Task GetAsync_FiltersExpiringOrganizationGroupsBySalaryWork()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var salaryClient = new LegacyOrg(legacyUnitOfWork) { Name = "Salary client" };
        var otherClient = new LegacyOrg(legacyUnitOfWork) { Name = "Other client" };
        MarkSalaryWorking(legacyUnitOfWork, salaryClient);

        CreateLicense(legacyUnitOfWork, salaryClient, "SALARY-1", new DateTime(2025, 1, 1), new DateTime(2025, 12, 31), clientNumber: "SALARY");
        CreateLicense(legacyUnitOfWork, otherClient, "OTHER-1", new DateTime(2025, 1, 1), new DateTime(2025, 12, 31), clientNumber: "OTHER");
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseAnalyticsService(legacyUnitOfWork);
        var result = await service.GetAsync(new DateTime(2025, 1, 1), new DateTime(2025, 12, 31), null, "expiring", true, 0, 10, CancellationToken.None);

        Assert.Equal(1, result.OrganizationGroupsTotalCount);
        var group = Assert.Single(result.OrganizationGroups);
        Assert.Equal("SALARY", group.LicenseNumber);
        Assert.True(group.SalaryWorking);
    }

    [Fact]
    public async Task GetAsync_TreatsSameLicenseInnAndBaseNumberAsRenewalAcrossOrganizationCards()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var oldCard = new LegacyOrg(legacyUnitOfWork) { Name = "ЦБ С.А.ЖДАНЬКО", INN = "5440113029" };
        var newCard = new LegacyOrg(legacyUnitOfWork) { Name = "МКУ \"ЦБО\"", INN = "5440111906" };
        MarkSalaryWorking(legacyUnitOfWork, oldCard);

        CreateLicense(
            legacyUnitOfWork,
            oldCard,
            "HA2767-1-10",
            new DateTime(2025, 7, 18),
            new DateTime(2026, 7, 18),
            clientNumber: "HA-2767",
            licenseInn: "5440111906");
        CreateLicense(
            legacyUnitOfWork,
            newCard,
            "HA2767-1-11",
            new DateTime(2026, 7, 6),
            new DateTime(2027, 7, 18),
            clientNumber: "HA-2767",
            licenseInn: "5440111906");
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseAnalyticsService(legacyUnitOfWork);

        var expiringResult = await service.GetAsync(new DateTime(2026, 7, 1), new DateTime(2026, 7, 31), null, "expiring", true, 0, 10, CancellationToken.None);

        Assert.Equal(0, expiringResult.Summary.ExpiringInPeriod);
        Assert.Empty(expiringResult.OrganizationGroups);

        var allResult = await service.GetAsync(new DateTime(2026, 7, 1), new DateTime(2026, 7, 31), null, "all", true, 0, 10, CancellationToken.None);

        var group = Assert.Single(allResult.OrganizationGroups);
        Assert.Equal("HA2767", group.LicenseNumber);
        Assert.Equal("МКУ \"ЦБО\"", group.ClientName);
        Assert.True(group.ActiveAtPeriodEnd);
        Assert.True(group.RenewedInPeriod);
    }

    [Fact]
    public async Task GetLicenseFileAsync_PrefersLinkedLicenseOwnerFile()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var licenseOwner = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "License owner",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
            {
                ParusLicenseFileName = "license-new.lic",
                ParusLicenseFileData = "new-data"u8.ToArray()
            }
        };
        licenseOwner.OrgInfoOther.Org = licenseOwner;
        var linkedClient = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "Linked client",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
            {
                OrgParusLicense = licenseOwner,
                ParusLicenseFileName = "license-old.lic",
                ParusLicenseFileData = "old-data"u8.ToArray()
            }
        };
        linkedClient.OrgInfoOther.Org = linkedClient;
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseAnalyticsService(legacyUnitOfWork);
        var file = await service.GetLicenseFileAsync(linkedClient.Oid, CancellationToken.None);

        Assert.NotNull(file);
        Assert.Equal("license-new.lic", file.FileName);
        Assert.Equal("new-data"u8.ToArray(), file.Content);
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
        string modification = "Парус 10",
        string? clientNumber = null,
        string? quantity = null,
        string? licenseInn = null)
    {
        _ = new LegacyZPParusLicenseInfo(unitOfWork)
        {
            Org = org,
            RegNumberAbonement = abonementNumber,
            RegNumberClient = clientNumber ?? $"CLIENT-{org.Oid}",
            DateSince = dateSince,
            DateTo = dateTo,
            Modification = modification,
            Number = quantity ?? abonementNumber,
            INN = licenseInn
        };
    }

    private static void MarkSalaryWorking(LegacyUnitOfWork unitOfWork, LegacyOrg org)
    {
        org.OrgInfoOther = new LegacyOrgInfoOther(unitOfWork)
        {
            Org = org,
            ZpWorking = true
        };
    }
}

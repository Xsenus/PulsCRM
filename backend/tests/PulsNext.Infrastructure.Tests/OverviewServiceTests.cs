using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class OverviewServiceTests
{
    [Fact]
    public async Task GetAsync_ReturnsDashboardCountsFromLegacyAndMailingStores()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        using var mailingUnitOfWork = CreateMailingUnitOfWork();

        var activeGroup = new LegacyUserGroup(legacyUnitOfWork) { Name = "Активные" };
        var dismissedGroup = new LegacyUserGroup(legacyUnitOfWork) { Name = "уволенные" };
        _ = new LegacyUser(legacyUnitOfWork) { Name = "first", UserGroup = activeGroup };
        _ = new LegacyUser(legacyUnitOfWork) { Name = "second" };
        _ = new LegacyUser(legacyUnitOfWork) { Name = "dismissed", UserGroup = dismissedGroup };
        _ = new LegacyOrg(legacyUnitOfWork) { Name = "Org A" };
        _ = new LegacyOrg(legacyUnitOfWork) { Name = "Org B" };
        legacyUnitOfWork.CommitChanges();

        _ = new MailCampaign(mailingUnitOfWork) { Name = "Active", Status = CampaignStatus.Active };
        _ = new MailCampaign(mailingUnitOfWork) { Name = "Paused", Status = CampaignStatus.Paused };
        CreateDispatchItem(mailingUnitOfWork, DispatchStatus.Queued);
        CreateDispatchItem(mailingUnitOfWork, DispatchStatus.Processing);
        CreateDispatchItem(mailingUnitOfWork, DispatchStatus.Deferred);
        CreateDispatchItem(mailingUnitOfWork, DispatchStatus.Sent, sentAtUtc: DateTime.UtcNow.AddHours(-1));
        CreateDispatchItem(mailingUnitOfWork, DispatchStatus.Sent, sentAtUtc: DateTime.UtcNow.AddDays(-2));
        CreateDispatchItem(mailingUnitOfWork, DispatchStatus.Failed, failedAtUtc: DateTime.UtcNow.AddMinutes(-30));
        CreateDispatchItem(mailingUnitOfWork, DispatchStatus.Failed, failedAtUtc: DateTime.UtcNow.AddDays(-3));
        mailingUnitOfWork.CommitChanges();

        var service = new OverviewService(legacyUnitOfWork, mailingUnitOfWork);
        var dashboard = await service.GetAsync(CancellationToken.None);

        Assert.Equal(2, dashboard.Employees);
        Assert.Equal(2, dashboard.Organizations);
        Assert.Equal(1, dashboard.ActiveCampaigns);
        Assert.Equal(3, dashboard.QueueDepth);
        Assert.Equal(1, dashboard.SentLast24Hours);
        Assert.Equal(1, dashboard.FailedLast24Hours);
    }

    private static LegacyUnitOfWork CreateLegacyUnitOfWork()
    {
        var dataLayer = new SimpleDataLayer(new InMemoryDataStore());
        return new LegacyUnitOfWork(dataLayer);
    }

    private static MailingUnitOfWork CreateMailingUnitOfWork()
    {
        var dataLayer = new SimpleDataLayer(new InMemoryDataStore());
        return new MailingUnitOfWork(dataLayer);
    }

    private static void CreateDispatchItem(
        UnitOfWork unitOfWork,
        DispatchStatus status,
        DateTime? sentAtUtc = null,
        DateTime? failedAtUtc = null)
    {
        _ = new MailDispatchItem(unitOfWork)
        {
            Status = status,
            RecipientEmail = $"{Guid.NewGuid():N}@example.test",
            SourceKind = RecipientSourceKind.Manual,
            QueuedAtUtc = DateTime.UtcNow,
            SentAtUtc = sentAtUtc ?? DateTime.MinValue,
            FailedAtUtc = failedAtUtc ?? DateTime.MinValue
        };
    }
}

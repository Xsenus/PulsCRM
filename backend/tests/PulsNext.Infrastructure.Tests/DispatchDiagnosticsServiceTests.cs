using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Mailing;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class DispatchDiagnosticsServiceTests
{
    [Fact]
    public async Task GetBatchesAsync_AppliesCampaignFilterBeforePaging()
    {
        using var unitOfWork = CreateUnitOfWork();
        var firstCampaign = CreateCampaign(unitOfWork, "First campaign");
        var secondCampaign = CreateCampaign(unitOfWork, "Second campaign");

        var olderBatch = CreateBatch(unitOfWork, firstCampaign, DateTime.UtcNow.AddHours(-2));
        var newerBatch = CreateBatch(unitOfWork, firstCampaign, DateTime.UtcNow.AddHours(-1));
        _ = CreateBatch(unitOfWork, secondCampaign, DateTime.UtcNow);
        unitOfWork.CommitChanges();

        var service = new DispatchDiagnosticsService(unitOfWork);
        var result = await service.GetBatchesAsync(new DispatchBatchListQuery
        {
            CampaignId = firstCampaign.Oid,
            Skip = 1,
            Take = 1
        }, CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        var item = Assert.Single(result.Items);
        Assert.Equal(olderBatch.Oid, item.Id);
        Assert.NotEqual(newerBatch.Oid, item.Id);
    }

    [Fact]
    public async Task GetItemsAsync_AppliesSimpleFiltersBeforeSearchAndPaging()
    {
        using var unitOfWork = CreateUnitOfWork();
        var firstCampaign = CreateCampaign(unitOfWork, "First campaign");
        var secondCampaign = CreateCampaign(unitOfWork, "Second campaign");
        var firstBatch = CreateBatch(unitOfWork, firstCampaign, DateTime.UtcNow.AddMinutes(-10));
        var secondBatch = CreateBatch(unitOfWork, firstCampaign, DateTime.UtcNow.AddMinutes(-5));

        var expected = CreateItem(unitOfWork, firstCampaign, firstBatch, DispatchStatus.Failed, "target@example.test", "Primary Org", failedAtUtc: DateTime.UtcNow.AddMinutes(-1), errorMessage: "SMTP timeout");
        _ = CreateItem(unitOfWork, firstCampaign, firstBatch, DispatchStatus.Failed, "other@example.test", "Primary Org", failedAtUtc: DateTime.UtcNow.AddMinutes(-2), errorMessage: "Other error");
        _ = CreateItem(unitOfWork, firstCampaign, firstBatch, DispatchStatus.Queued, "queued@example.test", "Primary Org", queuedAtUtc: DateTime.UtcNow.AddMinutes(-3), errorMessage: "SMTP timeout");
        _ = CreateItem(unitOfWork, firstCampaign, secondBatch, DispatchStatus.Failed, "second-batch@example.test", "Primary Org", failedAtUtc: DateTime.UtcNow.AddMinutes(-4), errorMessage: "SMTP timeout");
        _ = CreateItem(unitOfWork, secondCampaign, CreateBatch(unitOfWork, secondCampaign, DateTime.UtcNow), DispatchStatus.Failed, "other-campaign@example.test", "Other Org", failedAtUtc: DateTime.UtcNow, errorMessage: "SMTP timeout");
        unitOfWork.CommitChanges();

        var service = new DispatchDiagnosticsService(unitOfWork);
        var result = await service.GetItemsAsync(new DispatchItemListQuery
        {
            CampaignId = firstCampaign.Oid,
            BatchId = firstBatch.Oid,
            Status = DispatchStatus.Failed,
            Search = "smtp",
            Skip = 0,
            Take = 10
        }, CancellationToken.None);

        Assert.Equal(1, result.TotalCount);
        var item = Assert.Single(result.Items);
        Assert.Equal(expected.Oid, item.Id);
        Assert.Equal("target@example.test", item.RecipientEmail);
    }

    private static MailingUnitOfWork CreateUnitOfWork()
    {
        var dataLayer = new SimpleDataLayer(new InMemoryDataStore());
        return new MailingUnitOfWork(dataLayer);
    }

    private static MailCampaign CreateCampaign(UnitOfWork unitOfWork, string name)
    {
        return new MailCampaign(unitOfWork)
        {
            Name = name,
            Subject = name,
            Status = CampaignStatus.Active,
            CreatedAtUtc = DateTime.UtcNow,
            UpdatedAtUtc = DateTime.UtcNow
        };
    }

    private static MailDispatchBatch CreateBatch(UnitOfWork unitOfWork, MailCampaign campaign, DateTime createdAtUtc)
    {
        return new MailDispatchBatch(unitOfWork)
        {
            Campaign = campaign,
            TriggerKind = DispatchTriggerKind.Manual,
            CreatedAtUtc = createdAtUtc,
            ScheduledAtUtc = createdAtUtc,
            TotalRecipients = 1
        };
    }

    private static MailDispatchItem CreateItem(
        UnitOfWork unitOfWork,
        MailCampaign campaign,
        MailDispatchBatch batch,
        DispatchStatus status,
        string recipientEmail,
        string legacyOrgName,
        DateTime? queuedAtUtc = null,
        DateTime? failedAtUtc = null,
        string? errorMessage = null)
    {
        return new MailDispatchItem(unitOfWork)
        {
            Campaign = campaign,
            Batch = batch,
            Status = status,
            RecipientEmail = recipientEmail,
            LegacyOrgName = legacyOrgName,
            SourceKind = RecipientSourceKind.Manual,
            QueuedAtUtc = queuedAtUtc ?? DateTime.MinValue,
            FailedAtUtc = failedAtUtc ?? DateTime.MinValue,
            ErrorMessage = errorMessage
        };
    }
}

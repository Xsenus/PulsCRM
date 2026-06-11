using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Mailing;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class StatisticsServiceTests
{
    [Fact]
    public async Task GetCampaignStatisticsAsync_UsesOnlyRequestedCampaign()
    {
        using var unitOfWork = CreateUnitOfWork();
        var campaign = CreateCampaign(unitOfWork, "Primary campaign");
        var otherCampaign = CreateCampaign(unitOfWork, "Other campaign");

        var olderBatch = CreateBatch(unitOfWork, campaign, DateTime.UtcNow.AddHours(-2), completedAtUtc: DateTime.UtcNow.AddHours(-1));
        var newerBatch = CreateBatch(unitOfWork, campaign, DateTime.UtcNow.AddHours(-1));
        var otherBatch = CreateBatch(unitOfWork, otherCampaign, DateTime.UtcNow);

        var sent = CreateItem(unitOfWork, campaign, newerBatch, DispatchStatus.Sent, "sent@example.test", queuedAtUtc: DateTime.UtcNow.AddMinutes(-1), sentAtUtc: DateTime.UtcNow);
        var failed = CreateItem(unitOfWork, campaign, olderBatch, DispatchStatus.Failed, "failed@example.test", queuedAtUtc: DateTime.UtcNow.AddMinutes(-2), failedAtUtc: DateTime.UtcNow.AddMinutes(-1));
        var deferred = CreateItem(unitOfWork, campaign, olderBatch, DispatchStatus.Deferred, "deferred@example.test", queuedAtUtc: DateTime.UtcNow.AddMinutes(-3), nextAttemptAtUtc: DateTime.UtcNow.AddMinutes(10));
        _ = CreateItem(unitOfWork, campaign, olderBatch, DispatchStatus.Cancelled, "cancelled@example.test", queuedAtUtc: DateTime.UtcNow.AddMinutes(-4));
        _ = CreateItem(unitOfWork, otherCampaign, otherBatch, DispatchStatus.Failed, "other@example.test", queuedAtUtc: DateTime.UtcNow, failedAtUtc: DateTime.UtcNow);
        unitOfWork.CommitChanges();

        var service = new StatisticsService(unitOfWork);
        var stats = await service.GetCampaignStatisticsAsync(campaign.Oid, CancellationToken.None);

        Assert.Equal(campaign.Oid, stats.CampaignId);
        Assert.Equal(4, stats.TotalItems);
        Assert.Equal(1, stats.Sent);
        Assert.Equal(1, stats.Failed);
        Assert.Equal(1, stats.Deferred);
        Assert.Equal(1, stats.Cancelled);
        Assert.Equal(newerBatch.Oid, stats.RecentBatches.First().Id);
        Assert.Equal(sent.Oid, stats.RecentItems.First().Id);
        Assert.Equal(failed.Oid, Assert.Single(stats.FailedItems).Id);
        Assert.Equal(deferred.Oid, Assert.Single(stats.DeferredItems).Id);
        Assert.DoesNotContain(stats.RecentItems, x => x.RecipientEmail == "other@example.test");
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
            UpdatedAtUtc = DateTime.UtcNow,
            MaxAttempts = 3
        };
    }

    private static MailDispatchBatch CreateBatch(
        UnitOfWork unitOfWork,
        MailCampaign campaign,
        DateTime createdAtUtc,
        DateTime? completedAtUtc = null)
    {
        return new MailDispatchBatch(unitOfWork)
        {
            Campaign = campaign,
            TriggerKind = DispatchTriggerKind.Manual,
            ScheduledAtUtc = createdAtUtc,
            CreatedAtUtc = createdAtUtc,
            CompletedAtUtc = completedAtUtc ?? DateTime.MinValue,
            TotalRecipients = 1
        };
    }

    private static MailDispatchItem CreateItem(
        UnitOfWork unitOfWork,
        MailCampaign campaign,
        MailDispatchBatch batch,
        DispatchStatus status,
        string recipientEmail,
        DateTime queuedAtUtc,
        DateTime? sentAtUtc = null,
        DateTime? failedAtUtc = null,
        DateTime? nextAttemptAtUtc = null)
    {
        return new MailDispatchItem(unitOfWork)
        {
            Campaign = campaign,
            Batch = batch,
            Status = status,
            RecipientEmail = recipientEmail,
            SourceKind = RecipientSourceKind.Manual,
            QueuedAtUtc = queuedAtUtc,
            SentAtUtc = sentAtUtc ?? DateTime.MinValue,
            FailedAtUtc = failedAtUtc ?? DateTime.MinValue,
            NextAttemptAtUtc = nextAttemptAtUtc ?? DateTime.MinValue
        };
    }
}

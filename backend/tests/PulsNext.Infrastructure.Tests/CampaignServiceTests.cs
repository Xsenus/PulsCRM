using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class CampaignServiceTests
{
    [Fact]
    public async Task GetAsync_AppliesStatusFilterBeforePaging()
    {
        using var mailingUnitOfWork = CreateMailingUnitOfWork();
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var olderActive = CreateCampaign(mailingUnitOfWork, "Older active", CampaignStatus.Active, DateTime.UtcNow.AddHours(-3));
        var newerActive = CreateCampaign(mailingUnitOfWork, "Newer active", CampaignStatus.Active, DateTime.UtcNow.AddHours(-1));
        _ = CreateCampaign(mailingUnitOfWork, "Newest paused", CampaignStatus.Paused, DateTime.UtcNow);
        mailingUnitOfWork.CommitChanges();

        var service = CreateService(mailingUnitOfWork, legacyUnitOfWork);
        var result = await service.GetAsync(null, CampaignStatus.Active, skip: 1, take: 1, CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        var item = Assert.Single(result.Items);
        Assert.Equal(olderActive.Oid, item.Id);
        Assert.NotEqual(newerActive.Oid, item.Id);
    }

    [Fact]
    public async Task GetAsync_SearchKeepsTransportProfileMatchAndPagedCount()
    {
        using var mailingUnitOfWork = CreateMailingUnitOfWork();
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();

        var profile = new MailTransportProfile(mailingUnitOfWork)
        {
            Name = "Main SMTP",
            Host = "smtp.example.test",
            Port = 25,
            SenderEmail = "sender@example.test"
        };

        var first = CreateCampaign(mailingUnitOfWork, "First", CampaignStatus.Active, DateTime.UtcNow.AddHours(-2), profile);
        var second = CreateCampaign(mailingUnitOfWork, "Second", CampaignStatus.Active, DateTime.UtcNow.AddHours(-1), profile);
        _ = CreateCampaign(mailingUnitOfWork, "Paused", CampaignStatus.Paused, DateTime.UtcNow, profile);
        _ = CreateCampaign(mailingUnitOfWork, "No match", CampaignStatus.Active, DateTime.UtcNow, transportProfile: null);
        mailingUnitOfWork.CommitChanges();

        var service = CreateService(mailingUnitOfWork, legacyUnitOfWork);
        var result = await service.GetAsync("smtp", CampaignStatus.Active, skip: 1, take: 1, CancellationToken.None);

        Assert.Equal(2, result.TotalCount);
        var item = Assert.Single(result.Items);
        Assert.Equal(first.Oid, item.Id);
        Assert.NotEqual(second.Oid, item.Id);
    }

    private static CampaignService CreateService(MailingUnitOfWork mailingUnitOfWork, LegacyUnitOfWork legacyUnitOfWork)
    {
        return new CampaignService(
            mailingUnitOfWork,
            legacyUnitOfWork,
            currentUserAccessor: null!,
            scheduleCalculator: null!,
            recipientResolver: null!,
            dispatchService: null!);
    }

    private static MailingUnitOfWork CreateMailingUnitOfWork()
    {
        var dataLayer = new SimpleDataLayer(new InMemoryDataStore());
        return new MailingUnitOfWork(dataLayer);
    }

    private static LegacyUnitOfWork CreateLegacyUnitOfWork()
    {
        var dataLayer = new SimpleDataLayer(new InMemoryDataStore());
        return new LegacyUnitOfWork(dataLayer);
    }

    private static MailCampaign CreateCampaign(
        UnitOfWork unitOfWork,
        string name,
        CampaignStatus status,
        DateTime updatedAtUtc,
        MailTransportProfile? transportProfile = null)
    {
        return new MailCampaign(unitOfWork)
        {
            Name = name,
            Subject = $"{name} subject",
            Status = status,
            TransportProfile = transportProfile,
            CreatedAtUtc = updatedAtUtc.AddMinutes(-10),
            UpdatedAtUtc = updatedAtUtc,
            MaxAttempts = 3
        };
    }
}

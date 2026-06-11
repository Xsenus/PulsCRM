using System.ComponentModel.DataAnnotations;
using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class DeletionGuardTests
{
    [Fact]
    public async Task TransportProfile_DeleteAsync_ThrowsWhenCampaignUsesProfile()
    {
        using var mailingUnitOfWork = CreateMailingUnitOfWork();
        var profile = CreateTransportProfile(mailingUnitOfWork, "Primary SMTP");
        _ = CreateCampaign(mailingUnitOfWork, "Campaign", profile);
        mailingUnitOfWork.CommitChanges();

        var service = new TransportProfileService(mailingUnitOfWork, new PassthroughSecretProtector());

        await Assert.ThrowsAsync<ValidationException>(() => service.DeleteAsync(profile.Oid, CancellationToken.None));
    }

    [Fact]
    public async Task Organization_DeleteAsync_ThrowsWhenLegacyJobUsesOrganization()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        using var mailingUnitOfWork = CreateMailingUnitOfWork();
        var organization = CreateOrganization(legacyUnitOfWork, "Organization with jobs");
        _ = new LegacyJob(legacyUnitOfWork)
        {
            Org = organization,
            Message = "Call customer"
        };
        legacyUnitOfWork.CommitChanges();

        var service = new OrganizationService(legacyUnitOfWork, mailingUnitOfWork, currentUserAccessor: null!);

        await Assert.ThrowsAsync<ValidationException>(() => service.DeleteAsync(organization.Oid, CancellationToken.None));
    }

    [Fact]
    public async Task Organization_DeleteAsync_ThrowsWhenCampaignTargetsOrganization()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        using var mailingUnitOfWork = CreateMailingUnitOfWork();
        var organization = CreateOrganization(legacyUnitOfWork, "Campaign target");
        legacyUnitOfWork.CommitChanges();

        var campaign = CreateCampaign(mailingUnitOfWork, "Campaign", transportProfile: null);
        _ = new MailCampaignTargetOrganization(mailingUnitOfWork)
        {
            Campaign = campaign,
            LegacyOrgId = organization.Oid,
            LegacyOrgName = organization.Name
        };
        mailingUnitOfWork.CommitChanges();

        var service = new OrganizationService(legacyUnitOfWork, mailingUnitOfWork, currentUserAccessor: null!);

        await Assert.ThrowsAsync<ValidationException>(() => service.DeleteAsync(organization.Oid, CancellationToken.None));
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

    private static MailTransportProfile CreateTransportProfile(UnitOfWork unitOfWork, string name)
    {
        return new MailTransportProfile(unitOfWork)
        {
            Name = name,
            Host = "smtp.example.test",
            Port = 25,
            SenderEmail = "sender@example.test",
            IsEnabled = true
        };
    }

    private static MailCampaign CreateCampaign(
        UnitOfWork unitOfWork,
        string name,
        MailTransportProfile? transportProfile)
    {
        var now = DateTime.UtcNow;
        return new MailCampaign(unitOfWork)
        {
            Name = name,
            Subject = $"{name} subject",
            Status = CampaignStatus.Draft,
            TransportProfile = transportProfile,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            MaxAttempts = 3
        };
    }

    private static LegacyOrg CreateOrganization(UnitOfWork unitOfWork, string name)
    {
        return new LegacyOrg(unitOfWork)
        {
            Name = name,
            FullName = name,
            Date_create = DateTime.UtcNow,
            Date_update = DateTime.UtcNow
        };
    }

    private sealed class PassthroughSecretProtector : ISecretProtector
    {
        public string Protect(string value) => value;

        public string Unprotect(string? protectedValue) => protectedValue ?? string.Empty;
    }
}

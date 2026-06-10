using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class RecipientResolverTests
{
    [Fact]
    public async Task ResolveAsync_ParsesManualRecipientsAndDedupesByEmail()
    {
        using var unitOfWork = CreateUnitOfWork();
        var resolver = new RecipientResolver(unitOfWork);

        var recipients = await resolver.ResolveAsync(new CampaignRecipientSelection
        {
            ManualRecipientsCsv = " First@Example.com;invalid-email\nfirst@example.COM\tsecond@example.com "
        }, CancellationToken.None);

        Assert.Collection(
            recipients,
            first =>
            {
                Assert.Equal(0, first.LegacyOrgId);
                Assert.Equal("First@Example.com", first.Email);
                Assert.Equal(RecipientSourceKind.Manual, first.SourceKind);
            },
            second =>
            {
                Assert.Equal(0, second.LegacyOrgId);
                Assert.Equal("second@example.com", second.Email);
                Assert.Equal(RecipientSourceKind.Manual, second.SourceKind);
            });
    }

    [Fact]
    public async Task ResolveAsync_CollectsSelectedOrganizationSourcesAndSkipsDuplicates()
    {
        using var unitOfWork = CreateUnitOfWork();
        var org = CreateOrganization(unitOfWork);
        unitOfWork.CommitChanges();

        var resolver = new RecipientResolver(unitOfWork);
        var recipients = await resolver.ResolveAsync(new CampaignRecipientSelection
        {
            TargetOrganizationIds = [org.Oid],
            UseOrgPrimaryEmail = true,
            UseDirectorEmail = true,
            UseSalaryEmail = true,
            UseOneCEmail = true,
            UseSiteEmail = true,
            UseContactEmails = true
        }, CancellationToken.None);

        Assert.Collection(
            recipients,
            primary =>
            {
                Assert.Equal(org.Oid, primary.LegacyOrgId);
                Assert.Equal("Org A", primary.LegacyOrgName);
                Assert.Equal("common@example.com", primary.Email);
                Assert.Equal("Org A", primary.DisplayName);
                Assert.Equal(RecipientSourceKind.OrgPrimary, primary.SourceKind);
            },
            director =>
            {
                Assert.Equal("director@example.com", director.Email);
                Assert.Equal(RecipientSourceKind.Director, director.SourceKind);
            },
            salary =>
            {
                Assert.Equal("salary@example.com", salary.Email);
                Assert.Equal("Salary Person", salary.DisplayName);
                Assert.Equal(RecipientSourceKind.Salary, salary.SourceKind);
            },
            contact =>
            {
                Assert.Equal("contact@example.com", contact.Email);
                Assert.Equal("Contact Person", contact.DisplayName);
                Assert.Equal(RecipientSourceKind.Contact, contact.SourceKind);
            });
    }

    [Fact]
    public async Task ResolveAsync_AllowsSameEmailForDifferentOrganizations()
    {
        using var unitOfWork = CreateUnitOfWork();
        var firstOrg = new LegacyOrg(unitOfWork)
        {
            Name = "Org A",
            OrgInfo = new LegacyOrgInfo(unitOfWork)
            {
                Email = "shared@example.com"
            }
        };

        firstOrg.OrgInfo.Org = firstOrg;

        var secondOrg = new LegacyOrg(unitOfWork)
        {
            Name = "Org B",
            OrgInfo = new LegacyOrgInfo(unitOfWork)
            {
                Email = "SHARED@example.com"
            }
        };

        secondOrg.OrgInfo.Org = secondOrg;
        unitOfWork.CommitChanges();

        var resolver = new RecipientResolver(unitOfWork);
        var recipients = await resolver.ResolveAsync(new CampaignRecipientSelection
        {
            TargetOrganizationIds = [firstOrg.Oid, secondOrg.Oid],
            UseOrgPrimaryEmail = true
        }, CancellationToken.None);

        Assert.Equal(2, recipients.Count);
        Assert.Contains(recipients, x => x.LegacyOrgId == firstOrg.Oid && x.Email == "shared@example.com");
        Assert.Contains(recipients, x => x.LegacyOrgId == secondOrg.Oid && x.Email == "SHARED@example.com");
    }

    private static LegacyUnitOfWork CreateUnitOfWork()
    {
        var dataLayer = new SimpleDataLayer(new InMemoryDataStore());
        return new LegacyUnitOfWork(dataLayer);
    }

    private static LegacyOrg CreateOrganization(UnitOfWork unitOfWork)
    {
        var org = new LegacyOrg(unitOfWork)
        {
            Name = "Org A"
        };

        var orgInfo = new LegacyOrgInfo(unitOfWork)
        {
            Org = org,
            Email = "common@example.com"
        };

        var other = new LegacyOrgInfoOther(unitOfWork)
        {
            Org = org,
            RukEmail = "director@example.com",
            ZpEmail = "salary@example.com",
            ZpFIO = "Salary Person",
            F1cEmail = "invalid-email",
            SiteEmail = "COMMON@example.com",
            SiteFIO = "Site Person"
        };

        org.OrgInfo = orgInfo;
        org.OrgInfoOther = other;

        _ = new LegacyContact(unitOfWork)
        {
            Org = org,
            Email = "contact@example.com",
            FIO = "Contact Person"
        };

        _ = new LegacyContact(unitOfWork)
        {
            Org = org,
            Email = "common@example.com",
            FIO = "Duplicate Contact"
        };

        return org;
    }
}

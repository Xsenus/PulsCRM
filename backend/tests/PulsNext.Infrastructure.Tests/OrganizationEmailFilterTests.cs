using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class OrganizationEmailFilterTests
{
    [Fact]
    public async Task EmailFilterReturnsTheSameOrganizationsWithAFixedNumberOfQueries()
    {
        var store = new CountingDataStore(new InMemoryDataStore());
        using (var seed = new LegacyUnitOfWork(new SimpleDataLayer(store)))
        {
            Seed(seed, 60);
        }

        using var mailing = new MailingUnitOfWork(new SimpleDataLayer(new InMemoryDataStore()));
        // E-mail есть у вариантов 0–2 (основной, «прочие» и контакт); у 3–5 — некорректный, пустой или никакого.
        var expected = Enumerable.Range(0, 60).Where(index => index % 6 <= 2).Select(index => $"Орг {index:D3}").ToArray();

        using var fresh = new LegacyUnitOfWork(new SimpleDataLayer(store));
        var service = new OrganizationService(fresh, mailing, new NoUser());
        store.Selects = 0;
        var page = await service.GetAsync(null, [], hasEmail: true, skip: 0, take: 500, CancellationToken.None);

        Assert.Equal(expected, page.Items.Select(x => x.Name).Order());
        Assert.Equal(expected.Length, page.TotalCount);
        // Раньше: все 60 организаций в память и запрос контактов на каждую (десятки запросов).
        Assert.True(store.Selects <= 10, $"Запросов к хранилищу: {store.Selects}");

        var raions = await service.GetRaionsAsync(null, hasEmail: true, CancellationToken.None);
        Assert.Equal(expected.Length, raions.Sum(x => x.Count));
    }

    private static void Seed(UnitOfWork unitOfWork, int count)
    {
        for (var index = 0; index < count; index++)
        {
            var org = new LegacyOrg(unitOfWork) { Name = $"Орг {index:D3}" };
            switch (index % 6)
            {
                case 0:
                    org.OrgInfo = new LegacyOrgInfo(unitOfWork) { Email = $"info{index}@example.test" };
                    break;
                case 1:
                    org.OrgInfoOther = new LegacyOrgInfoOther(unitOfWork) { ZpEmail = $"zp{index}@example.test" };
                    break;
                case 2:
                    _ = new LegacyContact(unitOfWork) { Org = org, Email = $"contact{index}@example.test" };
                    break;
                case 3:
                    // Некорректный адрес — организация без e-mail (как и раньше).
                    org.OrgInfo = new LegacyOrgInfo(unitOfWork) { Email = "не адрес" };
                    break;
                case 4:
                    _ = new LegacyContact(unitOfWork) { Org = org, Email = "" };
                    break;
                default:
                    break;
            }
        }

        unitOfWork.CommitChanges();
    }

    private sealed class NoUser : ICurrentUserAccessor
    {
        public int? GetLegacyUserId() => null;
        public string? GetLogin() => null;
    }

    /// <summary>
    /// Считает запросы выборки к хранилищу (как запросы к SQL Server).
    /// </summary>
    private sealed class CountingDataStore(IDataStore inner) : IDataStore
    {
        public int Selects { get; set; }

        public AutoCreateOption AutoCreateOption => inner.AutoCreateOption;

        public ModificationResult ModifyData(params ModificationStatement[] dmlStatements) => inner.ModifyData(dmlStatements);

        public SelectedData SelectData(params SelectStatement[] selects)
        {
            Selects++;
            return inner.SelectData(selects);
        }

        public UpdateSchemaResult UpdateSchema(bool doNotCreateIfFirstTableNotExist, params DBTable[] tables) => inner.UpdateSchema(doNotCreateIfFirstTableNotExist, tables);
    }
}

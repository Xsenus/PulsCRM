using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Legacy;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class OrganizationDirectoryServiceTests : IDisposable
{
    private readonly LegacyUnitOfWork _unitOfWork = new(new SimpleDataLayer(new InMemoryDataStore()));

    public void Dispose() => _unitOfWork.Dispose();

    [Fact]
    public void SearchFindsByNameAndInnAndPages()
    {
        var raion = new LegacyRaion(_unitOfWork) { Name = "Центральный" };
        _ = new LegacyOrg(_unitOfWork) { Name = "ООО «Ромашка»", INN = "5401000001", Raion = raion, OrgInfo = new LegacyOrgInfo(_unitOfWork) { Phone = "+7 383 111-11-11", Email = "info@romashka.test" } };
        _ = new LegacyOrg(_unitOfWork) { Name = "АО «Василек»", INN = "5402000002" };
        _ = new LegacyOrg(_unitOfWork) { Name = "ИП Иванов", INN = "540300000300" };
        _unitOfWork.CommitChanges();
        var service = new OrganizationDirectoryService(_unitOfWork);

        var all = service.Search(null, 0, 2);
        Assert.Equal(3, all.TotalCount);
        Assert.Equal(["АО «Василек»", "ИП Иванов"], all.Items.Select(x => x.Name));
        Assert.Equal(["ООО «Ромашка»"], service.Search(null, 2, 2).Items.Select(x => x.Name));

        // В SQL Server поиск без учета регистра (collation *_CI_*), хранилище в памяти — с учетом; ищем как в данных.
        var romashka = Assert.Single(service.Search("Ромашка", 0, 10).Items);
        Assert.Equal("Центральный", romashka.Raion);
        Assert.Equal("+7 383 111-11-11", romashka.Phone);
        Assert.Equal("info@romashka.test", romashka.Email);
        Assert.Equal("АО «Василек»", Assert.Single(service.Search("5402", 0, 10).Items).Name);
        Assert.Equal(1, service.Search("Центральный", 0, 10).TotalCount);
    }

    [Fact]
    public void CardShowsRequisitesAndContactsButNotInternalData()
    {
        var org = new LegacyOrg(_unitOfWork)
        {
            Name = "ООО «Ромашка»",
            FullName = "Общество с ограниченной ответственностью «Ромашка»",
            INN = "5401000001",
            OrgInfo = new LegacyOrgInfo(_unitOfWork) { KPP = "540101001", AddressU = "г. Новосибирск, ул. Ленина, 1", Phone = "+7 383 111-11-11", Email = "info@romashka.test", Site = "romashka.test", Comment = "Служебный комментарий", SummaDolga = 1000 },
            OrgInfoOther = new LegacyOrgInfoOther(_unitOfWork) { OGRN = "1025400000001", RukFIO = "Петров Петр Петрович", RukDolgnost = "Директор", RukPhone = "+7 900 000-00-01", ZpEmail = "zp@romashka.test" }
        };
        _ = new LegacyContact(_unitOfWork) { Org = org, FIO = "Сидорова Анна", Phone = "+7 900 000-00-02", Email = "anna@romashka.test", Comment = "Не звонить после 18" };
        _ = new LegacyContact(_unitOfWork) { Org = org };
        _unitOfWork.CommitChanges();

        var card = new OrganizationDirectoryService(_unitOfWork).GetCard(org.Oid)!;

        Assert.Equal("Общество с ограниченной ответственностью «Ромашка»", card.FullName);
        Assert.Equal("540101001", card.Kpp);
        Assert.Equal("1025400000001", card.Ogrn);
        Assert.Equal("г. Новосибирск, ул. Ленина, 1", card.AddressLegal);
        Assert.Equal([("Основной", "info@romashka.test"), ("Зарплата", "zp@romashka.test")], card.Emails.Select(x => (x.Label, x.Email)));
        Assert.Equal("Петров Петр Петрович", card.DirectorName);
        Assert.Equal("Директор", card.DirectorPosition);
        // Пустой контакт не показывается; комментарий контакта в справочник не попадает.
        var contact = Assert.Single(card.Contacts);
        Assert.Equal("Сидорова Анна", contact.Fio);
        Assert.Equal("anna@romashka.test", contact.Email);
        Assert.Null(new OrganizationDirectoryService(_unitOfWork).GetCard(99999));
        // В DTO справочника нет полей долгов и комментариев.
        Assert.DoesNotContain(typeof(OrganizationDirectoryCardDto).GetProperties(), x => x.Name.Contains("Debt") || x.Name.Contains("Comment") || x.Name.Contains("Bank"));
    }
}

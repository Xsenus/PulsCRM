using System.Text;
using System.IO.Compression;
using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Legacy;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class ParusLicenseImportServiceTests
{
    [Fact]
    public async Task ImportInfoAsync_ReadsExcelXmlAndCreatesOnlyMissingRows()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        var org = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "Test org",
            INN = "5453175287",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
        };
        org.OrgInfoOther.Org = org;
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseImportService(legacyUnitOfWork);

        var first = await service.ImportInfoAsync(ToStream(BuildXml()), "CliensBase.xml", false, CancellationToken.None);
        var second = await service.ImportInfoAsync(ToStream(BuildXml()), "CliensBase.xml", false, CancellationToken.None);

        Assert.Equal(2, first.ImportedRows);
        Assert.Equal(0, first.MissingOrganizationRows);
        Assert.Equal(1, first.UpdatedOrganizations);
        Assert.Equal(0, second.ImportedRows);
        Assert.Equal(2, second.DuplicateRows);

        var licenses = new XPQuery<LegacyZPParusLicenseInfo>(legacyUnitOfWork).ToArray();
        Assert.Equal(2, licenses.Length);
        Assert.All(licenses, license => Assert.Equal(org.Oid, license.Org?.Oid));
        Assert.Contains(licenses, license => license.RegNumberClient == "НА-2360" && license.RegNumberAbonement == "НА2360-2-11" && license.Number == "5");
        Assert.Equal("НА2360", org.OrgInfoOther?.ParusLicenseNumber);
    }

    [Fact]
    public async Task ImportInfoAsync_UpdatesExistingPeriodDatesInsteadOfCreatingDuplicate()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        var org = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "Test org",
            INN = "5453175287",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
        };
        org.OrgInfoOther.Org = org;
        _ = new LegacyZPParusLicenseInfo(legacyUnitOfWork)
        {
            Org = org,
            Payer = "ООО «ПУЛЬС-ГРУП»",
            RegNumberClient = "НА-2360",
            MnemoOrg = "АдминТатарНСО",
            RegNumberAbonement = "НА2360-2-11",
            DateSince = new DateTime(2025, 2, 21),
            DateTo = new DateTime(2026, 12, 31),
            Nomenclature = "PARUS 10 Б",
            Modification = "Модуль «Расчет заработной платы»",
            Number = "5",
            INN = "5453175287"
        };
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseImportService(legacyUnitOfWork);
        var result = await service.ImportInfoAsync(ToStream(BuildXml()), "CliensBase.xml", false, CancellationToken.None);

        Assert.Equal(1, result.ImportedRows);
        Assert.Equal(1, result.UpdatedRows);
        Assert.Equal(0, result.DuplicateRows);

        var licenses = new XPQuery<LegacyZPParusLicenseInfo>(legacyUnitOfWork).ToArray();
        Assert.Equal(2, licenses.Length);
        var updated = Assert.Single(licenses, license => license.Modification == "Модуль «Расчет заработной платы»");
        Assert.Equal(new DateTime(2026, 2, 21), updated.DateTo.Date);
        Assert.Equal(org.Oid, updated.Org?.Oid);
    }

    [Fact]
    public async Task ImportInfoAsync_MovesExistingLicenseInfoToMatchedOrganization()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        var oldOrg = new LegacyOrg(legacyUnitOfWork) { Name = "Old org", INN = "0000000000" };
        var matchedOrg = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "Matched org",
            INN = "5453175287",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
        };
        matchedOrg.OrgInfoOther.Org = matchedOrg;
        _ = new LegacyZPParusLicenseInfo(legacyUnitOfWork)
        {
            Org = oldOrg,
            Payer = "ООО «ПУЛЬС-ГРУП»",
            RegNumberClient = "НА-2360",
            MnemoOrg = "АдминТатарНСО",
            RegNumberAbonement = "НА2360-2-11",
            DateSince = new DateTime(2025, 2, 21),
            DateTo = new DateTime(2026, 2, 21),
            Nomenclature = "PARUS 10 Б",
            Modification = "Модуль «Расчет заработной платы»",
            Number = "5",
            INN = "5453175287"
        };
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseImportService(legacyUnitOfWork);
        var result = await service.ImportInfoAsync(ToStream(BuildXml()), "CliensBase.xml", false, CancellationToken.None);

        Assert.Equal(1, result.ImportedRows);
        Assert.Equal(1, result.UpdatedRows);
        Assert.Equal(0, result.DuplicateRows);

        var updated = Assert.Single(new XPQuery<LegacyZPParusLicenseInfo>(legacyUnitOfWork), license => license.Modification == "Модуль «Расчет заработной платы»");
        Assert.Equal(matchedOrg.Oid, updated.Org?.Oid);
    }

    [Fact]
    public async Task ImportInfoAsync_DryRunDoesNotWriteRows()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        _ = new LegacyOrg(legacyUnitOfWork) { Name = "Test org", INN = "5453175287" };
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseImportService(legacyUnitOfWork);
        var result = await service.ImportInfoAsync(ToStream(BuildXml()), "CliensBase.xml", true, CancellationToken.None);

        Assert.True(result.DryRun);
        Assert.Equal(2, result.ImportedRows);
        Assert.Empty(new XPQuery<LegacyZPParusLicenseInfo>(legacyUnitOfWork).ToArray());
    }

    [Fact]
    public async Task ImportFilesAsync_AttachesLicenseFileByAbonementNumber()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        var org = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "Test org",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
        };
        org.OrgInfoOther.Org = org;
        _ = new LegacyZPParusLicenseInfo(legacyUnitOfWork)
        {
            Org = org,
            RegNumberAbonement = "НА2360-2-11",
            RegNumberClient = "НА-2360",
            DateSince = new DateTime(2025, 2, 21),
            DateTo = new DateTime(2026, 2, 21),
            Modification = "PARUS 10"
        };
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseImportService(legacyUnitOfWork);
        var file = new ParusLicenseFileImportItem("License_НА2360-2-11.lic", 4, () => ToStream("data"));

        var first = await service.ImportFilesAsync([file], false, CancellationToken.None);
        var second = await service.ImportFilesAsync([file], false, CancellationToken.None);

        Assert.Equal(1, first.ImportedFiles);
        Assert.Equal(0, first.MissingLicenseFiles);
        Assert.Equal("НА2360", org.OrgInfoOther?.ParusLicenseNumber);
        Assert.Equal("License_НА2360-2-11.lic", org.OrgInfoOther?.ParusLicenseFileName);
        Assert.Equal(4, org.OrgInfoOther?.ParusLicenseFileData?.Length);
        Assert.Equal(0, second.ImportedFiles);
        Assert.Equal(1, second.DuplicateFiles);
    }

    [Fact]
    public async Task ImportFilesAsync_DryRunDoesNotAttachFileData()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        var org = new LegacyOrg(legacyUnitOfWork) { Name = "Test org" };
        _ = new LegacyZPParusLicenseInfo(legacyUnitOfWork)
        {
            Org = org,
            RegNumberAbonement = "НА2360-2-11",
            DateSince = new DateTime(2025, 2, 21),
            DateTo = new DateTime(2026, 2, 21),
            Modification = "PARUS 10"
        };
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseImportService(legacyUnitOfWork);
        var result = await service.ImportFilesAsync([new ParusLicenseFileImportItem("НА2360-2-11.lic", 4, () => ToStream("data"))], true, CancellationToken.None);

        Assert.Equal(1, result.ImportedFiles);
        Assert.Null(org.OrgInfoOther);
    }

    [Fact]
    public async Task ImportBatchAsync_ExpandsZipAndImportsLicenseFiles()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        var org = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "Test org",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
        };
        org.OrgInfoOther.Org = org;
        _ = new LegacyZPParusLicenseInfo(legacyUnitOfWork)
        {
            Org = org,
            RegNumberAbonement = "HA2360-2-11",
            RegNumberClient = "HA-2360",
            DateSince = new DateTime(2025, 2, 21),
            DateTo = new DateTime(2026, 2, 21),
            Modification = "PARUS 10"
        };
        legacyUnitOfWork.CommitChanges();

        var zipBytes = BuildZip(("License_HA2360-2-11.lic", "data"));
        var service = new ParusLicenseImportService(legacyUnitOfWork);

        var result = await service.ImportBatchAsync([
            new ParusLicenseFileImportItem("licenses.zip", zipBytes.Length, () => new MemoryStream(zipBytes, writable: false))
        ], false, CancellationToken.None);

        Assert.Equal(1, result.TotalFiles);
        Assert.Equal(1, result.ExpandedFiles);
        Assert.Equal(1, result.LicenseFiles);
        Assert.NotNull(result.FileResult);
        Assert.Equal(1, result.FileResult.ImportedFiles);
        Assert.Contains(result.LogItems, item => item.Stage == "archive" && item.Status == "expanded");
        Assert.Contains(result.LogItems, item => item.Stage == "license-file" && item.Status == "imported");
        Assert.Equal("License_HA2360-2-11.lic", org.OrgInfoOther?.ParusLicenseFileName);
    }

    [Fact]
    public async Task ImportBatchAsync_DoesNotUpdateOrganizationCards()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        var org = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "Test org",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
            {
                ParusLicenseNumber = "НА2360"
            }
        };
        org.OrgInfoOther.Org = org;
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseImportService(legacyUnitOfWork);
        var file = new ParusLicenseFileImportItem("cards.csv", Encoding.UTF8.GetByteCount(BuildCardCsv()), () => ToStream(BuildCardCsv()));

        var result = await service.ImportBatchAsync([file], false, CancellationToken.None);

        Assert.Equal(1, result.TotalFiles);
        Assert.Equal(1, result.ExpandedFiles);
        Assert.Equal(0, result.CardInfoFiles);
        Assert.Empty(result.CardResults);
        Assert.Equal(1, result.SkippedFiles);
        Assert.Contains("cards.csv", result.SkippedFileNames);
        Assert.Contains(result.LogItems, item => item.Stage == "cards" && item.Status == "skipped" && item.FileName == "cards.csv");
        Assert.Null(org.OrgInfoOther?.ZpPhone);
        Assert.Null(org.OrgInfoOther?.ZpEmail);
        Assert.Null(org.OrgInfoOther?.ZpFIO);
        Assert.Equal(0, org.OrgInfoOther?.ZpNumOfBases);
    }

    [Fact]
    public async Task ImportCardInfoAsync_UpdatesOrganizationCardByBaseLicenseNumber()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        var org = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "Test org",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
            {
                ParusLicenseNumber = "НА2360"
            }
        };
        org.OrgInfoOther.Org = org;
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseImportService(legacyUnitOfWork);
        var result = await service.ImportCardInfoAsync(ToStream(BuildCardCsv()), "cards.csv", false, CancellationToken.None);

        Assert.Equal(2, result.TotalRows);
        Assert.Equal(1, result.MatchedRows);
        Assert.Equal(1, result.UpdatedOrganizations);
        Assert.Equal(1, result.MissingLicenseRows);
        Assert.Equal("8 (383) 100-10-10", org.OrgInfoOther?.ZpPhone);
        Assert.Equal("client@example.test", org.OrgInfoOther?.ZpEmail);
        Assert.Equal("Иванов Иван", org.OrgInfoOther?.ZpFIO);
        Assert.Equal("Расчет зарплаты, 5 мест", org.OrgInfoOther?.ZpLicSostav);
        Assert.Equal(3, org.OrgInfoOther?.ZpNumOfBases);
        Assert.Equal(12, org.OrgInfoOther?.CountOrganizationsInDataBases);
        Assert.Equal(2, org.OrgInfoOther?.ZpNumDopPlaces);
        Assert.True(org.OrgInfoOther?.ZpWorking);
        Assert.Equal(new DateTime(2024, 1, 15), org.OrgInfoOther?.ZpDateWorkBegin.Date);
    }

    [Fact]
    public async Task ImportCardInfoAsync_DryRunDoesNotUpdateOrganizationCard()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        var org = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "Test org",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
            {
                ParusLicenseNumber = "НА2360"
            }
        };
        org.OrgInfoOther.Org = org;
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseImportService(legacyUnitOfWork);
        var result = await service.ImportCardInfoAsync(ToStream(BuildCardCsv()), "cards.csv", true, CancellationToken.None);

        Assert.True(result.DryRun);
        Assert.Equal(1, result.UpdatedOrganizations);
        Assert.Null(org.OrgInfoOther?.ZpPhone);
        Assert.Equal(0, org.OrgInfoOther?.ZpNumOfBases);
        Assert.Equal(0, org.OrgInfoOther?.CountOrganizationsInDataBases);
        Assert.Equal(0, org.OrgInfoOther?.ZpNumDopPlaces);
    }

    [Fact]
    public async Task ImportCardInfoAsync_IgnoresOutOfRangeNumericValues()
    {
        using var legacyUnitOfWork = CreateLegacyUnitOfWork();
        var org = new LegacyOrg(legacyUnitOfWork)
        {
            Name = "Test org",
            OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
            {
                ParusLicenseNumber = "НА2360"
            }
        };
        org.OrgInfoOther.Org = org;
        legacyUnitOfWork.CommitChanges();

        var service = new ParusLicenseImportService(legacyUnitOfWork);
        var csv = """
                  НомерЛицензии;КоличествоБаз;КоличествоОрганизацийВБазах;ДопМест
                  2360;999999999999;999999999999;999999999999
                  """;
        var result = await service.ImportCardInfoAsync(ToStream(csv), "cards.csv", false, CancellationToken.None);

        Assert.Equal(1, result.MatchedRows);
        Assert.Equal(0, result.UpdatedOrganizations);
        Assert.Equal(1, result.UnchangedOrganizations);
        Assert.Equal(0, org.OrgInfoOther?.ZpNumOfBases);
        Assert.Equal(0, org.OrgInfoOther?.CountOrganizationsInDataBases);
        Assert.Equal(0, org.OrgInfoOther?.ZpNumDopPlaces);
    }

    private static LegacyUnitOfWork CreateLegacyUnitOfWork()
    {
        var dataLayer = new SimpleDataLayer(new InMemoryDataStore());
        return new LegacyUnitOfWork(dataLayer);
    }

    private static MemoryStream ToStream(string value)
        => new(Encoding.UTF8.GetBytes(value));

    private static byte[] BuildZip(params (string Name, string Content)[] entries)
    {
        using var memory = new MemoryStream();
        using (var archive = new ZipArchive(memory, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (var (name, content) in entries)
            {
                var entry = archive.CreateEntry(name);
                using var stream = entry.Open();
                var bytes = Encoding.UTF8.GetBytes(content);
                stream.Write(bytes, 0, bytes.Length);
            }
        }

        return memory.ToArray();
    }

    private static string BuildCardCsv()
        => """
           НомерЛицензии;Наименование;Телефон;емаил;ФИО;СоставЛицензии;Работает;НачалоРаботы;Ведущий;КоличествоБаз;КоличествоОрганизацийВБазах;ДопМест;Доп;ПарусЗарплата;ТорнадоЗарплата
           2360;Test org;8 (383) 100-10-10;client@example.test;Иванов Иван;Расчет зарплаты, 5 мест;1;15.01.2024;Петров;3;12;2;Комментарий;1;0
           999999;Missing org;8 (383) 200-20-20;missing@example.test;Петров Петр;Нет;0;;;0;0;0;;0;0
           """;

    private static string BuildXml()
        => """
           <?xml version="1.0"?>
           <Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
             <Worksheet ss:Name="List1">
               <Table>
                 <Row>
                   <Cell><Data ss:Type="String">№П/П</Data></Cell>
                   <Cell><Data ss:Type="String">Рег. номер клиента</Data></Cell>
                   <Cell><Data ss:Type="String">Мнемокод клиента</Data></Cell>
                   <Cell><Data ss:Type="String">ИНН</Data></Cell>
                   <Cell><Data ss:Type="String">Отрасль клиента</Data></Cell>
                   <Cell><Data ss:Type="String">Рег. номер абонемента</Data></Cell>
                   <Cell><Data ss:Type="String">Дата выдачи абонемента</Data></Cell>
                   <Cell><Data ss:Type="String">Срок с</Data></Cell>
                   <Cell><Data ss:Type="String">Срок по</Data></Cell>
                   <Cell><Data ss:Type="String">Номенклатура</Data></Cell>
                   <Cell><Data ss:Type="String">Модификация</Data></Cell>
                   <Cell><Data ss:Type="String">Кол-во</Data></Cell>
                 </Row>
                 <Row>
                   <Cell><Data ss:Type="String">МР-397 ООО "ПУЛЬС ГРУП"</Data></Cell>
                 </Row>
                 <Row>
                   <Cell ss:Index="2"><Data ss:Type="String">НА-2360</Data></Cell>
                   <Cell><Data ss:Type="String">АдминТатарНСО</Data></Cell>
                   <Cell><Data ss:Type="String">5453175287</Data></Cell>
                 </Row>
                 <Row>
                   <Cell ss:Index="6"><Data ss:Type="String">НА2360-2-11</Data></Cell>
                   <Cell><Data ss:Type="DateTime">2025-02-21T00:00:00.000</Data></Cell>
                   <Cell><Data ss:Type="DateTime">2025-02-21T00:00:00.000</Data></Cell>
                   <Cell><Data ss:Type="DateTime">2026-02-21T00:00:00.000</Data></Cell>
                 </Row>
                 <Row>
                   <Cell ss:Index="10"><Data ss:Type="String">PARUS 10 Б</Data></Cell>
                   <Cell><Data ss:Type="String">Модуль «Расчет заработной платы»</Data></Cell>
                   <Cell><Data ss:Type="Number">5</Data></Cell>
                 </Row>
                 <Row>
                   <Cell ss:Index="10"><Data ss:Type="String">PARUS 10 Б</Data></Cell>
                   <Cell><Data ss:Type="String">Рабочее место для модуля «Расчет заработной платы»</Data></Cell>
                   <Cell><Data ss:Type="Number">1</Data></Cell>
                 </Row>
               </Table>
             </Worksheet>
           </Workbook>
           """;
}

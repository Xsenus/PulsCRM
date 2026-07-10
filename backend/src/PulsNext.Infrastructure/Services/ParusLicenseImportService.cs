using System.Globalization;
using System.Data;
using System.Data.OleDb;
using System.IO.Compression;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;
using DevExpress.Xpo;
using PulsNext.Domain.Legacy;

namespace PulsNext.Infrastructure;

public interface IParusLicenseImportService
{
    Task<ParusLicenseInfoImportResultDto> ImportInfoAsync(Stream stream, string fileName, bool dryRun, CancellationToken cancellationToken);
    Task<ParusLicenseFileImportResultDto> ImportFilesAsync(IReadOnlyCollection<ParusLicenseFileImportItem> files, bool dryRun, CancellationToken cancellationToken);
    Task<ParusLicenseCardImportResultDto> ImportCardInfoAsync(Stream stream, string fileName, bool dryRun, CancellationToken cancellationToken);
    Task<ParusLicenseBatchImportResultDto> ImportBatchAsync(IReadOnlyCollection<ParusLicenseFileImportItem> files, bool dryRun, CancellationToken cancellationToken);
}

public sealed record ParusLicenseFileImportItem(string FileName, long Length, Func<Stream> OpenReadStream);

public sealed class ParusLicenseImportService(LegacyUnitOfWork legacyUnitOfWork) : IParusLicenseImportService
{
    private const string SpreadsheetNamespace = "urn:schemas-microsoft-com:office:spreadsheet";
    private const int MissingOrganizationLimit = 50;
    private static readonly CultureInfo RussianCulture = CultureInfo.GetCultureInfo("ru-RU");

    public Task<ParusLicenseInfoImportResultDto> ImportInfoAsync(Stream stream, string fileName, bool dryRun, CancellationToken cancellationToken)
    {
        var result = new ImportAccumulator(fileName, dryRun);
        var organizationsByInn = BuildOrganizationsByInn();
        var existingLicenses = BuildExistingLicenseIndex();
        var touchedOrganizations = new Dictionary<int, TouchedOrganization>();
        var state = new SpreadsheetState();

        var settings = new XmlReaderSettings
        {
            Async = false,
            DtdProcessing = DtdProcessing.Ignore,
            IgnoreComments = true,
            IgnoreWhitespace = true
        };

        using var reader = XmlReader.Create(stream, settings);
        while (reader.Read())
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (reader.NodeType != XmlNodeType.Element || reader.LocalName != "Row")
            {
                continue;
            }

            result.TotalRows += 1;
            var row = ReadRow(reader);
            if (IsHeaderRow(row))
            {
                result.SkippedRows += 1;
                continue;
            }

            UpdateState(state, row);
            var parsed = TryBuildRecord(state, row, result);
            if (parsed is null)
            {
                continue;
            }

            result.ComponentRows += 1;
            if (!organizationsByInn.TryGetValue(parsed.NormalizedInn, out var org))
            {
                result.MissingOrganizationRows += 1;
                result.AddMissingOrganization($"{parsed.Inn} - ({ExtractLicenseNumber(parsed.RegNumberClient)}) {parsed.MnemoOrg}");
                continue;
            }

            var key = BuildImportKey(parsed, org.Oid);
            if (existingLicenses.FullKeys.Contains(key))
            {
                result.DuplicateRows += 1;
                continue;
            }

            var updateCandidate = existingLicenses.FindUpdateCandidate(parsed, org.Oid);
            if (updateCandidate is not null)
            {
                TrackTouchedOrganization(touchedOrganizations, org, parsed);
                if (UpdateLicenseInfo(updateCandidate, parsed, org, dryRun))
                {
                    result.UpdatedRows += 1;
                    existingLicenses.FullKeys.Add(key);
                    continue;
                }

                result.DuplicateRows += 1;
                existingLicenses.FullKeys.Add(key);
                continue;
            }

            TrackTouchedOrganization(touchedOrganizations, org, parsed);
            if (!dryRun)
            {
                _ = new LegacyZPParusLicenseInfo(legacyUnitOfWork)
                {
                    Payer = parsed.Payer,
                    RegNumberClient = parsed.RegNumberClient,
                    MnemoOrg = parsed.MnemoOrg,
                    RegNumberAbonement = parsed.RegNumberAbonement,
                    DateCreate = DateTime.Today,
                    DateSince = parsed.DateSince,
                    DateTo = parsed.DateTo,
                    Nomenclature = parsed.Nomenclature,
                    Modification = parsed.Modification,
                    Number = parsed.Quantity,
                    INN = parsed.Inn,
                    Org = org
                };
            }

            existingLicenses.FullKeys.Add(key);
            result.ImportedRows += 1;
        }

        result.UpdatedOrganizations = UpdateOrganizationLicenseNumbers(touchedOrganizations.Values, dryRun);
        if (!dryRun && (result.ImportedRows > 0 || result.UpdatedRows > 0 || result.UpdatedOrganizations > 0))
        {
            legacyUnitOfWork.CommitChanges();
        }

        return Task.FromResult(result.ToDto());
    }

    public Task<ParusLicenseFileImportResultDto> ImportFilesAsync(IReadOnlyCollection<ParusLicenseFileImportItem> files, bool dryRun, CancellationToken cancellationToken)
    {
        var licenseLookup = new XPQuery<LegacyZPParusLicenseInfo>(legacyUnitOfWork)
            .ToList()
            .Where(license => license.Org is not null && !string.IsNullOrWhiteSpace(license.RegNumberAbonement))
            .OrderByDescending(license => license.DateTo)
            .ThenByDescending(license => license.DateSince)
            .ThenByDescending(license => license.Oid)
            .ToArray();
        var items = new List<ParusLicenseFileImportItemDto>();
        var imported = 0;
        var duplicates = 0;
        var missing = 0;
        var skipped = 0;
        long totalBytes = 0;

        foreach (var file in files)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var fileName = Path.GetFileName(file.FileName);
            var licenseNumber = ExtractLicenseNumber(fileName);
            if (string.IsNullOrWhiteSpace(fileName) || string.IsNullOrWhiteSpace(licenseNumber))
            {
                skipped += 1;
                items.Add(BuildFileItem(fileName, "skipped", licenseNumber, null, "Не удалось определить номер лицензии из имени файла."));
                continue;
            }

            var normalizedLicenseNumber = NormalizeLicenseForLookup(licenseNumber);
            var license = licenseLookup.FirstOrDefault(item =>
                item.RegNumberAbonement?.Contains(licenseNumber, StringComparison.OrdinalIgnoreCase) == true
                || NormalizeLicenseForLookup(item.RegNumberAbonement).Contains(normalizedLicenseNumber, StringComparison.OrdinalIgnoreCase));
            var org = license?.Org;
            if (org is null)
            {
                missing += 1;
                items.Add(BuildFileItem(fileName, "missing", licenseNumber, null, "В базе не найден абонемент с этим номером."));
                continue;
            }

            var targetOrganizations = ResolveLicenseFileTargetOrganizations(org);
            var uploadedFileData = ReadImportFileBytes(file);
            var sameFileAlreadyWritten = targetOrganizations.All(target =>
                HasSameLicenseFile(target.OrgInfoOther, fileName, uploadedFileData));
            var hasExistingFiles = targetOrganizations.Any(target =>
                target.OrgInfoOther?.ParusLicenseFileData is { Length: > 0 });

            if (sameFileAlreadyWritten)
            {
                duplicates += 1;
                items.Add(BuildFileItem(fileName, "duplicate", licenseNumber, org, "Файл с таким именем и содержимым уже записан в связанных карточках организаций."));
                continue;
            }

            if (!dryRun)
            {
                foreach (var targetOrganization in targetOrganizations)
                {
                    var other = targetOrganization.OrgInfoOther;
                    if (other is null)
                    {
                        other = new LegacyOrgInfoOther(legacyUnitOfWork) { Org = targetOrganization };
                        targetOrganization.OrgInfoOther = other;
                    }

                    other.ParusLicenseNumber = NormalizeBaseLicenseNumber(licenseNumber);
                    other.ParusLicenseFileName = fileName;
                    other.ParusLicenseFileData = uploadedFileData;
                }
            }

            totalBytes += file.Length;
            imported += 1;
            items.Add(BuildFileItem(
                fileName,
                dryRun ? "ready" : "imported",
                licenseNumber,
                org,
                BuildLicenseFileImportMessage(dryRun, hasExistingFiles, targetOrganizations.Count)));
        }

        if (!dryRun && imported > 0)
        {
            legacyUnitOfWork.CommitChanges();
        }

        return Task.FromResult(new ParusLicenseFileImportResultDto
        {
            DryRun = dryRun,
            TotalFiles = files.Count,
            ImportedFiles = imported,
            DuplicateFiles = duplicates,
            MissingLicenseFiles = missing,
            SkippedFiles = skipped,
            TotalBytes = totalBytes,
            Items = items.ToArray()
        });
    }

    private static byte[] ReadImportFileBytes(ParusLicenseFileImportItem file)
    {
        using var stream = file.OpenReadStream();
        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        return memory.ToArray();
    }

    private IReadOnlyCollection<LegacyOrg> ResolveLicenseFileTargetOrganizations(LegacyOrg licenseOrganization)
    {
        var targets = new Dictionary<int, LegacyOrg>
        {
            [licenseOrganization.Oid] = licenseOrganization
        };

        foreach (var org in new XPQuery<LegacyOrg>(legacyUnitOfWork)
                     .ToList()
                     .Where(org => org.OrgInfoOther?.OrgParusLicense?.Oid == licenseOrganization.Oid))
        {
            targets.TryAdd(org.Oid, org);
        }

        return targets.Values.ToArray();
    }

    private static bool HasSameLicenseFile(LegacyOrgInfoOther? other, string fileName, byte[] content)
        => other?.ParusLicenseFileData is { Length: > 0 } existingFileData
            && string.Equals(other.ParusLicenseFileName, fileName, StringComparison.OrdinalIgnoreCase)
            && existingFileData.SequenceEqual(content);

    private static string BuildLicenseFileImportMessage(bool dryRun, bool hasExistingFiles, int targetCount)
    {
        var targetText = targetCount == 1
            ? "карточку организации"
            : $"{targetCount} связанных карточек организаций";

        return hasExistingFiles
            ? dryRun ? $"Файл будет перезаписан в {targetText}." : $"Файл перезаписан в {targetText}."
            : dryRun ? $"Файл будет записан в {targetText}." : $"Файл записан в {targetText}.";
    }

    public async Task<ParusLicenseCardImportResultDto> ImportCardInfoAsync(Stream stream, string fileName, bool dryRun, CancellationToken cancellationToken)
    {
        var result = new CardImportAccumulator(fileName, dryRun);
        var rows = await ReadCardRowsAsync(stream, fileName, result, cancellationToken);
        var organizationsByLicense = BuildOrganizationsByLicense();
        var processedOrganizations = new HashSet<int>();

        foreach (var row in rows)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var rowKeys = BuildLicenseLookupKeys(row.LicenseNumber).ToArray();
            if (rowKeys.Length == 0)
            {
                result.InvalidRows += 1;
                continue;
            }

            var org = rowKeys
                .Select(key => organizationsByLicense.GetValueOrDefault(key))
                .FirstOrDefault(item => item is not null);
            if (org is null)
            {
                result.MissingLicenseRows += 1;
                result.AddMissingLicense(row.LicenseNumber ?? string.Empty);
                continue;
            }

            if (!processedOrganizations.Add(org.Oid))
            {
                result.DuplicateRows += 1;
                continue;
            }

            result.MatchedRows += 1;
            if (ApplyCardInfo(org, row, dryRun))
            {
                result.UpdatedOrganizations += 1;
            }
            else
            {
                result.UnchangedOrganizations += 1;
            }
        }

        if (!dryRun && result.UpdatedOrganizations > 0)
        {
            legacyUnitOfWork.CommitChanges();
        }

        return result.ToDto();
    }

    public async Task<ParusLicenseBatchImportResultDto> ImportBatchAsync(IReadOnlyCollection<ParusLicenseFileImportItem> files, bool dryRun, CancellationToken cancellationToken)
    {
        var errors = new List<string>();
        var logItems = new List<ParusLicenseImportLogItemDto>();
        var expandedFiles = await ExpandImportFilesAsync(files, errors, logItems, cancellationToken);
        var infoResults = new List<ParusLicenseInfoImportResultDto>();
        var licenseFiles = new List<ParusLicenseFileImportItem>();
        var skipped = new List<string>();

        foreach (var file in expandedFiles)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var extension = Path.GetExtension(file.FileName).ToLowerInvariant();
            switch (extension)
            {
                case ".xml":
                    await using (var stream = file.OpenReadStream())
                    {
                        var result = await ImportInfoAsync(stream, file.FileName, dryRun, cancellationToken);
                        infoResults.Add(result);
                        AddInfoImportLog(logItems, result);
                    }

                    break;

                case ".mdb":
                case ".accdb":
                case ".csv":
                case ".txt":
                    skipped.Add(file.FileName);
                    logItems.Add(new ParusLicenseImportLogItemDto
                    {
                        Stage = "cards",
                        Status = "skipped",
                        FileName = file.FileName,
                        Message = "Обновление карточек организаций отключено; файл не обработан."
                    });
                    break;

                case ".lic":
                    licenseFiles.Add(file);
                    logItems.Add(new ParusLicenseImportLogItemDto
                    {
                        Stage = "license-file",
                        Status = "queued",
                        FileName = file.FileName,
                        Message = "Файл лицензии добавлен в очередь обработки."
                    });
                    break;

                default:
                    skipped.Add(file.FileName);
                    logItems.Add(new ParusLicenseImportLogItemDto
                    {
                        Stage = "file",
                        Status = "skipped",
                        FileName = file.FileName,
                        Message = "Тип файла не поддерживается общим импортом."
                    });
                    break;
            }
        }

        var fileResult = licenseFiles.Count > 0
            ? await ImportFilesAsync(licenseFiles, dryRun, cancellationToken)
            : null;

        errors.AddRange(infoResults.SelectMany(result => result.Errors));

        if (fileResult is not null)
        {
            AddLicenseFileLogs(logItems, fileResult);
        }

        return new ParusLicenseBatchImportResultDto
        {
            DryRun = dryRun,
            TotalFiles = files.Count,
            ExpandedFiles = expandedFiles.Count,
            LicenseInfoFiles = infoResults.Count,
            CardInfoFiles = 0,
            LicenseFiles = licenseFiles.Count,
            SkippedFiles = skipped.Count,
            SkippedFileNames = skipped.Take(MissingOrganizationLimit).ToArray(),
            Errors = errors.Take(MissingOrganizationLimit).ToArray(),
            InfoResults = infoResults.ToArray(),
            CardResults = Array.Empty<ParusLicenseCardImportResultDto>(),
            FileResult = fileResult,
            LogItems = logItems.ToArray()
        };
    }

    private static async Task<IReadOnlyCollection<ParusLicenseFileImportItem>> ExpandImportFilesAsync(
        IReadOnlyCollection<ParusLicenseFileImportItem> files,
        ICollection<string> errors,
        ICollection<ParusLicenseImportLogItemDto> logItems,
        CancellationToken cancellationToken)
    {
        var result = new List<ParusLicenseFileImportItem>();
        foreach (var file in files)
        {
            cancellationToken.ThrowIfCancellationRequested();

            if (!Path.GetExtension(file.FileName).Equals(".zip", StringComparison.OrdinalIgnoreCase))
            {
                result.Add(file);
                continue;
            }

            try
            {
                await using var source = file.OpenReadStream();
                using var archive = new ZipArchive(source, ZipArchiveMode.Read, leaveOpen: false);
                foreach (var entry in archive.Entries)
                {
                    cancellationToken.ThrowIfCancellationRequested();

                    if (string.IsNullOrWhiteSpace(entry.Name) || entry.Length == 0)
                    {
                        continue;
                    }

                    await using var entryStream = entry.Open();
                    using var memory = new MemoryStream();
                    await entryStream.CopyToAsync(memory, cancellationToken);
                    var bytes = memory.ToArray();
                    var fileName = Path.GetFileName(entry.FullName);
                    result.Add(new ParusLicenseFileImportItem(
                        fileName,
                        bytes.LongLength,
                        () => new MemoryStream(bytes, writable: false)));
                    logItems.Add(new ParusLicenseImportLogItemDto
                    {
                        Stage = "archive",
                        Status = "expanded",
                        FileName = fileName,
                        Message = $"Файл извлечен из архива {file.FileName}."
                    });
                }
            }
            catch (InvalidDataException exception)
            {
                var message = $"Не удалось распаковать {file.FileName}: {exception.Message}";
                errors.Add(message);
                logItems.Add(new ParusLicenseImportLogItemDto
                {
                    Stage = "archive",
                    Status = "error",
                    FileName = file.FileName,
                    Message = message
                });
            }
            catch (IOException exception)
            {
                var message = $"Не удалось прочитать {file.FileName}: {exception.Message}";
                errors.Add(message);
                logItems.Add(new ParusLicenseImportLogItemDto
                {
                    Stage = "archive",
                    Status = "error",
                    FileName = file.FileName,
                    Message = message
                });
            }
        }

        return result;
    }

    private static void AddInfoImportLog(ICollection<ParusLicenseImportLogItemDto> logItems, ParusLicenseInfoImportResultDto result)
    {
        logItems.Add(new ParusLicenseImportLogItemDto
        {
            Stage = "license-info",
            Status = result.Errors.Count > 0 ? "warning" : "processed",
            FileName = result.FileName,
            Message = BuildInfoImportLogMessage(result)
        });

        foreach (var missing in result.MissingOrganizations.Take(MissingOrganizationLimit))
        {
            logItems.Add(new ParusLicenseImportLogItemDto
            {
                Stage = "license-info",
                Status = "missing-organization",
                FileName = result.FileName,
                Message = $"Организация не найдена: {missing}"
            });
        }

        foreach (var error in result.Errors.Take(MissingOrganizationLimit))
        {
            logItems.Add(new ParusLicenseImportLogItemDto
            {
                Stage = "license-info",
                Status = "error",
                FileName = result.FileName,
                Message = error
            });
        }
    }

    private static void AddLicenseFileLogs(ICollection<ParusLicenseImportLogItemDto> logItems, ParusLicenseFileImportResultDto result)
    {
        foreach (var item in result.Items)
        {
            logItems.Add(new ParusLicenseImportLogItemDto
            {
                Stage = "license-file",
                Status = item.Status,
                FileName = item.FileName,
                LicenseNumber = item.LicenseNumber,
                OrganizationId = item.OrganizationId,
                OrganizationName = item.OrganizationName,
                Message = item.Message
            });
        }
    }

    private static string BuildInfoImportLogMessage(ParusLicenseInfoImportResultDto result)
        => string.Join(" · ", new[]
        {
            $"строк: {result.TotalRows}",
            $"состав: {result.ComponentRows}",
            $"{(result.DryRun ? "будет добавлено" : "добавлено")}: {result.ImportedRows}",
            $"{(result.DryRun ? "будет обновлено" : "обновлено")}: {result.UpdatedRows}",
            $"дубликатов: {result.DuplicateRows}",
            $"не найдены организации: {result.MissingOrganizationRows}",
            $"ошибочных строк: {result.InvalidRows}"
        });

    private Dictionary<string, LegacyOrg> BuildOrganizationsByInn()
    {
        return new XPQuery<LegacyOrg>(legacyUnitOfWork)
            .ToList()
            .Select(org => new { Org = org, Inn = NormalizeInn(org.INN) })
            .Where(item => !string.IsNullOrWhiteSpace(item.Inn))
            .GroupBy(item => item.Inn, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().Org, StringComparer.OrdinalIgnoreCase);
    }

    private Dictionary<string, LegacyOrg> BuildOrganizationsByLicense()
    {
        var result = new Dictionary<string, LegacyOrg>(StringComparer.OrdinalIgnoreCase);
        foreach (var org in new XPQuery<LegacyOrg>(legacyUnitOfWork).ToList())
        {
            foreach (var key in BuildOrganizationLicenseKeys(org))
            {
                result.TryAdd(key, org);
            }
        }

        return result;
    }

    private static IEnumerable<string> BuildOrganizationLicenseKeys(LegacyOrg org)
    {
        foreach (var key in BuildLicenseLookupKeys(org.OrgInfoOther?.ParusLicenseNumber))
        {
            yield return key;
        }

        var latestLicenseNumber = org.ParusLicenseInfo
            .Cast<LegacyZPParusLicenseInfo>()
            .OrderByDescending(license => license.DateTo)
            .ThenByDescending(license => license.DateSince)
            .Select(license => ExtractLicenseNumber(license.RegNumberClient))
            .FirstOrDefault(value => !string.IsNullOrWhiteSpace(value));

        foreach (var key in BuildLicenseLookupKeys(latestLicenseNumber))
        {
            yield return key;
        }
    }

    private ExistingLicenseIndex BuildExistingLicenseIndex()
    {
        var licenses = new XPQuery<LegacyZPParusLicenseInfo>(legacyUnitOfWork)
            .ToList()
            .Where(license => license.Org is not null)
            .ToArray();
        var fullKeys = licenses
            .Select(license => BuildImportKey(
                NormalizePayer(license.Payer),
                license.RegNumberClient,
                license.MnemoOrg,
                license.RegNumberAbonement,
                license.DateSince,
                license.DateTo,
                license.Nomenclature,
                license.Modification,
                license.Number,
                license.Org!.Oid))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);
        var legacyKeys = licenses
            .GroupBy(license => BuildLegacyImportKey(
                NormalizePayer(license.Payer),
                license.RegNumberClient,
                license.MnemoOrg,
                license.RegNumberAbonement,
                license.Modification),
                StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.OrdinalIgnoreCase);

        return new ExistingLicenseIndex(fullKeys, legacyKeys);
    }

    private async Task<IReadOnlyCollection<ParusLicenseCardRow>> ReadCardRowsAsync(
        Stream stream,
        string fileName,
        CardImportAccumulator result,
        CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(fileName).ToLowerInvariant();
        switch (extension)
        {
            case ".mdb":
            case ".accdb":
                var tempPath = Path.Combine(Path.GetTempPath(), $"puls-parus-cards-{Guid.NewGuid():N}{extension}");
                try
                {
                    await using (var fileStream = File.Create(tempPath))
                    {
                        await stream.CopyToAsync(fileStream, cancellationToken);
                    }

                    return ReadAccessCardRows(tempPath, extension, result);
                }
                catch (Exception exception) when (exception is OleDbException
                    or InvalidOperationException
                    or PlatformNotSupportedException
                    or NotSupportedException)
                {
                    result.AddError($"Не удалось прочитать Access-файл: {exception.Message}");
                    return Array.Empty<ParusLicenseCardRow>();
                }
                finally
                {
                    TryDeleteTempFile(tempPath);
                }

            case ".csv":
            case ".txt":
                return ReadCsvCardRows(stream, result);

            default:
                result.AddError("Поддерживаются файлы .mdb, .accdb, .csv и .txt.");
                return Array.Empty<ParusLicenseCardRow>();
        }
    }

    private static IReadOnlyCollection<ParusLicenseCardRow> ReadAccessCardRows(string filePath, string extension, CardImportAccumulator result)
    {
        if (!OperatingSystem.IsWindows())
        {
            throw new PlatformNotSupportedException("Чтение Access-файлов через OleDb доступно только на Windows.");
        }

        var connectionStrings = extension.Equals(".mdb", StringComparison.OrdinalIgnoreCase)
            ? new[]
            {
                ("ACE", $"Provider=Microsoft.ACE.OLEDB.12.0;Data Source={filePath};Persist Security Info=False;"),
                ("Jet", $"Provider=Microsoft.Jet.OLEDB.4.0;Data Source={filePath};Persist Security Info=False;")
            }
            : new[]
            {
                ("ACE", $"Provider=Microsoft.ACE.OLEDB.12.0;Data Source={filePath};Persist Security Info=False;")
            };

        var providerErrors = new List<string>();
        foreach (var (providerName, connectionString) in connectionStrings)
        {
            try
            {
                using var connection = new OleDbConnection(connectionString);
                connection.Open();
                using var command = connection.CreateCommand();
                command.CommandText = "SELECT * FROM [Клиент]";
                using var reader = command.ExecuteReader();
                var rows = new List<ParusLicenseCardRow>();
                while (reader is not null && reader.Read())
                {
                    result.TotalRows += 1;
                    rows.Add(ReadCardRow(reader));
                }

                return rows;
            }
            catch (Exception exception) when (exception is OleDbException or InvalidOperationException)
            {
                providerErrors.Add($"{providerName}: {exception.Message}");
            }
        }

        var providerHint = extension.Equals(".accdb", StringComparison.OrdinalIgnoreCase)
            ? " Для .accdb нужен установленный Microsoft Access Database Engine (ACE OLEDB)."
            : " Для .mdb/.accdb нужен установленный Microsoft Access Database Engine (ACE OLEDB) или Jet OLEDB для старых .mdb.";
        throw new InvalidOperationException($"Не удалось открыть Access-файл.{providerHint} {string.Join(" | ", providerErrors)}");
    }

    private static IReadOnlyCollection<ParusLicenseCardRow> ReadCsvCardRows(Stream stream, CardImportAccumulator result)
    {
        using var reader = new StreamReader(stream, Encoding.UTF8, detectEncodingFromByteOrderMarks: true, leaveOpen: true);
        var headerLine = reader.ReadLine();
        if (string.IsNullOrWhiteSpace(headerLine))
        {
            result.AddError("CSV-файл пустой.");
            return Array.Empty<ParusLicenseCardRow>();
        }

        var delimiter = GuessDelimiter(headerLine);
        var headers = SplitDelimitedLine(headerLine, delimiter)
            .Select((name, index) => new { Name = NormalizeColumnName(name), Index = index })
            .Where(item => !string.IsNullOrWhiteSpace(item.Name))
            .GroupBy(item => item.Name, StringComparer.OrdinalIgnoreCase)
            .ToDictionary(group => group.Key, group => group.First().Index, StringComparer.OrdinalIgnoreCase);

        var rows = new List<ParusLicenseCardRow>();
        while (!reader.EndOfStream)
        {
            var line = reader.ReadLine();
            if (string.IsNullOrWhiteSpace(line))
            {
                continue;
            }

            result.TotalRows += 1;
            var values = SplitDelimitedLine(line, delimiter);
            rows.Add(new ParusLicenseCardRow(
                GetCsvValue(values, headers, "номерлицензии", "license", "licensenumber"),
                GetCsvValue(values, headers, "телефон", "phone"),
                GetCsvValue(values, headers, "емаил", "email", "mail"),
                GetCsvValue(values, headers, "фио", "fio"),
                GetCsvValue(values, headers, "составлицензии", "composition"),
                TryParseBool(GetCsvValue(values, headers, "работает", "working")),
                TryParseNullableDate(GetCsvValue(values, headers, "началоработы", "workbegin")),
                GetCsvValue(values, headers, "ведущий", "user"),
                TryParseInt(GetCsvValue(values, headers, "количествобаз", "databasecount")),
                TryParseInt(GetCsvValue(values, headers, "количествоорганизацийвбазах", "organizationcount", "organizationsindatabases")),
                TryParseInt(GetCsvValue(values, headers, "допмест", "допрабмест", "дополнительныеместа", "extraworkplaces", "additionalworkplaces", "dopplaces")),
                GetCsvValue(values, headers, "доп", "comment"),
                TryParseInt(GetCsvValue(values, headers, "парусзарплата", "parussalary")),
                TryParseInt(GetCsvValue(values, headers, "торнадозарплата", "tornadosalary")),
                GetCsvValue(values, headers, "наименование", "name")));
        }

        return rows;
    }

    private static ParusLicenseCardRow ReadCardRow(IDataRecord reader)
        => new(
            GetRecordString(reader, "НомерЛицензии"),
            GetRecordString(reader, "Телефон"),
            GetRecordString(reader, "емаил"),
            GetRecordString(reader, "ФИО"),
            GetRecordString(reader, "СоставЛицензии"),
            TryParseBool(GetRecordValue(reader, "Работает")),
            TryParseNullableDate(GetRecordValue(reader, "НачалоРаботы")),
            GetRecordString(reader, "Ведущий"),
            TryParseInt(GetRecordValue(reader, "КоличествоБаз")),
            TryParseInt(GetFirstRecordValue(reader, "КоличествоОрганизацийВБазах", "КолОрганизацийВБазах", "ОрганизацийВБазах")),
            TryParseInt(GetFirstRecordValue(reader, "ДопМест", "ДопРабМест", "ДополнительныеМеста", "ZpNumDopPlaces")),
            GetRecordString(reader, "Доп"),
            TryParseInt(GetRecordValue(reader, "ПарусЗарплата")),
            TryParseInt(GetRecordValue(reader, "ТорнадоЗарплата")),
            GetRecordString(reader, "Наименование"));

    private bool ApplyCardInfo(LegacyOrg org, ParusLicenseCardRow row, bool dryRun)
    {
        var changed = false;
        var other = org.OrgInfoOther;
        if (other is null)
        {
            changed = true;
            if (!dryRun)
            {
                other = new LegacyOrgInfoOther(legacyUnitOfWork) { Org = org };
                org.OrgInfoOther = other;
            }
        }

        if (other is null)
        {
            return changed;
        }

        changed |= SetText(other.ZpPhone, row.Phone, value => other.ZpPhone = value, dryRun);
        changed |= SetText(other.ZpEmail, row.Email, value => other.ZpEmail = value, dryRun);
        changed |= SetText(other.ZpFIO, row.Fio, value => other.ZpFIO = value, dryRun);
        changed |= SetText(other.ZpLicSostav, row.LicenseComposition, value => other.ZpLicSostav = value, dryRun);
        changed |= SetText(other.ZpComment, row.Comment, value => other.ZpComment = value, dryRun);

        if (row.DatabaseCount is not null && other.ZpNumOfBases != row.DatabaseCount.Value)
        {
            changed = true;
            if (!dryRun)
            {
                other.ZpNumOfBases = row.DatabaseCount.Value;
            }
        }

        if (row.OrganizationCount is not null && other.CountOrganizationsInDataBases != row.OrganizationCount.Value)
        {
            changed = true;
            if (!dryRun)
            {
                other.CountOrganizationsInDataBases = row.OrganizationCount.Value;
            }
        }

        if (row.ExtraWorkplaces is not null && other.ZpNumDopPlaces != row.ExtraWorkplaces.Value)
        {
            changed = true;
            if (!dryRun)
            {
                other.ZpNumDopPlaces = row.ExtraWorkplaces.Value;
            }
        }

        if (row.Working is not null && other.ZpWorking != row.Working.Value)
        {
            changed = true;
            if (!dryRun)
            {
                other.ZpWorking = row.Working.Value;
            }
        }

        if (row.BeginWorkDate is not null && other.ZpDateWorkBegin.Date != row.BeginWorkDate.Value.Date)
        {
            changed = true;
            if (!dryRun)
            {
                other.ZpDateWorkBegin = row.BeginWorkDate.Value.Date;
            }
        }

        var user = ResolveCardUser(row.UserName);
        if (user is not null && other.ZpUser?.Oid != user.Oid)
        {
            changed = true;
            if (!dryRun)
            {
                other.ZpUser = user;
            }
        }

        var platform = ResolveCardPlatform(row);
        if (platform is not null && other.ZpPlatform?.Oid != platform.Oid)
        {
            changed = true;
            if (!dryRun)
            {
                other.ZpPlatform = platform;
            }
        }

        return changed;
    }

    private static string[] ReadRow(XmlReader reader)
    {
        var values = new List<string>();
        using var subtree = reader.ReadSubtree();

        while (subtree.Read())
        {
            if (subtree.NodeType != XmlNodeType.Element || subtree.LocalName != "Cell")
            {
                continue;
            }

            var index = subtree.GetAttribute("Index", SpreadsheetNamespace);
            var columnIndex = TryParsePositiveInt(index);
            if (columnIndex is not null)
            {
                while (values.Count < columnIndex.Value - 1)
                {
                    values.Add(string.Empty);
                }
            }

            values.Add(ReadCellValue(subtree));
        }

        return values.ToArray();
    }

    private static string ReadCellValue(XmlReader cellReader)
    {
        if (cellReader.IsEmptyElement)
        {
            return string.Empty;
        }

        using var subtree = cellReader.ReadSubtree();
        while (subtree.Read())
        {
            if (subtree.NodeType == XmlNodeType.Element && subtree.LocalName == "Data")
            {
                return subtree.ReadElementContentAsString().Trim();
            }
        }

        return string.Empty;
    }

    private static void UpdateState(SpreadsheetState state, string[] row)
    {
        state.Payer = FirstNotEmpty(GetCell(row, 1), state.Payer);
        state.Payer = NormalizePayer(state.Payer);
        state.RegNumberClient = FirstNotEmpty(GetCell(row, 2), state.RegNumberClient);
        state.MnemoOrg = FirstNotEmpty(GetCell(row, 3), state.MnemoOrg);
        state.Inn = FirstNotEmpty(GetCell(row, 4), state.Inn);
        state.RegNumberAbonement = FirstNotEmpty(GetCell(row, 6), state.RegNumberAbonement);

        if (TryParseDate(GetCell(row, 8), out var dateSince))
        {
            state.DateSince = dateSince;
        }

        if (TryParseDate(GetCell(row, 9), out var dateTo))
        {
            state.DateTo = dateTo;
        }
    }

    private static ParsedLicenseRow? TryBuildRecord(SpreadsheetState state, string[] row, ImportAccumulator result)
    {
        var nomenclature = NullIfWhiteSpace(GetCell(row, 10));
        var modification = NullIfWhiteSpace(GetCell(row, 11));
        var quantity = NullIfWhiteSpace(GetCell(row, 12));

        if (string.IsNullOrWhiteSpace(nomenclature) && string.IsNullOrWhiteSpace(modification) && string.IsNullOrWhiteSpace(quantity))
        {
            result.SkippedRows += 1;
            return null;
        }

        if (string.IsNullOrWhiteSpace(quantity))
        {
            result.SkippedRows += 1;
            return null;
        }

        var normalizedInn = NormalizeInn(state.Inn);
        if (string.IsNullOrWhiteSpace(state.Payer)
            || string.IsNullOrWhiteSpace(state.RegNumberClient)
            || string.IsNullOrWhiteSpace(state.RegNumberAbonement)
            || string.IsNullOrWhiteSpace(normalizedInn)
            || state.DateSince is null
            || state.DateTo is null)
        {
            result.InvalidRows += 1;
            result.AddError($"Строка состава пропущена: не заполнен клиент, абонемент, ИНН или период ({state.RegNumberClient} / {state.RegNumberAbonement}).");
            return null;
        }

        return new ParsedLicenseRow(
            state.Payer,
            state.RegNumberClient,
            state.MnemoOrg,
            state.Inn,
            normalizedInn,
            state.RegNumberAbonement,
            state.DateSince.Value,
            state.DateTo.Value,
            nomenclature,
            modification,
            quantity);
    }

    private static void TrackTouchedOrganization(IDictionary<int, TouchedOrganization> organizations, LegacyOrg org, ParsedLicenseRow row)
    {
        if (organizations.TryGetValue(org.Oid, out var current)
            && (current.DateTo > row.DateTo || (current.DateTo == row.DateTo && current.DateSince >= row.DateSince)))
        {
            return;
        }

        organizations[org.Oid] = new TouchedOrganization(org, row.DateSince, row.DateTo, row.RegNumberClient);
    }

    private int UpdateOrganizationLicenseNumbers(IEnumerable<TouchedOrganization> organizations, bool dryRun)
    {
        var updated = 0;
        foreach (var touched in organizations)
        {
            var org = touched.Org;
            var existingLatest = org.ParusLicenseInfo
                .Cast<LegacyZPParusLicenseInfo>()
                .OrderByDescending(license => license.DateTo)
                .ThenByDescending(license => license.DateSince)
                .FirstOrDefault();
            var latestNumber = existingLatest is not null && existingLatest.DateTo > touched.DateTo
                ? NormalizeBaseLicenseNumber(ExtractLicenseNumber(existingLatest.RegNumberClient))
                : NormalizeBaseLicenseNumber(ExtractLicenseNumber(touched.RegNumberClient));

            if (string.IsNullOrWhiteSpace(latestNumber) || string.Equals(org.OrgInfoOther?.ParusLicenseNumber, latestNumber, StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            updated += 1;
            if (dryRun)
            {
                continue;
            }

            var other = org.OrgInfoOther;
            if (other is null)
            {
                other = new LegacyOrgInfoOther(legacyUnitOfWork) { Org = org };
                org.OrgInfoOther = other;
            }

            other.ParusLicenseNumber = latestNumber;
        }

        return updated;
    }

    private static bool IsHeaderRow(string[] row)
    {
        var joined = string.Join(' ', row);
        return joined.Contains("Рег. номер клиента", StringComparison.OrdinalIgnoreCase)
            || joined.Contains("Номенклатура", StringComparison.OrdinalIgnoreCase)
            || joined.Contains("Кол-во", StringComparison.OrdinalIgnoreCase);
    }

    private static string BuildImportKey(ParsedLicenseRow row, int orgId)
        => BuildImportKey(
            row.Payer,
            row.RegNumberClient,
            row.MnemoOrg,
            row.RegNumberAbonement,
            row.DateSince,
            row.DateTo,
            row.Nomenclature,
            row.Modification,
            row.Quantity,
            orgId);

    private static string BuildImportKey(
        string? payer,
        string? regNumberClient,
        string? mnemoOrg,
        string? regNumberAbonement,
        DateTime dateSince,
        DateTime dateTo,
        string? nomenclature,
        string? modification,
        string? quantity,
        int orgId)
        => string.Join('|',
            orgId.ToString(CultureInfo.InvariantCulture),
            NormalizeKey(payer),
            NormalizeKey(regNumberClient),
            NormalizeKey(mnemoOrg),
            NormalizeKey(regNumberAbonement),
            dateSince.Date.ToString("yyyyMMdd", CultureInfo.InvariantCulture),
            dateTo.Date.ToString("yyyyMMdd", CultureInfo.InvariantCulture),
            NormalizeKey(nomenclature),
            NormalizeKey(modification),
            NormalizeKey(quantity));

    private static string BuildLegacyImportKey(ParsedLicenseRow row)
        => BuildLegacyImportKey(
            row.Payer,
            row.RegNumberClient,
            row.MnemoOrg,
            row.RegNumberAbonement,
            row.Modification);

    private static string BuildLegacyImportKey(
        string? payer,
        string? regNumberClient,
        string? mnemoOrg,
        string? regNumberAbonement,
        string? modification)
        => string.Join('|',
            NormalizeKey(payer),
            NormalizeKey(regNumberClient),
            NormalizeKey(mnemoOrg),
            NormalizeKey(regNumberAbonement),
            NormalizeKey(modification));

    private static bool UpdateLicenseInfo(LegacyZPParusLicenseInfo license, ParsedLicenseRow row, LegacyOrg org, bool dryRun)
    {
        var changed = false;
        changed |= !StringEquals(license.Payer, row.Payer);
        changed |= !StringEquals(license.RegNumberClient, row.RegNumberClient);
        changed |= !StringEquals(license.MnemoOrg, row.MnemoOrg);
        changed |= !StringEquals(license.RegNumberAbonement, row.RegNumberAbonement);
        changed |= license.DateSince.Date != row.DateSince.Date;
        changed |= license.DateTo.Date != row.DateTo.Date;
        changed |= !StringEquals(license.Nomenclature, row.Nomenclature);
        changed |= !StringEquals(license.Modification, row.Modification);
        changed |= !StringEquals(license.Number, row.Quantity);
        changed |= !StringEquals(license.INN, row.Inn);
        changed |= license.Org?.Oid != org.Oid;

        if (!changed || dryRun)
        {
            return changed;
        }

        license.Payer = row.Payer;
        license.RegNumberClient = row.RegNumberClient;
        license.MnemoOrg = row.MnemoOrg;
        license.RegNumberAbonement = row.RegNumberAbonement;
        license.DateSince = row.DateSince;
        license.DateTo = row.DateTo;
        license.Nomenclature = row.Nomenclature;
        license.Modification = row.Modification;
        license.Number = row.Quantity;
        license.INN = row.Inn;
        license.Org = org;

        return true;
    }

    private static bool StringEquals(string? left, string? right)
        => string.Equals(NullIfWhiteSpace(left), NullIfWhiteSpace(right), StringComparison.OrdinalIgnoreCase);

    private static string NormalizePayer(string? value)
    {
        var trimmed = NullIfWhiteSpace(value) ?? string.Empty;
        return trimmed switch
        {
            "МР-397 ООО \"ПУЛЬС ГРУП\"" => "ООО «ПУЛЬС-ГРУП»",
            "НА-1568 ООО \"Пульс-плюс\"" => "ООО «ПУЛЬС-ПЛЮС»",
            "ПУЛЬС-ПЛЮС" => "ООО «ПУЛЬС-ПЛЮС»",
            "ПУЛЬС ГРУП" => "ООО «ПУЛЬС-ГРУП»",
            _ => trimmed
        };
    }

    private static string NormalizeInn(string? value)
    {
        var inn = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
        return inn switch
        {
            "5431208394" => "5431103225",
            "5426101575" => "5434100695",
            "5432211417" => "5432211520",
            "5438107483" => "5438318685",
            "5435100779" => "5435111749",
            "5435100881" => "5435100747",
            "5431104902" => "5431200010",
            "5429107247" => "5429108804",
            "5428102126" => "5452111428",
            "5427106142" => "5427107298",
            "5425108962" => "5425002300",
            "5451110750" => "5451112404",
            "5451110100" => "5451110365",
            "5421101959" => "5421100271",
            "5431104765" => "5431106339",
            "5436106340" => "5436311966",
            "5440111906" => "5440113029",
            "5451105781" => "5451111753",
            _ => inn
        };
    }

    private static string ExtractLicenseNumber(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return string.Empty;
        }

        var stem = Path.GetFileNameWithoutExtension(value).Trim();
        var parts = stem.Split('_', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length == 3 && parts[1].Any(char.IsDigit))
        {
            return parts[1].Trim();
        }

        var licenseMatch = Regex.Match(stem, @"[A-Za-zА-Яа-я]{1,4}\s*-?\s*\d+(?:-\d+)*");
        if (licenseMatch.Success)
        {
            return new string(licenseMatch.Value.Where(ch => !char.IsWhiteSpace(ch)).ToArray()).Trim();
        }

        if (stem.Contains('-'))
        {
            return stem.Replace("-", string.Empty, StringComparison.Ordinal).Trim();
        }

        var match = Regex.Match(stem, @"(\d+)");
        return match.Success ? match.Value.Trim() : string.Empty;
    }

    private static string NormalizeLicenseForLookup(string? value)
        => new((value ?? string.Empty)
            .Where(ch => !char.IsWhiteSpace(ch) && ch != '-')
            .Select(NormalizeLicenseChar)
            .ToArray());

    private static char NormalizeLicenseChar(char value)
        => char.ToUpperInvariant(value) switch
        {
            'А' => 'A',
            'В' => 'B',
            'Е' => 'E',
            'К' => 'K',
            'М' => 'M',
            'Н' => 'H',
            'О' => 'O',
            'Р' => 'P',
            'С' => 'C',
            'Т' => 'T',
            'Х' => 'X',
            _ => char.ToUpperInvariant(value)
        };

    private static string NormalizeBaseLicenseNumber(string value)
    {
        var trimmed = value.Trim();
        var parts = trimmed.Split('-', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
        if (parts.Length >= 3)
        {
            return NormalizeLicenseCompact(parts[0]);
        }

        if (parts.Length == 2)
        {
            return parts[0].Any(char.IsDigit)
                ? NormalizeLicenseCompact(parts[0])
                : NormalizeLicenseCompact($"{parts[0]}{parts[1]}");
        }

        return NormalizeLicenseCompact(trimmed);
    }

    private static string NormalizeLicenseCompact(string? value)
        => new((value ?? string.Empty)
            .Where(ch => !char.IsWhiteSpace(ch) && ch != '-')
            .Select(char.ToUpperInvariant)
            .ToArray());

    private static ParusLicenseFileImportItemDto BuildFileItem(string fileName, string status, string? licenseNumber, LegacyOrg? org, string message)
        => new()
        {
            FileName = fileName,
            Status = status,
            LicenseNumber = NullIfWhiteSpace(licenseNumber),
            OrganizationId = org?.Oid,
            OrganizationName = org?.Name ?? org?.FullName,
            Message = message
        };

    private static bool TryParseDate(string? value, out DateTime date)
    {
        date = default;
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var text = value.Trim();
        if (DateTime.TryParse(text, RussianCulture, DateTimeStyles.AssumeLocal, out date)
            || DateTime.TryParse(text, CultureInfo.InvariantCulture, DateTimeStyles.AssumeLocal, out date))
        {
            date = date.Date;
            return true;
        }

        if (double.TryParse(text, NumberStyles.Float, CultureInfo.InvariantCulture, out var oaDate))
        {
            try
            {
                date = DateTime.FromOADate(oaDate).Date;
                return true;
            }
            catch (ArgumentException)
            {
                return false;
            }
        }

        return false;
    }

    private static int? TryParsePositiveInt(string? value)
        => int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var result) && result > 0
            ? result
            : null;

    private static string GetCell(string[] row, int index)
        => index <= row.Length ? row[index - 1].Trim() : string.Empty;

    private static string FirstNotEmpty(params string?[] values)
        => values.FirstOrDefault(value => !string.IsNullOrWhiteSpace(value))?.Trim() ?? string.Empty;

    private static string? NullIfWhiteSpace(string? value)
        => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

    private static string NormalizeKey(string? value)
        => (NullIfWhiteSpace(value) ?? string.Empty).ToUpperInvariant();

    private static IEnumerable<string> BuildLicenseLookupKeys(string? value)
    {
        var normalized = NormalizeLicenseForLookup(ExtractLicenseNumber(value));
        if (!string.IsNullOrWhiteSpace(normalized))
        {
            yield return normalized;
        }

        var digits = new string((value ?? string.Empty).Where(char.IsDigit).ToArray());
        if (!string.IsNullOrWhiteSpace(digits) && !string.Equals(digits, normalized, StringComparison.OrdinalIgnoreCase))
        {
            yield return digits;
        }
    }

    private static bool SetText(string? current, string? source, Action<string> assign, bool dryRun)
    {
        var value = NullIfWhiteSpace(source);
        if (value is null || string.Equals(NullIfWhiteSpace(current), value, StringComparison.Ordinal))
        {
            return false;
        }

        if (!dryRun)
        {
            assign(value);
        }

        return true;
    }

    private LegacyUser? ResolveCardUser(string? value)
    {
        var text = value?.ToLowerInvariant() ?? string.Empty;
        var userId = text switch
        {
            var item when item.Contains("ананьев", StringComparison.Ordinal) => 4,
            var item when item.Contains("голубева", StringComparison.Ordinal) => 9,
            var item when item.Contains("кулагин", StringComparison.Ordinal) => 16,
            var item when item.Contains("петров", StringComparison.Ordinal) => 22,
            var item when item.Contains("уткина", StringComparison.Ordinal) => 30,
            var item when item.Contains("матвеев", StringComparison.Ordinal) => 44,
            _ => -1
        };

        return userId > 0 ? legacyUnitOfWork.GetObjectByKey<LegacyUser>(userId) : null;
    }

    private LegacySprEnumeration? ResolveCardPlatform(ParusLicenseCardRow row)
    {
        if (row.TornadoSalary is > 0)
        {
            return legacyUnitOfWork.GetObjectByKey<LegacySprEnumeration>(87);
        }

        return row.ParusSalary is > 0
            ? legacyUnitOfWork.GetObjectByKey<LegacySprEnumeration>(86)
            : null;
    }

    private static string NormalizeColumnName(string? value)
        => new((value ?? string.Empty)
            .Where(char.IsLetterOrDigit)
            .Select(char.ToLowerInvariant)
            .ToArray());

    private static string? GetCsvValue(string[] values, IReadOnlyDictionary<string, int> headers, params string[] names)
    {
        foreach (var name in names)
        {
            if (headers.TryGetValue(NormalizeColumnName(name), out var index) && index >= 0 && index < values.Length)
            {
                return NullIfWhiteSpace(values[index]);
            }
        }

        return null;
    }

    private static char GuessDelimiter(string line)
    {
        var candidates = new[] { ';', '\t', ',' };
        return candidates
            .OrderByDescending(candidate => line.Count(ch => ch == candidate))
            .First();
    }

    private static string[] SplitDelimitedLine(string line, char delimiter)
    {
        var values = new List<string>();
        var buffer = new StringBuilder();
        var inQuotes = false;

        for (var index = 0; index < line.Length; index += 1)
        {
            var ch = line[index];
            if (ch == '"')
            {
                if (inQuotes && index + 1 < line.Length && line[index + 1] == '"')
                {
                    buffer.Append('"');
                    index += 1;
                }
                else
                {
                    inQuotes = !inQuotes;
                }

                continue;
            }

            if (ch == delimiter && !inQuotes)
            {
                values.Add(buffer.ToString().Trim());
                buffer.Clear();
                continue;
            }

            buffer.Append(ch);
        }

        values.Add(buffer.ToString().Trim());
        return values.ToArray();
    }

    private static string? GetRecordString(IDataRecord reader, string name)
    {
        var value = GetRecordValue(reader, name);
        return value is DBNull ? null : NullIfWhiteSpace(Convert.ToString(value, CultureInfo.InvariantCulture));
    }

    private static object? GetRecordValue(IDataRecord reader, string name)
    {
        for (var index = 0; index < reader.FieldCount; index += 1)
        {
            if (string.Equals(reader.GetName(index), name, StringComparison.OrdinalIgnoreCase))
            {
                return reader.GetValue(index);
            }
        }

        return null;
    }

    private static object? GetFirstRecordValue(IDataRecord reader, params string[] names)
        => names
            .Select(name => GetRecordValue(reader, name))
            .FirstOrDefault(value => value is not null && value is not DBNull);

    private static int? TryParseInt(object? value)
    {
        if (value is null or DBNull)
        {
            return null;
        }

        return value switch
        {
            int intValue => intValue,
            long longValue => longValue is >= int.MinValue and <= int.MaxValue ? (int)longValue : null,
            short shortValue => shortValue,
            byte byteValue => byteValue,
            double doubleValue => doubleValue is >= int.MinValue and <= int.MaxValue ? (int)doubleValue : null,
            decimal decimalValue => decimalValue is >= int.MinValue and <= int.MaxValue ? (int)decimalValue : null,
            bool boolValue => boolValue ? 1 : 0,
            _ => int.TryParse(Convert.ToString(value, CultureInfo.InvariantCulture), NumberStyles.Integer, CultureInfo.InvariantCulture, out var result)
                || int.TryParse(Convert.ToString(value, RussianCulture), NumberStyles.Integer, RussianCulture, out result)
                    ? result
                    : null
        };
    }

    private static bool? TryParseBool(object? value)
    {
        if (value is null or DBNull)
        {
            return null;
        }

        if (value is bool boolValue)
        {
            return boolValue;
        }

        var text = Convert.ToString(value, RussianCulture)?.Trim();
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        if (int.TryParse(text, NumberStyles.Integer, RussianCulture, out var intValue))
        {
            return intValue != 0;
        }

        return text.Equals("true", StringComparison.OrdinalIgnoreCase)
            || text.Equals("да", StringComparison.OrdinalIgnoreCase)
            || text.Equals("истина", StringComparison.OrdinalIgnoreCase);
    }

    private static DateTime? TryParseNullableDate(object? value)
    {
        if (value is null or DBNull)
        {
            return null;
        }

        if (value is DateTime dateTime)
        {
            return dateTime.Date;
        }

        return TryParseDate(Convert.ToString(value, RussianCulture), out var parsed)
            ? parsed
            : null;
    }

    private static void TryDeleteTempFile(string path)
    {
        try
        {
            if (File.Exists(path))
            {
                File.Delete(path);
            }
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private sealed class SpreadsheetState
    {
        public string Payer { get; set; } = string.Empty;
        public string RegNumberClient { get; set; } = string.Empty;
        public string MnemoOrg { get; set; } = string.Empty;
        public string Inn { get; set; } = string.Empty;
        public string RegNumberAbonement { get; set; } = string.Empty;
        public DateTime? DateSince { get; set; }
        public DateTime? DateTo { get; set; }
    }

    private sealed record ParsedLicenseRow(
        string Payer,
        string RegNumberClient,
        string MnemoOrg,
        string Inn,
        string NormalizedInn,
        string RegNumberAbonement,
        DateTime DateSince,
        DateTime DateTo,
        string? Nomenclature,
        string? Modification,
        string Quantity);

    private sealed record TouchedOrganization(LegacyOrg Org, DateTime DateSince, DateTime DateTo, string RegNumberClient);

    private sealed class ExistingLicenseIndex(
        HashSet<string> fullKeys,
        Dictionary<string, LegacyZPParusLicenseInfo[]> legacyKeys)
    {
        public HashSet<string> FullKeys { get; } = fullKeys;

        public LegacyZPParusLicenseInfo? FindUpdateCandidate(ParsedLicenseRow row, int orgId)
        {
            if (!legacyKeys.TryGetValue(BuildLegacyImportKey(row), out var licenses))
            {
                return null;
            }

            return licenses
                .Where(license => StringEquals(license.Nomenclature, row.Nomenclature)
                    && StringEquals(license.Number, row.Quantity))
                .OrderByDescending(license => license.Org?.Oid == orgId)
                .ThenBy(license => Math.Abs((license.DateSince.Date - row.DateSince.Date).TotalDays))
                .ThenByDescending(license => license.DateTo)
                .ThenByDescending(license => license.Oid)
                .FirstOrDefault();
        }
    }

    private sealed record ParusLicenseCardRow(
        string? LicenseNumber,
        string? Phone,
        string? Email,
        string? Fio,
        string? LicenseComposition,
        bool? Working,
        DateTime? BeginWorkDate,
        string? UserName,
        int? DatabaseCount,
        int? OrganizationCount,
        int? ExtraWorkplaces,
        string? Comment,
        int? ParusSalary,
        int? TornadoSalary,
        string? Name);

    private sealed class ImportAccumulator(string fileName, bool dryRun)
    {
        private readonly List<string> _missingOrganizations = new();
        private readonly List<string> _errors = new();

        public string FileName { get; } = fileName;
        public bool DryRun { get; } = dryRun;
        public int TotalRows { get; set; }
        public int ComponentRows { get; set; }
        public int ImportedRows { get; set; }
        public int UpdatedRows { get; set; }
        public int DuplicateRows { get; set; }
        public int SkippedRows { get; set; }
        public int MissingOrganizationRows { get; set; }
        public int InvalidRows { get; set; }
        public int UpdatedOrganizations { get; set; }

        public void AddMissingOrganization(string value)
        {
            if (_missingOrganizations.Count >= MissingOrganizationLimit || _missingOrganizations.Contains(value, StringComparer.OrdinalIgnoreCase))
            {
                return;
            }

            _missingOrganizations.Add(value);
        }

        public void AddError(string value)
        {
            if (_errors.Count >= MissingOrganizationLimit)
            {
                return;
            }

            _errors.Add(value);
        }

        public ParusLicenseInfoImportResultDto ToDto()
            => new()
            {
                FileName = FileName,
                DryRun = DryRun,
                TotalRows = TotalRows,
                ComponentRows = ComponentRows,
                ImportedRows = ImportedRows,
                UpdatedRows = UpdatedRows,
                DuplicateRows = DuplicateRows,
                SkippedRows = SkippedRows,
                MissingOrganizationRows = MissingOrganizationRows,
                InvalidRows = InvalidRows,
                UpdatedOrganizations = UpdatedOrganizations,
                MissingOrganizations = _missingOrganizations.ToArray(),
                Errors = _errors.ToArray()
            };
    }

    private sealed class CardImportAccumulator(string fileName, bool dryRun)
    {
        private readonly List<string> _missingLicenses = new();
        private readonly List<string> _errors = new();

        public string FileName { get; } = fileName;
        public bool DryRun { get; } = dryRun;
        public int TotalRows { get; set; }
        public int MatchedRows { get; set; }
        public int UpdatedOrganizations { get; set; }
        public int UnchangedOrganizations { get; set; }
        public int DuplicateRows { get; set; }
        public int MissingLicenseRows { get; set; }
        public int InvalidRows { get; set; }

        public void AddMissingLicense(string value)
        {
            if (_missingLicenses.Count >= MissingOrganizationLimit || _missingLicenses.Contains(value, StringComparer.OrdinalIgnoreCase))
            {
                return;
            }

            _missingLicenses.Add(value);
        }

        public void AddError(string value)
        {
            if (_errors.Count >= MissingOrganizationLimit)
            {
                return;
            }

            _errors.Add(value);
        }

        public ParusLicenseCardImportResultDto ToDto()
            => new()
            {
                FileName = FileName,
                DryRun = DryRun,
                TotalRows = TotalRows,
                MatchedRows = MatchedRows,
                UpdatedOrganizations = UpdatedOrganizations,
                UnchangedOrganizations = UnchangedOrganizations,
                DuplicateRows = DuplicateRows,
                MissingLicenseRows = MissingLicenseRows,
                InvalidRows = InvalidRows,
                MissingLicenses = _missingLicenses.ToArray(),
                Errors = _errors.ToArray()
            };
    }
}

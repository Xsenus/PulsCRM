using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using DevExpress.Xpo;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using PulsPlusSpace;

namespace PulsNext.Infrastructure.Internal;

internal static class DateTimeHelper
{
    public static DateTime? NullIfMin(DateTime value)
    {
        return value.Year <= 1901 ? null : DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }

    public static DateTime MinIfNull(DateTime? value)
    {
        return value?.ToUniversalTime() ?? DateTime.MinValue;
    }

    public static DateTime ForceUtc(DateTime value)
    {
        return value.Kind == DateTimeKind.Utc ? value : DateTime.SpecifyKind(value, DateTimeKind.Utc);
    }
}

internal static class TextHelper
{
    public static string? NullIfWhiteSpace(string? value)
    {
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }

    public static IEnumerable<string> SplitEmailsCsv(string? input)
    {
        if (string.IsNullOrWhiteSpace(input))
        {
            yield break;
        }

        var separators = new[] { ',', ';', '\n', '\r', '\t' };
        foreach (var raw in input.Split(separators, StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
        {
            var normalized = raw.Trim();
            if (EmailHelper.IsValid(normalized))
            {
                yield return normalized;
            }
        }
    }
}

internal static class EmailHelper
{
    public static bool IsValid(string? email)
    {
        if (string.IsNullOrWhiteSpace(email))
        {
            return false;
        }

        try
        {
            _ = new MailAddress(email);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public static IReadOnlyCollection<string> CollectOrganizationEmails(LegacyOrg org)
    {
        var result = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        Add(result, org.OrgInfo?.Email);
        Add(result, org.OrgInfoOther?.RukEmail);
        Add(result, org.OrgInfoOther?.ZpEmail);
        Add(result, org.OrgInfoOther?.F1cEmail);
        Add(result, org.OrgInfoOther?.SiteEmail);

        foreach (var contact in org.Contacts)
        {
            Add(result, contact.Email);
        }

        return result.ToArray();
    }

    public static void Add(ISet<string> target, string? email)
    {
        if (IsValid(email))
        {
            target.Add(email!.Trim());
        }
    }
}

internal static class ValidationHelper
{
    public static void Guard(bool condition, string message)
    {
        if (!condition)
        {
            throw new ValidationException(message);
        }
    }
}

internal static class HashHelper
{
    public static string ComputeSha256(byte[] bytes)
    {
        return Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant();
    }
}

internal static class BinaryImageHelper
{
    public static string? ToBase64(byte[]? bytes)
        => bytes is { Length: > 0 } ? Convert.ToBase64String(bytes) : null;

    public static string? DetectContentType(byte[]? bytes)
    {
        if (bytes is null || bytes.Length < 4)
        {
            return null;
        }

        if (bytes.Length >= 8
            && bytes[0] == 0x89
            && bytes[1] == 0x50
            && bytes[2] == 0x4E
            && bytes[3] == 0x47)
        {
            return "image/png";
        }

        if (bytes[0] == 0xFF && bytes[1] == 0xD8)
        {
            return "image/jpeg";
        }

        if (bytes[0] == 0x47 && bytes[1] == 0x49 && bytes[2] == 0x46)
        {
            return "image/gif";
        }

        if (bytes[0] == 0x42 && bytes[1] == 0x4D)
        {
            return "image/bmp";
        }

        if (bytes.Length >= 12
            && bytes[0] == 0x52
            && bytes[1] == 0x49
            && bytes[2] == 0x46
            && bytes[3] == 0x46
            && bytes[8] == 0x57
            && bytes[9] == 0x45
            && bytes[10] == 0x42
            && bytes[11] == 0x50)
        {
            return "image/webp";
        }

        return "application/octet-stream";
    }
}

internal static class MappingHelper
{
    public static CurrentUserDto ToCurrentUserDto(LegacyUser user)
    {
        var avatar = user.UserInfo?.Avatar;
        var fallbackAvatar = avatar is { Length: > 0 } ? avatar : user.UserInfo?.Photo;

        return new CurrentUserDto
        {
            Id = user.Oid,
            Login = user.Name ?? string.Empty,
            FullName = user.FullName ?? user.Name ?? string.Empty,
            IsRoot = user.FlRoot,
            UserGroup = user.UserGroup?.Name,
            Email = user.UserInfo?.Email,
            Phone = user.UserInfo?.Phone,
            AvatarBase64 = BinaryImageHelper.ToBase64(fallbackAvatar),
            AvatarContentType = BinaryImageHelper.DetectContentType(fallbackAvatar)
        };
    }

    public static LoginUserOptionDto ToLoginUserOptionDto(LegacyUser user)
    {
        return new LoginUserOptionDto
        {
            Id = user.Oid,
            Login = user.Name ?? string.Empty,
            FullName = user.FullName,
            UserGroup = user.UserGroup?.Name
        };
    }

    public static EmployeeListItemDto ToEmployeeDto(LegacyUser user)
    {
        var userInfo = user.UserInfo;
        var isDismissed = string.Equals(user.UserGroup?.Name, "Уволенные", StringComparison.OrdinalIgnoreCase);

        return new EmployeeListItemDto
        {
            Id = user.Oid,
            Login = user.Name ?? string.Empty,
            FullName = user.FullName,
            UserGroup = user.UserGroup?.Name,
            RuleName = user.Rule?.FullName ?? user.Rule?.Name,
            PrivacyGroupName = user.PrivacyGroup?.FullName ?? user.PrivacyGroup?.Name,
            Email = userInfo?.Email,
            Phone = userInfo?.Phone,
            PhoneWorkRedirect = userInfo?.PhoneWorkRedirect,
            Site = userInfo?.Site,
            Address = userInfo?.Address,
            Position = userInfo?.Dolgnost,
            Icq = userInfo?.ICQ,
            Skype = userInfo?.Skype,
            Comment = userInfo?.Comment,
            S1cCode = userInfo?.S1cCode,
            BirthDay = DateTimeHelper.NullIfMin(userInfo?.BirthDay ?? DateTime.MinValue),
            IsRoot = user.FlRoot,
            IsMale = user.MaleFemale,
            IsDismissed = isDismissed
        };
    }

    public static EmployeeDetailsDto ToEmployeeDetailsDto(LegacyUser user)
    {
        var dto = ToEmployeeDto(user);
        var avatar = user.UserInfo?.Avatar;
        var photo = user.UserInfo?.Photo;
        var fallbackAvatar = avatar is { Length: > 0 } ? avatar : photo;

        return new EmployeeDetailsDto
        {
            Id = dto.Id,
            Login = dto.Login,
            FullName = dto.FullName,
            UserGroup = dto.UserGroup,
            RuleName = dto.RuleName,
            PrivacyGroupName = dto.PrivacyGroupName,
            Email = dto.Email,
            Phone = dto.Phone,
            PhoneWorkRedirect = dto.PhoneWorkRedirect,
            Site = dto.Site,
            Address = dto.Address,
            Position = dto.Position,
            Icq = dto.Icq,
            Skype = dto.Skype,
            Comment = dto.Comment,
            S1cCode = dto.S1cCode,
            BirthDay = dto.BirthDay,
            IsRoot = dto.IsRoot,
            IsMale = dto.IsMale,
            IsDismissed = dto.IsDismissed,
            UserGroupId = user.UserGroup?.Oid,
            RuleId = user.Rule?.Oid,
            PrivacyGroupId = user.PrivacyGroup?.Oid,
            AvatarBase64 = BinaryImageHelper.ToBase64(fallbackAvatar),
            AvatarContentType = BinaryImageHelper.DetectContentType(fallbackAvatar),
            PhotoBase64 = BinaryImageHelper.ToBase64(photo),
            PhotoContentType = BinaryImageHelper.DetectContentType(photo)
        };
    }

    public static OrganizationContactDto ToContactDto(LegacyContact contact)
    {
        return new OrganizationContactDto
        {
            Id = contact.Oid,
            Fio = contact.FIO,
            Position = contact.EnDolgnost?.Name ?? contact.EnDolgnost?.FullName,
            Phone = contact.Phone,
            Email = contact.Email,
            Group = contact.Group?.Name ?? contact.Group?.FullName,
            Status = contact.Status?.Name ?? contact.Status?.FullName,
            Comment = contact.Comment
        };
    }

    public static OrganizationListItemDto ToOrganizationDto(LegacyOrg org, int openWorkItems)
    {
        var emails = EmailHelper.CollectOrganizationEmails(org);

        return new OrganizationListItemDto
        {
            Id = org.Oid,
            Name = org.Name ?? string.Empty,
            SmallName = org.SmallName,
            FullName = org.FullName,
            Inn = org.INN,
            RaionId = org.Raion?.Oid,
            Raion = org.Raion?.Name,
            OrgTypeId = org.OrgType?.Oid,
            OrgType = org.OrgType?.Name,
            Visible = org.FlVisible,
            IsManager = org.FlManager,
            Emails = emails,
            EmailCount = emails.Count,
            ContactCount = org.Contacts.Count,
            OpenWorkItems = openWorkItems
        };
    }

    private const int SiteTaskVariant = 2;
    private const int OneCAccountingTaskVariant = 8;

    private static string? GetDisplayName(LegacyUser? user)
        => user?.FullName ?? user?.Name;

    private static string? GetDisplayName(LegacySprEnumeration? item)
        => item?.Name ?? item?.FullName;

    private static OrganizationTaskSummaryDto ToTaskSummaryDto(LegacyTask task)
    {
        return new OrganizationTaskSummaryDto
        {
            Id = task.Oid,
            Name = task.Name,
            FullName = task.FullName,
            TaskVariant = task.TaskVariant
        };
    }

    private static OrganizationInfoTaskDto ToProgramInfoDto(LegacyInfoTask task)
    {
        return new OrganizationInfoTaskDto
        {
            Id = task.Oid,
            Variant = task.CategoryInfoTask?.CategoryInfoTaskVariant ?? -1,
            Name = task.CategoryInfoTask?.Name,
            FullName = task.CategoryInfoTask?.FullName,
            Places = task.KolPlace,
            Comment = task.Comment,
            OrganizationCreatorId = task.OrgCreator?.Oid,
            OrganizationCreatorName = GetDisplayName(task.OrgCreator),
            UpdatedById = task.User_update?.Oid,
            UpdatedByName = GetDisplayName(task.User_update),
            UpdatedAtUtc = DateTimeHelper.NullIfMin(task.Date_update)
        };
    }

    private static (int? TaskId, string? TaskName, int? TaskVariant) GetEventTaskInfo(set_OrgEventInfo? info)
    {
        LegacyTask? task = info switch
        {
            set_OrgEventInfo_Licenz license => license.Task,
            set_OrgEventInfo_Zvonok call => call.Task,
            set_OrgEventInfo_RingJur ringJur => ringJur.Task,
            set_OrgEventInfo_Oplata payment => payment.Task,
            set_OrgEventInfo_Note note => note.Task,
            _ => null
        };

        return (task?.Oid, task?.Name ?? task?.FullName, task?.TaskVariant);
    }

    private static bool? GetEventCompleted(set_OrgEventInfo? info)
    {
        return info switch
        {
            set_OrgEventInfo_Licenz license => license.Completed,
            set_OrgEventInfo_Journal journal => journal.Completed,
            set_OrgEventInfo_Coming coming => coming.Completed,
            set_OrgEventInfo_Turnout turnout => turnout.Completed,
            set_OrgEventInfo_RingJur ringJur => ringJur.Completed,
            set_OrgEventInfo_Oplata payment => payment.Completed,
            _ => null
        };
    }

    private static OrganizationEventDto ToOrganizationEventDto(LegacyOrgEvent orgEvent)
    {
        var info = orgEvent.OrgEventInfo;
        var licenseInfo = info as set_OrgEventInfo_Licenz;
        var taskInfo = GetEventTaskInfo(info);

        return new OrganizationEventDto
        {
            Id = orgEvent.Oid,
            CategoryId = orgEvent.CategoryOrgEvent?.Oid,
            CategoryName = orgEvent.CategoryOrgEvent?.Name,
            CategoryFullName = orgEvent.CategoryOrgEvent?.FullName,
            CategoryVariant = orgEvent.CategoryOrgEvent?.CategoryOrgEventVariant,
            UserName = GetDisplayName(orgEvent.User),
            Name = orgEvent.Name,
            FullName = orgEvent.FullName,
            Comment = orgEvent.Comment,
            EventDateUtc = DateTimeHelper.NullIfMin(orgEvent.DateEvent),
            CreatedAtUtc = DateTimeHelper.NullIfMin(orgEvent.Date_create),
            UpdatedAtUtc = DateTimeHelper.NullIfMin(orgEvent.Date_update),
            DateFromUtc = info is null ? null : DateTimeHelper.NullIfMin(info.DateFrom),
            DateToUtc = info is null ? null : DateTimeHelper.NullIfMin(info.DateTo),
            IsInProcess = info?.FlProcess ?? false,
            IsCompleted = GetEventCompleted(info),
            TaskId = taskInfo.TaskId,
            TaskName = taskInfo.TaskName,
            TaskVariant = taskInfo.TaskVariant,
            LicenseKey = licenseInfo?.LicKey,
            LicenseAmount = licenseInfo is null ? null : licenseInfo.LicSumma,
            LicenseAmountComment = licenseInfo?.LicSummaComment
        };
    }

    private static OrganizationParusLicenseDto ToParusLicenseDto(LegacyZPParusLicenseInfo license)
    {
        return new OrganizationParusLicenseDto
        {
            Id = license.Oid,
            CreatedAtUtc = DateTimeHelper.NullIfMin(license.DateCreate),
            Payer = license.Payer,
            MnemoOrg = license.MnemoOrg,
            RegNumberClient = license.RegNumberClient,
            RegNumberAbonement = license.RegNumberAbonement,
            DateSinceUtc = DateTimeHelper.NullIfMin(license.DateSince),
            DateToUtc = DateTimeHelper.NullIfMin(license.DateTo),
            Nomenclature = license.Nomenclature,
            Modification = license.Modification,
            Number = license.Number,
            Inn = license.INN
        };
    }

    private static OrganizationParusOrderDto ToParusOrderDto(LegacyZPParusOrder order)
    {
        return new OrganizationParusOrderDto
        {
            Id = order.Oid,
            CreatedAtUtc = DateTimeHelper.NullIfMin(order.DateCreate),
            TypeOf = order.TypeOf,
            Number = order.Number,
            DateUtc = DateTimeHelper.NullIfMin(order.Date),
            MnemoOrg = order.MnemoOrg,
            MnemoName = order.MnemoName,
            RegNumberClient = order.RegNumberClient,
            Payer = order.Payer,
            State = order.State,
            TypeOfShipment = order.TypeOfShipment,
            Discount = order.Discount,
            Summa = order.Summa,
            InvoiceDateUtc = DateTimeHelper.NullIfMin(order.InvoiceDate),
            InvoiceNumber = order.InvoiceNumber,
            CustomerAmount = order.CustomerAmount
        };
    }

    private static OrganizationContractDto ToOrganizationContractDto(LegacyDogovor contract)
    {
        return new OrganizationContractDto
        {
            Id = contract.Oid,
            ExecutorName = GetDisplayName(contract.PulsOrg),
            FileTypeName = contract.FileType?.Name,
            DateUtc = DateTimeHelper.NullIfMin(contract.Date),
            DateFromUtc = DateTimeHelper.NullIfMin(contract.DateFrom),
            DateToUtc = DateTimeHelper.NullIfMin(contract.DateTo),
            Number = contract.Number,
            FileName = contract.FileName,
            Name = contract.Name,
            Comment = contract.Comment,
            DocumentTransport = GetDisplayName(contract.DocumentTransport),
            DocumentState = GetDisplayName(contract.DocumentState),
            Summa = contract.Summa,
            CreatedAtUtc = DateTimeHelper.NullIfMin(contract.Date_create),
            UpdatedAtUtc = DateTimeHelper.NullIfMin(contract.Date_update),
            CreatedByName = contract.User_create?.FullName ?? contract.User_create?.Name,
            UpdatedByName = contract.User_update?.FullName ?? contract.User_update?.Name,
            OneCDateUtc = DateTimeHelper.NullIfMin(contract.C1Date),
            OneCTransferState = contract.FlTo1C,
            PurchaseNumber = contract.NumKontrakt,
            IsProlongation = contract.FlProlongation,
            IsParus10Tornado = contract.FlParus10Tornado,
            IsOneCHourSupport = contract.Fl1CHourSopr,
            HasItsDiscount = contract.FlLgotITS,
            LawNumber = contract.NumFZ
        };
    }

    private static OrganizationAttachmentDto ToOrganizationAttachmentDto(LegacyAttachDocument attachment)
    {
        return new OrganizationAttachmentDto
        {
            Id = attachment.Oid,
            PrivacyGroupName = attachment.PrivacyGroup?.FullName ?? attachment.PrivacyGroup?.Name,
            ExecutorName = GetDisplayName(attachment.PulsOrg),
            FileTypeName = attachment.FileType?.Name,
            AttachDocumentTypeName = attachment.AttachDocumentType?.FullName ?? attachment.AttachDocumentType?.Name,
            DateUtc = DateTimeHelper.NullIfMin(attachment.Date),
            DateFromUtc = DateTimeHelper.NullIfMin(attachment.DateFrom),
            DateToUtc = DateTimeHelper.NullIfMin(attachment.DateTo),
            Number = attachment.Number,
            FileName = attachment.FileName,
            Name = attachment.Name,
            Comment = attachment.Comment,
            DocumentTransport = GetDisplayName(attachment.DocumentTransport),
            DocumentState = GetDisplayName(attachment.DocumentState),
            Summa = attachment.Summa,
            IsCompleted = attachment.FlCompleted,
            CreatedAtUtc = DateTimeHelper.NullIfMin(attachment.Date_create),
            UpdatedAtUtc = DateTimeHelper.NullIfMin(attachment.Date_update),
            CreatedByName = attachment.User_create?.FullName ?? attachment.User_create?.Name,
            UpdatedByName = attachment.User_update?.FullName ?? attachment.User_update?.Name
        };
    }

    private static OrganizationRealizationDto ToOrganizationRealizationDto(LegacyOrgRealizDocs realization)
    {
        return new OrganizationRealizationDto
        {
            Id = realization.Oid,
            Number = realization.Number,
            DateUtc = DateTimeHelper.NullIfMin(realization.Date),
            Summa = realization.Sumdoc,
            IsDone = realization.FlDone,
            EdoStatus = realization.EDOStatus,
            StatusName = realization.RealizDocStatus?.Name,
            ContractCode = realization.OrgDogovorPersonal?.s_base2,
            ContractName = realization.OrgDogovorPersonal?.Name
        };
    }

    private static OrganizationOneCSnapshotDto CreateOneCSnapshotDto(
        string key,
        string title,
        string? code,
        string? raion,
        string? name,
        string? fullName,
        string? inn,
        string? phone,
        string? otherInfo,
        string? comment,
        string? addressLegal,
        string? addressActual)
    {
        return new OrganizationOneCSnapshotDto
        {
            Key = key,
            Title = title,
            Code = code,
            Raion = raion,
            Name = name,
            FullName = fullName,
            Inn = inn,
            Phone = phone,
            OtherInfo = otherInfo,
            Comment = comment,
            AddressLegal = addressLegal,
            AddressActual = addressActual
        };
    }

    private static bool HasOneCSnapshotData(OrganizationOneCSnapshotDto snapshot)
    {
        return !string.IsNullOrWhiteSpace(snapshot.Code)
            || !string.IsNullOrWhiteSpace(snapshot.Raion)
            || !string.IsNullOrWhiteSpace(snapshot.Name)
            || !string.IsNullOrWhiteSpace(snapshot.FullName)
            || !string.IsNullOrWhiteSpace(snapshot.Inn)
            || !string.IsNullOrWhiteSpace(snapshot.Phone)
            || !string.IsNullOrWhiteSpace(snapshot.OtherInfo)
            || !string.IsNullOrWhiteSpace(snapshot.Comment)
            || !string.IsNullOrWhiteSpace(snapshot.AddressLegal)
            || !string.IsNullOrWhiteSpace(snapshot.AddressActual);
    }

    private static OrganizationOneCSnapshotDto[] BuildOneCSnapshots(LegacyOrgInfo1C? info)
    {
        if (info is null)
        {
            return [];
        }

        var snapshots = new[]
        {
            CreateOneCSnapshotDto("pp", "1С ПП", info.s_1cCode, info.s_1cRaion, info.s_1cName, info.s_1cFullName, info.s_1cINN, info.s_1cPhone, info.s_1cOtherInfo, info.s_1cComment, info.s_1cAddressU, info.s_1cAddressF),
            CreateOneCSnapshotDto("pc", "1С ПЦ", info.s_1cCode_PC, info.s_1cRaion_PC, info.s_1cName_PC, info.s_1cFullName_PC, info.s_1cINN_PC, info.s_1cPhone_PC, info.s_1cOtherInfo_PC, info.s_1cComment_PC, info.s_1cAddressU_PC, info.s_1cAddressF_PC),
            CreateOneCSnapshotDto("pg", "1С ПГ", info.s_1cCode_PG, info.s_1cRaion_PG, info.s_1cName_PG, info.s_1cFullName_PG, info.s_1cINN_PG, info.s_1cPhone_PG, info.s_1cOtherInfo_PG, info.s_1cComment_PG, info.s_1cAddressU_PG, info.s_1cAddressF_PG),
            CreateOneCSnapshotDto("pc2", "ПЦ2", info.s_1cCode_PC2, info.s_1cRaion_PC2, info.s_1cName_PC2, info.s_1cFullName_PC2, info.s_1cINN_PC2, info.s_1cPhone_PC2, info.s_1cOtherInfo_PC2, info.s_1cComment_PC2, info.s_1cAddressU_PC2, info.s_1cAddressF_PC2)
        };

        return snapshots.Where(HasOneCSnapshotData).ToArray();
    }

    private static set_OrgEventInfo_Licenz? FindLatestLicenseInfo(LegacyOrg org, int taskVariant)
    {
        return org.OrgEvents
            .Cast<LegacyOrgEvent>()
            .Select(item => item.OrgEventInfo as set_OrgEventInfo_Licenz)
            .Where(item => item is not null && item.Task?.TaskVariant == taskVariant)
            .OrderByDescending(item => DateTimeHelper.NullIfMin(item!.DateFrom) ?? DateTime.MinValue)
            .ThenByDescending(item => item!.Oid)
            .FirstOrDefault();
    }

    private static string? ResolveLicenseKeyName(set_OrgEventInfo_Licenz? license)
    {
        if (license is null || string.IsNullOrWhiteSpace(license.LicKey))
        {
            return null;
        }

        if (!int.TryParse(license.LicKey, out var id))
        {
            return license.LicKey;
        }

        var item = license.Session.GetObjectByKey<LegacySprEnumeration>(id);
        return GetDisplayName(item) ?? license.LicKey;
    }

    private static string? ResolveSalaryLicenseNumber(LegacyOrg org)
    {
        static string? Normalize(string? value)
            => string.IsNullOrWhiteSpace(value) ? null : value.Replace("-", string.Empty);

        var ownLicense = org.ParusLicenseInfo
            .Cast<LegacyZPParusLicenseInfo>()
            .OrderByDescending(item => DateTimeHelper.NullIfMin(item.DateTo) ?? DateTime.MinValue)
            .FirstOrDefault(item => !string.IsNullOrWhiteSpace(item.RegNumberAbonement));
        var ownNumber = Normalize(ownLicense?.RegNumberClient);
        if (!string.IsNullOrWhiteSpace(ownNumber))
        {
            return ownNumber;
        }

        var otherOrgLicense = org.OrgInfoOther?.OrgParusLicense?.ParusLicenseInfo
            .Cast<LegacyZPParusLicenseInfo>()
            .OrderByDescending(item => DateTimeHelper.NullIfMin(item.DateTo) ?? DateTime.MinValue)
            .FirstOrDefault(item => !string.IsNullOrWhiteSpace(item.RegNumberAbonement));
        var sharedNumber = Normalize(otherOrgLicense?.RegNumberClient);
        if (!string.IsNullOrWhiteSpace(sharedNumber))
        {
            return sharedNumber;
        }

        if (!string.IsNullOrWhiteSpace(org.OrgInfoOther?.OrgParusLicense?.OrgInfoOther?.ParusLicenseNumber))
        {
            return org.OrgInfoOther.OrgParusLicense.OrgInfoOther.ParusLicenseNumber;
        }

        return org.OrgInfoOther?.ParusLicenseNumber;
    }

    public static OrganizationDetailsDto ToOrganizationDetailsDto(LegacyOrg org, int openWorkItems)
    {
        var emails = EmailHelper.CollectOrganizationEmails(org);
        var orgInfo = org.OrgInfo;
        var other = org.OrgInfoOther;
        var oneCSnapshots = BuildOneCSnapshots(org.OrgInfo1C);
        var programInfos = org.InfoTasks.Cast<LegacyInfoTask>()
            .OrderBy(item => item.CategoryInfoTask?.CategoryInfoTaskVariant ?? int.MaxValue)
            .ThenBy(item => item.CategoryInfoTask?.Name ?? string.Empty)
            .Select(ToProgramInfoDto)
            .ToArray();
        var events = org.OrgEvents.Cast<LegacyOrgEvent>()
            .OrderByDescending(item => DateTimeHelper.NullIfMin(item.DateEvent) ?? DateTimeHelper.NullIfMin(item.Date_create) ?? DateTime.MinValue)
            .ThenByDescending(item => item.Oid)
            .Select(ToOrganizationEventDto)
            .ToArray();
        var parusLicenses = org.ParusLicenseInfo.Cast<LegacyZPParusLicenseInfo>()
            .OrderByDescending(item => DateTimeHelper.NullIfMin(item.DateSince) ?? DateTime.MinValue)
            .ThenByDescending(item => DateTimeHelper.NullIfMin(item.DateTo) ?? DateTime.MinValue)
            .Select(ToParusLicenseDto)
            .ToArray();
        var parusOrders = org.ZPParusOrder.Cast<LegacyZPParusOrder>()
            .OrderByDescending(item => DateTimeHelper.NullIfMin(item.Date) ?? DateTime.MinValue)
            .ThenByDescending(item => item.Oid)
            .Select(ToParusOrderDto)
            .ToArray();
        var contracts = new XPQuery<LegacyDogovor>(org.Session)
            .Where(item => item.Org != null && item.Org.Oid == org.Oid)
            .ToList()
            .OrderByDescending(item => DateTimeHelper.NullIfMin(item.Date) ?? DateTime.MinValue)
            .ThenByDescending(item => DateTimeHelper.NullIfMin(item.DateFrom) ?? DateTime.MinValue)
            .ThenByDescending(item => item.Oid)
            .Select(ToOrganizationContractDto)
            .ToArray();
        var attachments = new XPQuery<LegacyAttachDocument>(org.Session)
            .Where(item => item.Org != null && item.Org.Oid == org.Oid)
            .ToList()
            .OrderByDescending(item => DateTimeHelper.NullIfMin(item.Date) ?? DateTime.MinValue)
            .ThenByDescending(item => DateTimeHelper.NullIfMin(item.DateFrom) ?? DateTime.MinValue)
            .ThenByDescending(item => item.Oid)
            .Select(ToOrganizationAttachmentDto)
            .ToArray();
        var realizations = new XPQuery<LegacyOrgRealizDocs>(org.Session)
            .Where(item => item.Org != null && item.Org.Oid == org.Oid)
            .ToList()
            .OrderByDescending(item => DateTimeHelper.NullIfMin(item.Date) ?? DateTime.MinValue)
            .ThenByDescending(item => item.Oid)
            .Select(ToOrganizationRealizationDto)
            .ToArray();
        var oneCLicense = FindLatestLicenseInfo(org, OneCAccountingTaskVariant);
        var siteLicense = FindLatestLicenseInfo(org, SiteTaskVariant);

        return new OrganizationDetailsDto
        {
            Id = org.Oid,
            Name = org.Name ?? string.Empty,
            SmallName = org.SmallName,
            FullName = org.FullName,
            Inn = org.INN,
            RaionId = org.Raion?.Oid,
            Raion = org.Raion?.Name,
            OrgTypeId = org.OrgType?.Oid,
            OrgType = org.OrgType?.Name,
            Visible = org.FlVisible,
            IsManager = org.FlManager,
            Emails = emails,
            EmailCount = emails.Count,
            ContactCount = org.Contacts.Count,
            OpenWorkItems = openWorkItems,
            Ogrn = other?.OGRN,
            Okpo = other?.OKPO,
            Okved = other?.OKVED,
            Kpp = orgInfo?.KPP,
            PfrNumber = other?.PFR,
            FssNumber = other?.FSS,
            BankName = other?.Bank?.Name,
            BankBik = other?.Bank?.BIK,
            BankCity = other?.Bank?.Gorod,
            BankCorrespondentAccount = other?.Bank?.KSch,
            BankAccount = other?.RSch,
            PersonalAccount = other?.LSch,
            FlagName = org.WhatToDo?.FullName ?? org.WhatToDo?.Name,
            StatusName = org.OrgVariant?.FullName ?? org.OrgVariant?.Name,
            AddressLegal = orgInfo?.AddressU,
            AddressActual = orgInfo?.AddressF,
            Phone = orgInfo?.Phone,
            Site = orgInfo?.Site,
            DebtAmount = orgInfo?.SummaDolga ?? 0,
            DebtActualAmount = orgInfo?.SummaDolgaActual ?? 0,
            DebtMinus6Amount = orgInfo?.SummaDolgaMinus6 ?? 0,
            PrimaryEmail = orgInfo?.Email,
            DirectorEmail = other?.RukEmail,
            SalaryEmail = other?.ZpEmail,
            OneCEmail = other?.F1cEmail,
            SiteEmail = other?.SiteEmail,
            DirectorFullName = other?.RukFIO,
            DirectorShortName = other?.RukFIO_sokr,
            DirectorGenitiveName = other?.RukFIO_rod,
            DirectorPosition = other?.RukDolgnost,
            DirectorPositionGenitive = other?.RukDolgnost_rod,
            DirectorPhone = other?.RukPhone,
            DirectorSnils = other?.RukComment,
            AuthorityDocument = other?.Osnovanie_rod,
            Comment = orgInfo?.Comment,
            OtherInfo = orgInfo?.OtherInfo,
            AdditionalComment = other?.DopComment,
            TechnicsComment = other?.TechnicsComment,
            ProcurementComment = other?.ZakupkiComment,
            EcpComment = other?.ECPComment,
            EcpContractComment = other?.ECPCommentDog,
            InternetSpeed = GetDisplayName(other?.InternetSpeed),
            Edo = GetDisplayName(other?.EDO),
            PfrAgreementNumber = other?.PFRSoglNum,
            PfrAgreementDateUtc = other is null ? null : DateTimeHelper.NullIfMin(other.PFRSoglDate),
            SalaryEnabled = other?.ZpWorking ?? false,
            OneCAccountingEnabled = other?.F1cWorkingB ?? false,
            OneCSalaryEnabled = other?.F1cWorkingZ ?? false,
            OneCHousingEnabled = other?.F1cWorkingJKH ?? false,
            SalaryContactName = other?.ZpFIO,
            SalaryContactPhone = other?.ZpPhone,
            SalaryLabel = other?.ZpFIO,
            SalaryLicenseNumber = ResolveSalaryLicenseNumber(org),
            SalaryManualLicenseNumber = other?.ParusLicenseNumber,
            SalaryLicenseComposition = other?.ZpLicSostav,
            SalaryDatabaseCount = other?.ZpNumOfBases ?? 0,
            SalaryOrganizationCount = other?.CountOrganizationsInDataBases ?? 0,
            SalaryExtraWorkplaces = other?.ZpNumDopPlaces ?? 0,
            SalaryComment = other?.ZpComment,
            SalaryLeadName = GetDisplayName(other?.ZpUser),
            SalaryWorkBeginUtc = other is null ? null : DateTimeHelper.NullIfMin(other.ZpDateWorkBegin),
            SalaryWorkEndUtc = other is null ? null : DateTimeHelper.NullIfMin(other.ZpDateWorkEnd),
            SalaryPlatform = GetDisplayName(other?.ZpPlatform),
            SalaryConfiguration = GetDisplayName(other?.ZpConfig),
            SalaryRating = GetDisplayName(other?.ZpRating),
            SalaryLicenseOrganizationId = other?.OrgParusLicense?.Oid,
            SalaryLicenseOrganizationName = other?.OrgParusLicense?.Name,
            SalaryLicenseFileName = other?.ParusLicenseFileName,
            OneCContactName = other?.F1cFIO,
            OneCContactPhone = other?.F1cPhone,
            OneCComment = other?.F1cComment,
            OneCSalaryComment = other?.F1cCommentZ,
            OneCAccountingChanges = other?.F1cDorabotkiB,
            OneCSalaryChanges = other?.F1cDorabotkiZ,
            OneCLeadAccountingName = GetDisplayName(other?.F1cUserB),
            OneCLeadSalaryName = GetDisplayName(other?.F1cUserZ),
            OneCBaseContract = other?.F1cBaseDogovor ?? false,
            OneCRegNumberAccounting = other?.F1CRegNumB,
            OneCRegNumberSalary = other?.F1CRegNumZ,
            OneCPlatformAccounting = GetDisplayName(other?.PlatformB),
            OneCPlatformSalary = GetDisplayName(other?.PlatformZ),
            OneCConfigurationAccounting = GetDisplayName(other?.ConfigB),
            OneCConfigurationSalary = GetDisplayName(other?.ConfigZ),
            OneCContractVariant = GetDisplayName(other?.F1CVarDog),
            OneCItsVariant = ResolveLicenseKeyName(oneCLicense) ?? GetDisplayName(other?.ITSVariant),
            OneCItsLicenseNumber = oneCLicense?.OrgEvent?.Name ?? other?.F1CLicNum,
            OneCItsComment = oneCLicense?.OrgEvent?.FullName ?? other?.F1cCommentITS,
            OneCItsComposition = oneCLicense?.OrgEvent?.Comment ?? other?.F1cLicSostav,
            OneCItsAmount = oneCLicense is null ? null : oneCLicense.LicSumma,
            OneCItsAmountComment = oneCLicense?.LicSummaComment,
            OneCItsDateFromUtc = oneCLicense is not null ? DateTimeHelper.NullIfMin(oneCLicense.DateFrom) : (other is null ? null : DateTimeHelper.NullIfMin(other.F1CLicDateFrom)),
            OneCItsDateToUtc = oneCLicense is not null ? DateTimeHelper.NullIfMin(oneCLicense.DateTo) : (other is null ? null : DateTimeHelper.NullIfMin(other.F1CLicDateTo)),
            OneCItsCompleted = oneCLicense?.Completed ?? false,
            SiteContactName = other?.SiteFIO,
            SiteContactPhone = other?.SitePhone,
            SiteAlias = other?.SiteAlias,
            SiteReadyAtUtc = other is null ? null : DateTimeHelper.NullIfMin(other.SiteDateDone),
            SiteState = other?.SiteState,
            SiteBaseId = other?.SiteIdBase,
            SiteComment = other?.SiteComment,
            SiteOnSupport = other?.SiteSoprov ?? false,
            SiteTemplate = other?.SiteTemplate,
            SiteLicenseDateFromUtc = siteLicense is null ? null : DateTimeHelper.NullIfMin(siteLicense.DateFrom),
            SiteLicenseDateToUtc = siteLicense is null ? null : DateTimeHelper.NullIfMin(siteLicense.DateTo),
            SiteLicenseCompleted = siteLicense?.Completed ?? false,
            CreatedByName = org.User_create?.FullName ?? org.User_create?.Name,
            UpdatedByName = org.User_update?.FullName ?? org.User_update?.Name,
            UpdatedAdminByName = org.User_update_admin?.FullName ?? org.User_update_admin?.Name,
            CreatedAtUtc = DateTimeHelper.NullIfMin(org.Date_create),
            UpdatedAtUtc = DateTimeHelper.NullIfMin(org.Date_update),
            UpdatedAdminAtUtc = DateTimeHelper.NullIfMin(org.Date_update_admin),
            Contacts = org.Contacts.Cast<LegacyContact>().OrderBy(x => x.FIO ?? string.Empty).Select(ToContactDto).ToArray(),
            Tasks = org.Tasks.Cast<LegacyTask>().OrderBy(x => x.TaskVariant).ThenBy(x => x.Name ?? x.FullName ?? string.Empty).Select(ToTaskSummaryDto).ToArray(),
            OneCSnapshots = oneCSnapshots,
            ProgramInfos = programInfos,
            Events = events,
            Contracts = contracts,
            Attachments = attachments,
            Realizations = realizations,
            ParusLicenses = parusLicenses,
            ParusOrders = parusOrders
        };
    }

    public static WorkItemDto ToWorkDto(LegacyJob job)
    {
        return new WorkItemDto
        {
            Id = job.Oid,
            UserFromId = job.UserFrom?.Oid,
            UserFromName = job.UserFrom?.FullName ?? job.UserFrom?.Name,
            UserToId = job.UserTo?.Oid,
            UserToName = job.UserTo?.FullName ?? job.UserTo?.Name,
            OrgId = job.Org?.Oid,
            OrgName = job.Org?.Name,
            Category = job.CategoryJob?.Name,
            Task = job.Task?.Name,
            Message = job.Message,
            Comment = job.Comment,
            CreatedAtUtc = DateTimeHelper.NullIfMin(job.Date_create),
            DateFromUtc = DateTimeHelper.NullIfMin(job.DateFrom),
            DateToUtc = DateTimeHelper.NullIfMin(job.DateTo),
            DateCompletedUtc = DateTimeHelper.NullIfMin(job.DateCompleted),
            IsCompleted = DateTimeHelper.NullIfMin(job.DateCompleted) is not null
        };
    }

    public static TransportProfileDto ToTransportProfileDto(MailTransportProfile profile)
    {
        return new TransportProfileDto
        {
            Id = profile.Oid,
            Name = profile.Name ?? string.Empty,
            Host = profile.Host ?? string.Empty,
            Port = profile.Port,
            UseSsl = profile.UseSsl,
            Username = profile.Username,
            SenderEmail = profile.SenderEmail,
            SenderName = profile.SenderName,
            ReplyToEmail = profile.ReplyToEmail,
            MaxConnections = profile.MaxConnections,
            MessagesPerMinute = profile.MessagesPerMinute,
            IsDefault = profile.IsDefault,
            IsEnabled = profile.IsEnabled,
            CreatedAtUtc = DateTimeHelper.ForceUtc(profile.CreatedAtUtc),
            UpdatedAtUtc = DateTimeHelper.ForceUtc(profile.UpdatedAtUtc)
        };
    }

    public static StoredFileDto ToStoredFileDto(MailStoredFile file)
    {
        return new StoredFileDto
        {
            Id = file.Oid,
            OriginalFileName = file.OriginalFileName ?? string.Empty,
            StoredFileName = file.StoredFileName ?? string.Empty,
            RelativePath = file.RelativePath ?? string.Empty,
            ContentType = file.ContentType,
            Length = file.Length,
            Sha256 = file.Sha256,
            IsPublic = file.IsPublic,
            UploadedAtUtc = DateTimeHelper.ForceUtc(file.UploadedAtUtc),
            UploadedByLegacyUserId = file.UploadedByLegacyUserId
        };
    }

    public static CampaignAttachmentDto ToCampaignAttachmentDto(MailCampaignAttachment attachment)
    {
        return new CampaignAttachmentDto
        {
            Id = attachment.Oid,
            AttachmentKind = attachment.AttachmentKind,
            DisplayName = attachment.DisplayName,
            ContentId = attachment.ContentId,
            SortOrder = attachment.SortOrder,
            StoredFile = attachment.StoredFile is null ? new StoredFileDto() : ToStoredFileDto(attachment.StoredFile)
        };
    }

    public static CampaignTargetOrganizationDto ToCampaignTargetDto(MailCampaignTargetOrganization target)
    {
        return new CampaignTargetOrganizationDto
        {
            Id = target.Oid,
            LegacyOrgId = target.LegacyOrgId,
            LegacyOrgName = target.LegacyOrgName,
            LegacyRaionName = target.LegacyRaionName
        };
    }

    public static CampaignListItemDto ToCampaignListItemDto(MailCampaign campaign)
    {
        return new CampaignListItemDto
        {
            Id = campaign.Oid,
            Name = campaign.Name ?? string.Empty,
            Subject = campaign.Subject,
            Status = campaign.Status,
            ScheduleKind = campaign.ScheduleKind,
            TimeZoneId = campaign.TimeZoneId,
            NextRunAtUtc = DateTimeHelper.NullIfMin(campaign.NextRunAtUtc),
            LastRunAtUtc = DateTimeHelper.NullIfMin(campaign.LastRunAtUtc),
            TargetOrganizationsCount = campaign.TargetOrganizations.Count,
            AttachmentsCount = campaign.Attachments.Count,
            TransportProfileName = campaign.TransportProfile?.Name,
            CreatedAtUtc = DateTimeHelper.ForceUtc(campaign.CreatedAtUtc),
            UpdatedAtUtc = DateTimeHelper.ForceUtc(campaign.UpdatedAtUtc)
        };
    }

    public static CampaignDetailsDto ToCampaignDetailsDto(MailCampaign campaign)
    {
        return new CampaignDetailsDto
        {
            Id = campaign.Oid,
            Name = campaign.Name ?? string.Empty,
            Subject = campaign.Subject,
            HtmlBody = campaign.HtmlBody,
            PlainTextBody = campaign.PlainTextBody,
            Status = campaign.Status,
            TransportProfileId = campaign.TransportProfile?.Oid,
            TransportProfileName = campaign.TransportProfile?.Name,
            ScheduleKind = campaign.ScheduleKind,
            CronExpression = campaign.CronExpression,
            TimeZoneId = campaign.TimeZoneId,
            StartAtUtc = DateTimeHelper.NullIfMin(campaign.StartAtUtc),
            EndAtUtc = DateTimeHelper.NullIfMin(campaign.EndAtUtc),
            IntervalMinutes = campaign.IntervalMinutes,
            RandomIntervalMinMinutes = campaign.RandomIntervalMinMinutes,
            RandomIntervalMaxMinutes = campaign.RandomIntervalMaxMinutes,
            NextRunAtUtc = DateTimeHelper.NullIfMin(campaign.NextRunAtUtc),
            LastRunAtUtc = DateTimeHelper.NullIfMin(campaign.LastRunAtUtc),
            LastRunStartedAtUtc = DateTimeHelper.NullIfMin(campaign.LastRunStartedAtUtc),
            LastRunFinishedAtUtc = DateTimeHelper.NullIfMin(campaign.LastRunFinishedAtUtc),
            MaxRecipientsPerRun = campaign.MaxRecipientsPerRun,
            MaxAttempts = campaign.MaxAttempts,
            UseOrgPrimaryEmail = campaign.UseOrgPrimaryEmail,
            UseContactEmails = campaign.UseContactEmails,
            UseSalaryEmail = campaign.UseSalaryEmail,
            UseOneCEmail = campaign.UseOneCEmail,
            UseSiteEmail = campaign.UseSiteEmail,
            UseDirectorEmail = campaign.UseDirectorEmail,
            ManualRecipientsCsv = campaign.ManualRecipientsCsv,
            Targets = campaign.TargetOrganizations.Cast<MailCampaignTargetOrganization>().OrderBy(x => x.LegacyOrgName ?? string.Empty).Select(ToCampaignTargetDto).ToArray(),
            Attachments = campaign.Attachments.Cast<MailCampaignAttachment>().OrderBy(x => x.SortOrder).ThenBy(x => x.DisplayName ?? string.Empty).Select(ToCampaignAttachmentDto).ToArray(),
            CreatedAtUtc = DateTimeHelper.ForceUtc(campaign.CreatedAtUtc),
            UpdatedAtUtc = DateTimeHelper.ForceUtc(campaign.UpdatedAtUtc)
        };
    }

    public static DispatchBatchDto ToDispatchBatchDto(MailDispatchBatch batch)
    {
        return new DispatchBatchDto
        {
            Id = batch.Oid,
            TriggerKind = batch.TriggerKind,
            TriggerComment = batch.TriggerComment,
            ScheduledAtUtc = DateTimeHelper.NullIfMin(batch.ScheduledAtUtc),
            CreatedAtUtc = DateTimeHelper.ForceUtc(batch.CreatedAtUtc),
            CompletedAtUtc = DateTimeHelper.NullIfMin(batch.CompletedAtUtc),
            TotalRecipients = batch.TotalRecipients,
            QueuedCount = batch.QueuedCount,
            ProcessingCount = batch.ProcessingCount,
            SentCount = batch.SentCount,
            FailedCount = batch.FailedCount,
            CancelledCount = batch.CancelledCount,
            CorrelationId = batch.CorrelationId
        };
    }

    public static DispatchItemDto ToDispatchItemDto(MailDispatchItem item)
    {
        return new DispatchItemDto
        {
            Id = item.Oid,
            LegacyOrgId = item.LegacyOrgId,
            LegacyOrgName = item.LegacyOrgName,
            RecipientEmail = item.RecipientEmail,
            RecipientDisplayName = item.RecipientDisplayName,
            SourceKind = item.SourceKind,
            Status = item.Status,
            AttemptCount = item.AttemptCount,
            QueuedAtUtc = DateTimeHelper.NullIfMin(item.QueuedAtUtc),
            StartedAtUtc = DateTimeHelper.NullIfMin(item.StartedAtUtc),
            SentAtUtc = DateTimeHelper.NullIfMin(item.SentAtUtc),
            FailedAtUtc = DateTimeHelper.NullIfMin(item.FailedAtUtc),
            NextAttemptAtUtc = DateTimeHelper.NullIfMin(item.NextAttemptAtUtc),
            ErrorMessage = item.ErrorMessage,
            SmtpResponse = item.SmtpResponse,
            MessageId = item.MessageId
        };
    }
}

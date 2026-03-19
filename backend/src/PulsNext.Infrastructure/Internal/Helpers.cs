using System.ComponentModel.DataAnnotations;
using System.Net;
using System.Net.Mail;
using System.Security.Cryptography;
using System.Text;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;

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

internal static class MappingHelper
{
    public static CurrentUserDto ToCurrentUserDto(LegacyUser user)
    {
        return new CurrentUserDto
        {
            Id = user.Oid,
            Login = user.Name ?? string.Empty,
            FullName = user.FullName ?? user.Name ?? string.Empty,
            IsRoot = user.FlRoot,
            UserGroup = user.UserGroup?.Name,
            Email = user.UserInfo?.Email,
            Phone = user.UserInfo?.Phone
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
        var isDismissed = string.Equals(user.UserGroup?.Name, "Уволенные", StringComparison.OrdinalIgnoreCase);

        return new EmployeeListItemDto
        {
            Id = user.Oid,
            Login = user.Name ?? string.Empty,
            FullName = user.FullName,
            UserGroup = user.UserGroup?.Name,
            Email = user.UserInfo?.Email,
            Phone = user.UserInfo?.Phone,
            IsDismissed = isDismissed
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

    public static OrganizationDetailsDto ToOrganizationDetailsDto(LegacyOrg org, int openWorkItems)
    {
        var emails = EmailHelper.CollectOrganizationEmails(org);

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
            Ogrn = org.OrgInfoOther?.OGRN,
            Kpp = org.OrgInfo?.KPP,
            AddressLegal = org.OrgInfo?.AddressU,
            AddressActual = org.OrgInfo?.AddressF,
            Phone = org.OrgInfo?.Phone,
            Site = org.OrgInfo?.Site,
            PrimaryEmail = org.OrgInfo?.Email,
            DirectorEmail = org.OrgInfoOther?.RukEmail,
            SalaryEmail = org.OrgInfoOther?.ZpEmail,
            OneCEmail = org.OrgInfoOther?.F1cEmail,
            SiteEmail = org.OrgInfoOther?.SiteEmail,
            Comment = org.OrgInfo?.Comment,
            OtherInfo = org.OrgInfo?.OtherInfo,
            SalaryEnabled = org.OrgInfoOther?.ZpWorking ?? false,
            OneCAccountingEnabled = org.OrgInfoOther?.F1cWorkingB ?? false,
            OneCSalaryEnabled = org.OrgInfoOther?.F1cWorkingZ ?? false,
            OneCHousingEnabled = org.OrgInfoOther?.F1cWorkingJKH ?? false,
            SalaryContactName = org.OrgInfoOther?.ZpFIO,
            SalaryContactPhone = org.OrgInfoOther?.ZpPhone,
            OneCContactName = org.OrgInfoOther?.F1cFIO,
            OneCContactPhone = org.OrgInfoOther?.F1cPhone,
            SiteContactName = org.OrgInfoOther?.SiteFIO,
            SiteContactPhone = org.OrgInfoOther?.SitePhone,
            CreatedByName = org.User_create?.FullName ?? org.User_create?.Name,
            UpdatedByName = org.User_update?.FullName ?? org.User_update?.Name,
            UpdatedAdminByName = org.User_update_admin?.FullName ?? org.User_update_admin?.Name,
            CreatedAtUtc = DateTimeHelper.NullIfMin(org.Date_create),
            UpdatedAtUtc = DateTimeHelper.NullIfMin(org.Date_update),
            UpdatedAdminAtUtc = DateTimeHelper.NullIfMin(org.Date_update_admin),
            Contacts = org.Contacts.Cast<LegacyContact>().OrderBy(x => x.FIO ?? string.Empty).Select(ToContactDto).ToArray()
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

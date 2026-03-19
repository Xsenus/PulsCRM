using PulsNext.Domain.Mailing;

namespace PulsNext.Infrastructure;

public sealed record PagedResult<T>(IReadOnlyCollection<T> Items, int TotalCount);

public sealed class LoginRequest
{
    public string Login { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
}

public sealed class CurrentUserDto
{
    public int Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public bool IsRoot { get; set; }
    public string? UserGroup { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? AvatarBase64 { get; set; }
    public string? AvatarContentType { get; set; }
}

public sealed class LoginUserOptionDto
{
    public int Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? UserGroup { get; set; }
}

public sealed class AuthResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public CurrentUserDto User { get; set; } = new();
}

public class EmployeeListItemDto
{
    public int Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? UserGroup { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public bool IsDismissed { get; set; }
}

public sealed class EmployeeLookupItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public sealed class EmployeeEditorLookupsDto
{
    public IReadOnlyCollection<EmployeeLookupItemDto> Groups { get; set; } = Array.Empty<EmployeeLookupItemDto>();
    public IReadOnlyCollection<EmployeeLookupItemDto> Rules { get; set; } = Array.Empty<EmployeeLookupItemDto>();
    public IReadOnlyCollection<EmployeeLookupItemDto> PrivacyGroups { get; set; } = Array.Empty<EmployeeLookupItemDto>();
    public int? DefaultGroupId { get; set; }
    public int? DefaultRuleId { get; set; }
    public int? DefaultPrivacyGroupId { get; set; }
}

public sealed class EmployeeUpsertRequest
{
    public string Login { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public int? UserGroupId { get; set; }
    public int? RuleId { get; set; }
    public int? PrivacyGroupId { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? PhoneWorkRedirect { get; set; }
    public string? Site { get; set; }
    public string? Address { get; set; }
    public string? Position { get; set; }
    public string? Icq { get; set; }
    public string? Skype { get; set; }
    public string? Comment { get; set; }
    public string? S1cCode { get; set; }
    public DateTime? BirthDay { get; set; }
    public bool IsMale { get; set; } = true;
    public bool IsRoot { get; set; }
    public string? Password { get; set; }
    public string? AvatarBase64 { get; set; }
    public string? AvatarContentType { get; set; }
    public string? PhotoBase64 { get; set; }
    public string? PhotoContentType { get; set; }
}

public sealed class EmployeeDetailsDto : EmployeeListItemDto
{
    public int? UserGroupId { get; set; }
    public int? RuleId { get; set; }
    public string? RuleName { get; set; }
    public int? PrivacyGroupId { get; set; }
    public string? PrivacyGroupName { get; set; }
    public bool IsRoot { get; set; }
    public bool IsMale { get; set; }
    public string? PhoneWorkRedirect { get; set; }
    public string? Site { get; set; }
    public string? Address { get; set; }
    public string? Position { get; set; }
    public string? Icq { get; set; }
    public string? Skype { get; set; }
    public string? Comment { get; set; }
    public string? S1cCode { get; set; }
    public DateTime? BirthDay { get; set; }
    public string? AvatarBase64 { get; set; }
    public string? AvatarContentType { get; set; }
    public string? PhotoBase64 { get; set; }
    public string? PhotoContentType { get; set; }
}

public sealed class OrganizationContactDto
{
    public int Id { get; set; }
    public string? Fio { get; set; }
    public string? Position { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Group { get; set; }
    public string? Status { get; set; }
    public string? Comment { get; set; }
}

public sealed class OrganizationRaionDto
{
    public int? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Count { get; set; }
}

public sealed class OrganizationLookupItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

public sealed class OrganizationEditorLookupsDto
{
    public IReadOnlyCollection<OrganizationLookupItemDto> Raions { get; set; } = Array.Empty<OrganizationLookupItemDto>();
    public IReadOnlyCollection<OrganizationLookupItemDto> OrgTypes { get; set; } = Array.Empty<OrganizationLookupItemDto>();
}

public sealed class OrganizationUpsertRequest
{
    public string Name { get; set; } = string.Empty;
    public string? SmallName { get; set; }
    public string? FullName { get; set; }
    public string? Inn { get; set; }
    public int? RaionId { get; set; }
    public int? OrgTypeId { get; set; }
    public bool Visible { get; set; } = true;
    public bool IsManager { get; set; }
    public string? Ogrn { get; set; }
    public string? Kpp { get; set; }
    public string? AddressLegal { get; set; }
    public string? AddressActual { get; set; }
    public string? Phone { get; set; }
    public string? Site { get; set; }
    public string? PrimaryEmail { get; set; }
    public string? DirectorEmail { get; set; }
    public string? SalaryEmail { get; set; }
    public string? OneCEmail { get; set; }
    public string? SiteEmail { get; set; }
    public string? Comment { get; set; }
    public string? OtherInfo { get; set; }
    public bool SalaryEnabled { get; set; }
    public bool OneCAccountingEnabled { get; set; }
    public bool OneCSalaryEnabled { get; set; }
    public bool OneCHousingEnabled { get; set; }
    public string? SalaryContactName { get; set; }
    public string? SalaryContactPhone { get; set; }
    public string? OneCContactName { get; set; }
    public string? OneCContactPhone { get; set; }
    public string? SiteContactName { get; set; }
    public string? SiteContactPhone { get; set; }
}

public class OrganizationListItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? SmallName { get; set; }
    public string? FullName { get; set; }
    public string? Inn { get; set; }
    public int? RaionId { get; set; }
    public string? Raion { get; set; }
    public int? OrgTypeId { get; set; }
    public string? OrgType { get; set; }
    public bool Visible { get; set; }
    public bool IsManager { get; set; }
    public IReadOnlyCollection<string> Emails { get; set; } = Array.Empty<string>();
    public int EmailCount { get; set; }
    public int ContactCount { get; set; }
    public int OpenWorkItems { get; set; }
}

public sealed class OrganizationDetailsDto : OrganizationListItemDto
{
    public string? Ogrn { get; set; }
    public string? Kpp { get; set; }
    public string? AddressLegal { get; set; }
    public string? AddressActual { get; set; }
    public string? Phone { get; set; }
    public string? Site { get; set; }
    public string? PrimaryEmail { get; set; }
    public string? DirectorEmail { get; set; }
    public string? SalaryEmail { get; set; }
    public string? OneCEmail { get; set; }
    public string? SiteEmail { get; set; }
    public string? Comment { get; set; }
    public string? OtherInfo { get; set; }
    public bool SalaryEnabled { get; set; }
    public bool OneCAccountingEnabled { get; set; }
    public bool OneCSalaryEnabled { get; set; }
    public bool OneCHousingEnabled { get; set; }
    public string? SalaryContactName { get; set; }
    public string? SalaryContactPhone { get; set; }
    public string? OneCContactName { get; set; }
    public string? OneCContactPhone { get; set; }
    public string? SiteContactName { get; set; }
    public string? SiteContactPhone { get; set; }
    public string? CreatedByName { get; set; }
    public string? UpdatedByName { get; set; }
    public string? UpdatedAdminByName { get; set; }
    public DateTime? CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? UpdatedAdminAtUtc { get; set; }
    public IReadOnlyCollection<OrganizationContactDto> Contacts { get; set; } = Array.Empty<OrganizationContactDto>();
}

public sealed class WorkItemDto
{
    public int Id { get; set; }
    public int? UserFromId { get; set; }
    public string? UserFromName { get; set; }
    public int? UserToId { get; set; }
    public string? UserToName { get; set; }
    public int? OrgId { get; set; }
    public string? OrgName { get; set; }
    public string? Category { get; set; }
    public string? Task { get; set; }
    public string? Message { get; set; }
    public string? Comment { get; set; }
    public DateTime? CreatedAtUtc { get; set; }
    public DateTime? DateFromUtc { get; set; }
    public DateTime? DateToUtc { get; set; }
    public DateTime? DateCompletedUtc { get; set; }
    public bool IsCompleted { get; set; }
}

public sealed class DashboardDto
{
    public int Employees { get; set; }
    public int Organizations { get; set; }
    public int ActiveCampaigns { get; set; }
    public int QueueDepth { get; set; }
    public int SentLast24Hours { get; set; }
    public int FailedLast24Hours { get; set; }
}

public sealed class TransportProfileDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
    public bool UseSsl { get; set; }
    public string? Username { get; set; }
    public string? SenderEmail { get; set; }
    public string? SenderName { get; set; }
    public string? ReplyToEmail { get; set; }
    public int MaxConnections { get; set; }
    public int MessagesPerMinute { get; set; }
    public bool IsDefault { get; set; }
    public bool IsEnabled { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public sealed class TransportProfileUpsertRequest
{
    public string Name { get; set; } = string.Empty;
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public bool UseSsl { get; set; } = true;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? SenderEmail { get; set; }
    public string? SenderName { get; set; }
    public string? ReplyToEmail { get; set; }
    public int MaxConnections { get; set; } = 2;
    public int MessagesPerMinute { get; set; } = 60;
    public bool IsDefault { get; set; }
    public bool IsEnabled { get; set; } = true;
}

public sealed class TransportProfileTestResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
}

public sealed class FileUploadCommand
{
    public required Stream Content { get; init; }
    public required string FileName { get; init; }
    public string? ContentType { get; init; }
    public bool IsPublic { get; init; }
}

public sealed class StoredFileDto
{
    public int Id { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string RelativePath { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public long Length { get; set; }
    public string? Sha256 { get; set; }
    public bool IsPublic { get; set; }
    public DateTime UploadedAtUtc { get; set; }
    public int UploadedByLegacyUserId { get; set; }
}

public sealed class CampaignAttachmentRequest
{
    public int StoredFileId { get; set; }
    public AttachmentKind AttachmentKind { get; set; } = AttachmentKind.File;
    public string? DisplayName { get; set; }
    public string? ContentId { get; set; }
    public int SortOrder { get; set; }
}

public sealed class CampaignAttachmentDto
{
    public int Id { get; set; }
    public AttachmentKind AttachmentKind { get; set; }
    public string? DisplayName { get; set; }
    public string? ContentId { get; set; }
    public int SortOrder { get; set; }
    public StoredFileDto StoredFile { get; set; } = new();
}

public sealed class CampaignTargetOrganizationDto
{
    public int Id { get; set; }
    public int LegacyOrgId { get; set; }
    public string? LegacyOrgName { get; set; }
    public string? LegacyRaionName { get; set; }
}

public sealed class CampaignListItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public CampaignStatus Status { get; set; }
    public ScheduleKind ScheduleKind { get; set; }
    public string? TimeZoneId { get; set; }
    public DateTime? NextRunAtUtc { get; set; }
    public DateTime? LastRunAtUtc { get; set; }
    public int TargetOrganizationsCount { get; set; }
    public int AttachmentsCount { get; set; }
    public string? TransportProfileName { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public sealed class CampaignUpsertRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public string? HtmlBody { get; set; }
    public string? PlainTextBody { get; set; }
    public CampaignStatus Status { get; set; } = CampaignStatus.Draft;
    public int? TransportProfileId { get; set; }
    public ScheduleKind ScheduleKind { get; set; } = ScheduleKind.OneTime;
    public string? CronExpression { get; set; }
    public string? TimeZoneId { get; set; } = "Europe/Amsterdam";
    public DateTime? StartAtUtc { get; set; }
    public DateTime? EndAtUtc { get; set; }
    public int IntervalMinutes { get; set; } = 2;
    public int RandomIntervalMinMinutes { get; set; } = 1;
    public int RandomIntervalMaxMinutes { get; set; } = 5;
    public int MaxRecipientsPerRun { get; set; } = 0;
    public int MaxAttempts { get; set; } = 3;
    public bool UseOrgPrimaryEmail { get; set; } = true;
    public bool UseContactEmails { get; set; }
    public bool UseSalaryEmail { get; set; }
    public bool UseOneCEmail { get; set; }
    public bool UseSiteEmail { get; set; }
    public bool UseDirectorEmail { get; set; }
    public string? ManualRecipientsCsv { get; set; }
    public IReadOnlyCollection<int> TargetOrganizationIds { get; set; } = Array.Empty<int>();
    public IReadOnlyCollection<CampaignAttachmentRequest> Attachments { get; set; } = Array.Empty<CampaignAttachmentRequest>();
}

public sealed class CampaignDetailsDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public string? HtmlBody { get; set; }
    public string? PlainTextBody { get; set; }
    public CampaignStatus Status { get; set; }
    public int? TransportProfileId { get; set; }
    public string? TransportProfileName { get; set; }
    public ScheduleKind ScheduleKind { get; set; }
    public string? CronExpression { get; set; }
    public string? TimeZoneId { get; set; }
    public DateTime? StartAtUtc { get; set; }
    public DateTime? EndAtUtc { get; set; }
    public int IntervalMinutes { get; set; }
    public int RandomIntervalMinMinutes { get; set; }
    public int RandomIntervalMaxMinutes { get; set; }
    public DateTime? NextRunAtUtc { get; set; }
    public DateTime? LastRunAtUtc { get; set; }
    public DateTime? LastRunStartedAtUtc { get; set; }
    public DateTime? LastRunFinishedAtUtc { get; set; }
    public int MaxRecipientsPerRun { get; set; }
    public int MaxAttempts { get; set; }
    public bool UseOrgPrimaryEmail { get; set; }
    public bool UseContactEmails { get; set; }
    public bool UseSalaryEmail { get; set; }
    public bool UseOneCEmail { get; set; }
    public bool UseSiteEmail { get; set; }
    public bool UseDirectorEmail { get; set; }
    public string? ManualRecipientsCsv { get; set; }
    public IReadOnlyCollection<CampaignTargetOrganizationDto> Targets { get; set; } = Array.Empty<CampaignTargetOrganizationDto>();
    public IReadOnlyCollection<CampaignAttachmentDto> Attachments { get; set; } = Array.Empty<CampaignAttachmentDto>();
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

public sealed class CampaignStatusChangeRequest
{
    public CampaignStatus Status { get; set; }
}

public sealed class CampaignManualRunRequest
{
    public DateTime? ScheduledAtUtc { get; set; }
    public string? Comment { get; set; }
}

public sealed class SchedulePreviewRequest
{
    public ScheduleKind ScheduleKind { get; set; } = ScheduleKind.OneTime;
    public string? CronExpression { get; set; }
    public string? TimeZoneId { get; set; } = "Europe/Amsterdam";
    public DateTime? StartAtUtc { get; set; }
    public DateTime? EndAtUtc { get; set; }
    public int IntervalMinutes { get; set; } = 2;
    public int RandomIntervalMinMinutes { get; set; } = 1;
    public int RandomIntervalMaxMinutes { get; set; } = 5;
    public int Count { get; set; } = 10;
}

public sealed class ScheduleOccurrenceDto
{
    public DateTime Utc { get; set; }
    public DateTime Local { get; set; }
}

public sealed class CampaignRecipientPreviewItemDto
{
    public int LegacyOrgId { get; set; }
    public string? LegacyOrgName { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public RecipientSourceKind SourceKind { get; set; }
}

public sealed class CampaignRecipientPreviewDto
{
    public int OrganizationCount { get; set; }
    public int RecipientCount { get; set; }
    public IReadOnlyCollection<CampaignRecipientPreviewItemDto> Items { get; set; } = Array.Empty<CampaignRecipientPreviewItemDto>();
}

public sealed class DispatchBatchDto
{
    public int Id { get; set; }
    public DispatchTriggerKind TriggerKind { get; set; }
    public string? TriggerComment { get; set; }
    public DateTime? ScheduledAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public int TotalRecipients { get; set; }
    public int QueuedCount { get; set; }
    public int ProcessingCount { get; set; }
    public int SentCount { get; set; }
    public int FailedCount { get; set; }
    public int CancelledCount { get; set; }
    public string? CorrelationId { get; set; }
}

public sealed class DispatchItemDto
{
    public int Id { get; set; }
    public int LegacyOrgId { get; set; }
    public string? LegacyOrgName { get; set; }
    public string? RecipientEmail { get; set; }
    public string? RecipientDisplayName { get; set; }
    public RecipientSourceKind SourceKind { get; set; }
    public DispatchStatus Status { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? QueuedAtUtc { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public DateTime? FailedAtUtc { get; set; }
    public DateTime? NextAttemptAtUtc { get; set; }
    public string? ErrorMessage { get; set; }
    public string? SmtpResponse { get; set; }
    public string? MessageId { get; set; }
}

public sealed class CampaignStatisticsDto
{
    public int CampaignId { get; set; }
    public int TotalItems { get; set; }
    public int Queued { get; set; }
    public int Processing { get; set; }
    public int Sent { get; set; }
    public int Failed { get; set; }
    public int Deferred { get; set; }
    public int Cancelled { get; set; }
    public DateTime? LastBatchScheduledAtUtc { get; set; }
    public DateTime? LastBatchCompletedAtUtc { get; set; }
    public IReadOnlyCollection<DispatchBatchDto> RecentBatches { get; set; } = Array.Empty<DispatchBatchDto>();
    public IReadOnlyCollection<DispatchItemDto> RecentItems { get; set; } = Array.Empty<DispatchItemDto>();
}

public sealed class MailSendResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? SmtpResponse { get; set; }
    public string? MessageId { get; set; }
}

public sealed class CampaignRecipientSelection
{
    public IReadOnlyCollection<int> TargetOrganizationIds { get; set; } = Array.Empty<int>();
    public bool UseOrgPrimaryEmail { get; set; }
    public bool UseContactEmails { get; set; }
    public bool UseSalaryEmail { get; set; }
    public bool UseOneCEmail { get; set; }
    public bool UseSiteEmail { get; set; }
    public bool UseDirectorEmail { get; set; }
    public string? ManualRecipientsCsv { get; set; }
}

public sealed class ResolvedRecipient
{
    public int LegacyOrgId { get; set; }
    public string? LegacyOrgName { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public RecipientSourceKind SourceKind { get; set; }
}

using System.ComponentModel.DataAnnotations;
using DevExpress.Xpo;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

public interface IRecipientResolver
{
    Task<IReadOnlyCollection<ResolvedRecipient>> ResolveAsync(MailCampaign campaign, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<ResolvedRecipient>> ResolveAsync(CampaignRecipientSelection selection, CancellationToken cancellationToken);
}

public sealed class RecipientResolver(LegacyUnitOfWork legacyUnitOfWork) : IRecipientResolver
{
    public Task<IReadOnlyCollection<ResolvedRecipient>> ResolveAsync(MailCampaign campaign, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(campaign);

        var selection = new CampaignRecipientSelection
        {
            TargetOrganizationIds = campaign.TargetOrganizations.Cast<MailCampaignTargetOrganization>().Select(x => x.LegacyOrgId).ToArray(),
            UseOrgPrimaryEmail = campaign.UseOrgPrimaryEmail,
            UseContactEmails = campaign.UseContactEmails,
            UseSalaryEmail = campaign.UseSalaryEmail,
            UseOneCEmail = campaign.UseOneCEmail,
            UseSiteEmail = campaign.UseSiteEmail,
            UseDirectorEmail = campaign.UseDirectorEmail,
            ManualRecipientsCsv = campaign.ManualRecipientsCsv
        };

        return ResolveAsync(selection, cancellationToken);
    }

    public Task<IReadOnlyCollection<ResolvedRecipient>> ResolveAsync(CampaignRecipientSelection selection, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(selection);

        var organizations = new XPQuery<LegacyOrg>(legacyUnitOfWork)
            .ToList()
            .Where(x => selection.TargetOrganizationIds.Contains(x.Oid))
            .OrderBy(x => x.Name ?? string.Empty)
            .ToList();

        var results = new List<ResolvedRecipient>();
        var dedupe = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var organization in organizations)
        {
            if (selection.UseOrgPrimaryEmail)
            {
                AddRecipient(results, dedupe, organization.Oid, organization.Name, organization.OrgInfo?.Email, organization.Name, RecipientSourceKind.OrgPrimary);
            }

            if (selection.UseDirectorEmail)
            {
                AddRecipient(results, dedupe, organization.Oid, organization.Name, organization.OrgInfoOther?.RukEmail, organization.Name, RecipientSourceKind.Director);
            }

            if (selection.UseSalaryEmail)
            {
                AddRecipient(results, dedupe, organization.Oid, organization.Name, organization.OrgInfoOther?.ZpEmail, organization.OrgInfoOther?.ZpFIO ?? organization.Name, RecipientSourceKind.Salary);
            }

            if (selection.UseOneCEmail)
            {
                AddRecipient(results, dedupe, organization.Oid, organization.Name, organization.OrgInfoOther?.F1cEmail, organization.OrgInfoOther?.F1cFIO ?? organization.Name, RecipientSourceKind.OneC);
            }

            if (selection.UseSiteEmail)
            {
                AddRecipient(results, dedupe, organization.Oid, organization.Name, organization.OrgInfoOther?.SiteEmail, organization.OrgInfoOther?.SiteFIO ?? organization.Name, RecipientSourceKind.Site);
            }

            if (selection.UseContactEmails)
            {
                foreach (var contact in organization.Contacts.Cast<LegacyContact>())
                {
                    AddRecipient(results, dedupe, organization.Oid, organization.Name, contact.Email, contact.FIO, RecipientSourceKind.Contact);
                }
            }
        }

        foreach (var email in TextHelper.SplitEmailsCsv(selection.ManualRecipientsCsv))
        {
            AddRecipient(results, dedupe, 0, "Ручной список", email, email, RecipientSourceKind.Manual);
        }

        return Task.FromResult<IReadOnlyCollection<ResolvedRecipient>>(results);
    }

    private static void AddRecipient(List<ResolvedRecipient> results, ISet<string> dedupe, int orgId, string? orgName, string? email, string? displayName, RecipientSourceKind sourceKind)
    {
        if (!EmailHelper.IsValid(email))
        {
            return;
        }

        var normalizedEmail = email!.Trim();
        var dedupeKey = $"{orgId}:{normalizedEmail}";
        if (!dedupe.Add(dedupeKey))
        {
            return;
        }

        results.Add(new ResolvedRecipient
        {
            LegacyOrgId = orgId,
            LegacyOrgName = orgName,
            Email = normalizedEmail,
            DisplayName = displayName,
            SourceKind = sourceKind
        });
    }
}

public interface ICampaignService
{
    Task<PagedResult<CampaignListItemDto>> GetAsync(string? search, CampaignStatus? status, int skip, int take, CancellationToken cancellationToken);
    Task<CampaignDetailsDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<CampaignDetailsDto> UpsertAsync(int? id, CampaignUpsertRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int id, CancellationToken cancellationToken);
    Task<CampaignDetailsDto> ChangeStatusAsync(int id, CampaignStatus status, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<ScheduleOccurrenceDto>> PreviewScheduleAsync(SchedulePreviewRequest request, CancellationToken cancellationToken);
    Task<CampaignRecipientPreviewDto> PreviewRecipientsAsync(CampaignUpsertRequest request, CancellationToken cancellationToken);
    Task<DispatchBatchDto> RunAsync(int id, CampaignManualRunRequest request, CancellationToken cancellationToken);
}

public sealed class CampaignService(
    MailingUnitOfWork mailingUnitOfWork,
    LegacyUnitOfWork legacyUnitOfWork,
    ICurrentUserAccessor currentUserAccessor,
    IScheduleCalculator scheduleCalculator,
    IRecipientResolver recipientResolver,
    IDispatchService dispatchService) : ICampaignService
{
    public Task<PagedResult<CampaignListItemDto>> GetAsync(string? search, CampaignStatus? status, int skip, int take, CancellationToken cancellationToken)
    {
        var term = TextHelper.NullIfWhiteSpace(search);
        IEnumerable<MailCampaign> query = new XPQuery<MailCampaign>(mailingUnitOfWork).ToList();

        if (status is not null)
        {
            query = query.Where(x => x.Status == status.Value);
        }

        if (!string.IsNullOrWhiteSpace(term))
        {
            query = query.Where(x => Contains(x.Name, term)
                || Contains(x.Subject, term)
                || Contains(x.TransportProfile?.Name, term)
                || Contains(x.CronExpression, term));
        }

        var ordered = query.OrderByDescending(x => DateTimeHelper.NullIfMin(x.UpdatedAtUtc) ?? DateTime.MinValue)
            .ThenByDescending(x => x.Oid)
            .ToList();
        var totalCount = ordered.Count;
        var items = ordered.Skip(Math.Max(0, skip)).Take(NormalizeTake(take)).Select(MappingHelper.ToCampaignListItemDto).ToArray();
        return Task.FromResult(new PagedResult<CampaignListItemDto>(items, totalCount));
    }

    public Task<CampaignDetailsDto?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var entity = mailingUnitOfWork.GetObjectByKey<MailCampaign>(id);
        return Task.FromResult(entity is null ? null : MappingHelper.ToCampaignDetailsDto(entity));
    }

    public Task<CampaignDetailsDto> UpsertAsync(int? id, CampaignUpsertRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(request.Name), "Введите название кампании.");

        if (request.Status == CampaignStatus.Active)
        {
            ValidationHelper.Guard(request.TargetOrganizationIds.Any() || !string.IsNullOrWhiteSpace(request.ManualRecipientsCsv), "Для активной кампании нужно выбрать хотя бы одну организацию или указать ручные email-адреса.");
        }

        var now = DateTime.UtcNow;
        var currentLegacyUserId = currentUserAccessor.GetLegacyUserId() ?? 0;

        var campaign = id is > 0
            ? mailingUnitOfWork.GetObjectByKey<MailCampaign>(id.Value) ?? throw new KeyNotFoundException($"Кампания #{id} не найдена.")
            : new MailCampaign(mailingUnitOfWork)
            {
                CreatedAtUtc = now,
                CreatedByLegacyUserId = currentLegacyUserId,
                MaxAttempts = 3,
                TimeZoneId = "Europe/Amsterdam"
            };

        campaign.Name = request.Name.Trim();
        campaign.Subject = TextHelper.NullIfWhiteSpace(request.Subject);
        campaign.HtmlBody = TextHelper.NullIfWhiteSpace(request.HtmlBody);
        campaign.PlainTextBody = TextHelper.NullIfWhiteSpace(request.PlainTextBody);
        campaign.Status = request.Status;
        campaign.TransportProfile = request.TransportProfileId is > 0
            ? mailingUnitOfWork.GetObjectByKey<MailTransportProfile>(request.TransportProfileId.Value) ?? throw new KeyNotFoundException($"SMTP-профиль #{request.TransportProfileId} не найден.")
            : null;
        campaign.ScheduleKind = request.ScheduleKind;
        campaign.CronExpression = TextHelper.NullIfWhiteSpace(request.CronExpression);
        campaign.TimeZoneId = TextHelper.NullIfWhiteSpace(request.TimeZoneId) ?? "Europe/Amsterdam";
        campaign.StartAtUtc = DateTimeHelper.MinIfNull(request.StartAtUtc?.ToUniversalTime() ?? now);
        campaign.EndAtUtc = DateTimeHelper.MinIfNull(request.EndAtUtc?.ToUniversalTime());
        campaign.IntervalMinutes = Math.Max(1, request.IntervalMinutes);
        campaign.RandomIntervalMinMinutes = Math.Max(1, request.RandomIntervalMinMinutes);
        campaign.RandomIntervalMaxMinutes = Math.Max(campaign.RandomIntervalMinMinutes, request.RandomIntervalMaxMinutes);
        campaign.MaxRecipientsPerRun = Math.Max(0, request.MaxRecipientsPerRun);
        campaign.MaxAttempts = Math.Max(1, request.MaxAttempts);
        campaign.UseOrgPrimaryEmail = request.UseOrgPrimaryEmail;
        campaign.UseContactEmails = request.UseContactEmails;
        campaign.UseSalaryEmail = request.UseSalaryEmail;
        campaign.UseOneCEmail = request.UseOneCEmail;
        campaign.UseSiteEmail = request.UseSiteEmail;
        campaign.UseDirectorEmail = request.UseDirectorEmail;
        campaign.ManualRecipientsCsv = TextHelper.NullIfWhiteSpace(request.ManualRecipientsCsv);
        campaign.UpdatedAtUtc = now;
        campaign.UpdatedByLegacyUserId = currentLegacyUserId;

        SyncTargets(campaign, request.TargetOrganizationIds);
        SyncAttachments(campaign, request.Attachments);

        campaign.NextRunAtUtc = campaign.Status is CampaignStatus.Archived or CampaignStatus.Completed
            ? DateTime.MinValue
            : DateTimeHelper.MinIfNull(scheduleCalculator.CalculateInitialNextRunUtc(campaign, now));

        mailingUnitOfWork.CommitChanges();
        return Task.FromResult(MappingHelper.ToCampaignDetailsDto(campaign));
    }

    public Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var campaign = mailingUnitOfWork.GetObjectByKey<MailCampaign>(id)
            ?? throw new KeyNotFoundException($"Кампания #{id} не найдена.");

        foreach (var attachment in campaign.Attachments.Cast<MailCampaignAttachment>().ToList())
        {
            attachment.Delete();
        }

        foreach (var target in campaign.TargetOrganizations.Cast<MailCampaignTargetOrganization>().ToList())
        {
            target.Delete();
        }

        foreach (var batch in campaign.Batches.Cast<MailDispatchBatch>().ToList())
        {
            foreach (var item in batch.Items.Cast<MailDispatchItem>().ToList())
            {
                item.Delete();
            }

            batch.Delete();
        }

        campaign.Delete();
        mailingUnitOfWork.CommitChanges();
        return Task.CompletedTask;
    }

    public Task<CampaignDetailsDto> ChangeStatusAsync(int id, CampaignStatus status, CancellationToken cancellationToken)
    {
        var campaign = mailingUnitOfWork.GetObjectByKey<MailCampaign>(id)
            ?? throw new KeyNotFoundException($"Кампания #{id} не найдена.");

        campaign.Status = status;
        campaign.UpdatedAtUtc = DateTime.UtcNow;
        campaign.UpdatedByLegacyUserId = currentUserAccessor.GetLegacyUserId() ?? campaign.UpdatedByLegacyUserId;
        campaign.NextRunAtUtc = status is CampaignStatus.Archived or CampaignStatus.Completed
            ? DateTime.MinValue
            : DateTimeHelper.MinIfNull(scheduleCalculator.CalculateInitialNextRunUtc(campaign, DateTime.UtcNow));

        mailingUnitOfWork.CommitChanges();
        return Task.FromResult(MappingHelper.ToCampaignDetailsDto(campaign));
    }

    public Task<IReadOnlyCollection<ScheduleOccurrenceDto>> PreviewScheduleAsync(SchedulePreviewRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        return Task.FromResult(scheduleCalculator.Preview(request));
    }

    public async Task<CampaignRecipientPreviewDto> PreviewRecipientsAsync(CampaignUpsertRequest request, CancellationToken cancellationToken)
    {
        var selection = new CampaignRecipientSelection
        {
            TargetOrganizationIds = request.TargetOrganizationIds,
            UseOrgPrimaryEmail = request.UseOrgPrimaryEmail,
            UseContactEmails = request.UseContactEmails,
            UseSalaryEmail = request.UseSalaryEmail,
            UseOneCEmail = request.UseOneCEmail,
            UseSiteEmail = request.UseSiteEmail,
            UseDirectorEmail = request.UseDirectorEmail,
            ManualRecipientsCsv = request.ManualRecipientsCsv
        };

        var recipients = await recipientResolver.ResolveAsync(selection, cancellationToken);
        var previewItems = recipients.Take(500).Select(x => new CampaignRecipientPreviewItemDto
        {
            LegacyOrgId = x.LegacyOrgId,
            LegacyOrgName = x.LegacyOrgName,
            Email = x.Email,
            DisplayName = x.DisplayName,
            SourceKind = x.SourceKind
        }).ToArray();

        return new CampaignRecipientPreviewDto
        {
            OrganizationCount = recipients.Where(x => x.LegacyOrgId > 0).Select(x => x.LegacyOrgId).Distinct().Count(),
            RecipientCount = recipients.Count,
            Items = previewItems
        };
    }

    public Task<DispatchBatchDto> RunAsync(int id, CampaignManualRunRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        return dispatchService.CreateBatchAsync(id, DispatchTriggerKind.Manual, request.ScheduledAtUtc?.ToUniversalTime() ?? DateTime.UtcNow, request.Comment, cancellationToken);
    }

    private void SyncTargets(MailCampaign campaign, IReadOnlyCollection<int> targetOrganizationIds)
    {
        var targetIds = targetOrganizationIds.Where(x => x > 0).Distinct().ToHashSet();
        var existing = campaign.TargetOrganizations.Cast<MailCampaignTargetOrganization>().ToList();

        foreach (var target in existing.Where(x => !targetIds.Contains(x.LegacyOrgId)).ToList())
        {
            target.Delete();
        }

        var organizations = new XPQuery<LegacyOrg>(legacyUnitOfWork)
            .ToList()
            .Where(x => targetIds.Contains(x.Oid))
            .ToDictionary(x => x.Oid);

        foreach (var targetId in targetIds)
        {
            if (!organizations.TryGetValue(targetId, out var org))
            {
                throw new ValidationException($"Организация #{targetId} не найдена в legacy БД.");
            }

            var target = existing.FirstOrDefault(x => x.LegacyOrgId == targetId);
            if (target is null)
            {
                target = new MailCampaignTargetOrganization(mailingUnitOfWork)
                {
                    Campaign = campaign,
                    LegacyOrgId = targetId
                };
            }

            target.LegacyOrgName = org.Name;
            target.LegacyRaionName = org.Raion?.Name;
        }
    }

    private void SyncAttachments(MailCampaign campaign, IReadOnlyCollection<CampaignAttachmentRequest> attachments)
    {
        foreach (var existing in campaign.Attachments.Cast<MailCampaignAttachment>().ToList())
        {
            existing.Delete();
        }

        foreach (var attachmentRequest in attachments.OrderBy(x => x.SortOrder).ThenBy(x => x.StoredFileId))
        {
            var storedFile = mailingUnitOfWork.GetObjectByKey<MailStoredFile>(attachmentRequest.StoredFileId)
                ?? throw new ValidationException($"Файл #{attachmentRequest.StoredFileId} не найден.");

            _ = new MailCampaignAttachment(mailingUnitOfWork)
            {
                Campaign = campaign,
                StoredFile = storedFile,
                AttachmentKind = attachmentRequest.AttachmentKind,
                DisplayName = TextHelper.NullIfWhiteSpace(attachmentRequest.DisplayName) ?? storedFile.OriginalFileName,
                ContentId = TextHelper.NullIfWhiteSpace(attachmentRequest.ContentId),
                SortOrder = attachmentRequest.SortOrder
            };
        }
    }

    private static int NormalizeTake(int take) => take <= 0 ? 100 : Math.Min(take, 500);

    private static bool Contains(string? source, string term)
        => !string.IsNullOrWhiteSpace(source) && source.Contains(term, StringComparison.OrdinalIgnoreCase);
}

public interface IStatisticsService
{
    Task<CampaignStatisticsDto> GetCampaignStatisticsAsync(int campaignId, CancellationToken cancellationToken);
}

public sealed class StatisticsService(MailingUnitOfWork mailingUnitOfWork) : IStatisticsService
{
    public Task<CampaignStatisticsDto> GetCampaignStatisticsAsync(int campaignId, CancellationToken cancellationToken)
    {
        var batches = new XPQuery<MailDispatchBatch>(mailingUnitOfWork).ToList().Where(x => x.Campaign?.Oid == campaignId).OrderByDescending(x => x.CreatedAtUtc).ToList();
        var items = new XPQuery<MailDispatchItem>(mailingUnitOfWork).ToList().Where(x => x.Campaign?.Oid == campaignId).OrderByDescending(x => x.QueuedAtUtc).ToList();

        var dto = new CampaignStatisticsDto
        {
            CampaignId = campaignId,
            TotalItems = items.Count,
            Queued = items.Count(x => x.Status == DispatchStatus.Queued),
            Processing = items.Count(x => x.Status == DispatchStatus.Processing),
            Sent = items.Count(x => x.Status == DispatchStatus.Sent),
            Failed = items.Count(x => x.Status == DispatchStatus.Failed),
            Deferred = items.Count(x => x.Status == DispatchStatus.Deferred),
            Cancelled = items.Count(x => x.Status == DispatchStatus.Cancelled),
            LastBatchScheduledAtUtc = batches.Select(x => DateTimeHelper.NullIfMin(x.ScheduledAtUtc)).FirstOrDefault(x => x is not null),
            LastBatchCompletedAtUtc = batches.Select(x => DateTimeHelper.NullIfMin(x.CompletedAtUtc)).FirstOrDefault(x => x is not null),
            RecentBatches = batches.Take(20).Select(MappingHelper.ToDispatchBatchDto).ToArray(),
            RecentItems = items.Take(200).Select(MappingHelper.ToDispatchItemDto).ToArray()
        };

        return Task.FromResult(dto);
    }
}

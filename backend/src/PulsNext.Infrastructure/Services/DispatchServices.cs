using System.Collections.Concurrent;
using System.Net;
using System.Text.RegularExpressions;
using DevExpress.Xpo;
using MailKit.Net.Smtp;
using Microsoft.Extensions.Logging;
using MimeKit;
using MimeKit.Utils;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

public interface ITransportProfileLimiter
{
    Task<IAsyncDisposable> AcquireAsync(MailTransportProfile profile, CancellationToken cancellationToken);
}

public sealed class TransportProfileLimiter : ITransportProfileLimiter
{
    private readonly ConcurrentDictionary<int, ProfileLimiterState> _states = new();

    public async Task<IAsyncDisposable> AcquireAsync(MailTransportProfile profile, CancellationToken cancellationToken)
    {
        var state = _states.GetOrAdd(profile.Oid, _ => new ProfileLimiterState(Math.Max(1, profile.MaxConnections)));
        await state.Connections.WaitAsync(cancellationToken);

        if (profile.MessagesPerMinute > 0)
        {
            await state.RateMutex.WaitAsync(cancellationToken);
            try
            {
                var now = DateTime.UtcNow;
                var minimumSpacing = TimeSpan.FromMinutes(1d / profile.MessagesPerMinute);
                var wait = state.NextAllowedAtUtc - now;
                if (wait > TimeSpan.Zero)
                {
                    await Task.Delay(wait, cancellationToken);
                }

                state.NextAllowedAtUtc = DateTime.UtcNow.Add(minimumSpacing);
            }
            finally
            {
                state.RateMutex.Release();
            }
        }

        return new AsyncDisposeAction(() =>
        {
            state.Connections.Release();
            return ValueTask.CompletedTask;
        });
    }

    private sealed class ProfileLimiterState(int maxConnections)
    {
        public SemaphoreSlim Connections { get; } = new(Math.Max(1, maxConnections), Math.Max(1, maxConnections));
        public SemaphoreSlim RateMutex { get; } = new(1, 1);
        public DateTime NextAllowedAtUtc { get; set; } = DateTime.MinValue;
    }

    private sealed class AsyncDisposeAction(Func<ValueTask> disposeAction) : IAsyncDisposable
    {
        public ValueTask DisposeAsync() => disposeAction();
    }
}

public interface IMailComposer
{
    Task<MimeMessage> BuildAsync(MailDispatchItem item, MailTransportProfile profile, CancellationToken cancellationToken);
}

public sealed class MailComposer(IFileStorageService fileStorageService) : IMailComposer
{
    public async Task<MimeMessage> BuildAsync(MailDispatchItem item, MailTransportProfile profile, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(item);
        ArgumentNullException.ThrowIfNull(profile);

        var campaign = item.Campaign ?? throw new InvalidOperationException("Dispatch item is not linked to campaign.");
        var message = new MimeMessage();
        var fromEmail = profile.SenderEmail ?? throw new InvalidOperationException("SMTP profile SenderEmail is empty.");

        message.From.Add(new MailboxAddress(profile.SenderName ?? fromEmail, fromEmail));

        var replyToEmail = TextHelper.NullIfWhiteSpace(profile.ReplyToEmail);
        if (replyToEmail is not null && EmailHelper.IsValid(replyToEmail))
        {
            message.ReplyTo.Add(MailboxAddress.Parse(replyToEmail));
        }

        message.To.Add(new MailboxAddress(item.RecipientDisplayName ?? item.RecipientEmail ?? item.LegacyOrgName ?? string.Empty, item.RecipientEmail ?? throw new InvalidOperationException("Recipient email is empty.")));
        message.Subject = campaign.Subject ?? campaign.Name ?? "Без темы";
        message.MessageId = MimeUtils.GenerateMessageId();

        var builder = new BodyBuilder
        {
            HtmlBody = campaign.HtmlBody,
            TextBody = !string.IsNullOrWhiteSpace(campaign.PlainTextBody) ? campaign.PlainTextBody : ConvertHtmlToText(campaign.HtmlBody)
        };

        foreach (var attachment in campaign.Attachments.Cast<MailCampaignAttachment>().OrderBy(x => x.SortOrder).ThenBy(x => x.DisplayName ?? string.Empty))
        {
            if (attachment.StoredFile is null)
            {
                continue;
            }

            var opened = await fileStorageService.OpenReadAsync(attachment.StoredFile.Oid, cancellationToken);
            if (opened is null)
            {
                continue;
            }

            await using var contentStream = opened.Value.Content;
            await using var memory = new MemoryStream();
            await contentStream.CopyToAsync(memory, cancellationToken);
            var bytes = memory.ToArray();
            var fileName = attachment.DisplayName ?? opened.Value.Metadata.OriginalFileName;

            if (attachment.AttachmentKind == AttachmentKind.InlineImage)
            {
                var resource = builder.LinkedResources.Add(fileName, bytes);
                resource.ContentId = TextHelper.NullIfWhiteSpace(attachment.ContentId) ?? MimeUtils.GenerateMessageId();
            }
            else
            {
                builder.Attachments.Add(fileName, bytes);
            }
        }

        message.Body = builder.ToMessageBody();
        return message;
    }

    private static string ConvertHtmlToText(string? html)
    {
        if (string.IsNullOrWhiteSpace(html))
        {
            return string.Empty;
        }

        var withoutTags = Regex.Replace(html, "<[^>]+>", " ");
        var decoded = WebUtility.HtmlDecode(withoutTags);
        return Regex.Replace(decoded, "\\s+", " ").Trim();
    }
}

public interface IMailSender
{
    Task<MailSendResult> SendAsync(MailDispatchItem item, CancellationToken cancellationToken);
}

public sealed class MailSender(
    ISecretProtector secretProtector,
    ITransportProfileLimiter transportProfileLimiter,
    ITransportProfileService transportProfileService,
    IMailComposer mailComposer) : IMailSender
{
    public async Task<MailSendResult> SendAsync(MailDispatchItem item, CancellationToken cancellationToken)
    {
        var campaign = item.Campaign ?? throw new InvalidOperationException("Dispatch item is not linked to campaign.");
        var profile = await transportProfileService.GetPreferredProfileAsync(campaign.TransportProfile?.Oid, cancellationToken)
            ?? throw new InvalidOperationException("Не найден активный SMTP-профиль.");

        if (!profile.IsEnabled)
        {
            throw new InvalidOperationException("SMTP-профиль отключён.");
        }

        await using var lease = await transportProfileLimiter.AcquireAsync(profile, cancellationToken);
        var message = await mailComposer.BuildAsync(item, profile, cancellationToken);
        var host = string.IsNullOrWhiteSpace(profile.Host)
            ? throw new InvalidOperationException("В SMTP-профиле не указан сервер.")
            : profile.Host;

        using var client = new SmtpClient();
        client.Timeout = 60000;
        await client.ConnectAsync(host, profile.Port, profile.UseSsl, cancellationToken);

        if (!string.IsNullOrWhiteSpace(profile.Username))
        {
            var password = secretProtector.Unprotect(profile.PasswordProtected);
            await client.AuthenticateAsync(profile.Username, password, cancellationToken);
        }

        var response = await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);

        return new MailSendResult
        {
            Success = true,
            MessageId = message.MessageId,
            SmtpResponse = response
        };
    }
}

public interface IDispatchService
{
    Task<int> ScheduleDueCampaignsAsync(CancellationToken cancellationToken);
    Task<DispatchBatchDto> CreateBatchAsync(int campaignId, DispatchTriggerKind triggerKind, DateTime scheduledAtUtc, string? comment, CancellationToken cancellationToken);
    Task<int> QueueDueItemsAsync(CancellationToken cancellationToken);
    Task<bool> ProcessItemAsync(int dispatchItemId, CancellationToken cancellationToken);
    Task<int> RecoverStuckItemsAsync(CancellationToken cancellationToken);
}

public sealed class DispatchService(
    MailingUnitOfWork mailingUnitOfWork,
    IRecipientResolver recipientResolver,
    IScheduleCalculator scheduleCalculator,
    IDispatchChannel dispatchChannel,
    IMailSender mailSender,
    Microsoft.Extensions.Options.IOptions<DispatchOptions> dispatchOptions,
    Microsoft.Extensions.Logging.ILogger<DispatchService> logger) : IDispatchService
{
    public async Task<int> ScheduleDueCampaignsAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var dueCampaignIds = new XPQuery<MailCampaign>(mailingUnitOfWork)
            .ToList()
            .Where(x => x.Status == CampaignStatus.Active && DateTimeHelper.NullIfMin(x.NextRunAtUtc) is DateTime nextRun && nextRun <= now)
            .OrderBy(x => x.NextRunAtUtc)
            .Take(Math.Max(1, dispatchOptions.Value.DueCampaignBatchSize))
            .Select(x => x.Oid)
            .ToList();

        foreach (var campaignId in dueCampaignIds)
        {
            var campaign = mailingUnitOfWork.GetObjectByKey<MailCampaign>(campaignId);
            if (campaign is null)
            {
                continue;
            }

            var scheduledAtUtc = DateTimeHelper.NullIfMin(campaign.NextRunAtUtc) ?? now;
            await CreateScheduledBatchInternalAsync(campaign, scheduledAtUtc, cancellationToken);
        }

        return dueCampaignIds.Count;
    }

    public async Task<DispatchBatchDto> CreateBatchAsync(int campaignId, DispatchTriggerKind triggerKind, DateTime scheduledAtUtc, string? comment, CancellationToken cancellationToken)
    {
        var campaign = mailingUnitOfWork.GetObjectByKey<MailCampaign>(campaignId)
            ?? throw new KeyNotFoundException($"Кампания #{campaignId} не найдена.");

        var batch = await CreateBatchInternalAsync(campaign, triggerKind, scheduledAtUtc.ToUniversalTime(), comment, updateCampaignSchedule: triggerKind == DispatchTriggerKind.Scheduled, cancellationToken);
        return MappingHelper.ToDispatchBatchDto(batch);
    }

    public async Task<int> QueueDueItemsAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var queueBatchSize = Math.Max(1, dispatchOptions.Value.QueueBatchSize);

        var dueItems = new XPQuery<MailDispatchItem>(mailingUnitOfWork)
            .ToList()
            .Where(x => x.Status is DispatchStatus.Queued or DispatchStatus.Deferred)
            .Where(x => DateTimeHelper.NullIfMin(x.NextAttemptAtUtc) is DateTime nextAttempt && nextAttempt <= now)
            .Where(x => DateTimeHelper.NullIfMin(x.ChannelQueuedAtUtc) is null)
            .OrderBy(x => x.NextAttemptAtUtc)
            .Take(queueBatchSize)
            .ToList();

        if (dueItems.Count == 0)
        {
            return 0;
        }

        foreach (var item in dueItems)
        {
            item.ChannelQueuedAtUtc = now;
            item.WorkerNode = dispatchOptions.Value.WorkerNode;
        }

        mailingUnitOfWork.CommitChanges();

        foreach (var item in dueItems)
        {
            await dispatchChannel.WriteAsync(item.Oid, cancellationToken);
        }

        return dueItems.Count;
    }

    public async Task<bool> ProcessItemAsync(int dispatchItemId, CancellationToken cancellationToken)
    {
        var item = mailingUnitOfWork.GetObjectByKey<MailDispatchItem>(dispatchItemId);
        if (item is null)
        {
            return false;
        }

        if (item.Status is DispatchStatus.Sent or DispatchStatus.Cancelled or DispatchStatus.Failed)
        {
            return false;
        }

        var now = DateTime.UtcNow;
        item.Status = DispatchStatus.Processing;
        item.StartedAtUtc = now;
        item.AttemptCount += 1;
        item.ErrorMessage = null;
        mailingUnitOfWork.CommitChanges();

        try
        {
            var result = await mailSender.SendAsync(item, cancellationToken);
            if (!result.Success)
            {
                throw new InvalidOperationException(result.ErrorMessage ?? "SMTP send failed.");
            }

            item.Status = DispatchStatus.Sent;
            item.SentAtUtc = DateTime.UtcNow;
            item.SmtpResponse = result.SmtpResponse;
            item.MessageId = result.MessageId;
            item.ChannelQueuedAtUtc = DateTime.MinValue;
            item.ErrorMessage = null;

            RefreshBatchCounters(item.Batch?.Oid);
            mailingUnitOfWork.CommitChanges();
            return true;
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Dispatch item {DispatchItemId} failed", dispatchItemId);
            var maxAttempts = Math.Max(1, item.Campaign?.MaxAttempts ?? 3);
            var canRetry = item.AttemptCount < maxAttempts;

            item.FailedAtUtc = DateTime.UtcNow;
            item.ErrorMessage = ex.Message;
            item.ChannelQueuedAtUtc = DateTime.MinValue;
            item.SmtpResponse ??= ex.GetType().Name;

            if (canRetry)
            {
                item.Status = DispatchStatus.Deferred;
                item.NextAttemptAtUtc = DateTime.UtcNow.AddMinutes(DispatchRecoveryPolicy.CalculateRetryDelayMinutes(
                    item.AttemptCount,
                    dispatchOptions.Value.RetryBaseDelayMinutes,
                    dispatchOptions.Value.RetryMaxDelayMinutes));
            }
            else
            {
                item.Status = DispatchStatus.Failed;
                item.NextAttemptAtUtc = DateTime.MinValue;
            }

            RefreshBatchCounters(item.Batch?.Oid);
            mailingUnitOfWork.CommitChanges();
            return false;
        }
    }

    public Task<int> RecoverStuckItemsAsync(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var recovered = 0;
        var processingTimeoutMinutes = dispatchOptions.Value.ProcessingTimeoutMinutes;
        var queueReservationTimeoutMinutes = dispatchOptions.Value.QueueReservationTimeoutMinutes;
        var items = new XPQuery<MailDispatchItem>(mailingUnitOfWork).ToList();

        foreach (var item in items.Where(x => x.Status == DispatchStatus.Processing && DispatchRecoveryPolicy.ShouldRecoverProcessing(now, x.StartedAtUtc, processingTimeoutMinutes)))
        {
            item.Status = DispatchStatus.Deferred;
            item.NextAttemptAtUtc = now.AddMinutes(Math.Max(1, dispatchOptions.Value.RetryBaseDelayMinutes));
            item.ChannelQueuedAtUtc = DateTime.MinValue;
            item.ErrorMessage = "Сообщение было возвращено в очередь после таймаута обработки.";
            recovered++;
            RefreshBatchCounters(item.Batch?.Oid);
        }

        foreach (var item in items.Where(x => x.Status is DispatchStatus.Queued or DispatchStatus.Deferred)
                     .Where(x => DispatchRecoveryPolicy.ShouldReleaseQueueReservation(now, x.ChannelQueuedAtUtc, queueReservationTimeoutMinutes)))
        {
            item.ChannelQueuedAtUtc = DateTime.MinValue;
            recovered++;
        }

        mailingUnitOfWork.CommitChanges();
        return Task.FromResult(recovered);
    }

    private async Task CreateScheduledBatchInternalAsync(MailCampaign campaign, DateTime scheduledAtUtc, CancellationToken cancellationToken)
    {
        var existingBatch = FindExistingScheduledBatch(campaign.Oid, scheduledAtUtc);
        if (existingBatch is not null)
        {
            AdvanceCampaignScheduleAfterScheduledBatch(campaign, scheduledAtUtc);
            mailingUnitOfWork.CommitChanges();
            return;
        }

        await CreateBatchInternalAsync(campaign, DispatchTriggerKind.Scheduled, scheduledAtUtc, null, updateCampaignSchedule: true, cancellationToken);
    }

    private async Task<MailDispatchBatch> CreateBatchInternalAsync(MailCampaign campaign, DispatchTriggerKind triggerKind, DateTime scheduledAtUtc, string? comment, bool updateCampaignSchedule, CancellationToken cancellationToken)
    {
        var recipients = await recipientResolver.ResolveAsync(campaign, cancellationToken);
        if (campaign.MaxRecipientsPerRun > 0)
        {
            recipients = recipients.Take(campaign.MaxRecipientsPerRun).ToArray();
        }

        var now = DateTime.UtcNow;
        var batch = new MailDispatchBatch(mailingUnitOfWork)
        {
            Campaign = campaign,
            TriggerKind = triggerKind,
            TriggerComment = TextHelper.NullIfWhiteSpace(comment),
            ScheduledAtUtc = scheduledAtUtc,
            CreatedAtUtc = now,
            CorrelationId = Guid.NewGuid().ToString("N")
        };

        foreach (var recipient in recipients)
        {
            _ = new MailDispatchItem(mailingUnitOfWork)
            {
                Batch = batch,
                Campaign = campaign,
                LegacyOrgId = recipient.LegacyOrgId,
                LegacyOrgName = recipient.LegacyOrgName,
                RecipientEmail = recipient.Email,
                RecipientDisplayName = recipient.DisplayName,
                SourceKind = recipient.SourceKind,
                Status = DispatchStatus.Queued,
                AttemptCount = 0,
                QueuedAtUtc = now,
                ChannelQueuedAtUtc = DateTime.MinValue,
                StartedAtUtc = DateTime.MinValue,
                SentAtUtc = DateTime.MinValue,
                FailedAtUtc = DateTime.MinValue,
                NextAttemptAtUtc = scheduledAtUtc,
                DispatchKey = DispatchRecoveryPolicy.BuildDispatchKey(campaign.Oid, scheduledAtUtc, recipient.LegacyOrgId, recipient.Email)
            };
        }

        batch.TotalRecipients = recipients.Count;
        batch.QueuedCount = recipients.Count;
        batch.ProcessingCount = 0;
        batch.SentCount = 0;
        batch.FailedCount = 0;
        batch.CancelledCount = 0;

        if (updateCampaignSchedule)
        {
            AdvanceCampaignScheduleAfterScheduledBatch(campaign, scheduledAtUtc, now);
            if (recipients.Count == 0)
            {
                campaign.LastRunFinishedAtUtc = now;
            }
        }

        if (recipients.Count == 0)
        {
            batch.CompletedAtUtc = now;
        }

        mailingUnitOfWork.CommitChanges();
        return batch;
    }

    private MailDispatchBatch? FindExistingScheduledBatch(int campaignId, DateTime scheduledAtUtc)
    {
        var scheduledAt = scheduledAtUtc.ToUniversalTime();
        return new XPQuery<MailDispatchBatch>(mailingUnitOfWork)
            .ToList()
            .FirstOrDefault(x => DispatchRecoveryPolicy.IsSameScheduledBatch(x, campaignId, scheduledAt));
    }

    private void AdvanceCampaignScheduleAfterScheduledBatch(MailCampaign campaign, DateTime scheduledAtUtc, DateTime? startedAtUtc = null)
    {
        campaign.LastRunAtUtc = scheduledAtUtc.ToUniversalTime();
        campaign.LastRunStartedAtUtc = startedAtUtc ?? DateTime.UtcNow;
        campaign.NextRunAtUtc = DateTimeHelper.MinIfNull(scheduleCalculator.CalculateNextRunAfterExecution(campaign, scheduledAtUtc));
    }

    private void RefreshBatchCounters(int? batchId)
    {
        if (batchId is not > 0)
        {
            return;
        }

        var batch = mailingUnitOfWork.GetObjectByKey<MailDispatchBatch>(batchId.Value);
        if (batch is null)
        {
            return;
        }

        var items = batch.Items.Cast<MailDispatchItem>().ToList();
        batch.TotalRecipients = items.Count;
        batch.QueuedCount = items.Count(x => x.Status == DispatchStatus.Queued || x.Status == DispatchStatus.Deferred);
        batch.ProcessingCount = items.Count(x => x.Status == DispatchStatus.Processing);
        batch.SentCount = items.Count(x => x.Status == DispatchStatus.Sent);
        batch.FailedCount = items.Count(x => x.Status == DispatchStatus.Failed);
        batch.CancelledCount = items.Count(x => x.Status == DispatchStatus.Cancelled);

        var hasPending = items.Any(x => x.Status is DispatchStatus.Queued or DispatchStatus.Deferred or DispatchStatus.Processing);
        if (!hasPending)
        {
            batch.CompletedAtUtc = DateTime.UtcNow;
            if (batch.Campaign is not null)
            {
                batch.Campaign.LastRunFinishedAtUtc = batch.CompletedAtUtc;
            }
        }
    }

}

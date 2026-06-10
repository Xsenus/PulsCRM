using DevExpress.Xpo;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

public interface IDispatchDiagnosticsService
{
    Task<PagedResult<DispatchItemDto>> GetItemsAsync(DispatchItemListQuery query, CancellationToken cancellationToken);
    Task<PagedResult<DispatchBatchDto>> GetBatchesAsync(DispatchBatchListQuery query, CancellationToken cancellationToken);
    Task<DispatchItemDto> RetryItemAsync(int id, CancellationToken cancellationToken);
    Task<DispatchItemDto> CancelItemAsync(int id, CancellationToken cancellationToken);
}

public static class DispatchDiagnosticsQuery
{
    public const int DefaultTake = 50;
    public const int MaxTake = 500;

    public static int NormalizeSkip(int? skip) => Math.Max(0, skip ?? 0);

    public static int NormalizeTake(int? take)
    {
        if (take is null or <= 0)
        {
            return DefaultTake;
        }

        return Math.Min(take.Value, MaxTake);
    }
}

public sealed class DispatchDiagnosticsService(MailingUnitOfWork mailingUnitOfWork) : IDispatchDiagnosticsService
{
    public Task<PagedResult<DispatchItemDto>> GetItemsAsync(DispatchItemListQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var skip = DispatchDiagnosticsQuery.NormalizeSkip(query.Skip);
        var take = DispatchDiagnosticsQuery.NormalizeTake(query.Take);
        var search = TextHelper.NullIfWhiteSpace(query.Search);
        IEnumerable<MailDispatchItem> items = new XPQuery<MailDispatchItem>(mailingUnitOfWork).ToList();

        if (query.Status is DispatchStatus status)
        {
            items = items.Where(x => x.Status == status);
        }

        if (query.CampaignId is > 0)
        {
            items = items.Where(x => x.Campaign?.Oid == query.CampaignId.Value);
        }

        if (query.BatchId is > 0)
        {
            items = items.Where(x => x.Batch?.Oid == query.BatchId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            items = items.Where(x =>
                Contains(x.RecipientEmail, search) ||
                Contains(x.RecipientDisplayName, search) ||
                Contains(x.LegacyOrgName, search) ||
                Contains(x.ErrorMessage, search) ||
                Contains(x.SmtpResponse, search));
        }

        var filtered = items
            .OrderByDescending(GetItemSortDate)
            .ThenByDescending(x => x.Oid)
            .ToList();

        var result = new PagedResult<DispatchItemDto>(
            filtered.Skip(skip).Take(take).Select(MappingHelper.ToDispatchItemDto).ToArray(),
            filtered.Count);

        return Task.FromResult(result);
    }

    public Task<PagedResult<DispatchBatchDto>> GetBatchesAsync(DispatchBatchListQuery query, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(query);

        var skip = DispatchDiagnosticsQuery.NormalizeSkip(query.Skip);
        var take = DispatchDiagnosticsQuery.NormalizeTake(query.Take);
        IEnumerable<MailDispatchBatch> batches = new XPQuery<MailDispatchBatch>(mailingUnitOfWork).ToList();

        if (query.CampaignId is > 0)
        {
            batches = batches.Where(x => x.Campaign?.Oid == query.CampaignId.Value);
        }

        var filtered = batches
            .OrderByDescending(x => DateTimeHelper.ForceUtc(x.CreatedAtUtc))
            .ThenByDescending(x => x.Oid)
            .ToList();

        var result = new PagedResult<DispatchBatchDto>(
            filtered.Skip(skip).Take(take).Select(MappingHelper.ToDispatchBatchDto).ToArray(),
            filtered.Count);

        return Task.FromResult(result);
    }

    public Task<DispatchItemDto> RetryItemAsync(int id, CancellationToken cancellationToken)
    {
        var item = GetItemOrThrow(id);

        if (item.Status is DispatchStatus.Sent or DispatchStatus.Processing or DispatchStatus.Cancelled)
        {
            throw new InvalidOperationException("Повторить можно только ошибочные или отложенные сообщения.");
        }

        item.Status = DispatchStatus.Queued;
        item.NextAttemptAtUtc = DateTime.UtcNow;
        item.ChannelQueuedAtUtc = DateTime.MinValue;
        item.StartedAtUtc = DateTime.MinValue;
        item.FailedAtUtc = DateTime.MinValue;
        item.ErrorMessage = null;
        item.SmtpResponse = null;
        item.MessageId = null;

        RefreshBatchCounters(item.Batch?.Oid);
        mailingUnitOfWork.CommitChanges();

        return Task.FromResult(MappingHelper.ToDispatchItemDto(item));
    }

    public Task<DispatchItemDto> CancelItemAsync(int id, CancellationToken cancellationToken)
    {
        var item = GetItemOrThrow(id);

        if (item.Status == DispatchStatus.Sent)
        {
            throw new InvalidOperationException("Уже отправленное сообщение нельзя отменить.");
        }

        if (item.Status != DispatchStatus.Cancelled)
        {
            item.Status = DispatchStatus.Cancelled;
            item.ChannelQueuedAtUtc = DateTime.MinValue;
            item.NextAttemptAtUtc = DateTime.MinValue;
            item.ErrorMessage = "Отправка отменена оператором.";
        }

        RefreshBatchCounters(item.Batch?.Oid);
        mailingUnitOfWork.CommitChanges();

        return Task.FromResult(MappingHelper.ToDispatchItemDto(item));
    }

    private MailDispatchItem GetItemOrThrow(int id)
    {
        return mailingUnitOfWork.GetObjectByKey<MailDispatchItem>(id)
            ?? throw new KeyNotFoundException($"Запись очереди #{id} не найдена.");
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
        batch.QueuedCount = items.Count(x => x.Status is DispatchStatus.Queued or DispatchStatus.Deferred);
        batch.ProcessingCount = items.Count(x => x.Status == DispatchStatus.Processing);
        batch.SentCount = items.Count(x => x.Status == DispatchStatus.Sent);
        batch.FailedCount = items.Count(x => x.Status == DispatchStatus.Failed);
        batch.CancelledCount = items.Count(x => x.Status == DispatchStatus.Cancelled);

        var hasPending = items.Any(x => x.Status is DispatchStatus.Queued or DispatchStatus.Deferred or DispatchStatus.Processing);
        batch.CompletedAtUtc = hasPending ? DateTime.MinValue : DateTime.UtcNow;
    }

    private static DateTime GetItemSortDate(MailDispatchItem item)
    {
        return DateTimeHelper.NullIfMin(item.FailedAtUtc)
            ?? DateTimeHelper.NullIfMin(item.SentAtUtc)
            ?? DateTimeHelper.NullIfMin(item.StartedAtUtc)
            ?? DateTimeHelper.NullIfMin(item.QueuedAtUtc)
            ?? DateTime.MinValue;
    }

    private static bool Contains(string? value, string search)
    {
        return !string.IsNullOrWhiteSpace(value) && value.Contains(search, StringComparison.OrdinalIgnoreCase);
    }
}

using System.Collections.Concurrent;
using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Mailing;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class DispatchServiceRecoveryTests
{
    [Fact]
    public async Task RecoverStuckItemsAsync_RecoversOnlyTimedOutProcessingAndReservations()
    {
        using var unitOfWork = CreateMailingUnitOfWork();
        var now = DateTime.UtcNow;
        var campaign = CreateCampaign(unitOfWork);
        var batch = CreateBatch(unitOfWork, campaign);
        var staleProcessing = CreateItem(unitOfWork, campaign, batch, DispatchStatus.Processing, now.AddMinutes(-30), now.AddMinutes(-30));
        var freshProcessing = CreateItem(unitOfWork, campaign, batch, DispatchStatus.Processing, now.AddMinutes(-2), now.AddMinutes(-2));
        var staleReservation = CreateItem(unitOfWork, campaign, batch, DispatchStatus.Queued, DateTime.MinValue, now.AddMinutes(-10));
        var freshReservation = CreateItem(unitOfWork, campaign, batch, DispatchStatus.Deferred, DateTime.MinValue, now.AddMinutes(-1));
        var unreservedQueued = CreateItem(unitOfWork, campaign, batch, DispatchStatus.Queued, DateTime.MinValue, DateTime.MinValue);
        batch.TotalRecipients = 5;
        batch.QueuedCount = 2;
        batch.ProcessingCount = 2;
        unitOfWork.CommitChanges();

        var service = CreateService(unitOfWork);
        var recovered = await service.RecoverStuckItemsAsync(CancellationToken.None);

        Assert.Equal(2, recovered);
        Assert.Equal(DispatchStatus.Deferred, staleProcessing.Status);
        Assert.Equal(DateTime.MinValue, staleProcessing.ChannelQueuedAtUtc);
        Assert.NotEqual(DateTime.MinValue, staleProcessing.NextAttemptAtUtc);
        Assert.False(string.IsNullOrWhiteSpace(staleProcessing.ErrorMessage));
        Assert.Equal(DispatchStatus.Processing, freshProcessing.Status);
        Assert.NotEqual(DateTime.MinValue, freshProcessing.ChannelQueuedAtUtc);
        Assert.Equal(DateTime.MinValue, staleReservation.ChannelQueuedAtUtc);
        Assert.NotEqual(DateTime.MinValue, freshReservation.ChannelQueuedAtUtc);
        Assert.Equal(DateTime.MinValue, unreservedQueued.ChannelQueuedAtUtc);
        Assert.Equal(5, batch.TotalRecipients);
        Assert.Equal(4, batch.QueuedCount);
        Assert.Equal(1, batch.ProcessingCount);
    }

    [Fact]
    public async Task QueueDueItemsAsync_QueuesOnlyDueUnreservedItems()
    {
        using var unitOfWork = CreateMailingUnitOfWork();
        var now = DateTime.UtcNow;
        var campaign = CreateCampaign(unitOfWork);
        var batch = CreateBatch(unitOfWork, campaign);
        var dueQueued = CreateItem(unitOfWork, campaign, batch, DispatchStatus.Queued, DateTime.MinValue, DateTime.MinValue, now.AddMinutes(-1));
        var dueDeferred = CreateItem(unitOfWork, campaign, batch, DispatchStatus.Deferred, DateTime.MinValue, DateTime.MinValue, now.AddMinutes(-2));
        var futureQueued = CreateItem(unitOfWork, campaign, batch, DispatchStatus.Queued, DateTime.MinValue, DateTime.MinValue, now.AddMinutes(5));
        var reservedQueued = CreateItem(unitOfWork, campaign, batch, DispatchStatus.Queued, DateTime.MinValue, now.AddMinutes(-10), now.AddMinutes(-1));
        var sent = CreateItem(unitOfWork, campaign, batch, DispatchStatus.Sent, DateTime.MinValue, DateTime.MinValue, now.AddMinutes(-1));
        unitOfWork.CommitChanges();

        var channel = new RecordingDispatchChannel();
        var service = CreateService(unitOfWork, channel);
        var queued = await service.QueueDueItemsAsync(CancellationToken.None);

        Assert.Equal(2, queued);
        Assert.NotEqual(DateTime.MinValue, dueQueued.ChannelQueuedAtUtc);
        Assert.NotEqual(DateTime.MinValue, dueDeferred.ChannelQueuedAtUtc);
        Assert.Equal(DateTime.MinValue, futureQueued.ChannelQueuedAtUtc);
        Assert.NotEqual(DateTime.MinValue, reservedQueued.ChannelQueuedAtUtc);
        Assert.Equal(DateTime.MinValue, sent.ChannelQueuedAtUtc);
        Assert.Equal(new[] { dueDeferred.Oid, dueQueued.Oid }.OrderBy(x => x), channel.WrittenIds.OrderBy(x => x));
    }

    private static DispatchService CreateService(MailingUnitOfWork unitOfWork, IDispatchChannel? channel = null)
    {
        return new DispatchService(
            unitOfWork,
            new EmptyRecipientResolver(),
            new NoopScheduleCalculator(),
            channel ?? new RecordingDispatchChannel(),
            new NoopMailSender(),
            Options.Create(new DispatchOptions
            {
                QueueBatchSize = 10,
                RetryBaseDelayMinutes = 3,
                ProcessingTimeoutMinutes = 15,
                QueueReservationTimeoutMinutes = 5,
                WorkerNode = "TEST"
            }),
            NullLogger<DispatchService>.Instance);
    }

    private static MailingUnitOfWork CreateMailingUnitOfWork()
    {
        var dataLayer = new SimpleDataLayer(new InMemoryDataStore());
        return new MailingUnitOfWork(dataLayer);
    }

    private static MailCampaign CreateCampaign(UnitOfWork unitOfWork)
    {
        var now = DateTime.UtcNow;
        return new MailCampaign(unitOfWork)
        {
            Name = "Campaign",
            Subject = "Subject",
            Status = CampaignStatus.Active,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            MaxAttempts = 3
        };
    }

    private static MailDispatchBatch CreateBatch(UnitOfWork unitOfWork, MailCampaign campaign)
    {
        var now = DateTime.UtcNow;
        return new MailDispatchBatch(unitOfWork)
        {
            Campaign = campaign,
            TriggerKind = DispatchTriggerKind.Manual,
            ScheduledAtUtc = now,
            CreatedAtUtc = now,
            CorrelationId = Guid.NewGuid().ToString("N")
        };
    }

    private static MailDispatchItem CreateItem(
        UnitOfWork unitOfWork,
        MailCampaign campaign,
        MailDispatchBatch batch,
        DispatchStatus status,
        DateTime startedAtUtc,
        DateTime channelQueuedAtUtc,
        DateTime? nextAttemptAtUtc = null)
    {
        var now = DateTime.UtcNow;
        return new MailDispatchItem(unitOfWork)
        {
            Campaign = campaign,
            Batch = batch,
            LegacyOrgId = 1,
            LegacyOrgName = "Org",
            RecipientEmail = $"{Guid.NewGuid():N}@example.test",
            Status = status,
            QueuedAtUtc = now,
            StartedAtUtc = startedAtUtc,
            ChannelQueuedAtUtc = channelQueuedAtUtc,
            SentAtUtc = DateTime.MinValue,
            FailedAtUtc = DateTime.MinValue,
            NextAttemptAtUtc = nextAttemptAtUtc ?? now.AddMinutes(-1),
            DispatchKey = Guid.NewGuid().ToString("N")
        };
    }

    private sealed class EmptyRecipientResolver : IRecipientResolver
    {
        public Task<IReadOnlyCollection<ResolvedRecipient>> ResolveAsync(MailCampaign campaign, CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyCollection<ResolvedRecipient>>(Array.Empty<ResolvedRecipient>());

        public Task<IReadOnlyCollection<ResolvedRecipient>> ResolveAsync(CampaignRecipientSelection selection, CancellationToken cancellationToken)
            => Task.FromResult<IReadOnlyCollection<ResolvedRecipient>>(Array.Empty<ResolvedRecipient>());
    }

    private sealed class NoopScheduleCalculator : IScheduleCalculator
    {
        public DateTime? CalculateInitialNextRunUtc(MailCampaign campaign, DateTime nowUtc) => null;

        public DateTime? CalculateNextRunAfterExecution(MailCampaign campaign, DateTime executedAtUtc) => null;

        public IReadOnlyCollection<ScheduleOccurrenceDto> Preview(SchedulePreviewRequest request) => Array.Empty<ScheduleOccurrenceDto>();
    }

    private sealed class RecordingDispatchChannel : IDispatchChannel
    {
        private readonly ConcurrentQueue<int> _writtenIds = new();

        public IReadOnlyCollection<int> WrittenIds => _writtenIds.ToArray();

        public ValueTask WriteAsync(int dispatchItemId, CancellationToken cancellationToken)
        {
            _writtenIds.Enqueue(dispatchItemId);
            return ValueTask.CompletedTask;
        }

        public bool TryWrite(int dispatchItemId)
        {
            _writtenIds.Enqueue(dispatchItemId);
            return true;
        }

        public async IAsyncEnumerable<int> ReadAllAsync([System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken cancellationToken)
        {
            await Task.CompletedTask;
            yield break;
        }
    }

    private sealed class NoopMailSender : IMailSender
    {
        public Task<MailSendResult> SendAsync(MailDispatchItem item, CancellationToken cancellationToken)
            => Task.FromResult(new MailSendResult { Success = true });
    }
}

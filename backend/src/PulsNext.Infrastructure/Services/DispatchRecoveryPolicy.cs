using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

public static class DispatchRecoveryPolicy
{
    public static int CalculateRetryDelayMinutes(int attemptCount, int retryBaseDelayMinutes, int retryMaxDelayMinutes)
    {
        var baseDelay = Math.Max(1, retryBaseDelayMinutes);
        var maxDelay = Math.Max(baseDelay, retryMaxDelayMinutes);
        var exponent = Math.Max(0, attemptCount - 1);
        var delay = (int)Math.Min(maxDelay, baseDelay * Math.Pow(2, exponent));
        return Math.Max(baseDelay, delay);
    }

    public static bool ShouldRecoverProcessing(DateTime nowUtc, DateTime startedAtUtc, int processingTimeoutMinutes)
    {
        var startedAt = DateTimeHelper.NullIfMin(startedAtUtc);
        if (startedAt is null)
        {
            return false;
        }

        return startedAt.Value <= nowUtc - TimeSpan.FromMinutes(Math.Max(1, processingTimeoutMinutes));
    }

    public static bool ShouldReleaseQueueReservation(DateTime nowUtc, DateTime channelQueuedAtUtc, int queueReservationTimeoutMinutes)
    {
        var channelQueuedAt = DateTimeHelper.NullIfMin(channelQueuedAtUtc);
        if (channelQueuedAt is null)
        {
            return false;
        }

        return channelQueuedAt.Value <= nowUtc - TimeSpan.FromMinutes(Math.Max(1, queueReservationTimeoutMinutes));
    }

    public static string BuildDispatchKey(int campaignId, DateTime scheduledAtUtc, int legacyOrgId, string email)
    {
        var normalizedEmail = (email ?? string.Empty).Trim().ToLowerInvariant();
        return $"{campaignId}:{scheduledAtUtc.ToUniversalTime():O}:{legacyOrgId}:{normalizedEmail}";
    }

    public static bool IsSameScheduledBatch(MailDispatchBatch batch, int campaignId, DateTime scheduledAtUtc)
    {
        return batch.TriggerKind == DispatchTriggerKind.Scheduled
            && batch.Campaign?.Oid == campaignId
            && DateTimeHelper.ForceUtc(batch.ScheduledAtUtc) == scheduledAtUtc.ToUniversalTime();
    }
}

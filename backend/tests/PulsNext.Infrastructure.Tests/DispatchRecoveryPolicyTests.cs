using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class DispatchRecoveryPolicyTests
{
    [Theory]
    [InlineData(1, 3, 30, 3)]
    [InlineData(2, 3, 30, 6)]
    [InlineData(3, 3, 30, 12)]
    [InlineData(6, 3, 30, 30)]
    [InlineData(0, 0, 0, 1)]
    public void CalculateRetryDelayMinutes_UsesExponentialBackoffWithCap(int attempt, int baseDelay, int maxDelay, int expected)
    {
        Assert.Equal(expected, DispatchRecoveryPolicy.CalculateRetryDelayMinutes(attempt, baseDelay, maxDelay));
    }

    [Fact]
    public void ShouldRecoverProcessing_ReturnsTrueOnlyAfterTimeout()
    {
        var now = new DateTime(2026, 6, 10, 10, 0, 0, DateTimeKind.Utc);

        Assert.False(DispatchRecoveryPolicy.ShouldRecoverProcessing(now, DateTime.MinValue, 15));
        Assert.False(DispatchRecoveryPolicy.ShouldRecoverProcessing(now, now.AddMinutes(-14), 15));
        Assert.True(DispatchRecoveryPolicy.ShouldRecoverProcessing(now, now.AddMinutes(-15), 15));
        Assert.True(DispatchRecoveryPolicy.ShouldRecoverProcessing(now, now.AddMinutes(-16), 15));
    }

    [Fact]
    public void ShouldReleaseQueueReservation_ReturnsTrueOnlyAfterTimeout()
    {
        var now = new DateTime(2026, 6, 10, 10, 0, 0, DateTimeKind.Utc);

        Assert.False(DispatchRecoveryPolicy.ShouldReleaseQueueReservation(now, DateTime.MinValue, 5));
        Assert.False(DispatchRecoveryPolicy.ShouldReleaseQueueReservation(now, now.AddMinutes(-4), 5));
        Assert.True(DispatchRecoveryPolicy.ShouldReleaseQueueReservation(now, now.AddMinutes(-5), 5));
        Assert.True(DispatchRecoveryPolicy.ShouldReleaseQueueReservation(now, now.AddMinutes(-6), 5));
    }

    [Fact]
    public void BuildDispatchKey_NormalizesEmailAndUtcDate()
    {
        var scheduledAt = new DateTime(2026, 6, 10, 17, 0, 0, DateTimeKind.Local);

        var key = DispatchRecoveryPolicy.BuildDispatchKey(10, scheduledAt, 25, "  Test@Example.COM  ");

        Assert.EndsWith(":25:test@example.com", key);
        Assert.StartsWith("10:", key);
    }

    [Fact]
    public void IsSameScheduledBatch_MatchesCampaignTriggerAndScheduledDate()
    {
        var campaign = new MailCampaign();
        var scheduledAt = new DateTime(2026, 6, 10, 10, 0, 0, DateTimeKind.Utc);
        var batch = new MailDispatchBatch
        {
            Campaign = campaign,
            TriggerKind = DispatchTriggerKind.Scheduled,
            ScheduledAtUtc = scheduledAt
        };

        Assert.True(DispatchRecoveryPolicy.IsSameScheduledBatch(batch, campaign.Oid, scheduledAt));

        batch.TriggerKind = DispatchTriggerKind.Manual;

        Assert.False(DispatchRecoveryPolicy.IsSameScheduledBatch(batch, campaign.Oid, scheduledAt));
    }
}

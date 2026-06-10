using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class ScheduleCalculatorTests
{
    private readonly ScheduleCalculator _calculator = new();

    [Fact]
    public void Preview_OneTime_ReturnsSingleOccurrence()
    {
        var start = new DateTime(2026, 5, 22, 9, 0, 0, DateTimeKind.Utc);

        var occurrences = _calculator.Preview(new SchedulePreviewRequest
        {
            ScheduleKind = ScheduleKind.OneTime,
            StartAtUtc = start,
            Count = 5,
            TimeZoneId = "UTC"
        });

        var occurrence = Assert.Single(occurrences);
        Assert.Equal(start, occurrence.Utc);
        Assert.Equal(start, occurrence.Local);
    }

    [Fact]
    public void Preview_FixedInterval_UsesStableSpacing()
    {
        var start = new DateTime(2026, 5, 22, 9, 0, 0, DateTimeKind.Utc);

        var occurrences = _calculator.Preview(new SchedulePreviewRequest
        {
            ScheduleKind = ScheduleKind.FixedInterval,
            StartAtUtc = start,
            IntervalMinutes = 15,
            Count = 4,
            TimeZoneId = "UTC"
        }).ToArray();

        Assert.Equal(4, occurrences.Length);
        Assert.Equal(start, occurrences[0].Utc);
        Assert.Equal(start.AddMinutes(15), occurrences[1].Utc);
        Assert.Equal(start.AddMinutes(30), occurrences[2].Utc);
        Assert.Equal(start.AddMinutes(45), occurrences[3].Utc);
    }

    [Fact]
    public void Preview_StopsAtEndDate()
    {
        var start = new DateTime(2026, 5, 22, 9, 0, 0, DateTimeKind.Utc);

        var occurrences = _calculator.Preview(new SchedulePreviewRequest
        {
            ScheduleKind = ScheduleKind.FixedInterval,
            StartAtUtc = start,
            EndAtUtc = start.AddMinutes(20),
            IntervalMinutes = 10,
            Count = 10,
            TimeZoneId = "UTC"
        }).ToArray();

        Assert.Equal(3, occurrences.Length);
        Assert.Equal(start, occurrences[0].Utc);
        Assert.Equal(start.AddMinutes(10), occurrences[1].Utc);
        Assert.Equal(start.AddMinutes(20), occurrences[2].Utc);
    }

    [Fact]
    public void Preview_Cron_ReturnsMatchingOccurrences()
    {
        var start = new DateTime(2026, 5, 22, 9, 0, 0, DateTimeKind.Utc);

        var occurrences = _calculator.Preview(new SchedulePreviewRequest
        {
            ScheduleKind = ScheduleKind.Cron,
            CronExpression = "0 0/30 * * * ?",
            StartAtUtc = start,
            Count = 3,
            TimeZoneId = "UTC"
        }).ToArray();

        Assert.Equal(3, occurrences.Length);
        Assert.Equal(start, occurrences[0].Utc);
        Assert.Equal(start.AddMinutes(30), occurrences[1].Utc);
        Assert.Equal(start.AddHours(1), occurrences[2].Utc);
    }
}

using Microsoft.Extensions.Logging;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class FileLoggingTests : IDisposable
{
    private readonly string _directory = Path.Combine(Path.GetTempPath(), $"puls-logs-{Guid.NewGuid():N}");

    public void Dispose()
    {
        if (Directory.Exists(_directory))
        {
            Directory.Delete(_directory, true);
        }
    }

    [Fact]
    public async Task WritesEntriesIntoADailyFileAndKeepsProblemsInMemory()
    {
        var now = new DateTime(2026, 11, 16, 9, 30, 0, DateTimeKind.Utc);
        var recent = new RecentLogBuffer();
        var provider = new FileLoggerProvider(_directory, LogLevel.Information, recent, () => now);
        var logger = provider.CreateLogger("PulsNext.Test");

        logger.LogDebug("не пишется: ниже порога");
        logger.LogInformation("Запуск {Version}", "1.0.59");
        logger.LogWarning("Web Push: сервис ответил {Status}", 500);
        logger.LogError(new InvalidOperationException("сломалось"), "Ошибка запроса {Id}", "abc");
        await provider.FlushAsync();

        var text = await File.ReadAllTextAsync(Path.Combine(_directory, "api-20261116.log"));
        Assert.Contains("[Information] PulsNext.Test: Запуск 1.0.59", text);
        Assert.Contains("[Warning] PulsNext.Test: Web Push: сервис ответил 500", text);
        Assert.Contains("System.InvalidOperationException: сломалось", text);
        Assert.DoesNotContain("ниже порога", text);

        // В памяти — только предупреждения и ошибки, новые сверху.
        var problems = recent.Snapshot();
        Assert.Equal(["Error", "Warning"], problems.Select(x => x.Level));
        Assert.Contains("сломалось", problems[0].Exception);
    }

    [Fact]
    public async Task EntriesOfDifferentDaysGoToDifferentFiles()
    {
        var now = new DateTime(2026, 11, 16, 23, 59, 59, DateTimeKind.Utc);
        var provider = new FileLoggerProvider(_directory, LogLevel.Information, new RecentLogBuffer(), () => now);
        var logger = provider.CreateLogger("Test");
        logger.LogInformation("вечер");
        now = now.AddSeconds(2);
        logger.LogInformation("утро");
        await provider.FlushAsync();

        Assert.Contains("вечер", await File.ReadAllTextAsync(Path.Combine(_directory, "api-20261116.log")));
        Assert.Contains("утро", await File.ReadAllTextAsync(Path.Combine(_directory, "api-20261117.log")));
    }

    [Fact]
    public void BufferKeepsOnlyTheLatestEntries()
    {
        var buffer = new RecentLogBuffer();
        for (var index = 0; index < RecentLogBuffer.Capacity + 50; index++)
        {
            buffer.Add(new LogEntryDto(DateTime.UtcNow, "Warning", "Test", $"#{index}", null));
        }

        var snapshot = buffer.Snapshot();
        Assert.Equal(RecentLogBuffer.Capacity, snapshot.Count);
        Assert.Equal($"#{RecentLogBuffer.Capacity + 49}", snapshot[0].Message);
    }

    [Fact]
    public void LogFileDownloadAcceptsOnlyDailyLogNames()
    {
        Directory.CreateDirectory(_directory);
        File.WriteAllText(Path.Combine(_directory, "api-20261116.log"), "x");
        var service = new SystemStatusService(null!, new SystemPaths(_directory, _directory, _directory, _directory, null), new RecentLogBuffer(), new ChatFeature(false), new JwtSigningKey("k", false, null));

        Assert.NotNull(service.GetLogFilePath("api-20261116.log"));
        Assert.Null(service.GetLogFilePath("api-20261117.log"));
        Assert.Null(service.GetLogFilePath("../appsettings.json"));
        Assert.Null(service.GetLogFilePath("api-20261116.log/../../secret"));
    }

    [Theory]
    [InlineData(0, "0 Б")]
    [InlineData(1536, "1.5 КБ")]
    [InlineData(5L * 1024 * 1024 * 1024, "5 ГБ")]
    public void FormatsSizesInRussian(long bytes, string expected)
        => Assert.Equal(expected, SystemStatusService.FormatBytes(bytes).Replace(',', '.'));
}

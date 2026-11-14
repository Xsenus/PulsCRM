using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class ChatDatabaseEncodingCheckTests
{
    [Theory]
    [InlineData("UTF8")]
    [InlineData("utf8")]
    [InlineData(" UTF-8 ")]
    public void Utf8IsAccepted(string encoding)
        => Assert.True(ChatDatabaseEncodingCheck.Evaluate(encoding).IsUtf8);

    [Theory]
    [InlineData("WIN1251")]
    [InlineData("SQL_ASCII")]
    [InlineData("LATIN1")]
    public void OtherEncodingsAreReportedWithAFix(string encoding)
    {
        var result = ChatDatabaseEncodingCheck.Evaluate(encoding);
        Assert.False(result.IsUtf8);
        Assert.Contains(encoding, result.Message);
        Assert.Contains("create-chat-database.sql", result.Message);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void UnknownEncodingIsNotTreatedAsUtf8(string? encoding)
        => Assert.False(ChatDatabaseEncodingCheck.Evaluate(encoding).IsUtf8);

    [Fact]
    public void HostedServiceLogsWarningForWrongEncoding()
    {
        var logger = new ListLogger();
        var result = CreateService(() => "WIN1251", logger).Run(CancellationToken.None);

        Assert.False(result!.IsUtf8);
        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.Contains("WIN1251", entry.Message);
    }

    [Fact]
    public void HostedServiceLogsInformationForUtf8()
    {
        var logger = new ListLogger();
        Assert.True(CreateService(() => "UTF8", logger).Run(CancellationToken.None)!.IsUtf8);
        Assert.Equal(LogLevel.Information, Assert.Single(logger.Entries).Level);
    }

    [Fact]
    public void HostedServiceDoesNotThrowWhenDatabaseIsUnavailable()
    {
        var logger = new ListLogger();
        Assert.Null(CreateService(() => throw new InvalidOperationException("нет связи"), logger).Run(CancellationToken.None));
        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Warning, entry.Level);
        Assert.NotNull(entry.Exception);
    }

    private static ChatDatabaseEncodingCheckHostedService CreateService(Func<string?> read, ListLogger logger)
    {
        var services = new ServiceCollection();
        services.AddScoped<IChatDatabaseEncodingReader>(_ => new FakeReader(read));
        return new ChatDatabaseEncodingCheckHostedService(services.BuildServiceProvider().GetRequiredService<IServiceScopeFactory>(), logger);
    }

    private sealed class FakeReader(Func<string?> read) : IChatDatabaseEncodingReader
    {
        public string? ReadEncoding() => read();
    }

    private sealed class ListLogger : ILogger<ChatDatabaseEncodingCheckHostedService>
    {
        public List<(LogLevel Level, string Message, Exception? Exception)> Entries { get; } = new();

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception), exception));
    }
}

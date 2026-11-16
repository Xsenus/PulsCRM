using Microsoft.Extensions.Logging;
using Npgsql;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class ChatDatabaseBootstrapTests
{
    private const string XpoConnectionString =
        "XpoProvider=Postgres;Server=localhost;Port=5433;User Id=pulschat;Password=secret;Database=pulschat;Encoding=UNICODE";

    [Fact]
    public void ParseTakesDatabaseAndBuildsMaintenanceConnection()
    {
        var target = ChatDatabaseBootstrap.Parse(XpoConnectionString)!;

        Assert.Equal("pulschat", target.Database);
        var builder = new NpgsqlConnectionStringBuilder(target.MaintenanceConnectionString);
        Assert.Equal("localhost", builder.Host);
        Assert.Equal(5433, builder.Port);
        Assert.Equal("pulschat", builder.Username);
        Assert.Equal("secret", builder.Password);
        Assert.Equal("postgres", builder.Database);
        Assert.False(builder.Pooling);
        Assert.DoesNotContain("XpoProvider", target.MaintenanceConnectionString, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void ParseUsesRequestedMaintenanceDatabase()
    {
        var target = ChatDatabaseBootstrap.Parse(XpoConnectionString, "template1")!;
        Assert.Equal("template1", new NpgsqlConnectionStringBuilder(target.MaintenanceConnectionString).Database);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("XpoProvider=Postgres;Server=localhost;User Id=pulschat;Password=secret")]
    public void ParseReturnsNullWithoutDatabase(string? connectionString)
        => Assert.Null(ChatDatabaseBootstrap.Parse(connectionString));

    [Fact]
    public void CreateDatabaseSqlForcesUtf8FromTemplate0AndQuotesName()
    {
        Assert.Equal(
            "CREATE DATABASE \"puls\"\"chat\" ENCODING 'UTF8' TEMPLATE template0",
            ChatDatabaseBootstrap.BuildCreateDatabaseSql("puls\"chat"));
    }

    [Fact]
    public void ExistingDatabaseIsNotCreated()
    {
        var admin = new FakeAdmin { Exists = true };
        Assert.Equal(ChatDatabaseEnsureOutcome.Exists, Run(admin, new ListLogger()));
        Assert.Empty(admin.Created);
    }

    [Fact]
    public void MissingDatabaseIsCreated()
    {
        var admin = new FakeAdmin();
        var logger = new ListLogger();

        Assert.Equal(ChatDatabaseEnsureOutcome.Created, Run(admin, logger));
        Assert.Equal(["pulschat"], admin.Created);
        Assert.Equal(LogLevel.Information, Assert.Single(logger.Entries).Level);
    }

    [Fact]
    public void DatabaseCreatedConcurrentlyCountsAsExisting()
    {
        var admin = new FakeAdmin { CreateError = Postgres("42P04") };
        var logger = new ListLogger();
        Assert.Equal(ChatDatabaseEnsureOutcome.Exists, Run(admin, logger));
        Assert.Empty(logger.Entries);
    }

    [Fact]
    public void MissingCreateDbPrivilegeIsExplained()
    {
        var logger = new ListLogger();
        Assert.Equal(ChatDatabaseEnsureOutcome.Failed, Run(new FakeAdmin { CreateError = Postgres("42501") }, logger));

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.Contains("CREATEDB", entry.Message);
        Assert.Contains("create-chat-database.sql", entry.Message);
    }

    [Fact]
    public void WrongPasswordIsExplainedWithoutLeakingIt()
    {
        var logger = new ListLogger();
        Assert.Equal(ChatDatabaseEnsureOutcome.Failed, Run(new FakeAdmin { ExistsError = Postgres("28P01") }, logger));

        var entry = Assert.Single(logger.Entries);
        Assert.Equal(LogLevel.Error, entry.Level);
        Assert.DoesNotContain("secret", entry.Message);
    }

    [Fact]
    public void UnavailableServerDoesNotThrow()
    {
        var logger = new ListLogger();
        Assert.Equal(ChatDatabaseEnsureOutcome.Failed, Run(new FakeAdmin { ExistsError = new InvalidOperationException("нет связи") }, logger));
        Assert.NotNull(Assert.Single(logger.Entries).Exception);
    }

    [Fact]
    public void ConnectionStringWithoutDatabaseIsOnlyAWarning()
    {
        var logger = new ListLogger();
        var admin = new FakeAdmin();
        Assert.Null(new ChatDatabaseBootstrapHostedService(admin, "XpoProvider=Postgres;Server=localhost", logger).Run());
        Assert.Equal(LogLevel.Warning, Assert.Single(logger.Entries).Level);
        Assert.Empty(admin.Created);
    }

    private static ChatDatabaseEnsureOutcome? Run(FakeAdmin admin, ListLogger logger)
        => new ChatDatabaseBootstrapHostedService(admin, XpoConnectionString, logger).Run();

    private static PostgresException Postgres(string sqlState) => new("ошибка", "ERROR", "ERROR", sqlState);

    private sealed class FakeAdmin : IChatDatabaseAdmin
    {
        public bool Exists { get; init; }
        public Exception? ExistsError { get; init; }
        public Exception? CreateError { get; init; }
        public List<string> Created { get; } = new();

        public bool DatabaseExists(string database) => ExistsError is null ? Exists : throw ExistsError;

        public void CreateDatabase(string database)
        {
            if (CreateError is not null)
            {
                throw CreateError;
            }

            Created.Add(database);
        }
    }

    private sealed class ListLogger : ILogger<ChatDatabaseBootstrapHostedService>
    {
        public List<(LogLevel Level, string Message, Exception? Exception)> Entries { get; } = new();

        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => true;

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
            => Entries.Add((logLevel, formatter(state, exception), exception));
    }
}

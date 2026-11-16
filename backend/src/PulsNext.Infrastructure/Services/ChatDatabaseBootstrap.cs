using System.Data.Common;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Npgsql;

namespace PulsNext.Infrastructure;

/// <summary>
/// База чата из строки ConnectionStrings:ChatDb и строка подключения к служебной базе сервера,
/// из которой ее можно создать.
/// </summary>
public sealed record ChatDatabaseTarget(string Database, string MaintenanceConnectionString);

/// <summary>
/// Создание базы чата: XPO создает базу в UTF8 копированием template1, и если template1 в другой кодировке
/// (на русской Windows обычно WIN1251), PostgreSQL отказывает (22023). Поэтому базу создаем сами — в UTF8
/// от template0, — а таблицы, как и раньше, создает XPO.
/// </summary>
public static class ChatDatabaseBootstrap
{
    private static readonly HashSet<string> IgnoredKeys = new(StringComparer.OrdinalIgnoreCase)
    {
        // Ключи XPO, а не Npgsql. Encoding в строке XPO — кодировка клиента, на кодировку базы не влияет.
        "XpoProvider", "Encoding",
        "Database", "Initial Catalog"
    };

    /// <summary>
    /// Разбирает строку подключения XPO (XpoProvider=Postgres;Server=…;Database=…) в имя базы и строку
    /// подключения Npgsql к служебной базе <paramref name="maintenanceDatabase"/>. Null — имя базы не задано.
    /// </summary>
    public static ChatDatabaseTarget? Parse(string? xpoConnectionString, string maintenanceDatabase = "postgres")
    {
        if (string.IsNullOrWhiteSpace(xpoConnectionString))
        {
            return null;
        }

        var source = new DbConnectionStringBuilder { ConnectionString = xpoConnectionString };
        string? database = null;
        foreach (var key in new[] { "Database", "Initial Catalog" })
        {
            if (source.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value?.ToString()))
            {
                database = value.ToString()!.Trim();
                break;
            }
        }

        if (database is null)
        {
            return null;
        }

        var target = new NpgsqlConnectionStringBuilder();
        foreach (string key in source.Keys)
        {
            if (IgnoredKeys.Contains(key))
            {
                continue;
            }

            try
            {
                target[key] = source[key];
            }
            catch (ArgumentException)
            {
                // Ключ, которого Npgsql не знает, для создания базы не нужен.
            }
        }

        target.Database = maintenanceDatabase;
        target.Pooling = false;
        return new ChatDatabaseTarget(database, target.ConnectionString);
    }

    public static string QuoteIdentifier(string identifier) => "\"" + identifier.Replace("\"", "\"\"") + "\"";

    /// <summary>
    /// UTF8 от template0: template1 может быть в другой кодировке, а копировать из него в UTF8 нельзя.
    /// Владелец базы — пользователь из строки подключения (CREATE DATABASE выполняется от его имени).
    /// </summary>
    public static string BuildCreateDatabaseSql(string database)
        => $"CREATE DATABASE {QuoteIdentifier(database)} ENCODING 'UTF8' TEMPLATE template0";
}

/// <summary>
/// Действия с базами на сервере PostgreSQL (выделено для тестов).
/// </summary>
public interface IChatDatabaseAdmin
{
    bool DatabaseExists(string database);

    void CreateDatabase(string database);
}

public enum ChatDatabaseEnsureOutcome
{
    Exists,
    Created,
    Failed
}

/// <summary>
/// Подключается к служебной базе postgres (если ее нет — template1) и создает базу чата.
/// </summary>
public sealed class NpgsqlChatDatabaseAdmin(string xpoConnectionString) : IChatDatabaseAdmin
{
    private const string InvalidCatalogName = "3D000";

    public bool DatabaseExists(string database)
    {
        using var connection = Open();
        using var command = new NpgsqlCommand("select 1 from pg_database where datname = @name", connection);
        command.Parameters.AddWithValue("name", database);
        return command.ExecuteScalar() is not null;
    }

    public void CreateDatabase(string database)
    {
        using var connection = Open();
        // CREATE DATABASE нельзя выполнить в транзакции, а Npgsql без явной транзакции ее не открывает.
        using var command = new NpgsqlCommand(ChatDatabaseBootstrap.BuildCreateDatabaseSql(database), connection);
        command.ExecuteNonQuery();
    }

    private NpgsqlConnection Open()
    {
        foreach (var candidate in new[] { "postgres", "template1" })
        {
            var target = ChatDatabaseBootstrap.Parse(xpoConnectionString, candidate)
                ?? throw new InvalidOperationException("В ConnectionStrings:ChatDb не указано имя базы (Database).");
            var connection = new NpgsqlConnection(target.MaintenanceConnectionString);
            try
            {
                connection.Open();
                return connection;
            }
            catch (PostgresException exception) when (exception.SqlState == InvalidCatalogName && candidate == "postgres")
            {
                connection.Dispose();
            }
            catch
            {
                connection.Dispose();
                throw;
            }
        }

        throw new InvalidOperationException("Не удалось подключиться к служебной базе PostgreSQL.");
    }
}

/// <summary>
/// Создает базу чата в UTF8, если ее нет. Не бросает исключений: при ошибке пишет в лог, что сделать.
/// </summary>
public sealed class ChatDatabaseCreator(IChatDatabaseAdmin admin, ILogger logger)
{
    private const string InsufficientPrivilege = "42501";
    private const string DuplicateDatabase = "42P04";
    private const string InvalidPassword = "28P01";

    public ChatDatabaseEnsureOutcome Ensure(string database)
    {
        try
        {
            if (admin.DatabaseExists(database))
            {
                return ChatDatabaseEnsureOutcome.Exists;
            }

            admin.CreateDatabase(database);
            logger.LogInformation("Chat database bootstrap: создана база чата {Database} в кодировке UTF8.", database);
            return ChatDatabaseEnsureOutcome.Created;
        }
        catch (PostgresException exception) when (exception.SqlState == DuplicateDatabase)
        {
            // Базу успел создать другой экземпляр API.
            return ChatDatabaseEnsureOutcome.Exists;
        }
        catch (PostgresException exception) when (exception.SqlState == InsufficientPrivilege)
        {
            logger.LogError(
                "Chat database bootstrap: базы чата {Database} нет, а у пользователя из ConnectionStrings:ChatDb нет права ее создать. "
                + "Дайте ему право (ALTER ROLE <пользователь> CREATEDB) или создайте базу скриптом scripts/sql/create-chat-database.sql (см. docs/chat.md).",
                database);
            return ChatDatabaseEnsureOutcome.Failed;
        }
        catch (PostgresException exception) when (exception.SqlState == InvalidPassword)
        {
            logger.LogError(
                "Chat database bootstrap: PostgreSQL не принял логин или пароль из ConnectionStrings:ChatDb. "
                + "Проверьте, что пользователь создан (scripts/sql/create-chat-database.sql или CREATE ROLE … LOGIN CREATEDB) и пароль совпадает.");
            return ChatDatabaseEnsureOutcome.Failed;
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Chat database bootstrap: не удалось проверить или создать базу чата {Database}.", database);
            return ChatDatabaseEnsureOutcome.Failed;
        }
    }
}

/// <summary>
/// При старте API (чат включен и Chat:AutoCreateSchema=true) до первого обращения XPO создает базу чата в UTF8,
/// если ее еще нет. Выполняется в StartAsync, то есть до приема запросов и до проверки кодировки.
/// </summary>
public sealed class ChatDatabaseBootstrapHostedService(
    IChatDatabaseAdmin admin,
    string? xpoConnectionString,
    ILogger<ChatDatabaseBootstrapHostedService> logger) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        Run();
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;

    /// <summary>
    /// Вынесено для тестов; null — имя базы в строке подключения не задано.
    /// </summary>
    public ChatDatabaseEnsureOutcome? Run()
    {
        ChatDatabaseTarget? target;
        try
        {
            target = ChatDatabaseBootstrap.Parse(xpoConnectionString);
        }
        catch (ArgumentException exception)
        {
            logger.LogError(exception, "Chat database bootstrap: не удалось разобрать ConnectionStrings:ChatDb.");
            return ChatDatabaseEnsureOutcome.Failed;
        }

        if (target is null)
        {
            logger.LogWarning("Chat database bootstrap: в ConnectionStrings:ChatDb не указано имя базы (Database).");
            return null;
        }

        return new ChatDatabaseCreator(admin, logger).Ensure(target.Database);
    }
}

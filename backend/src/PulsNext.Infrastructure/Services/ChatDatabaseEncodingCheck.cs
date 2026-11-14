using DevExpress.Xpo;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace PulsNext.Infrastructure;

/// <summary>
/// Итог проверки кодировки базы чата.
/// </summary>
public sealed record ChatDatabaseEncodingResult(bool IsUtf8, string? Encoding, string Message);

/// <summary>
/// Проверка кодировки базы чата: в базе не в UTF8 (например, WIN1251, созданной с настройками сервера по умолчанию)
/// эмодзи и часть символов в сообщениях не сохранятся — PostgreSQL отклонит такую запись.
/// </summary>
public static class ChatDatabaseEncodingCheck
{
    public static ChatDatabaseEncodingResult Evaluate(string? encoding)
    {
        var normalized = encoding?.Trim();
        if (string.IsNullOrEmpty(normalized))
        {
            return new(false, null, "Не удалось определить кодировку базы чата.");
        }

        if (string.Equals(normalized, "UTF8", StringComparison.OrdinalIgnoreCase)
            || string.Equals(normalized, "UTF-8", StringComparison.OrdinalIgnoreCase))
        {
            return new(true, normalized, "База чата в кодировке UTF8.");
        }

        return new(false, normalized,
            $"База чата в кодировке {normalized}, а нужна UTF8: эмодзи и часть символов в сообщениях не сохранятся. "
            + "Пересоздайте пустую базу скриптом scripts/sql/create-chat-database.sql (см. docs/chat.md), "
            + "а если в ней уже есть переписка — перенесите данные через pg_dump/pg_restore в новую базу UTF8.");
    }
}

/// <summary>
/// Читает кодировку текущей базы чата из PostgreSQL.
/// </summary>
public interface IChatDatabaseEncodingReader
{
    string? ReadEncoding();
}

public sealed class PostgresChatDatabaseEncodingReader(ChatUnitOfWork unitOfWork) : IChatDatabaseEncodingReader
{
    public string? ReadEncoding()
        => unitOfWork.ExecuteScalar("select pg_encoding_to_char(encoding) from pg_database where datname = current_database()") as string;
}

/// <summary>
/// Один раз при старте API (если чат включен) проверяет кодировку базы чата и пишет результат в лог.
/// Запуск не блокирует и не роняет: при ошибке — только предупреждение.
/// </summary>
public sealed class ChatDatabaseEncodingCheckHostedService(
    IServiceScopeFactory serviceScopeFactory,
    ILogger<ChatDatabaseEncodingCheckHostedService> logger) : BackgroundService
{
    protected override Task ExecuteAsync(CancellationToken stoppingToken)
        => Task.Run(() => Run(stoppingToken), stoppingToken);

    /// <summary>
    /// Возвращает результат проверки (null — проверить не удалось); вынесено для тестов.
    /// </summary>
    public ChatDatabaseEncodingResult? Run(CancellationToken cancellationToken)
    {
        try
        {
            cancellationToken.ThrowIfCancellationRequested();
            using var scope = serviceScopeFactory.CreateScope();
            var result = ChatDatabaseEncodingCheck.Evaluate(scope.ServiceProvider.GetRequiredService<IChatDatabaseEncodingReader>().ReadEncoding());
            if (result.IsUtf8)
            {
                logger.LogInformation("Chat database encoding check: {Message}", result.Message);
            }
            else
            {
                logger.LogWarning("Chat database encoding check: {Message}", result.Message);
            }

            return result;
        }
        catch (OperationCanceledException)
        {
            return null;
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Chat database encoding check: не удалось проверить кодировку базы чата");
            return null;
        }
    }
}

using DevExpress.Xpo;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Chat;

namespace PulsNext.Infrastructure;

/// <summary>
/// Удаляет вложения, которые загрузили, но так и не отправили (пользователь закрыл вкладку,
/// передумал и т. п.): иначе такие файлы навсегда остаются на диске.
/// </summary>
public interface IChatAttachmentCleaner
{
    /// <summary>
    /// Удаляет неотправленные вложения, загруженные раньше <paramref name="uploadedBeforeUtc"/>. Возвращает число удаленных.
    /// </summary>
    Task<int> RemovePendingAsync(DateTime uploadedBeforeUtc, CancellationToken cancellationToken);
}

public sealed class ChatAttachmentCleaner(ChatUnitOfWork unitOfWork, IChatFileStore fileStore, ILogger<ChatAttachmentCleaner> logger) : IChatAttachmentCleaner
{
    private const int BatchSize = 500;

    public Task<int> RemovePendingAsync(DateTime uploadedBeforeUtc, CancellationToken cancellationToken)
    {
        var removed = 0;
        while (!cancellationToken.IsCancellationRequested)
        {
            var batch = new XPQuery<ChatAttachment>(unitOfWork)
                .Where(x => x.Message == null && x.UploadedAtUtc < uploadedBeforeUtc)
                .OrderBy(x => x.Oid)
                .Take(BatchSize)
                .ToList();
            if (batch.Count == 0)
            {
                break;
            }

            foreach (var attachment in batch)
            {
                try
                {
                    if (!string.IsNullOrWhiteSpace(attachment.RelativePath))
                    {
                        fileStore.Delete(attachment.RelativePath);
                    }

                    if (!string.IsNullOrWhiteSpace(attachment.ThumbnailRelativePath))
                    {
                        fileStore.Delete(attachment.ThumbnailRelativePath);
                    }
                }
                catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
                {
                    // Файл занят или недоступен: запись все равно удаляем, чтобы не застрять на ней навсегда.
                    logger.LogWarning(exception, "Не удалось удалить файл неотправленного вложения {AttachmentId}", attachment.Oid);
                }

                attachment.Delete();
            }

            unitOfWork.CommitChanges();
            removed += batch.Count;
            if (batch.Count < BatchSize)
            {
                break;
            }
        }

        return Task.FromResult(removed);
    }
}

/// <summary>
/// Периодически чистит неотправленные вложения чата. Работает только при включенном чате.
/// </summary>
public sealed class ChatAttachmentCleanupHostedService(
    IServiceScopeFactory serviceScopeFactory,
    IOptions<ChatOptions> chatOptions,
    ILogger<ChatAttachmentCleanupHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        var options = chatOptions.Value;
        var interval = TimeSpan.FromMinutes(Math.Max(5, options.PendingAttachmentCleanupIntervalMinutes));
        var lifetime = TimeSpan.FromHours(Math.Max(1, options.PendingAttachmentLifetimeHours));

        try
        {
            // Не нагружаем базу в момент старта API.
            await Task.Delay(TimeSpan.FromMinutes(2), stoppingToken);
        }
        catch (OperationCanceledException)
        {
            return;
        }

        using var timer = new PeriodicTimer(interval);
        do
        {
            try
            {
                using var scope = serviceScopeFactory.CreateScope();
                var cleaner = scope.ServiceProvider.GetRequiredService<IChatAttachmentCleaner>();
                var count = await cleaner.RemovePendingAsync(DateTime.UtcNow - lifetime, stoppingToken);
                if (count > 0)
                {
                    logger.LogInformation("Removed {Count} pending chat attachments older than {Hours} h", count, lifetime.TotalHours);
                }
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
            {
                break;
            }
            catch (Exception exception)
            {
                logger.LogError(exception, "Failed to clean up pending chat attachments");
            }
        }
        while (!stoppingToken.IsCancellationRequested && await timer.WaitForNextTickAsync(stoppingToken));
    }
}

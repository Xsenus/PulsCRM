using System.Net;
using System.Text.Json;
using System.Threading.Channels;
using DevExpress.Xpo;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Chat;

namespace PulsNext.Infrastructure;

/// <summary>
/// Содержимое системного уведомления, которое показывает сервис-воркер браузера.
/// </summary>
public sealed record ChatPushPayload(string Title, string Body, int ConversationId, string Url);

/// <summary>
/// Уведомление одному сотруднику — на все его подписанные браузеры.
/// </summary>
public sealed record ChatPushJob(int UserId, ChatPushPayload Payload);

public interface IChatPushQueue
{
    /// <summary>
    /// Ставит уведомления в очередь; отправка идет в фоне и не задерживает отправку сообщения.
    /// </summary>
    void Enqueue(IEnumerable<ChatPushJob> jobs);
}

public sealed class ChatPushQueue : IChatPushQueue
{
    // Ограниченная очередь: при сбое сервисов push старые уведомления вытесняются, память не растет.
    private readonly Channel<ChatPushJob> _channel = Channel.CreateBounded<ChatPushJob>(new BoundedChannelOptions(5000)
    {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true
    });

    public ChannelReader<ChatPushJob> Reader => _channel.Reader;

    public void Enqueue(IEnumerable<ChatPushJob> jobs)
    {
        foreach (var job in jobs)
        {
            _channel.Writer.TryWrite(job);
        }
    }
}

public interface IWebPushKeyProvider
{
    WebPushVapidKeys GetKeys();
}

/// <summary>
/// Ключи VAPID: из Chat:WebPushPublicKey/WebPushPrivateKey, иначе — создаются один раз и хранятся в файле
/// webpush-vapid.json в каталоге ключей (Storage:RootPath/Storage:KeysPath). Ключи должны быть постоянными:
/// подписки браузеров привязаны к открытому ключу.
/// </summary>
public sealed class WebPushKeyProvider(IOptions<ChatOptions> options, string keysDirectory) : IWebPushKeyProvider
{
    private const string FileName = "webpush-vapid.json";
    private readonly object _sync = new();
    private WebPushVapidKeys? _keys;

    public WebPushVapidKeys GetKeys()
    {
        if (_keys is not null)
        {
            return _keys;
        }

        lock (_sync)
        {
            if (_keys is not null)
            {
                return _keys;
            }

            var configured = options.Value;
            if (!string.IsNullOrWhiteSpace(configured.WebPushPublicKey) && !string.IsNullOrWhiteSpace(configured.WebPushPrivateKey))
            {
                return _keys = new WebPushVapidKeys(configured.WebPushPublicKey.Trim(), configured.WebPushPrivateKey.Trim());
            }

            var path = Path.Combine(keysDirectory, FileName);
            if (File.Exists(path))
            {
                var stored = JsonSerializer.Deserialize<WebPushVapidKeys>(File.ReadAllText(path));
                if (stored is { PublicKey.Length: > 0, PrivateKey.Length: > 0 })
                {
                    return _keys = stored;
                }
            }

            Directory.CreateDirectory(keysDirectory);
            var generated = WebPushVapidKeys.Generate();
            File.WriteAllText(path, JsonSerializer.Serialize(generated));
            return _keys = generated;
        }
    }
}

public enum WebPushSendResult
{
    Sent,
    /// <summary>
    /// Подписка больше не действует (браузер отписался или сброшены данные сайта) — удалить.
    /// </summary>
    Gone,
    Failed
}

public interface IWebPushSender
{
    Task<WebPushSendResult> SendAsync(ChatPushSubscription subscription, byte[] payload, CancellationToken cancellationToken);
}

/// <summary>
/// Отправка в сервис push браузера (FCM для Chrome и Яндекса, Mozilla для Firefox, WNS для Edge).
/// Серверу нужен исходящий доступ в интернет к этим адресам.
/// </summary>
public sealed class HttpWebPushSender(
    IHttpClientFactory httpClientFactory,
    IWebPushKeyProvider keyProvider,
    IOptions<ChatOptions> options,
    ILogger<HttpWebPushSender> logger) : IWebPushSender
{
    public const string HttpClientName = "webpush";

    public async Task<WebPushSendResult> SendAsync(ChatPushSubscription subscription, byte[] payload, CancellationToken cancellationToken)
    {
        byte[] body;
        try
        {
            body = WebPushCrypto.Encrypt(payload, subscription.P256dh ?? string.Empty, subscription.Auth ?? string.Empty);
        }
        catch (Exception exception) when (exception is ArgumentException or FormatException)
        {
            logger.LogWarning("Web Push: подписка {Id} с некорректными ключами удалена.", subscription.Oid);
            return WebPushSendResult.Gone;
        }

        using var request = new HttpRequestMessage(HttpMethod.Post, subscription.Endpoint);
        request.Headers.TryAddWithoutValidation("Authorization", WebPushCrypto.CreateVapidAuthorization(
            subscription.Endpoint!, keyProvider.GetKeys(), options.Value.WebPushSubject, DateTimeOffset.UtcNow));
        request.Headers.TryAddWithoutValidation("TTL", "86400");
        request.Headers.TryAddWithoutValidation("Urgency", "high");
        request.Content = new ByteArrayContent(body);
        request.Content.Headers.TryAddWithoutValidation("Content-Type", "application/octet-stream");
        request.Content.Headers.TryAddWithoutValidation("Content-Encoding", "aes128gcm");

        try
        {
            using var response = await httpClientFactory.CreateClient(HttpClientName).SendAsync(request, cancellationToken);
            if (response.IsSuccessStatusCode)
            {
                return WebPushSendResult.Sent;
            }

            if (response.StatusCode is HttpStatusCode.NotFound or HttpStatusCode.Gone)
            {
                return WebPushSendResult.Gone;
            }

            logger.LogWarning("Web Push: сервис {Host} ответил {Status}.", request.RequestUri?.Host, (int)response.StatusCode);
            return WebPushSendResult.Failed;
        }
        catch (Exception exception) when (exception is HttpRequestException or TaskCanceledException && !cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning(exception, "Web Push: не удалось отправить уведомление в {Host}.", request.RequestUri?.Host);
            return WebPushSendResult.Failed;
        }
    }
}

/// <summary>
/// Отправляет уведомление на все подписки сотрудника; недействующие подписки удаляет.
/// </summary>
public sealed class ChatPushDispatcher(ChatUnitOfWork unitOfWork, IWebPushSender sender)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    public async Task DispatchAsync(ChatPushJob job, CancellationToken cancellationToken)
    {
        var subscriptions = new XPQuery<ChatPushSubscription>(unitOfWork).Where(x => x.UserId == job.UserId).ToList();
        if (subscriptions.Count == 0)
        {
            return;
        }

        var payload = JsonSerializer.SerializeToUtf8Bytes(job.Payload, JsonOptions);
        foreach (var subscription in subscriptions)
        {
            var result = await sender.SendAsync(subscription, payload, cancellationToken);
            if (result == WebPushSendResult.Gone)
            {
                subscription.Delete();
            }
            else if (result == WebPushSendResult.Sent)
            {
                subscription.LastSentAtUtc = DateTime.UtcNow;
            }
        }

        unitOfWork.CommitChanges();
    }
}

/// <summary>
/// Фоновая отправка уведомлений из очереди (каждое — в своей области DI и сессии XPO).
/// </summary>
public sealed class ChatPushHostedService(
    ChatPushQueue queue,
    IServiceScopeFactory scopeFactory,
    ILogger<ChatPushHostedService> logger) : BackgroundService
{
    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        try
        {
            await foreach (var job in queue.Reader.ReadAllAsync(stoppingToken))
            {
                try
                {
                    using var scope = scopeFactory.CreateScope();
                    await scope.ServiceProvider.GetRequiredService<ChatPushDispatcher>().DispatchAsync(job, stoppingToken);
                }
                catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
                {
                    return;
                }
                catch (Exception exception)
                {
                    logger.LogWarning(exception, "Web Push: ошибка отправки уведомления сотруднику {UserId}.", job.UserId);
                }
            }
        }
        catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested)
        {
        }
    }
}

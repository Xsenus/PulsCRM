using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Chat;

/// <summary>
/// SignalR-хаб чата: доставка событий в реальном времени, «печатает», статус «в сети».
/// Пользователь определяется по claim NameIdentifier (legacy-id) из JWT.
/// </summary>
[Authorize]
public sealed class ChatHub(ChatPresenceTracker presence, IChatService chatService, ILogger<ChatHub> logger) : Hub
{
    public const string Path = "/hubs/chat";
    public const string PresenceChangedEvent = "presenceChanged";

    public override async Task OnConnectedAsync()
    {
        if (TryGetUserId(out var userId) && presence.Connect(userId, Context.ConnectionId))
        {
            await Clients.Others.SendAsync(PresenceChangedEvent, new ChatPresenceEventDto { UserId = userId, IsOnline = true });
        }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (TryGetUserId(out var userId) && presence.Disconnect(userId, Context.ConnectionId))
        {
            await Clients.Others.SendAsync(PresenceChangedEvent, new ChatPresenceEventDto { UserId = userId, IsOnline = false });
        }

        await base.OnDisconnectedAsync(exception);
    }

    /// <summary>
    /// Сообщает собеседникам, что пользователь печатает в диалоге.
    /// </summary>
    public async Task Typing(int conversationId)
    {
        if (!TryGetUserId(out var userId))
        {
            return;
        }

        try
        {
            await chatService.NotifyTypingAsync(conversationId, userId, Context.ConnectionAborted);
        }
        catch (KeyNotFoundException)
        {
            logger.LogDebug("Typing в недоступный диалог {ConversationId}", conversationId);
        }
    }

    /// <summary>
    /// Кто из перечисленных сотрудников сейчас в сети.
    /// </summary>
    public IReadOnlyCollection<int> GetOnlineUsers(IReadOnlyCollection<int> userIds)
        => presence.FilterOnline(userIds ?? Array.Empty<int>());

    private bool TryGetUserId(out int userId)
        => int.TryParse(Context.UserIdentifier, out userId) && userId > 0;
}

public sealed class ChatPresenceEventDto
{
    public int UserId { get; set; }
    public bool IsOnline { get; set; }
}

/// <summary>
/// Рассылает события чата через SignalR. Ошибка доставки не ломает запрос: данные уже сохранены,
/// а клиент получит их при следующей загрузке.
/// </summary>
public sealed class SignalRChatEventPublisher(IHubContext<ChatHub> hubContext, ILogger<SignalRChatEventPublisher> logger) : IChatEventPublisher
{
    public async Task PublishAsync(IReadOnlyCollection<int> userIds, string eventName, object payload, CancellationToken cancellationToken)
    {
        var recipients = userIds.Where(x => x > 0).Distinct().Select(x => x.ToString(System.Globalization.CultureInfo.InvariantCulture)).ToArray();
        if (recipients.Length == 0)
        {
            return;
        }

        try
        {
            await hubContext.Clients.Users(recipients).SendAsync(eventName, payload, CancellationToken.None);
        }
        catch (Exception exception)
        {
            logger.LogWarning(exception, "Не удалось разослать событие чата {EventName}", eventName);
        }
    }
}

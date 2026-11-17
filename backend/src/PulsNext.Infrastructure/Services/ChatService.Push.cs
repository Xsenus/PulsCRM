using System.Globalization;
using DevExpress.Xpo;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Chat;
using PulsNext.Domain.Legacy;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

public sealed partial class ChatService
{
    /// <summary>
    /// Web Push получателям, у которых включены оповещения и системные оповещения: в «без звука» — только
    /// при упоминании. Текст — если сотрудник разрешил показывать его в оповещениях.
    /// </summary>
    private void EnqueuePushNotifications(ChatConversation conversation, ChatMessage message, ChatMessageDto dto)
    {
        if (pushQueue is null)
        {
            return;
        }

        var mentioned = ParseMentions(message.MentionedUserIds);
        var recipients = GetParticipants(conversation.Oid)
            .Where(x => x.LeftAtUtc == null && x.UserId != message.SenderUserId && (!x.IsMuted || mentioned.Contains(x.UserId)))
            .Select(x => x.UserId)
            .Distinct()
            .ToArray();
        if (recipients.Length == 0)
        {
            return;
        }

        var settings = new XPQuery<ChatUserSettings>(unitOfWork)
            .Where(x => recipients.Contains(x.UserId))
            .ToList()
            .GroupBy(x => x.UserId)
            .ToDictionary(x => x.Key, x => x.First());
        var isGroup = conversation.Kind == ChatConversationKind.Group;
        var senderName = dto.SenderName;
        var title = isGroup ? conversation.Title ?? "Групповой чат" : senderName;
        var preview = DescribeForPush(dto);
        var url = $"/chat/{conversation.Oid}";

        var jobs = new List<ChatPushJob>();
        foreach (var userId in recipients)
        {
            if (!settings.TryGetValue(userId, out var userSettings) || !userSettings.NotificationsEnabled || !userSettings.DesktopNotificationsEnabled)
            {
                continue;
            }

            var text = userSettings.ShowMessagePreview ? preview : "Новое сообщение";
            if (mentioned.Contains(userId))
            {
                text = $"Вас упомянули: {text}";
            }

            var body = isGroup ? $"{FirstWord(senderName)}: {text}" : text;
            jobs.Add(new ChatPushJob(userId, new ChatPushPayload(title, body, conversation.Oid, url)));
        }

        pushQueue.Enqueue(jobs);
    }

    private static string DescribeForPush(ChatMessageDto dto)
    {
        if (!string.IsNullOrWhiteSpace(dto.Text))
        {
            var text = dto.Text.ReplaceLineEndings(" ").Trim();
            return text.Length <= 160 ? text : $"{text[..157]}…";
        }

        var attachments = dto.Attachments.ToArray();
        var images = attachments.Count(x => x.IsImage);
        if (attachments.Length == 0)
        {
            return "Новое сообщение";
        }

        if (images == attachments.Length)
        {
            return images == 1 ? "📷 Фото" : $"📷 Фото: {images}";
        }

        if (attachments.Length == 1 && attachments[0].IsAudio)
        {
            return "🎤 Голосовое сообщение";
        }

        return attachments.Length == 1 ? $"📎 {attachments[0].FileName}" : $"📎 Вложений: {attachments.Length}";
    }

    /// <summary>
    /// «Иванов Иван Иванович» → «Иван»: в групповом уведомлении достаточно имени.
    /// </summary>
    private static string FirstWord(string fullName)
    {
        var parts = fullName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length >= 2 ? parts[1] : fullName;
    }

    public Task SavePushSubscriptionAsync(ChatPushSubscriptionRequest request, string? userAgent, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var me = CurrentUserId;
        var endpoint = request.Endpoint?.Trim();
        ValidationHelper.Guard(
            Uri.TryCreate(endpoint, UriKind.Absolute, out var uri) && uri.Scheme == Uri.UriSchemeHttps && endpoint!.Length <= 2048,
            "Некорректный адрес подписки на уведомления.");
        var p256dh = request.Keys?.P256dh?.Trim();
        var auth = request.Keys?.Auth?.Trim();
        ValidationHelper.Guard(IsBase64UrlOfLength(p256dh, 65) && IsBase64UrlOfLength(auth, 16), "Некорректные ключи подписки на уведомления.");

        var now = DateTime.UtcNow;
        // Один браузер — одна подписка; если в нем вошел другой сотрудник, подписка переходит к нему.
        var subscription = new XPQuery<ChatPushSubscription>(unitOfWork).FirstOrDefault(x => x.Endpoint == endpoint)
            ?? new ChatPushSubscription(unitOfWork) { Endpoint = endpoint, CreatedAtUtc = now };
        subscription.UserId = me;
        subscription.P256dh = p256dh;
        subscription.Auth = auth;
        subscription.UserAgent = Truncate(userAgent, 512);
        subscription.UpdatedAtUtc = now;
        unitOfWork.CommitChanges();
        return Task.CompletedTask;
    }

    public Task DeletePushSubscriptionAsync(string? endpoint, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var normalized = endpoint?.Trim();
        if (string.IsNullOrEmpty(normalized))
        {
            return Task.CompletedTask;
        }

        foreach (var subscription in new XPQuery<ChatPushSubscription>(unitOfWork).Where(x => x.Endpoint == normalized && x.UserId == me).ToList())
        {
            subscription.Delete();
        }

        unitOfWork.CommitChanges();
        return Task.CompletedTask;
    }

    private static bool IsBase64UrlOfLength(string? value, int length)
    {
        if (string.IsNullOrEmpty(value) || value.Length > 128)
        {
            return false;
        }

        try
        {
            return WebPushCrypto.FromBase64Url(value).Length == length;
        }
        catch (FormatException)
        {
            return false;
        }
    }
}

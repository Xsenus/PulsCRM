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
    /// Строка настроек может впервые появиться из-за окна чата — тогда оповещения и звук включены по умолчанию.
    /// </summary>
    private ChatUserSettings GetOrCreateSettings(int userId)
    {
        var existing = new XPQuery<ChatUserSettings>(unitOfWork).FirstOrDefault(x => x.UserId == userId);
        if (existing is not null)
        {
            return existing;
        }

        var defaults = new ChatUserSettingsDto();
        return new ChatUserSettings(unitOfWork)
        {
            UserId = userId,
            NotificationsEnabled = defaults.NotificationsEnabled,
            SoundEnabled = defaults.SoundEnabled,
            SoundName = defaults.SoundName,
            SoundVolume = defaults.SoundVolume,
            ShowMessagePreview = defaults.ShowMessagePreview,
            DesktopNotificationsEnabled = defaults.DesktopNotificationsEnabled,
            UpdatedAtUtc = DateTime.UtcNow
        };
    }

    private bool CanAccessConversation(int conversationId, int userId)
    {
        try
        {
            RequireMembership(conversationId, userId);
            return true;
        }
        catch (KeyNotFoundException)
        {
            return false;
        }
    }

    private (ChatConversation Conversation, ChatParticipant Participant) RequireMembership(int conversationId, int userId)
    {
        var conversation = unitOfWork.GetObjectByKey<ChatConversation>(conversationId);
        var participant = conversation is null || conversation.IsRemoved ? null : FindParticipant(conversation.Oid, userId);
        if (conversation is null || participant is null || participant.LeftAtUtc is not null
            || GetHiddenDirectConversationIds([conversation], userId).Count > 0)
        {
            throw new KeyNotFoundException("Диалог не найден.");
        }

        return (conversation, participant);
    }

    /// <summary>
    /// Личные диалоги с уволенными (или удаленными из legacy-БД) сотрудниками в чате не показываются:
    /// история остается в базе, но диалог пропадает из списка, счетчиков и недоступен по id.
    /// </summary>
    private HashSet<int> GetHiddenDirectConversationIds(IEnumerable<ChatConversation> conversations, int me)
    {
        var directIds = conversations
            .Where(x => x.Kind == ChatConversationKind.Direct)
            .Select(x => x.Oid)
            .Distinct()
            .ToArray();
        if (directIds.Length == 0)
        {
            return new HashSet<int>();
        }

        var peers = new XPQuery<ChatParticipant>(unitOfWork)
            .Where(x => x.Conversation != null && directIds.Contains(x.Conversation.Oid) && x.UserId != me)
            .ToList()
            .Select(x => (ConversationId: x.Conversation!.Oid, x.UserId))
            .ToList();
        var users = userDirectory.GetUsers(peers.Select(x => x.UserId));

        return peers
            .Where(x => users.GetValueOrDefault(x.UserId) is not { IsInactive: false })
            .Select(x => x.ConversationId)
            .ToHashSet();
    }

    private (ChatConversation Conversation, ChatParticipant Participant) RequireGroupAdmin(int conversationId, int userId)
    {
        var (conversation, participant) = RequireMembership(conversationId, userId);
        ValidationHelper.Guard(conversation.Kind == ChatConversationKind.Group, "Действие доступно только в групповом чате.");
        EnsureActiveGroupOwner(conversation);
        ValidationHelper.Guard(participant.Role is ChatParticipantRole.Admin or ChatParticipantRole.Owner, "Действие доступно только администраторам чата.");
        return (conversation, participant);
    }

    /// <summary>
    /// В группе всегда должен быть работающий владелец. Если создатель уволен (или удален из legacy-БД),
    /// владельцем становится старейший работающий администратор, а если их нет — старейший участник.
    /// Уволенный владелец понижается до участника. Возвращает true, если владелец сменился.
    /// </summary>
    private bool EnsureActiveGroupOwner(ChatConversation conversation)
    {
        var active = GetParticipants(conversation.Oid).Where(x => x.LeftAtUtc == null).ToList();
        if (active.Count == 0)
        {
            return false;
        }

        var users = userDirectory.GetUsers(active.Select(x => x.UserId));
        var working = active.Where(x => users.GetValueOrDefault(x.UserId) is { IsInactive: false }).ToList();
        if (working.Count == 0 || working.Any(x => x.Role == ChatParticipantRole.Owner))
        {
            return false;
        }

        foreach (var formerOwner in active.Where(x => x.Role == ChatParticipantRole.Owner))
        {
            formerOwner.Role = ChatParticipantRole.Member;
        }

        var heir = working
            .OrderByDescending(x => x.Role)
            .ThenBy(x => x.JoinedAtUtc)
            .ThenBy(x => x.Oid)
            .First();
        heir.Role = ChatParticipantRole.Owner;

        var now = DateTime.UtcNow;
        AddSystemMessage(conversation, $"{users[heir.UserId].DisplayName} теперь владелец чата: прежний создатель больше не работает в компании", now);
        conversation.UpdatedAtUtc = now;
        unitOfWork.CommitChanges();
        return true;
    }

    private ChatMessage RequireVisibleMessage(int messageId, int userId)
    {
        var message = unitOfWork.GetObjectByKey<ChatMessage>(messageId);
        if (message?.Conversation is null)
        {
            throw new KeyNotFoundException("Сообщение не найдено.");
        }

        RequireMembership(message.Conversation.Oid, userId);
        return message;
    }

    private ChatParticipant? FindParticipant(int conversationId, int userId)
        => new XPQuery<ChatParticipant>(unitOfWork)
            .FirstOrDefault(x => x.Conversation != null && x.Conversation.Oid == conversationId && x.UserId == userId);

    private List<ChatParticipant> GetParticipants(int conversationId)
        => new XPQuery<ChatParticipant>(unitOfWork)
            .Where(x => x.Conversation != null && x.Conversation.Oid == conversationId)
            .ToList();

    private int[] GetActiveUserIds(int conversationId)
        => GetParticipants(conversationId).Where(x => x.LeftAtUtc == null).Select(x => x.UserId).Distinct().ToArray();

    private void AddParticipant(ChatConversation conversation, int userId, ChatParticipantRole role, DateTime now)
        => _ = new ChatParticipant(unitOfWork)
        {
            Conversation = conversation,
            UserId = userId,
            Role = role,
            JoinedAtUtc = now
        };

    private void AddSystemMessage(ChatConversation conversation, string text, DateTime now)
    {
        var message = new ChatMessage(unitOfWork)
        {
            Conversation = conversation,
            SenderUserId = 0,
            Kind = ChatMessageKind.System,
            Text = text,
            CreatedAtUtc = now
        };

        unitOfWork.CommitChanges();
        conversation.LastMessageId = message.Oid;
        conversation.LastMessageAtUtc = now;
    }

    private List<ChatUserDto> RequireActiveUsers(IReadOnlyCollection<int> userIds)
    {
        var users = userDirectory.GetUsers(userIds);
        var missing = userIds.Where(id => !users.ContainsKey(id)).ToArray();
        if (missing.Length > 0)
        {
            throw new KeyNotFoundException("Сотрудник не найден.");
        }

        var inactive = users.Values.Where(x => x.IsInactive).Select(x => x.DisplayName).ToArray();
        ValidationHelper.Guard(inactive.Length == 0, $"Нельзя добавить уволенных сотрудников: {string.Join(", ", inactive)}.");
        return userIds.Select(id => users[id]).ToList();
    }

    private string GetDisplayName(int userId)
        => userDirectory.GetUsers([userId]).GetValueOrDefault(userId)?.DisplayName ?? $"Сотрудник #{userId}";

    private int CountUnreadMentions(ChatConversation conversation, ChatParticipant participant, int me)
    {
        var lastRead = participant.LastReadMessageId;
        if (conversation.LastMessageId <= lastRead)
        {
            return 0;
        }

        var token = $",{me},";
        return new XPQuery<ChatMessage>(unitOfWork)
            .Count(x => x.Conversation == conversation
                && x.Oid > lastRead
                && x.SenderUserId != me
                && x.Kind == ChatMessageKind.Text
                && x.DeletedAtUtc == null
                && x.MentionedUserIds != null
                && x.MentionedUserIds.Contains(token));
    }

    /// <summary>
    /// Оставляет из запрошенных упоминаний только действующих участников чата (не автора), чье «@Имя» есть в тексте.
    /// </summary>
    private int[] ResolveMentions(ChatConversation conversation, int me, string? text, IEnumerable<int>? requested)
    {
        var ids = (requested ?? Array.Empty<int>()).Where(x => x > 0 && x != me).Distinct().Take(MaxMentions).ToArray();
        if (ids.Length == 0 || string.IsNullOrEmpty(text))
        {
            return Array.Empty<int>();
        }

        var activeParticipants = GetParticipants(conversation.Oid).Where(x => x.LeftAtUtc == null).Select(x => x.UserId).ToHashSet();
        var users = userDirectory.GetUsers(ids.Where(activeParticipants.Contains));
        return ids
            .Where(id => users.GetValueOrDefault(id) is { IsInactive: false } user
                && text.Contains($"@{user.DisplayName}", StringComparison.CurrentCultureIgnoreCase))
            .ToArray();
    }

    private static string? FormatMentions(IReadOnlyCollection<int> ids)
        => ids.Count == 0 ? null : $",{string.Join(',', ids)},";

    private static int[] ParseMentions(string? value)
        => string.IsNullOrEmpty(value)
            ? Array.Empty<int>()
            : value.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(x => int.TryParse(x, out var id) ? id : 0).Where(x => x > 0).ToArray();

    private int CountUnread(ChatConversation conversation, ChatParticipant participant, int me)
    {
        var lastRead = participant.LastReadMessageId;
        if (conversation.LastMessageId <= lastRead)
        {
            return 0;
        }

        return new XPQuery<ChatMessage>(unitOfWork)
            .Count(x => x.Conversation == conversation
                && x.Oid > lastRead
                && x.SenderUserId != me
                && x.Kind == ChatMessageKind.Text
                && x.DeletedAtUtc == null);
    }
}

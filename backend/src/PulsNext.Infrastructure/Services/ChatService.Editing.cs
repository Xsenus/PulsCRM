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
    /// Уволенному сотруднику в личный диалог писать нельзя.
    /// </summary>
    private void EnsureCanWrite(ChatConversation conversation, int me)
    {
        if (conversation.Kind != ChatConversationKind.Direct)
        {
            return;
        }

        var peerId = GetParticipants(conversation.Oid).Select(x => x.UserId).FirstOrDefault(x => x != me);
        var peer = userDirectory.GetUsers([peerId]).GetValueOrDefault(peerId);
        ValidationHelper.Guard(peer is { IsInactive: false }, "Сотрудник уволен, отправить ему сообщение нельзя.");
    }

    public async Task<ChatMessageDto> EditMessageAsync(int messageId, string? text, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var message = RequireVisibleMessage(messageId, me);
        ValidationHelper.Guard(message.Kind == ChatMessageKind.Text && message.SenderUserId == me, "Редактировать можно только свои сообщения.");
        ValidationHelper.Guard(message.DeletedAtUtc is null, "Сообщение удалено.");

        var normalized = NormalizeMessageText(text);
        var hasAttachments = new XPQuery<ChatAttachment>(unitOfWork).Any(x => x.Message == message);
        ValidationHelper.Guard(normalized is not null || hasAttachments, "Сообщение пустое.");

        if (!string.Equals(message.Text, normalized, StringComparison.Ordinal))
        {
            message.Text = normalized;
            message.EditedAtUtc = DateTime.UtcNow;
            // Упоминание, чье «@Имя» убрали из текста, снимается; новые при правке не добавляются.
            message.MentionedUserIds = FormatMentions(ResolveMentions(message.Conversation!, me, normalized, ParseMentions(message.MentionedUserIds)));
            unitOfWork.CommitChanges();
        }

        var dto = BuildMessageDtos([message], me).Single();
        await eventPublisher.PublishAsync(GetActiveUserIds(message.Conversation!.Oid), ChatEventNames.MessageUpdated, dto, cancellationToken);
        return dto;
    }

    public async Task<ChatMessageDto> DeleteMessageAsync(int messageId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var message = RequireVisibleMessage(messageId, me);
        ValidationHelper.Guard(message.Kind == ChatMessageKind.Text, "Системные сообщения удалить нельзя.");

        if (message.SenderUserId != me)
        {
            var mine = FindParticipant(message.Conversation!.Oid, me);
            var canModerate = message.Conversation.Kind == ChatConversationKind.Group
                && mine is { Role: ChatParticipantRole.Admin or ChatParticipantRole.Owner };
            ValidationHelper.Guard(canModerate, "Удалять чужие сообщения могут только администраторы группового чата.");
        }

        if (message.DeletedAtUtc is null)
        {
            // Мягкое удаление: текст, вложения с файлами и реакции остаются в базе (для истории и разбора),
            // а участникам удаленное не выдается — ни в ленте, ни в поиске, ни по ссылке на файл.
            message.DeletedAtUtc = DateTime.UtcNow;
            message.DeletedByUserId = me;

            var wasPinned = message.Conversation!.PinnedMessageId == message.Oid;
            if (wasPinned)
            {
                message.Conversation.PinnedMessageId = 0;
                message.Conversation.PinnedByUserId = 0;
                message.Conversation.PinnedAtUtc = null;
            }

            unitOfWork.CommitChanges();
            if (wasPinned)
            {
                await PublishConversationUpdatedAsync(message.Conversation, cancellationToken);
            }
        }

        var dto = BuildMessageDtos([message], me).Single();
        await eventPublisher.PublishAsync(GetActiveUserIds(message.Conversation!.Oid), ChatEventNames.MessageUpdated, dto, cancellationToken);
        return dto;
    }

    public async Task<ChatMessageDto> ToggleReactionAsync(int messageId, string? emoji, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var message = RequireVisibleMessage(messageId, me);
        ValidationHelper.Guard(message.DeletedAtUtc is null, "Сообщение удалено.");
        ValidationHelper.Guard(message.Kind == ChatMessageKind.Text, "На системное сообщение нельзя поставить реакцию.");

        var normalized = TextHelper.NullIfWhiteSpace(emoji);
        ValidationHelper.Guard(normalized is not null, "Выберите реакцию.");
        ValidationHelper.Guard(normalized!.Length <= MaxEmojiLength && !normalized.Any(char.IsWhiteSpace) && !normalized.Any(char.IsLetterOrDigit), "Недопустимая реакция.");

        var existing = new XPQuery<ChatReaction>(unitOfWork)
            .FirstOrDefault(x => x.Message == message && x.UserId == me && x.Emoji == normalized);
        if (existing is null)
        {
            _ = new ChatReaction(unitOfWork)
            {
                Message = message,
                UserId = me,
                Emoji = normalized,
                CreatedAtUtc = DateTime.UtcNow
            };
        }
        else
        {
            existing.Delete();
        }

        unitOfWork.CommitChanges();

        var dto = BuildMessageDtos([message], me).Single();
        await eventPublisher.PublishAsync(GetActiveUserIds(message.Conversation!.Oid), ChatEventNames.MessageUpdated, dto, cancellationToken);
        return dto;
    }

    public async Task MarkReadAsync(int conversationId, int? messageId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var (conversation, mine) = RequireMembership(conversationId, me);
        var target = messageId is > 0 ? Math.Min(messageId.Value, conversation.LastMessageId) : conversation.LastMessageId;
        if (target <= mine.LastReadMessageId)
        {
            return;
        }

        mine.LastReadMessageId = target;
        mine.LastReadAtUtc = DateTime.UtcNow;
        // Прочитанное — тем более доставлено.
        mine.LastDeliveredMessageId = Math.Max(mine.LastDeliveredMessageId, target);
        unitOfWork.CommitChanges();

        await eventPublisher.PublishAsync(GetActiveUserIds(conversation.Oid), ChatEventNames.ReadStateChanged, new ChatReadStateEventDto
        {
            ConversationId = conversation.Oid,
            UserId = me,
            LastReadMessageId = mine.LastReadMessageId,
            LastReadAtUtc = ForceUtc(mine.LastReadAtUtc)
        }, cancellationToken);
    }

    public async Task MarkDeliveredAsync(IReadOnlyCollection<ChatDeliveredItem> items, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var requested = (items ?? Array.Empty<ChatDeliveredItem>())
            .Where(x => x.ConversationId > 0 && x.MessageId > 0)
            .GroupBy(x => x.ConversationId)
            .Select(x => (ConversationId: x.Key, MessageId: x.Max(item => item.MessageId)))
            .Take(MaxDeliveredItems)
            .ToArray();
        if (requested.Length == 0)
        {
            return;
        }

        var ids = requested.Select(x => x.ConversationId).ToArray();
        // Чужие и покинутые диалоги просто пропускаем: это фоновая отметка, ошибка тут не нужна.
        var participations = new XPQuery<ChatParticipant>(unitOfWork)
            .Where(x => x.UserId == me && x.LeftAtUtc == null && x.Conversation != null && !x.Conversation.IsRemoved && ids.Contains(x.Conversation.Oid))
            .ToList();
        var changed = new List<ChatParticipant>();
        foreach (var participation in participations)
        {
            var conversation = participation.Conversation!;
            var target = Math.Min(requested.First(x => x.ConversationId == conversation.Oid).MessageId, conversation.LastMessageId);
            if (target > participation.LastDeliveredMessageId)
            {
                participation.LastDeliveredMessageId = target;
                changed.Add(participation);
            }
        }

        if (changed.Count == 0)
        {
            return;
        }

        unitOfWork.CommitChanges();
        foreach (var participation in changed)
        {
            var conversationId = participation.Conversation!.Oid;
            await eventPublisher.PublishAsync(GetActiveUserIds(conversationId).Where(x => x != me).ToArray(), ChatEventNames.DeliveryStateChanged, new ChatDeliveryStateEventDto
            {
                ConversationId = conversationId,
                UserId = me,
                LastDeliveredMessageId = participation.LastDeliveredMessageId
            }, cancellationToken);
        }
    }

    public Task<ChatUnreadSummaryDto> GetUnreadSummaryAsync(CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var participations = new XPQuery<ChatParticipant>(unitOfWork)
            .Where(x => x.UserId == me && x.LeftAtUtc == null && x.Conversation != null && !x.Conversation.IsRemoved)
            .ToList();

        var hidden = GetHiddenDirectConversationIds(participations.Select(x => x.Conversation!), me);
        // В диалогах «без звука» считаются только упоминания текущего сотрудника.
        var counts = participations
            .Where(x => !hidden.Contains(x.Conversation!.Oid))
            .Select(x => x.IsMuted ? CountUnreadMentions(x.Conversation!, x, me) : CountUnread(x.Conversation!, x, me))
            .ToArray();
        return Task.FromResult(new ChatUnreadSummaryDto
        {
            TotalUnread = counts.Sum(),
            ConversationsWithUnread = counts.Count(x => x > 0)
        });
    }
}

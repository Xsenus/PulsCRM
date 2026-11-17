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
    private IReadOnlyCollection<ChatConversationDto> BuildConversationDtos(IReadOnlyCollection<ChatConversation> conversations, int me)
    {
        if (conversations.Count == 0)
        {
            return Array.Empty<ChatConversationDto>();
        }

        var conversationIds = conversations.Select(x => x.Oid).ToArray();
        var participants = new XPQuery<ChatParticipant>(unitOfWork)
            .Where(x => x.Conversation != null && conversationIds.Contains(x.Conversation.Oid))
            .ToList();
        var users = userDirectory.GetUsers(participants.Select(x => x.UserId));

        var lastMessageIds = conversations
            .SelectMany(x => new[] { x.LastMessageId, x.PinnedMessageId })
            .Where(x => x > 0)
            .Distinct()
            .ToArray();
        var lastMessages = lastMessageIds.Length == 0
            ? new Dictionary<int, ChatMessageDto>()
            : BuildMessageDtos(new XPQuery<ChatMessage>(unitOfWork).Where(x => lastMessageIds.Contains(x.Oid)).ToList(), me)
                .ToDictionary(x => x.Id);

        var result = new List<ChatConversationDto>(conversations.Count);
        foreach (var conversation in conversations)
        {
            var conversationParticipants = participants.Where(x => x.Conversation!.Oid == conversation.Oid).ToList();
            var mine = conversationParticipants.First(x => x.UserId == me);
            // Уволенные сотрудники в составе чата не показываются.
            var active = conversationParticipants
                .Where(x => x.LeftAtUtc == null && users.GetValueOrDefault(x.UserId) is { IsInactive: false })
                .ToList();
            var peer = conversation.Kind == ChatConversationKind.Direct
                ? conversationParticipants.FirstOrDefault(x => x.UserId != me)
                : null;

            result.Add(new ChatConversationDto
            {
                Id = conversation.Oid,
                Kind = conversation.Kind,
                Title = conversation.Kind == ChatConversationKind.Direct
                    ? (peer is null ? "Диалог" : users.GetValueOrDefault(peer.UserId)?.DisplayName ?? $"Сотрудник #{peer.UserId}")
                    : conversation.Title ?? "Групповой чат",
                Description = conversation.Description,
                Icon = conversation.Icon,
                PeerUserId = peer?.UserId,
                MyRole = mine.Role,
                IsMuted = mine.IsMuted,
                IsPinned = mine.IsPinned,
                IsArchived = mine.IsArchived,
                MyLastReadMessageId = mine.LastReadMessageId,
                UnreadCount = CountUnread(conversation, mine, me),
                UnreadMentionCount = CountUnreadMentions(conversation, mine, me),
                CreatedAtUtc = ForceUtc(conversation.CreatedAtUtc),
                LastMessageAtUtc = ForceUtc(conversation.LastMessageAtUtc),
                LastMessage = lastMessages.GetValueOrDefault(conversation.LastMessageId),
                PinnedMessage = conversation.PinnedMessageId > 0 && lastMessages.GetValueOrDefault(conversation.PinnedMessageId) is { IsDeleted: false } pinned
                    ? pinned
                    : null,
                CanPinMessages = conversation.Kind == ChatConversationKind.Direct
                    || mine.Role is ChatParticipantRole.Admin or ChatParticipantRole.Owner,
                Participants = active
                    .OrderByDescending(x => x.Role)
                    .ThenBy(x => users.GetValueOrDefault(x.UserId)?.DisplayName, StringComparer.CurrentCultureIgnoreCase)
                    .Select(x => new ChatParticipantDto
                    {
                        UserId = x.UserId,
                        DisplayName = users.GetValueOrDefault(x.UserId)?.DisplayName ?? $"Сотрудник #{x.UserId}",
                        Login = users.GetValueOrDefault(x.UserId)?.Login,
                        Role = x.Role,
                        IsInactive = users.GetValueOrDefault(x.UserId)?.IsInactive ?? true,
                        LastReadMessageId = x.LastReadMessageId,
                        LastReadAtUtc = ForceUtc(x.LastReadAtUtc),
                        LastDeliveredMessageId = Math.Max(x.LastDeliveredMessageId, x.LastReadMessageId)
                    })
                    .ToArray()
            });
        }

        return result;
    }

    private IReadOnlyCollection<ChatMessageDto> BuildMessageDtos(IReadOnlyCollection<ChatMessage> messages, int me)
    {
        if (messages.Count == 0)
        {
            return Array.Empty<ChatMessageDto>();
        }

        var messageIds = messages.Select(x => x.Oid).ToArray();
        var attachments = new XPQuery<ChatAttachment>(unitOfWork)
            .Where(x => x.Message != null && messageIds.Contains(x.Message.Oid))
            .ToList()
            .GroupBy(x => x.Message!.Oid)
            .ToDictionary(x => x.Key, x => x.OrderBy(a => a.SortOrder).ThenBy(a => a.Oid).ToList());
        var reactions = new XPQuery<ChatReaction>(unitOfWork)
            .Where(x => x.Message != null && messageIds.Contains(x.Message.Oid))
            .ToList()
            .GroupBy(x => x.Message!.Oid)
            .ToDictionary(x => x.Key, x => x.ToList());

        var replyIds = messages.Select(x => x.ReplyToMessageId).Where(x => x > 0).Distinct().ToArray();
        var replies = replyIds.Length == 0
            ? new Dictionary<int, ChatMessage>()
            : new XPQuery<ChatMessage>(unitOfWork).Where(x => replyIds.Contains(x.Oid)).ToList().ToDictionary(x => x.Oid);
        var replyAttachmentCounts = replyIds.Length == 0
            ? new Dictionary<int, int>()
            : new XPQuery<ChatAttachment>(unitOfWork)
                .Where(x => x.Message != null && replyIds.Contains(x.Message.Oid))
                .ToList()
                .GroupBy(x => x.Message!.Oid)
                .ToDictionary(x => x.Key, x => x.Count());

        var users = userDirectory.GetUsers(messages.Select(x => x.SenderUserId).Concat(replies.Values.Select(x => x.SenderUserId)));
        string NameOf(int userId) => userId == 0 ? "Система" : users.GetValueOrDefault(userId)?.DisplayName ?? $"Сотрудник #{userId}";

        return messages.Select(message =>
        {
            var isDeleted = message.DeletedAtUtc is not null;
            var messageReactions = reactions.GetValueOrDefault(message.Oid) ?? new List<ChatReaction>();
            ChatReplyPreviewDto? reply = null;
            if (message.ReplyToMessageId > 0 && replies.TryGetValue(message.ReplyToMessageId, out var replyMessage))
            {
                var replyDeleted = replyMessage.DeletedAtUtc is not null;
                reply = new ChatReplyPreviewDto
                {
                    Id = replyMessage.Oid,
                    SenderUserId = replyMessage.SenderUserId,
                    SenderName = NameOf(replyMessage.SenderUserId),
                    Text = replyDeleted ? null : Truncate(replyMessage.Text, 200),
                    IsDeleted = replyDeleted,
                    AttachmentCount = replyDeleted ? 0 : replyAttachmentCounts.GetValueOrDefault(replyMessage.Oid)
                };
            }

            return new ChatMessageDto
            {
                Id = message.Oid,
                ConversationId = message.Conversation?.Oid ?? 0,
                Kind = message.Kind,
                SenderUserId = message.SenderUserId,
                SenderName = NameOf(message.SenderUserId),
                Text = isDeleted ? null : message.Text,
                ClientMessageId = message.ClientMessageId,
                CreatedAtUtc = ForceUtc(message.CreatedAtUtc),
                EditedAtUtc = ForceUtc(message.EditedAtUtc),
                IsDeleted = isDeleted,
                ReplyTo = isDeleted ? null : reply,
                MentionedUserIds = isDeleted ? Array.Empty<int>() : ParseMentions(message.MentionedUserIds),
                ForwardedFrom = isDeleted || message.ForwardedFromUserId <= 0
                    ? null
                    : new ChatForwardedFromDto { UserId = message.ForwardedFromUserId, Name = message.ForwardedFromName ?? NameOf(message.ForwardedFromUserId) },
                Attachments = isDeleted
                    ? Array.Empty<ChatAttachmentDto>()
                    : (attachments.GetValueOrDefault(message.Oid) ?? new List<ChatAttachment>()).Select(ToAttachmentDto).ToArray(),
                Reactions = isDeleted
                    ? Array.Empty<ChatReactionDto>()
                    : messageReactions
                        .GroupBy(x => x.Emoji ?? string.Empty)
                        .Select(group => new ChatReactionDto
                        {
                            Emoji = group.Key,
                            Count = group.Count(),
                            ReactedByMe = group.Any(x => x.UserId == me),
                            UserIds = group.OrderBy(x => x.CreatedAtUtc).Select(x => x.UserId).ToArray()
                        })
                        .OrderBy(x => messageReactions.Where(r => r.Emoji == x.Emoji).Min(r => r.CreatedAtUtc))
                        .ToArray()
            };
        }).ToArray();
    }

    private async Task PublishConversationUpdatedAsync(ChatConversation conversation, CancellationToken cancellationToken)
    {
        foreach (var userId in GetActiveUserIds(conversation.Oid))
        {
            var dto = BuildConversationDtos([conversation], userId).Single();
            await eventPublisher.PublishAsync([userId], ChatEventNames.ConversationUpdated, dto, cancellationToken);
        }
    }

    private ChatAttachmentDto ToAttachmentDto(ChatAttachment attachment)
        => new()
        {
            Id = attachment.Oid,
            ConversationId = attachment.Conversation?.Oid ?? 0,
            MessageId = attachment.Message?.Oid,
            FileName = attachment.OriginalFileName ?? "file",
            ContentType = attachment.ContentType ?? "application/octet-stream",
            Length = attachment.Length,
            IsImage = ImageContentTypes.Contains(attachment.ContentType ?? string.Empty),
            HasThumbnail = !string.IsNullOrWhiteSpace(attachment.ThumbnailRelativePath),
            PreviewDataUrl = attachment.PreviewDataUrl,
            Width = attachment.ImageWidth > 0 && attachment.ImageHeight > 0 ? attachment.ImageWidth : null,
            Height = attachment.ImageWidth > 0 && attachment.ImageHeight > 0 ? attachment.ImageHeight : null,
            UploadedAtUtc = ForceUtc(attachment.UploadedAtUtc)
        };

    /// <summary>
    /// Читает уменьшенную копию от браузера. Тип определяется по сигнатуре, а не по заявленному MIME:
    /// принимаются только JPEG, PNG и WebP не больше <see cref="MaxThumbnailBytes"/>. Иначе копия игнорируется.
    /// </summary>
    /// <summary>
    /// Принимает превью, только если это короткий data:URL WebP/JPEG с корректным base64 и сигнатурой картинки.
    /// Иначе превью просто не сохраняется: оно необязательно.
    /// </summary>
    private static string? NormalizePreviewDataUrl(string? value)
    {
        if (string.IsNullOrEmpty(value) || value.Length > ChatAttachmentLimits.MaxPreviewDataUrlLength)
        {
            return null;
        }

        string[] prefixes = ["data:image/webp;base64,", "data:image/jpeg;base64,"];
        var prefix = prefixes.FirstOrDefault(x => value.StartsWith(x, StringComparison.Ordinal));
        if (prefix is null)
        {
            return null;
        }

        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(value[prefix.Length..]);
        }
        catch (FormatException)
        {
            return null;
        }

        var isJpeg = bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF;
        var isWebp = bytes.Length >= 12 && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8);
        return (prefix.Contains("jpeg") ? isJpeg : isWebp) ? value : null;
    }

    private static async Task<(byte[] Bytes, string ContentType, string Extension)?> ReadThumbnailAsync(Stream content, CancellationToken cancellationToken)
    {
        var buffer = new byte[MaxThumbnailBytes + 1];
        var total = 0;
        int read;
        while (total < buffer.Length && (read = await content.ReadAsync(buffer.AsMemory(total, buffer.Length - total), cancellationToken)) > 0)
        {
            total += read;
        }

        if (total == 0 || total > MaxThumbnailBytes)
        {
            return null;
        }

        var bytes = buffer.AsSpan(0, total).ToArray();
        if (bytes.Length >= 3 && bytes[0] == 0xFF && bytes[1] == 0xD8 && bytes[2] == 0xFF)
        {
            return (bytes, "image/jpeg", ".jpg");
        }

        if (bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A }))
        {
            return (bytes, "image/png", ".png");
        }

        if (bytes.Length >= 12 && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8))
        {
            return (bytes, "image/webp", ".webp");
        }

        return null;
    }

    private static ChatUserSettingsDto ToSettingsDto(ChatUserSettings settings)
        => new()
        {
            NotificationsEnabled = settings.NotificationsEnabled,
            SoundEnabled = settings.SoundEnabled,
            SoundName = ChatSoundNames.All.Contains(settings.SoundName) ? settings.SoundName! : ChatSoundNames.Default,
            SoundVolume = Math.Clamp(settings.SoundVolume, 0, 100),
            ShowMessagePreview = settings.ShowMessagePreview,
            DesktopNotificationsEnabled = settings.DesktopNotificationsEnabled
        };
}

using PulsNext.Domain.Chat;

namespace PulsNext.Infrastructure;

/// <summary>
/// Состояние модуля чата для текущего пользователя.
/// </summary>
public sealed class ChatStatusDto
{
    /// <summary>
    /// Чат включен на сервере.
    /// </summary>
    public bool Enabled { get; set; }

    /// <summary>
    /// Legacy-id текущего пользователя.
    /// </summary>
    public int CurrentUserId { get; set; }

    /// <summary>
    /// Максимальный размер одного вложения в байтах.
    /// </summary>
    public long MaxAttachmentBytes { get; set; }

    /// <summary>
    /// Максимальное число вложений в одном сообщении.
    /// </summary>
    public int MaxAttachmentsPerMessage { get; set; }

    /// <summary>
    /// Максимальная длина текста сообщения.
    /// </summary>
    public int MaxMessageLength { get; set; }
}

/// <summary>
/// Сотрудник в контексте чата.
/// </summary>
public sealed class ChatUserDto
{
    public int Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? GroupName { get; set; }

    /// <summary>
    /// Сотрудник уволен или удален из legacy-БД: писать ему нельзя.
    /// </summary>
    public bool IsInactive { get; set; }
}

public sealed class ChatParticipantDto
{
    public int UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public string? Login { get; set; }
    public ChatParticipantRole Role { get; set; }
    public bool IsInactive { get; set; }
    public int LastReadMessageId { get; set; }
    public DateTime? LastReadAtUtc { get; set; }

    /// <summary>
    /// До какого сообщения диалог доставлен в браузер участника (не меньше прочитанного).
    /// </summary>
    public int LastDeliveredMessageId { get; set; }
}

public sealed class ChatConversationDto
{
    public int Id { get; set; }
    public ChatConversationKind Kind { get; set; }

    /// <summary>
    /// Название: для группы — заданное, для личного диалога — имя собеседника.
    /// </summary>
    public string Title { get; set; } = string.Empty;

    public string? Description { get; set; }
    public string? Icon { get; set; }

    /// <summary>
    /// Собеседник в личном диалоге.
    /// </summary>
    public int? PeerUserId { get; set; }

    public ChatParticipantRole MyRole { get; set; }
    public bool IsMuted { get; set; }
    public bool IsPinned { get; set; }
    public bool IsArchived { get; set; }
    public int UnreadCount { get; set; }

    /// <summary>
    /// Непрочитанные сообщения, где упомянут текущий сотрудник: считаются и в диалогах «без звука».
    /// </summary>
    public int UnreadMentionCount { get; set; }

    public int MyLastReadMessageId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime LastMessageAtUtc { get; set; }
    public ChatMessageDto? LastMessage { get; set; }

    /// <summary>
    /// Закрепленное сообщение, общее для всех участников.
    /// </summary>
    public ChatMessageDto? PinnedMessage { get; set; }

    /// <summary>
    /// Может ли текущий сотрудник закреплять сообщения: в личном диалоге — всегда, в группе — администраторы.
    /// </summary>
    public bool CanPinMessages { get; set; }

    public IReadOnlyCollection<ChatParticipantDto> Participants { get; set; } = Array.Empty<ChatParticipantDto>();
}

public sealed class ChatAttachmentDto
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public int? MessageId { get; set; }
    public string FileName { get; set; } = string.Empty;
    public string ContentType { get; set; } = "application/octet-stream";
    public long Length { get; set; }

    /// <summary>
    /// Изображение, которое браузер может показать в предпросмотре.
    /// </summary>
    public bool IsImage { get; set; }

    /// <summary>
    /// Есть уменьшенная копия (<c>?thumbnail=true</c>) — в ленте показывать ее, а не оригинал.
    /// </summary>
    public bool HasThumbnail { get; set; }

    /// <summary>
    /// Размеры оригинала изображения в пикселях, если известны.
    /// </summary>
    public int? Width { get; set; }
    public int? Height { get; set; }

    public DateTime UploadedAtUtc { get; set; }
}

public sealed class ChatReactionDto
{
    public string Emoji { get; set; } = string.Empty;
    public int Count { get; set; }
    public bool ReactedByMe { get; set; }
    public IReadOnlyCollection<int> UserIds { get; set; } = Array.Empty<int>();
}

/// <summary>
/// Краткие сведения о сообщении, на которое дан ответ.
/// </summary>
public sealed class ChatReplyPreviewDto
{
    public int Id { get; set; }
    public int SenderUserId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string? Text { get; set; }
    public bool IsDeleted { get; set; }
    public int AttachmentCount { get; set; }
}

public sealed class ChatMessageDto
{
    public int Id { get; set; }
    public int ConversationId { get; set; }
    public ChatMessageKind Kind { get; set; }
    public int SenderUserId { get; set; }
    public string SenderName { get; set; } = string.Empty;
    public string? Text { get; set; }
    public string? ClientMessageId { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? EditedAtUtc { get; set; }
    public bool IsDeleted { get; set; }
    public ChatReplyPreviewDto? ReplyTo { get; set; }

    /// <summary>
    /// Автор оригинала, если сообщение переслано.
    /// </summary>
    public ChatForwardedFromDto? ForwardedFrom { get; set; }

    /// <summary>
    /// Сотрудники, упомянутые через @.
    /// </summary>
    public IReadOnlyCollection<int> MentionedUserIds { get; set; } = Array.Empty<int>();

    public IReadOnlyCollection<ChatAttachmentDto> Attachments { get; set; } = Array.Empty<ChatAttachmentDto>();
    public IReadOnlyCollection<ChatReactionDto> Reactions { get; set; } = Array.Empty<ChatReactionDto>();
}

public sealed class ChatMessagePageDto
{
    public IReadOnlyCollection<ChatMessageDto> Items { get; set; } = Array.Empty<ChatMessageDto>();

    /// <summary>
    /// Есть сообщения старше первого в выборке.
    /// </summary>
    public bool HasMoreBefore { get; set; }
}

public sealed class ChatUnreadSummaryDto
{
    public int TotalUnread { get; set; }
    public int ConversationsWithUnread { get; set; }
}

public sealed class ChatUserSettingsDto
{
    public bool NotificationsEnabled { get; set; } = true;
    public bool SoundEnabled { get; set; } = true;
    public string SoundName { get; set; } = ChatSoundNames.Default;
    public int SoundVolume { get; set; } = 70;
    public bool ShowMessagePreview { get; set; } = true;

    /// <summary>
    /// Системные оповещения браузера (Windows), когда вкладка в фоне. Выключены по умолчанию: нужно разрешение браузера.
    /// </summary>
    public bool DesktopNotificationsEnabled { get; set; }
}

/// <summary>
/// Состояние плавающего окна чата: хранится на сервере, чтобы быть одинаковым на всех компьютерах пользователя.
/// </summary>
public sealed class ChatDockStateDto
{
    public const int MinSize = 200;
    public const int MaxSize = 4000;

    /// <summary>
    /// Окно развернуто.
    /// </summary>
    public bool Open { get; set; }

    /// <summary>
    /// Диалог в окне; null — список диалогов.
    /// </summary>
    public int? ConversationId { get; set; }

    /// <summary>
    /// Размер окна; null — стандартный. Задаются вместе.
    /// </summary>
    public int? Width { get; set; }

    public int? Height { get; set; }
}

/// <summary>
/// Звуки оповещений, которые есть во фронтенде.
/// </summary>
public static class ChatSoundNames
{
    public const string Default = "chime";

    public static readonly IReadOnlyCollection<string> All = ["chime", "pop", "ding", "bell", "soft"];
}

public sealed class ChatCreateDirectRequest
{
    public int UserId { get; set; }
}

public sealed class ChatCreateGroupRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
    public IReadOnlyCollection<int> MemberUserIds { get; set; } = Array.Empty<int>();
}

public sealed class ChatUpdateGroupRequest
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? Icon { get; set; }
}

public sealed class ChatMembersRequest
{
    public IReadOnlyCollection<int> UserIds { get; set; } = Array.Empty<int>();
}

public sealed class ChatParticipantRoleRequest
{
    public ChatParticipantRole Role { get; set; }
}

public sealed class ChatConversationPreferencesRequest
{
    public bool? IsMuted { get; set; }
    public bool? IsPinned { get; set; }
    public bool? IsArchived { get; set; }
}

/// <summary>
/// Найденное сообщение вместе с диалогом, в котором оно лежит.
/// </summary>
public sealed class ChatSearchResultDto
{
    public int ConversationId { get; set; }
    public string ConversationTitle { get; set; } = string.Empty;
    public ChatConversationKind ConversationKind { get; set; }
    public string? ConversationIcon { get; set; }
    public int? PeerUserId { get; set; }
    public ChatMessageDto Message { get; set; } = new();
}

public sealed class ChatForwardedFromDto
{
    public int UserId { get; set; }
    public string Name { get; set; } = string.Empty;
}

public sealed class ChatForwardMessageRequest
{
    /// <summary>
    /// Диалоги, в которые переслать (не больше 10).
    /// </summary>
    public IReadOnlyCollection<int> ConversationIds { get; set; } = Array.Empty<int>();
}

public sealed class ChatPinMessageRequest
{
    /// <summary>
    /// Сообщение для закрепления; null — открепить.
    /// </summary>
    public int? MessageId { get; set; }
}

public sealed class ChatSendMessageRequest
{
    public string? Text { get; set; }
    public int? ReplyToMessageId { get; set; }
    public IReadOnlyCollection<int> AttachmentIds { get; set; } = Array.Empty<int>();

    /// <summary>
    /// Упомянутые сотрудники; учитываются только участники чата, чье «@Имя» есть в тексте.
    /// </summary>
    public IReadOnlyCollection<int> MentionedUserIds { get; set; } = Array.Empty<int>();

    public string? ClientMessageId { get; set; }
}

public sealed class ChatEditMessageRequest
{
    public string? Text { get; set; }
}

public sealed class ChatReactionRequest
{
    public string? Emoji { get; set; }
}

public sealed class ChatMarkReadRequest
{
    /// <summary>
    /// Последнее прочитанное сообщение; если не задано — весь диалог.
    /// </summary>
    public int? MessageId { get; set; }
}

public sealed class ChatAttachmentUploadCommand
{
    public required Stream Content { get; init; }
    public required string FileName { get; init; }
    public string? ContentType { get; init; }

    /// <summary>
    /// Уменьшенная копия изображения, подготовленная браузером (JPEG, PNG или WebP). Необязательна.
    /// </summary>
    public Stream? Thumbnail { get; init; }

    /// <summary>
    /// Размеры оригинала изображения в пикселях, если браузер их определил.
    /// </summary>
    public int? Width { get; init; }
    public int? Height { get; init; }
}

/// <summary>
/// Событие чата, которое рассылается участникам в реальном времени.
/// </summary>
public static class ChatEventNames
{
    public const string MessageCreated = "messageCreated";
    public const string MessageUpdated = "messageUpdated";
    public const string ConversationUpdated = "conversationUpdated";
    public const string ConversationRemoved = "conversationRemoved";
    public const string ReadStateChanged = "readStateChanged";
    public const string DeliveryStateChanged = "deliveryStateChanged";
    public const string Typing = "typing";
}

public sealed class ChatReadStateEventDto
{
    public int ConversationId { get; set; }
    public int UserId { get; set; }
    public int LastReadMessageId { get; set; }
    public DateTime? LastReadAtUtc { get; set; }
}

public sealed class ChatDeliveryStateEventDto
{
    public int ConversationId { get; set; }
    public int UserId { get; set; }
    public int LastDeliveredMessageId { get; set; }
}

/// <summary>
/// Браузер сотрудника получил сообщения: по каждому диалогу — последнее полученное.
/// </summary>
public sealed class ChatMarkDeliveredRequest
{
    public IReadOnlyCollection<ChatDeliveredItem> Items { get; set; } = Array.Empty<ChatDeliveredItem>();
}

public sealed class ChatDeliveredItem
{
    public int ConversationId { get; set; }
    public int MessageId { get; set; }
}

public sealed class ChatConversationRemovedEventDto
{
    public int ConversationId { get; set; }
}

public sealed class ChatTypingEventDto
{
    public int ConversationId { get; set; }
    public int UserId { get; set; }
    public string DisplayName { get; set; } = string.Empty;
}

using DevExpress.Xpo;

namespace PulsNext.Domain.Chat;

/// <summary>
/// Список XPO-сущностей модуля чата (отдельная БД PostgreSQL).
/// </summary>
public static class ChatPersistentTypes
{
    public static readonly Type[] All =
    {
        typeof(ChatConversation),
        typeof(ChatParticipant),
        typeof(ChatMessage),
        typeof(ChatAttachment),
        typeof(ChatReaction),
        typeof(ChatUserSettings)
    };
}

/// <summary>
/// Тип диалога.
/// </summary>
public enum ChatConversationKind
{
    /// <summary>
    /// Личная переписка двух сотрудников.
    /// </summary>
    Direct = 0,

    /// <summary>
    /// Групповой чат.
    /// </summary>
    Group = 1
}

/// <summary>
/// Роль участника группового чата.
/// </summary>
public enum ChatParticipantRole
{
    /// <summary>
    /// Участник.
    /// </summary>
    Member = 0,

    /// <summary>
    /// Администратор: управляет составом и удаляет чужие сообщения.
    /// </summary>
    Admin = 1,

    /// <summary>
    /// Создатель чата.
    /// </summary>
    Owner = 2
}

/// <summary>
/// Тип сообщения.
/// </summary>
public enum ChatMessageKind
{
    /// <summary>
    /// Обычное сообщение сотрудника.
    /// </summary>
    Text = 0,

    /// <summary>
    /// Системное событие: создание чата, изменение состава и т. п.
    /// </summary>
    System = 1
}

/// <summary>
/// Диалог: личная переписка двух сотрудников или групповой чат.
/// </summary>
[Persistent("ChatConversation")]
public class ChatConversation(Session session) : XPObject(session)
{
    private ChatConversationKind _kind;
    private string? _title;
    private string? _description;
    private string? _icon;
    private string? _directKey;
    private int _createdByUserId;
    private DateTime _createdAtUtc;
    private DateTime _updatedAtUtc;
    private DateTime _lastMessageAtUtc;
    private int _lastMessageId;
    private bool _isRemoved;
    private int _pinnedMessageId;
    private int _pinnedByUserId;
    private DateTime? _pinnedAtUtc;

    public ChatConversation() : this(Session.DefaultSession) { }

    /// <summary>
    /// Тип диалога.
    /// </summary>
    public ChatConversationKind Kind
    {
        get => _kind;
        set => SetPropertyValue(nameof(Kind), ref _kind, value);
    }

    /// <summary>
    /// Название группового чата. Для личного диалога не заполняется.
    /// </summary>
    [Size(256)]
    public string? Title
    {
        get => _title;
        set => SetPropertyValue(nameof(Title), ref _title, value);
    }

    /// <summary>
    /// Описание группового чата.
    /// </summary>
    [Size(1024)]
    public string? Description
    {
        get => _description;
        set => SetPropertyValue(nameof(Description), ref _description, value);
    }

    /// <summary>
    /// Иконка (эмодзи) группового чата.
    /// </summary>
    [Size(32)]
    public string? Icon
    {
        get => _icon;
        set => SetPropertyValue(nameof(Icon), ref _icon, value);
    }

    /// <summary>
    /// Ключ личного диалога вида «меньший id:больший id»; не дает создать два диалога одной пары.
    /// </summary>
    [Size(64)]
    [Indexed]
    public string? DirectKey
    {
        get => _directKey;
        set => SetPropertyValue(nameof(DirectKey), ref _directKey, value);
    }

    /// <summary>
    /// Legacy-id создателя.
    /// </summary>
    public int CreatedByUserId
    {
        get => _createdByUserId;
        set => SetPropertyValue(nameof(CreatedByUserId), ref _createdByUserId, value);
    }

    /// <summary>
    /// Когда создан (UTC).
    /// </summary>
    public DateTime CreatedAtUtc
    {
        get => _createdAtUtc;
        set => SetPropertyValue(nameof(CreatedAtUtc), ref _createdAtUtc, value);
    }

    /// <summary>
    /// Когда менялись свойства диалога (UTC).
    /// </summary>
    public DateTime UpdatedAtUtc
    {
        get => _updatedAtUtc;
        set => SetPropertyValue(nameof(UpdatedAtUtc), ref _updatedAtUtc, value);
    }

    /// <summary>
    /// Время последнего сообщения (UTC), для сортировки списка диалогов.
    /// </summary>
    [Indexed]
    public DateTime LastMessageAtUtc
    {
        get => _lastMessageAtUtc;
        set => SetPropertyValue(nameof(LastMessageAtUtc), ref _lastMessageAtUtc, value);
    }

    /// <summary>
    /// Id последнего сообщения; 0 — сообщений нет.
    /// </summary>
    public int LastMessageId
    {
        get => _lastMessageId;
        set => SetPropertyValue(nameof(LastMessageId), ref _lastMessageId, value);
    }

    /// <summary>
    /// Закрепленное сообщение (0 — нет), видно всем участникам над лентой.
    /// </summary>
    public int PinnedMessageId
    {
        get => _pinnedMessageId;
        set => SetPropertyValue(nameof(PinnedMessageId), ref _pinnedMessageId, value);
    }

    /// <summary>
    /// Legacy-id сотрудника, закрепившего сообщение.
    /// </summary>
    public int PinnedByUserId
    {
        get => _pinnedByUserId;
        set => SetPropertyValue(nameof(PinnedByUserId), ref _pinnedByUserId, value);
    }

    /// <summary>
    /// Когда сообщение закреплено (UTC).
    /// </summary>
    public DateTime? PinnedAtUtc
    {
        get => _pinnedAtUtc;
        set => SetPropertyValue(nameof(PinnedAtUtc), ref _pinnedAtUtc, value);
    }

    /// <summary>
    /// Диалог удален (например, из группы вышли все участники).
    /// </summary>
    public bool IsRemoved
    {
        get => _isRemoved;
        set => SetPropertyValue(nameof(IsRemoved), ref _isRemoved, value);
    }
}

/// <summary>
/// Участник диалога и его персональные настройки этого диалога.
/// </summary>
[Persistent("ChatParticipant")]
public class ChatParticipant(Session session) : XPObject(session)
{
    private ChatConversation? _conversation;
    private int _userId;
    private ChatParticipantRole _role;
    private DateTime _joinedAtUtc;
    private DateTime? _leftAtUtc;
    private int _lastReadMessageId;
    private DateTime? _lastReadAtUtc;
    private bool _isMuted;
    private bool _isPinned;
    private bool _isArchived;

    public ChatParticipant() : this(Session.DefaultSession) { }

    /// <summary>
    /// Диалог.
    /// </summary>
    [Indexed]
    public ChatConversation? Conversation
    {
        get => _conversation;
        set => SetPropertyValue(nameof(Conversation), ref _conversation, value);
    }

    /// <summary>
    /// Legacy-id сотрудника.
    /// </summary>
    [Indexed]
    public int UserId
    {
        get => _userId;
        set => SetPropertyValue(nameof(UserId), ref _userId, value);
    }

    /// <summary>
    /// Роль в групповом чате.
    /// </summary>
    public ChatParticipantRole Role
    {
        get => _role;
        set => SetPropertyValue(nameof(Role), ref _role, value);
    }

    /// <summary>
    /// Когда добавлен (UTC).
    /// </summary>
    public DateTime JoinedAtUtc
    {
        get => _joinedAtUtc;
        set => SetPropertyValue(nameof(JoinedAtUtc), ref _joinedAtUtc, value);
    }

    /// <summary>
    /// Когда вышел или был исключен (UTC); null — состоит в диалоге.
    /// </summary>
    public DateTime? LeftAtUtc
    {
        get => _leftAtUtc;
        set => SetPropertyValue(nameof(LeftAtUtc), ref _leftAtUtc, value);
    }

    /// <summary>
    /// Id последнего прочитанного сообщения.
    /// </summary>
    public int LastReadMessageId
    {
        get => _lastReadMessageId;
        set => SetPropertyValue(nameof(LastReadMessageId), ref _lastReadMessageId, value);
    }

    /// <summary>
    /// Когда последний раз читал диалог (UTC).
    /// </summary>
    public DateTime? LastReadAtUtc
    {
        get => _lastReadAtUtc;
        set => SetPropertyValue(nameof(LastReadAtUtc), ref _lastReadAtUtc, value);
    }

    /// <summary>
    /// Оповещения по диалогу отключены.
    /// </summary>
    public bool IsMuted
    {
        get => _isMuted;
        set => SetPropertyValue(nameof(IsMuted), ref _isMuted, value);
    }

    /// <summary>
    /// Диалог закреплен вверху списка.
    /// </summary>
    public bool IsPinned
    {
        get => _isPinned;
        set => SetPropertyValue(nameof(IsPinned), ref _isPinned, value);
    }

    /// <summary>
    /// Диалог убран в архив (вернется при новом сообщении).
    /// </summary>
    public bool IsArchived
    {
        get => _isArchived;
        set => SetPropertyValue(nameof(IsArchived), ref _isArchived, value);
    }
}

/// <summary>
/// Сообщение в диалоге.
/// </summary>
[Persistent("ChatMessage")]
public class ChatMessage(Session session) : XPObject(session)
{
    private ChatConversation? _conversation;
    private int _senderUserId;
    private ChatMessageKind _kind;
    private string? _text;
    private int _replyToMessageId;
    private string? _clientMessageId;
    private DateTime _createdAtUtc;
    private DateTime? _editedAtUtc;
    private DateTime? _deletedAtUtc;

    public ChatMessage() : this(Session.DefaultSession) { }

    /// <summary>
    /// Диалог.
    /// </summary>
    [Indexed]
    public ChatConversation? Conversation
    {
        get => _conversation;
        set => SetPropertyValue(nameof(Conversation), ref _conversation, value);
    }

    /// <summary>
    /// Legacy-id отправителя; 0 — системное сообщение.
    /// </summary>
    [Indexed]
    public int SenderUserId
    {
        get => _senderUserId;
        set => SetPropertyValue(nameof(SenderUserId), ref _senderUserId, value);
    }

    /// <summary>
    /// Тип сообщения.
    /// </summary>
    public ChatMessageKind Kind
    {
        get => _kind;
        set => SetPropertyValue(nameof(Kind), ref _kind, value);
    }

    /// <summary>
    /// Текст сообщения.
    /// </summary>
    [Size(SizeAttribute.Unlimited)]
    public string? Text
    {
        get => _text;
        set => SetPropertyValue(nameof(Text), ref _text, value);
    }

    /// <summary>
    /// Id сообщения, на которое дан ответ; 0 — не ответ.
    /// </summary>
    public int ReplyToMessageId
    {
        get => _replyToMessageId;
        set => SetPropertyValue(nameof(ReplyToMessageId), ref _replyToMessageId, value);
    }

    /// <summary>
    /// Id, сгенерированный клиентом, — защита от дублей при повторной отправке.
    /// </summary>
    [Size(64)]
    [Indexed]
    public string? ClientMessageId
    {
        get => _clientMessageId;
        set => SetPropertyValue(nameof(ClientMessageId), ref _clientMessageId, value);
    }

    /// <summary>
    /// Когда отправлено (UTC).
    /// </summary>
    [Indexed]
    public DateTime CreatedAtUtc
    {
        get => _createdAtUtc;
        set => SetPropertyValue(nameof(CreatedAtUtc), ref _createdAtUtc, value);
    }

    /// <summary>
    /// Когда отредактировано (UTC).
    /// </summary>
    public DateTime? EditedAtUtc
    {
        get => _editedAtUtc;
        set => SetPropertyValue(nameof(EditedAtUtc), ref _editedAtUtc, value);
    }

    /// <summary>
    /// Когда удалено (UTC); текст и вложения удаленного сообщения не выдаются.
    /// </summary>
    public DateTime? DeletedAtUtc
    {
        get => _deletedAtUtc;
        set => SetPropertyValue(nameof(DeletedAtUtc), ref _deletedAtUtc, value);
    }
}

/// <summary>
/// Файл, прикрепленный к сообщению. Загружается до отправки, затем привязывается к сообщению.
/// </summary>
[Persistent("ChatAttachment")]
public class ChatAttachment(Session session) : XPObject(session)
{
    private ChatConversation? _conversation;
    private ChatMessage? _message;
    private int _uploadedByUserId;
    private string? _originalFileName;
    private string? _storedFileName;
    private string? _relativePath;
    private string? _contentType;
    private long _length;
    private string? _sha256;
    private int _sortOrder;
    private DateTime _uploadedAtUtc;
    private string? _thumbnailRelativePath;
    private string? _thumbnailContentType;
    private long _thumbnailLength;
    private int _imageWidth;
    private int _imageHeight;

    public ChatAttachment() : this(Session.DefaultSession) { }

    /// <summary>
    /// Диалог, в который загружен файл.
    /// </summary>
    [Indexed]
    public ChatConversation? Conversation
    {
        get => _conversation;
        set => SetPropertyValue(nameof(Conversation), ref _conversation, value);
    }

    /// <summary>
    /// Сообщение; null — файл загружен, но еще не отправлен.
    /// </summary>
    [Indexed]
    public ChatMessage? Message
    {
        get => _message;
        set => SetPropertyValue(nameof(Message), ref _message, value);
    }

    /// <summary>
    /// Legacy-id загрузившего.
    /// </summary>
    public int UploadedByUserId
    {
        get => _uploadedByUserId;
        set => SetPropertyValue(nameof(UploadedByUserId), ref _uploadedByUserId, value);
    }

    /// <summary>
    /// Имя файла у пользователя.
    /// </summary>
    [Size(512)]
    public string? OriginalFileName
    {
        get => _originalFileName;
        set => SetPropertyValue(nameof(OriginalFileName), ref _originalFileName, value);
    }

    /// <summary>
    /// Имя файла в хранилище.
    /// </summary>
    [Size(256)]
    public string? StoredFileName
    {
        get => _storedFileName;
        set => SetPropertyValue(nameof(StoredFileName), ref _storedFileName, value);
    }

    /// <summary>
    /// Путь в хранилище относительно каталога чата.
    /// </summary>
    [Size(1024)]
    public string? RelativePath
    {
        get => _relativePath;
        set => SetPropertyValue(nameof(RelativePath), ref _relativePath, value);
    }

    /// <summary>
    /// MIME-тип.
    /// </summary>
    [Size(256)]
    public string? ContentType
    {
        get => _contentType;
        set => SetPropertyValue(nameof(ContentType), ref _contentType, value);
    }

    /// <summary>
    /// Размер в байтах.
    /// </summary>
    public long Length
    {
        get => _length;
        set => SetPropertyValue(nameof(Length), ref _length, value);
    }

    /// <summary>
    /// SHA-256 содержимого.
    /// </summary>
    [Size(64)]
    public string? Sha256
    {
        get => _sha256;
        set => SetPropertyValue(nameof(Sha256), ref _sha256, value);
    }

    /// <summary>
    /// Порядок в сообщении.
    /// </summary>
    public int SortOrder
    {
        get => _sortOrder;
        set => SetPropertyValue(nameof(SortOrder), ref _sortOrder, value);
    }

    /// <summary>
    /// Когда загружен (UTC).
    /// </summary>
    public DateTime UploadedAtUtc
    {
        get => _uploadedAtUtc;
        set => SetPropertyValue(nameof(UploadedAtUtc), ref _uploadedAtUtc, value);
    }

    /// <summary>
    /// Уменьшенная копия изображения для ленты (путь в хранилище); null — копии нет, показывается оригинал.
    /// </summary>
    [Size(1024)]
    public string? ThumbnailRelativePath
    {
        get => _thumbnailRelativePath;
        set => SetPropertyValue(nameof(ThumbnailRelativePath), ref _thumbnailRelativePath, value);
    }

    /// <summary>
    /// MIME-тип уменьшенной копии.
    /// </summary>
    [Size(64)]
    public string? ThumbnailContentType
    {
        get => _thumbnailContentType;
        set => SetPropertyValue(nameof(ThumbnailContentType), ref _thumbnailContentType, value);
    }

    /// <summary>
    /// Размер уменьшенной копии в байтах.
    /// </summary>
    public long ThumbnailLength
    {
        get => _thumbnailLength;
        set => SetPropertyValue(nameof(ThumbnailLength), ref _thumbnailLength, value);
    }

    /// <summary>
    /// Ширина оригинала в пикселях (0 — неизвестна), чтобы лента заранее резервировала место.
    /// </summary>
    public int ImageWidth
    {
        get => _imageWidth;
        set => SetPropertyValue(nameof(ImageWidth), ref _imageWidth, value);
    }

    /// <summary>
    /// Высота оригинала в пикселях (0 — неизвестна).
    /// </summary>
    public int ImageHeight
    {
        get => _imageHeight;
        set => SetPropertyValue(nameof(ImageHeight), ref _imageHeight, value);
    }
}

/// <summary>
/// Реакция сотрудника на сообщение.
/// </summary>
[Persistent("ChatReaction")]
public class ChatReaction(Session session) : XPObject(session)
{
    private ChatMessage? _message;
    private int _userId;
    private string? _emoji;
    private DateTime _createdAtUtc;

    public ChatReaction() : this(Session.DefaultSession) { }

    /// <summary>
    /// Сообщение.
    /// </summary>
    [Indexed]
    public ChatMessage? Message
    {
        get => _message;
        set => SetPropertyValue(nameof(Message), ref _message, value);
    }

    /// <summary>
    /// Legacy-id сотрудника.
    /// </summary>
    public int UserId
    {
        get => _userId;
        set => SetPropertyValue(nameof(UserId), ref _userId, value);
    }

    /// <summary>
    /// Эмодзи реакции.
    /// </summary>
    [Size(32)]
    public string? Emoji
    {
        get => _emoji;
        set => SetPropertyValue(nameof(Emoji), ref _emoji, value);
    }

    /// <summary>
    /// Когда поставлена (UTC).
    /// </summary>
    public DateTime CreatedAtUtc
    {
        get => _createdAtUtc;
        set => SetPropertyValue(nameof(CreatedAtUtc), ref _createdAtUtc, value);
    }
}

/// <summary>
/// Настройки оповещений и плавающего окна чата для сотрудника.
/// </summary>
[Persistent("ChatUserSettings")]
public class ChatUserSettings(Session session) : XPObject(session)
{
    private int _userId;
    private bool _notificationsEnabled;
    private bool _soundEnabled;
    private string? _soundName;
    private int _soundVolume;
    private bool _showMessagePreview;
    private bool _desktopNotificationsEnabled;
    private bool _dockOpen;
    private int _dockConversationId;
    private int _dockWidth;
    private int _dockHeight;
    private DateTime _updatedAtUtc;

    public ChatUserSettings() : this(Session.DefaultSession) { }

    /// <summary>
    /// Legacy-id сотрудника.
    /// </summary>
    [Indexed]
    public int UserId
    {
        get => _userId;
        set => SetPropertyValue(nameof(UserId), ref _userId, value);
    }

    /// <summary>
    /// Показывать оповещения о новых сообщениях.
    /// </summary>
    public bool NotificationsEnabled
    {
        get => _notificationsEnabled;
        set => SetPropertyValue(nameof(NotificationsEnabled), ref _notificationsEnabled, value);
    }

    /// <summary>
    /// Проигрывать звук.
    /// </summary>
    public bool SoundEnabled
    {
        get => _soundEnabled;
        set => SetPropertyValue(nameof(SoundEnabled), ref _soundEnabled, value);
    }

    /// <summary>
    /// Выбранный звук.
    /// </summary>
    [Size(64)]
    public string? SoundName
    {
        get => _soundName;
        set => SetPropertyValue(nameof(SoundName), ref _soundName, value);
    }

    /// <summary>
    /// Громкость 0–100.
    /// </summary>
    public int SoundVolume
    {
        get => _soundVolume;
        set => SetPropertyValue(nameof(SoundVolume), ref _soundVolume, value);
    }

    /// <summary>
    /// Показывать текст сообщения в оповещении.
    /// </summary>
    public bool ShowMessagePreview
    {
        get => _showMessagePreview;
        set => SetPropertyValue(nameof(ShowMessagePreview), ref _showMessagePreview, value);
    }

    /// <summary>
    /// Системные оповещения браузера, когда вкладка в фоне.
    /// </summary>
    public bool DesktopNotificationsEnabled
    {
        get => _desktopNotificationsEnabled;
        set => SetPropertyValue(nameof(DesktopNotificationsEnabled), ref _desktopNotificationsEnabled, value);
    }

    /// <summary>
    /// Плавающее окно чата развернуто.
    /// </summary>
    public bool DockOpen
    {
        get => _dockOpen;
        set => SetPropertyValue(nameof(DockOpen), ref _dockOpen, value);
    }

    /// <summary>
    /// Диалог, открытый в плавающем окне; 0 — список диалогов.
    /// </summary>
    public int DockConversationId
    {
        get => _dockConversationId;
        set => SetPropertyValue(nameof(DockConversationId), ref _dockConversationId, value);
    }

    /// <summary>
    /// Ширина плавающего окна в пикселях; 0 — стандартная.
    /// </summary>
    public int DockWidth
    {
        get => _dockWidth;
        set => SetPropertyValue(nameof(DockWidth), ref _dockWidth, value);
    }

    /// <summary>
    /// Высота плавающего окна в пикселях; 0 — стандартная.
    /// </summary>
    public int DockHeight
    {
        get => _dockHeight;
        set => SetPropertyValue(nameof(DockHeight), ref _dockHeight, value);
    }

    /// <summary>
    /// Когда менялись (UTC).
    /// </summary>
    public DateTime UpdatedAtUtc
    {
        get => _updatedAtUtc;
        set => SetPropertyValue(nameof(UpdatedAtUtc), ref _updatedAtUtc, value);
    }
}

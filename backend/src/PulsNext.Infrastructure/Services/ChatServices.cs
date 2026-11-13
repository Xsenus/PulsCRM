using System.Globalization;
using DevExpress.Xpo;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Chat;
using PulsNext.Domain.Legacy;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

public sealed class ChatUnitOfWork(IDataLayer dataLayer, params IDisposable[] disposeOnDisconnect) : UnitOfWork(dataLayer, disposeOnDisconnect);

/// <summary>
/// Справочник сотрудников для чата: имена и признак «уволен» из legacy-БД.
/// </summary>
public interface IChatUserDirectory
{
    IReadOnlyDictionary<int, ChatUserDto> GetUsers(IEnumerable<int> userIds);
    IReadOnlyCollection<ChatUserDto> Search(string? search, int take);
}

/// <summary>
/// Рассылка событий чата участникам в реальном времени.
/// </summary>
public interface IChatEventPublisher
{
    Task PublishAsync(IReadOnlyCollection<int> userIds, string eventName, object payload, CancellationToken cancellationToken);
}

/// <summary>
/// Хранилище содержимого вложений чата.
/// </summary>
public interface IChatFileStore
{
    Task<string> SaveAsync(byte[] content, string storedFileName, DateTime nowUtc, CancellationToken cancellationToken);
    Stream OpenRead(string relativePath);
    void Delete(string relativePath);
}

public interface IChatService
{
    ChatStatusDto GetStatus();
    IReadOnlyCollection<ChatUserDto> SearchUsers(string? search, int take);
    Task<IReadOnlyCollection<ChatConversationDto>> GetConversationsAsync(bool includeArchived, CancellationToken cancellationToken);
    Task<ChatConversationDto> GetConversationAsync(int conversationId, CancellationToken cancellationToken);
    Task<ChatConversationDto> OpenDirectAsync(int userId, CancellationToken cancellationToken);
    Task<ChatConversationDto> CreateGroupAsync(ChatCreateGroupRequest request, CancellationToken cancellationToken);
    Task<ChatConversationDto> UpdateGroupAsync(int conversationId, ChatUpdateGroupRequest request, CancellationToken cancellationToken);
    Task<ChatConversationDto> AddMembersAsync(int conversationId, IReadOnlyCollection<int> userIds, CancellationToken cancellationToken);
    Task<ChatConversationDto> RemoveMemberAsync(int conversationId, int userId, CancellationToken cancellationToken);
    Task<ChatConversationDto> SetMemberRoleAsync(int conversationId, int userId, ChatParticipantRole role, CancellationToken cancellationToken);
    Task LeaveAsync(int conversationId, CancellationToken cancellationToken);
    Task<ChatConversationDto> UpdatePreferencesAsync(int conversationId, ChatConversationPreferencesRequest request, CancellationToken cancellationToken);
    Task<ChatMessagePageDto> GetMessagesAsync(int conversationId, int? beforeMessageId, int take, CancellationToken cancellationToken);
    Task<ChatMessageDto> SendMessageAsync(int conversationId, ChatSendMessageRequest request, CancellationToken cancellationToken);
    Task<ChatMessageDto> EditMessageAsync(int messageId, string? text, CancellationToken cancellationToken);
    Task<ChatMessageDto> DeleteMessageAsync(int messageId, CancellationToken cancellationToken);
    Task<ChatMessageDto> ToggleReactionAsync(int messageId, string? emoji, CancellationToken cancellationToken);
    Task MarkReadAsync(int conversationId, int? messageId, CancellationToken cancellationToken);
    Task<ChatUnreadSummaryDto> GetUnreadSummaryAsync(CancellationToken cancellationToken);
    Task<ChatAttachmentDto> UploadAttachmentAsync(int conversationId, ChatAttachmentUploadCommand command, CancellationToken cancellationToken);
    Task<(ChatAttachmentDto Metadata, Stream Content)?> OpenAttachmentAsync(int attachmentId, CancellationToken cancellationToken);
    Task DeletePendingAttachmentAsync(int attachmentId, CancellationToken cancellationToken);
    /// <summary>
    /// Рассылает «печатает». <paramref name="userId"/> передает SignalR-хаб, где HttpContext недоступен;
    /// null — текущий пользователь HTTP-запроса.
    /// </summary>
    Task NotifyTypingAsync(int conversationId, int? userId, CancellationToken cancellationToken);
    Task<ChatUserSettingsDto> GetSettingsAsync(CancellationToken cancellationToken);
    Task<ChatUserSettingsDto> UpdateSettingsAsync(ChatUserSettingsDto request, CancellationToken cancellationToken);
}

/// <summary>
/// Обращается к legacy-БД лениво: запросы чата, которым не нужны имена (настройки, счетчик непрочитанных),
/// не открывают подключение к SQL Server. В пределах запроса имена кэшируются.
/// </summary>
public sealed class LegacyChatUserDirectory(Lazy<LegacyUnitOfWork> legacyUnitOfWork) : IChatUserDirectory
{
    private const string FiredGroupName = "Уволенные";
    private readonly Dictionary<int, ChatUserDto?> _cache = new();

    public IReadOnlyDictionary<int, ChatUserDto> GetUsers(IEnumerable<int> userIds)
    {
        var ids = userIds.Where(id => id > 0).Distinct().ToArray();
        var missing = ids.Where(id => !_cache.ContainsKey(id)).ToArray();
        if (missing.Length > 0)
        {
            var loaded = new XPQuery<LegacyUser>(legacyUnitOfWork.Value)
                .Where(x => missing.Contains(x.Oid))
                .ToList()
                .ToDictionary(x => x.Oid, ToDto);
            foreach (var id in missing)
            {
                _cache[id] = loaded.GetValueOrDefault(id);
            }
        }

        return ids
            .Select(id => _cache[id])
            .Where(x => x is not null)
            .ToDictionary(x => x!.Id, x => x!);
    }

    public IReadOnlyCollection<ChatUserDto> Search(string? search, int take)
    {
        var term = TextHelper.NullIfWhiteSpace(search);
        return new XPQuery<LegacyUser>(legacyUnitOfWork.Value)
            .ToList()
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .Where(x => !IsFired(x))
            .Where(x => term is null
                || (x.Name ?? string.Empty).Contains(term, StringComparison.OrdinalIgnoreCase)
                || (x.FullName ?? string.Empty).Contains(term, StringComparison.OrdinalIgnoreCase))
            .Select(ToDto)
            .OrderBy(x => x.DisplayName, StringComparer.CurrentCultureIgnoreCase)
            .Take(Math.Clamp(take, 1, 200))
            .ToArray();
    }

    private static bool IsFired(LegacyUser user)
        => string.Equals(user.UserGroup?.Name, FiredGroupName, StringComparison.OrdinalIgnoreCase);

    private static ChatUserDto ToDto(LegacyUser user)
        => new()
        {
            Id = user.Oid,
            Login = user.Name ?? string.Empty,
            DisplayName = TextHelper.NullIfWhiteSpace(user.FullName) ?? user.Name ?? $"Сотрудник #{user.Oid}",
            GroupName = user.UserGroup?.Name,
            IsInactive = IsFired(user)
        };
}

public sealed class NullChatEventPublisher : IChatEventPublisher
{
    public Task PublishAsync(IReadOnlyCollection<int> userIds, string eventName, object payload, CancellationToken cancellationToken)
        => Task.CompletedTask;
}

public sealed class DiskChatFileStore(IHostEnvironment hostEnvironment, IOptions<StorageOptions> storageOptions, IOptions<ChatOptions> chatOptions) : IChatFileStore
{
    public async Task<string> SaveAsync(byte[] content, string storedFileName, DateTime nowUtc, CancellationToken cancellationToken)
    {
        var relativeDirectory = Path.Combine(nowUtc.ToString("yyyy", CultureInfo.InvariantCulture), nowUtc.ToString("MM", CultureInfo.InvariantCulture));
        var absolutePath = Path.Combine(GetRoot(), relativeDirectory, storedFileName);
        Directory.CreateDirectory(Path.GetDirectoryName(absolutePath)!);
        await File.WriteAllBytesAsync(absolutePath, content, cancellationToken);
        return Path.Combine(relativeDirectory, storedFileName).Replace('\\', '/');
    }

    public Stream OpenRead(string relativePath)
    {
        var path = GetAbsolutePath(relativePath);
        if (!File.Exists(path))
        {
            throw new FileNotFoundException("Файл вложения не найден в хранилище.", path);
        }

        return File.OpenRead(path);
    }

    public void Delete(string relativePath)
    {
        var path = GetAbsolutePath(relativePath);
        if (File.Exists(path))
        {
            File.Delete(path);
        }
    }

    private string GetAbsolutePath(string relativePath)
    {
        var root = GetRoot();
        var path = Path.GetFullPath(Path.Combine(root, relativePath.Replace('/', Path.DirectorySeparatorChar)));
        if (!path.StartsWith(root, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Недопустимый путь вложения.");
        }

        return path;
    }

    private string GetRoot()
    {
        var root = StoragePathHelper.GetAbsolutePath(hostEnvironment.ContentRootPath, storageOptions.Value.RootPath, chatOptions.Value.StoragePath);
        Directory.CreateDirectory(root);
        return root.EndsWith(Path.DirectorySeparatorChar) ? root : root + Path.DirectorySeparatorChar;
    }
}

public sealed class ChatService(
    ChatUnitOfWork unitOfWork,
    ICurrentUserAccessor currentUserAccessor,
    IChatUserDirectory userDirectory,
    IChatEventPublisher eventPublisher,
    IChatFileStore fileStore,
    IOptions<ChatOptions> chatOptions) : IChatService
{
    private const int MaxTitleLength = 256;
    private const int MaxDescriptionLength = 1024;
    private const int MaxIconLength = 32;
    private const int MaxEmojiLength = 32;

    private static readonly HashSet<string> ImageContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"
    };

    private ChatOptions Options => chatOptions.Value;

    private int CurrentUserId => currentUserAccessor.GetLegacyUserId()
        ?? throw new UnauthorizedAccessException("Пользователь не определен.");

    public ChatStatusDto GetStatus()
        => new()
        {
            Enabled = true,
            CurrentUserId = CurrentUserId,
            MaxAttachmentBytes = Options.MaxAttachmentBytes,
            MaxAttachmentsPerMessage = Options.MaxAttachmentsPerMessage,
            MaxMessageLength = Options.MaxMessageLength
        };

    public IReadOnlyCollection<ChatUserDto> SearchUsers(string? search, int take)
    {
        var me = CurrentUserId;
        return userDirectory.Search(search, take + 1)
            .Where(x => x.Id != me)
            .Take(Math.Clamp(take, 1, 200))
            .ToArray();
    }

    public Task<IReadOnlyCollection<ChatConversationDto>> GetConversationsAsync(bool includeArchived, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var myParticipations = new XPQuery<ChatParticipant>(unitOfWork)
            .Where(x => x.UserId == me && x.LeftAtUtc == null && x.Conversation != null && !x.Conversation.IsRemoved)
            .ToList()
            .Where(x => includeArchived || !x.IsArchived)
            .ToList();

        var hidden = GetHiddenDirectConversationIds(myParticipations.Select(x => x.Conversation!), me);
        var conversations = myParticipations.Select(x => x.Conversation!).Where(x => !hidden.Contains(x.Oid)).ToList();
        var result = BuildConversationDtos(conversations, me)
            .OrderByDescending(x => x.IsPinned)
            .ThenByDescending(x => x.LastMessageAtUtc)
            .ToArray();

        return Task.FromResult<IReadOnlyCollection<ChatConversationDto>>(result);
    }

    public Task<ChatConversationDto> GetConversationAsync(int conversationId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var (conversation, _) = RequireMembership(conversationId, me);
        return Task.FromResult(BuildConversationDtos([conversation], me).Single());
    }

    public async Task<ChatConversationDto> OpenDirectAsync(int userId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        ValidationHelper.Guard(userId > 0 && userId != me, "Выберите собеседника.");

        var peer = userDirectory.GetUsers([userId]).GetValueOrDefault(userId);
        if (peer is null)
        {
            throw new KeyNotFoundException("Сотрудник не найден.");
        }

        ValidationHelper.Guard(!peer.IsInactive, "Сотрудник уволен, переписка с ним недоступна.");
        var key = BuildDirectKey(me, userId);
        var conversation = new XPQuery<ChatConversation>(unitOfWork)
            .FirstOrDefault(x => x.DirectKey == key && !x.IsRemoved);

        if (conversation is null)
        {
            var now = DateTime.UtcNow;
            conversation = new ChatConversation(unitOfWork)
            {
                Kind = ChatConversationKind.Direct,
                DirectKey = key,
                CreatedByUserId = me,
                CreatedAtUtc = now,
                UpdatedAtUtc = now,
                LastMessageAtUtc = now
            };

            AddParticipant(conversation, me, ChatParticipantRole.Member, now);
            AddParticipant(conversation, userId, ChatParticipantRole.Member, now);
            unitOfWork.CommitChanges();
        }
        else
        {
            var mine = FindParticipant(conversation.Oid, me);
            if (mine is { IsArchived: true })
            {
                mine.IsArchived = false;
                unitOfWork.CommitChanges();
            }
        }

        await Task.CompletedTask;
        return BuildConversationDtos([conversation], me).Single();
    }

    public async Task<ChatConversationDto> CreateGroupAsync(ChatCreateGroupRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var me = CurrentUserId;
        var title = NormalizeRequired(request.Title, MaxTitleLength, "Введите название чата.", "Название чата слишком длинное.");
        var description = NormalizeOptional(request.Description, MaxDescriptionLength, "Описание чата слишком длинное.");
        var icon = NormalizeOptional(request.Icon, MaxIconLength, "Иконка чата слишком длинная.");

        var memberIds = (request.MemberUserIds ?? Array.Empty<int>()).Where(x => x > 0 && x != me).Distinct().ToArray();
        ValidationHelper.Guard(memberIds.Length + 1 <= Options.MaxGroupMembers, $"В групповом чате может быть не больше {Options.MaxGroupMembers} участников.");
        var members = RequireActiveUsers(memberIds);

        var now = DateTime.UtcNow;
        var conversation = new ChatConversation(unitOfWork)
        {
            Kind = ChatConversationKind.Group,
            Title = title,
            Description = description,
            Icon = icon,
            CreatedByUserId = me,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
            LastMessageAtUtc = now
        };

        AddParticipant(conversation, me, ChatParticipantRole.Owner, now);
        foreach (var member in members)
        {
            AddParticipant(conversation, member.Id, ChatParticipantRole.Member, now);
        }

        AddSystemMessage(conversation, $"{GetDisplayName(me)} создал(а) чат «{title}»", now);
        unitOfWork.CommitChanges();

        await PublishConversationUpdatedAsync(conversation, cancellationToken);
        return BuildConversationDtos([conversation], me).Single();
    }

    public async Task<ChatConversationDto> UpdateGroupAsync(int conversationId, ChatUpdateGroupRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var me = CurrentUserId;
        var (conversation, mine) = RequireGroupAdmin(conversationId, me);

        var title = NormalizeRequired(request.Title, MaxTitleLength, "Введите название чата.", "Название чата слишком длинное.");
        var description = NormalizeOptional(request.Description, MaxDescriptionLength, "Описание чата слишком длинное.");
        var icon = NormalizeOptional(request.Icon, MaxIconLength, "Иконка чата слишком длинная.");
        var now = DateTime.UtcNow;

        if (!string.Equals(conversation.Title, title, StringComparison.Ordinal))
        {
            AddSystemMessage(conversation, $"{GetDisplayName(mine.UserId)} переименовал(а) чат в «{title}»", now);
        }

        conversation.Title = title;
        conversation.Description = description;
        conversation.Icon = icon;
        conversation.UpdatedAtUtc = now;
        unitOfWork.CommitChanges();

        await PublishConversationUpdatedAsync(conversation, cancellationToken);
        return BuildConversationDtos([conversation], me).Single();
    }

    public async Task<ChatConversationDto> AddMembersAsync(int conversationId, IReadOnlyCollection<int> userIds, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var (conversation, _) = RequireGroupAdmin(conversationId, me);
        var now = DateTime.UtcNow;

        var participants = GetParticipants(conversation.Oid);
        var activeIds = participants.Where(x => x.LeftAtUtc == null).Select(x => x.UserId).ToHashSet();
        var newIds = (userIds ?? Array.Empty<int>()).Where(x => x > 0 && !activeIds.Contains(x)).Distinct().ToArray();
        ValidationHelper.Guard(newIds.Length > 0, "Выберите сотрудников, которых нужно добавить.");
        ValidationHelper.Guard(activeIds.Count + newIds.Length <= Options.MaxGroupMembers, $"В групповом чате может быть не больше {Options.MaxGroupMembers} участников.");

        var users = RequireActiveUsers(newIds);
        foreach (var user in users)
        {
            var existing = participants.FirstOrDefault(x => x.UserId == user.Id);
            if (existing is null)
            {
                AddParticipant(conversation, user.Id, ChatParticipantRole.Member, now);
            }
            else
            {
                existing.LeftAtUtc = null;
                existing.JoinedAtUtc = now;
                existing.Role = ChatParticipantRole.Member;
                existing.IsArchived = false;
            }
        }

        AddSystemMessage(conversation, $"{GetDisplayName(me)} добавил(а) в чат: {string.Join(", ", users.Select(x => x.DisplayName))}", now);
        conversation.UpdatedAtUtc = now;
        unitOfWork.CommitChanges();

        await PublishConversationUpdatedAsync(conversation, cancellationToken);
        return BuildConversationDtos([conversation], me).Single();
    }

    public async Task<ChatConversationDto> RemoveMemberAsync(int conversationId, int userId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        ValidationHelper.Guard(userId != me, "Чтобы выйти из чата, используйте «Покинуть чат».");
        var (conversation, mine) = RequireGroupAdmin(conversationId, me);
        var target = FindParticipant(conversation.Oid, userId);
        if (target is null || target.LeftAtUtc is not null)
        {
            throw new KeyNotFoundException("Участник не найден.");
        }

        ValidationHelper.Guard(target.Role != ChatParticipantRole.Owner, "Создателя чата исключить нельзя.");
        ValidationHelper.Guard(mine.Role == ChatParticipantRole.Owner || target.Role == ChatParticipantRole.Member, "Исключить администратора может только создатель чата.");

        var now = DateTime.UtcNow;
        target.LeftAtUtc = now;
        AddSystemMessage(conversation, $"{GetDisplayName(me)} исключил(а) из чата: {GetDisplayName(userId)}", now);
        conversation.UpdatedAtUtc = now;
        unitOfWork.CommitChanges();

        await eventPublisher.PublishAsync([userId], ChatEventNames.ConversationRemoved, new ChatConversationRemovedEventDto { ConversationId = conversation.Oid }, cancellationToken);
        await PublishConversationUpdatedAsync(conversation, cancellationToken);
        return BuildConversationDtos([conversation], me).Single();
    }

    public async Task<ChatConversationDto> SetMemberRoleAsync(int conversationId, int userId, ChatParticipantRole role, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var (conversation, mine) = RequireGroupAdmin(conversationId, me);
        ValidationHelper.Guard(mine.Role == ChatParticipantRole.Owner, "Назначать администраторов может только создатель чата.");
        ValidationHelper.Guard(role is ChatParticipantRole.Member or ChatParticipantRole.Admin, "Недопустимая роль.");
        var target = FindParticipant(conversation.Oid, userId);
        if (target is null || target.LeftAtUtc is not null)
        {
            throw new KeyNotFoundException("Участник не найден.");
        }

        ValidationHelper.Guard(target.Role != ChatParticipantRole.Owner, "Роль создателя чата изменить нельзя.");
        target.Role = role;
        conversation.UpdatedAtUtc = DateTime.UtcNow;
        unitOfWork.CommitChanges();

        await PublishConversationUpdatedAsync(conversation, cancellationToken);
        return BuildConversationDtos([conversation], me).Single();
    }

    public async Task LeaveAsync(int conversationId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var (conversation, mine) = RequireMembership(conversationId, me);
        ValidationHelper.Guard(conversation.Kind == ChatConversationKind.Group, "Из личного диалога выйти нельзя — его можно убрать в архив.");

        var now = DateTime.UtcNow;
        mine.LeftAtUtc = now;
        var remaining = GetParticipants(conversation.Oid).Where(x => x.LeftAtUtc == null && x.UserId != me).ToList();

        if (remaining.Count == 0)
        {
            conversation.IsRemoved = true;
        }
        else if (mine.Role == ChatParticipantRole.Owner)
        {
            var heir = remaining
                .OrderByDescending(x => x.Role)
                .ThenBy(x => x.JoinedAtUtc)
                .First();
            heir.Role = ChatParticipantRole.Owner;
        }

        mine.Role = ChatParticipantRole.Member;
        if (!conversation.IsRemoved)
        {
            AddSystemMessage(conversation, $"{GetDisplayName(me)} покинул(а) чат", now);
        }

        conversation.UpdatedAtUtc = now;
        unitOfWork.CommitChanges();

        await eventPublisher.PublishAsync([me], ChatEventNames.ConversationRemoved, new ChatConversationRemovedEventDto { ConversationId = conversation.Oid }, cancellationToken);
        if (!conversation.IsRemoved)
        {
            await PublishConversationUpdatedAsync(conversation, cancellationToken);
        }
    }

    public Task<ChatConversationDto> UpdatePreferencesAsync(int conversationId, ChatConversationPreferencesRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var me = CurrentUserId;
        var (conversation, mine) = RequireMembership(conversationId, me);

        if (request.IsMuted is { } muted)
        {
            mine.IsMuted = muted;
        }

        if (request.IsPinned is { } pinned)
        {
            mine.IsPinned = pinned;
        }

        if (request.IsArchived is { } archived)
        {
            mine.IsArchived = archived;
        }

        unitOfWork.CommitChanges();
        return Task.FromResult(BuildConversationDtos([conversation], me).Single());
    }

    public Task<ChatMessagePageDto> GetMessagesAsync(int conversationId, int? beforeMessageId, int take, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var (conversation, _) = RequireMembership(conversationId, me);
        var size = Math.Clamp(take <= 0 ? Options.PageSize : take, 1, 200);

        var query = new XPQuery<ChatMessage>(unitOfWork).Where(x => x.Conversation == conversation);
        if (beforeMessageId is > 0)
        {
            var before = beforeMessageId.Value;
            query = query.Where(x => x.Oid < before);
        }

        var page = query.OrderByDescending(x => x.Oid).Take(size + 1).ToList();
        var hasMore = page.Count > size;
        var messages = page.Take(size).OrderBy(x => x.Oid).ToList();

        return Task.FromResult(new ChatMessagePageDto
        {
            Items = BuildMessageDtos(messages, me),
            HasMoreBefore = hasMore
        });
    }

    public async Task<ChatMessageDto> SendMessageAsync(int conversationId, ChatSendMessageRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var me = CurrentUserId;
        var (conversation, mine) = RequireMembership(conversationId, me);

        var clientMessageId = NormalizeOptional(request.ClientMessageId, 64, "Слишком длинный идентификатор сообщения.");
        if (clientMessageId is not null)
        {
            var duplicate = new XPQuery<ChatMessage>(unitOfWork)
                .FirstOrDefault(x => x.Conversation == conversation && x.SenderUserId == me && x.ClientMessageId == clientMessageId);
            if (duplicate is not null)
            {
                return BuildMessageDtos([duplicate], me).Single();
            }
        }

        var text = NormalizeMessageText(request.Text);
        var attachmentIds = (request.AttachmentIds ?? Array.Empty<int>()).Distinct().ToArray();
        ValidationHelper.Guard(text is not null || attachmentIds.Length > 0, "Сообщение пустое.");
        ValidationHelper.Guard(attachmentIds.Length <= Options.MaxAttachmentsPerMessage, $"К сообщению можно прикрепить не больше {Options.MaxAttachmentsPerMessage} файлов.");

        if (conversation.Kind == ChatConversationKind.Direct)
        {
            var peerId = GetParticipants(conversation.Oid).Select(x => x.UserId).FirstOrDefault(x => x != me);
            var peer = userDirectory.GetUsers([peerId]).GetValueOrDefault(peerId);
            ValidationHelper.Guard(peer is { IsInactive: false }, "Сотрудник уволен, отправить ему сообщение нельзя.");
        }

        var attachments = attachmentIds.Length == 0
            ? new List<ChatAttachment>()
            : new XPQuery<ChatAttachment>(unitOfWork).Where(x => attachmentIds.Contains(x.Oid)).ToList();
        ValidationHelper.Guard(attachments.Count == attachmentIds.Length
            && attachments.All(x => x.Message == null && x.UploadedByUserId == me && x.Conversation?.Oid == conversation.Oid),
            "Вложение не найдено или уже отправлено.");

        var replyToId = 0;
        if (request.ReplyToMessageId is > 0)
        {
            var replyTo = unitOfWork.GetObjectByKey<ChatMessage>(request.ReplyToMessageId.Value);
            ValidationHelper.Guard(replyTo is not null && replyTo.Conversation?.Oid == conversation.Oid, "Сообщение для ответа не найдено.");
            replyToId = replyTo!.Oid;
        }

        var now = DateTime.UtcNow;
        var message = new ChatMessage(unitOfWork)
        {
            Conversation = conversation,
            SenderUserId = me,
            Kind = ChatMessageKind.Text,
            Text = text,
            ReplyToMessageId = replyToId,
            ClientMessageId = clientMessageId,
            CreatedAtUtc = now
        };

        var order = 0;
        foreach (var attachment in attachmentIds.Select(id => attachments.First(x => x.Oid == id)))
        {
            attachment.Message = message;
            attachment.SortOrder = order++;
        }

        unitOfWork.CommitChanges();

        conversation.LastMessageId = message.Oid;
        conversation.LastMessageAtUtc = now;
        mine.LastReadMessageId = message.Oid;
        mine.LastReadAtUtc = now;
        foreach (var participant in GetParticipants(conversation.Oid).Where(x => x.LeftAtUtc == null && x.IsArchived))
        {
            participant.IsArchived = false;
        }

        unitOfWork.CommitChanges();

        var dto = BuildMessageDtos([message], me).Single();
        await eventPublisher.PublishAsync(GetActiveUserIds(conversation.Oid), ChatEventNames.MessageCreated, dto, cancellationToken);
        return dto;
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
            message.DeletedAtUtc = DateTime.UtcNow;
            message.Text = null;

            foreach (var attachment in new XPQuery<ChatAttachment>(unitOfWork).Where(x => x.Message == message).ToList())
            {
                TryDeleteFile(attachment.RelativePath);
                attachment.Delete();
            }

            foreach (var reaction in new XPQuery<ChatReaction>(unitOfWork).Where(x => x.Message == message).ToList())
            {
                reaction.Delete();
            }

            unitOfWork.CommitChanges();
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
        unitOfWork.CommitChanges();

        await eventPublisher.PublishAsync(GetActiveUserIds(conversation.Oid), ChatEventNames.ReadStateChanged, new ChatReadStateEventDto
        {
            ConversationId = conversation.Oid,
            UserId = me,
            LastReadMessageId = mine.LastReadMessageId,
            LastReadAtUtc = ForceUtc(mine.LastReadAtUtc)
        }, cancellationToken);
    }

    public Task<ChatUnreadSummaryDto> GetUnreadSummaryAsync(CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var participations = new XPQuery<ChatParticipant>(unitOfWork)
            .Where(x => x.UserId == me && x.LeftAtUtc == null && x.Conversation != null && !x.Conversation.IsRemoved)
            .ToList();

        var hidden = GetHiddenDirectConversationIds(participations.Select(x => x.Conversation!), me);
        var counts = participations
            .Where(x => !x.IsMuted && !hidden.Contains(x.Conversation!.Oid))
            .Select(x => CountUnread(x.Conversation!, x, me))
            .ToArray();
        return Task.FromResult(new ChatUnreadSummaryDto
        {
            TotalUnread = counts.Sum(),
            ConversationsWithUnread = counts.Count(x => x > 0)
        });
    }

    public async Task<ChatAttachmentDto> UploadAttachmentAsync(int conversationId, ChatAttachmentUploadCommand command, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(command);
        var me = CurrentUserId;
        var (conversation, _) = RequireMembership(conversationId, me);

        var fileName = Path.GetFileName(TextHelper.NullIfWhiteSpace(command.FileName) ?? string.Empty);
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(fileName), "Имя файла не задано.");
        ValidationHelper.Guard(fileName.Length <= 255, "Имя файла слишком длинное.");

        await using var memory = new MemoryStream();
        await command.Content.CopyToAsync(memory, cancellationToken);
        var bytes = memory.ToArray();
        ValidationHelper.Guard(bytes.LongLength > 0, "Файл пустой.");
        ValidationHelper.Guard(bytes.LongLength <= Options.MaxAttachmentBytes, $"Файл больше {FormatBytes(Options.MaxAttachmentBytes)}.");

        var now = DateTime.UtcNow;
        var extension = Path.GetExtension(fileName);
        var storedFileName = $"{Guid.NewGuid():N}{(extension.Length <= 16 ? extension : string.Empty)}";
        var relativePath = await fileStore.SaveAsync(bytes, storedFileName, now, cancellationToken);

        var attachment = new ChatAttachment(unitOfWork)
        {
            Conversation = conversation,
            UploadedByUserId = me,
            OriginalFileName = fileName,
            StoredFileName = storedFileName,
            RelativePath = relativePath,
            ContentType = NormalizeContentType(command.ContentType, extension),
            Length = bytes.LongLength,
            Sha256 = HashHelper.ComputeSha256(bytes),
            UploadedAtUtc = now
        };

        unitOfWork.CommitChanges();
        return ToAttachmentDto(attachment);
    }

    public Task<(ChatAttachmentDto Metadata, Stream Content)?> OpenAttachmentAsync(int attachmentId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var attachment = unitOfWork.GetObjectByKey<ChatAttachment>(attachmentId);
        if (attachment?.Conversation is null || attachment.Conversation.IsRemoved)
        {
            return Task.FromResult<(ChatAttachmentDto, Stream)?>(null);
        }

        var participant = FindParticipant(attachment.Conversation.Oid, me);
        var canRead = attachment.Message is null
            ? attachment.UploadedByUserId == me
            : participant is not null && participant.LeftAtUtc is null && attachment.Message.DeletedAtUtc is null;
        if (!canRead)
        {
            return Task.FromResult<(ChatAttachmentDto, Stream)?>(null);
        }

        var stream = fileStore.OpenRead(attachment.RelativePath ?? string.Empty);
        return Task.FromResult<(ChatAttachmentDto, Stream)?>((ToAttachmentDto(attachment), stream));
    }

    public Task DeletePendingAttachmentAsync(int attachmentId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var attachment = unitOfWork.GetObjectByKey<ChatAttachment>(attachmentId);
        if (attachment is null || attachment.UploadedByUserId != me || attachment.Message is not null)
        {
            throw new KeyNotFoundException("Вложение не найдено.");
        }

        TryDeleteFile(attachment.RelativePath);
        attachment.Delete();
        unitOfWork.CommitChanges();
        return Task.CompletedTask;
    }

    public async Task NotifyTypingAsync(int conversationId, int? userId, CancellationToken cancellationToken)
    {
        var me = userId ?? CurrentUserId;
        var (conversation, _) = RequireMembership(conversationId, me);
        var recipients = GetActiveUserIds(conversation.Oid).Where(x => x != me).ToArray();
        await eventPublisher.PublishAsync(recipients, ChatEventNames.Typing, new ChatTypingEventDto
        {
            ConversationId = conversation.Oid,
            UserId = me,
            DisplayName = GetDisplayName(me)
        }, cancellationToken);
    }

    public Task<ChatUserSettingsDto> GetSettingsAsync(CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var settings = new XPQuery<ChatUserSettings>(unitOfWork).FirstOrDefault(x => x.UserId == me);
        return Task.FromResult(settings is null ? new ChatUserSettingsDto() : ToSettingsDto(settings));
    }

    public Task<ChatUserSettingsDto> UpdateSettingsAsync(ChatUserSettingsDto request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var me = CurrentUserId;
        ValidationHelper.Guard(ChatSoundNames.All.Contains(request.SoundName), "Неизвестный звук оповещения.");
        ValidationHelper.Guard(request.SoundVolume is >= 0 and <= 100, "Громкость должна быть от 0 до 100.");

        var settings = new XPQuery<ChatUserSettings>(unitOfWork).FirstOrDefault(x => x.UserId == me)
            ?? new ChatUserSettings(unitOfWork) { UserId = me };
        settings.NotificationsEnabled = request.NotificationsEnabled;
        settings.SoundEnabled = request.SoundEnabled;
        settings.SoundName = request.SoundName;
        settings.SoundVolume = request.SoundVolume;
        settings.ShowMessagePreview = request.ShowMessagePreview;
        settings.UpdatedAtUtc = DateTime.UtcNow;
        unitOfWork.CommitChanges();

        return Task.FromResult(ToSettingsDto(settings));
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
        ValidationHelper.Guard(participant.Role is ChatParticipantRole.Admin or ChatParticipantRole.Owner, "Действие доступно только администраторам чата.");
        return (conversation, participant);
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

        var lastMessageIds = conversations.Select(x => x.LastMessageId).Where(x => x > 0).ToArray();
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
                CreatedAtUtc = ForceUtc(conversation.CreatedAtUtc),
                LastMessageAtUtc = ForceUtc(conversation.LastMessageAtUtc),
                LastMessage = lastMessages.GetValueOrDefault(conversation.LastMessageId),
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
                        LastReadAtUtc = ForceUtc(x.LastReadAtUtc)
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
            UploadedAtUtc = ForceUtc(attachment.UploadedAtUtc)
        };

    private static ChatUserSettingsDto ToSettingsDto(ChatUserSettings settings)
        => new()
        {
            NotificationsEnabled = settings.NotificationsEnabled,
            SoundEnabled = settings.SoundEnabled,
            SoundName = ChatSoundNames.All.Contains(settings.SoundName) ? settings.SoundName! : ChatSoundNames.Default,
            SoundVolume = Math.Clamp(settings.SoundVolume, 0, 100),
            ShowMessagePreview = settings.ShowMessagePreview
        };

    private void TryDeleteFile(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            return;
        }

        try
        {
            fileStore.Delete(relativePath);
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private string? NormalizeMessageText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var normalized = text.Replace("\r\n", "\n").Trim();
        ValidationHelper.Guard(normalized.Length <= Options.MaxMessageLength, $"Сообщение длиннее {Options.MaxMessageLength} символов.");
        return normalized;
    }

    private static string NormalizeRequired(string? value, int maxLength, string emptyMessage, string tooLongMessage)
    {
        var normalized = TextHelper.NullIfWhiteSpace(value);
        ValidationHelper.Guard(normalized is not null, emptyMessage);
        ValidationHelper.Guard(normalized!.Length <= maxLength, tooLongMessage);
        return normalized;
    }

    private static string? NormalizeOptional(string? value, int maxLength, string tooLongMessage)
    {
        var normalized = TextHelper.NullIfWhiteSpace(value);
        ValidationHelper.Guard(normalized is null || normalized.Length <= maxLength, tooLongMessage);
        return normalized;
    }

    private static string NormalizeContentType(string? contentType, string extension)
    {
        var normalized = TextHelper.NullIfWhiteSpace(contentType)?.ToLowerInvariant();
        if (normalized is not null && normalized != "application/octet-stream" && normalized.Length <= 256)
        {
            return normalized;
        }

        return extension.ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".bmp" => "image/bmp",
            ".pdf" => "application/pdf",
            ".txt" => "text/plain",
            _ => "application/octet-stream"
        };
    }

    private static string BuildDirectKey(int first, int second)
        => first < second ? $"{first}:{second}" : $"{second}:{first}";

    private static string? Truncate(string? value, int maxLength)
        => value is null || value.Length <= maxLength ? value : value[..maxLength] + "…";

    private static DateTime ForceUtc(DateTime value) => DateTimeHelper.ForceUtc(value);

    private static DateTime? ForceUtc(DateTime? value) => value is null ? null : DateTimeHelper.ForceUtc(value.Value);

    private static string FormatBytes(long bytes)
        => bytes >= 1024 * 1024 ? $"{bytes / (1024 * 1024)} МБ" : $"{Math.Max(1, bytes / 1024)} КБ";
}

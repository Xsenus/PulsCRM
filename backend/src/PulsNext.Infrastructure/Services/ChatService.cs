using System.Globalization;
using DevExpress.Xpo;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Chat;
using PulsNext.Domain.Legacy;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

/// <summary>
/// Сервис чата. Разделен на части по областям: ChatService.*.cs (сообщения, push, правка, вложения, настройки, доступ, DTO, нормализация).
/// </summary>
public sealed partial class ChatService(
    ChatUnitOfWork unitOfWork,
    ICurrentUserAccessor currentUserAccessor,
    IChatUserDirectory userDirectory,
    IChatEventPublisher eventPublisher,
    IChatFileStore fileStore,
    IOptions<ChatOptions> chatOptions,
    IChatPushQueue? pushQueue = null) : IChatService
{
    // Параметры конструктора видны только в этой части класса — для остальных частей (ChatService.*.cs) они сохранены в поля.
    private readonly ChatUnitOfWork unitOfWork = unitOfWork;
    private readonly ICurrentUserAccessor currentUserAccessor = currentUserAccessor;
    private readonly IChatUserDirectory userDirectory = userDirectory;
    private readonly IChatEventPublisher eventPublisher = eventPublisher;
    private readonly IChatFileStore fileStore = fileStore;
    private readonly IOptions<ChatOptions> chatOptions = chatOptions;
    private readonly IChatPushQueue? pushQueue = pushQueue;

    private const int MaxTitleLength = 256;
    private const int MaxDescriptionLength = 1024;
    private const int MaxIconLength = 32;
    private const int MaxEmojiLength = 32;

    private static readonly HashSet<string> ImageContentTypes = new(StringComparer.OrdinalIgnoreCase)
    {
        "image/png", "image/jpeg", "image/gif", "image/webp", "image/bmp"
    };

    /// <summary>
    /// Предел для уменьшенной копии: она нужна, чтобы лента не качала многомегабайтные оригиналы.
    /// </summary>
    public const int MaxThumbnailBytes = 512 * 1024;
    private const int MinSearchLength = 2;
    private const int MaxForwardTargets = 10;
    private const int MaxMentions = 50;
    private const int MaxDeliveredItems = 200;
    private const int MaxSearchLength = 200;
    private const int MaxImageSide = 50_000;

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
        foreach (var group in conversations.Where(x => x.Kind == ChatConversationKind.Group))
        {
            EnsureActiveGroupOwner(group);
        }
        var result = BuildConversationDtos(conversations, me)
            .OrderByDescending(x => x.IsPinned)
            .ThenByDescending(x => x.LastMessageAtUtc)
            .ToArray();

        return Task.FromResult<IReadOnlyCollection<ChatConversationDto>>(result);
    }

    public Task<IReadOnlyCollection<ChatSearchResultDto>> SearchMessagesAsync(string? query, int? conversationId, int take, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var term = TextHelper.NullIfWhiteSpace(query)?.Trim();
        ValidationHelper.Guard(term is { Length: >= MinSearchLength }, $"Введите не меньше {MinSearchLength} символов.");
        ValidationHelper.Guard(term!.Length <= MaxSearchLength, "Слишком длинный запрос.");
        var size = Math.Clamp(take <= 0 ? 50 : take, 1, 100);

        List<ChatConversation> conversations;
        if (conversationId is > 0)
        {
            conversations = [RequireMembership(conversationId.Value, me).Conversation];
        }
        else
        {
            // Те же диалоги, что в списке (включая архив), без скрытых личных диалогов с уволенными.
            var all = new XPQuery<ChatParticipant>(unitOfWork)
                .Where(x => x.UserId == me && x.LeftAtUtc == null && x.Conversation != null && !x.Conversation.IsRemoved)
                .ToList()
                .Select(x => x.Conversation!)
                .ToList();
            var hidden = GetHiddenDirectConversationIds(all, me);
            conversations = all.Where(x => !hidden.Contains(x.Oid)).ToList();
        }

        if (conversations.Count == 0)
        {
            return Task.FromResult<IReadOnlyCollection<ChatSearchResultDto>>(Array.Empty<ChatSearchResultDto>());
        }

        var ids = conversations.Select(x => x.Oid).ToArray();
        // «ё» и «е» не различаем: сотрудники пишут по-разному.
        var lowered = term.ToLowerInvariant().Replace('ё', 'е');
        var found = new XPQuery<ChatMessage>(unitOfWork)
            .Where(x => x.Conversation != null
                && ids.Contains(x.Conversation.Oid)
                && x.Kind == ChatMessageKind.Text
                && x.DeletedAtUtc == null
                && x.Text != null
                && x.Text.ToLower().Replace("ё", "е").Contains(lowered))
            .OrderByDescending(x => x.Oid)
            .Take(size)
            .ToList();
        if (found.Count == 0)
        {
            return Task.FromResult<IReadOnlyCollection<ChatSearchResultDto>>(Array.Empty<ChatSearchResultDto>());
        }

        var matchedConversations = found.Select(x => x.Conversation!).DistinctBy(x => x.Oid).ToList();
        var conversationDtos = BuildConversationDtos(matchedConversations, me).ToDictionary(x => x.Id);
        var results = BuildMessageDtos(found, me)
            .OrderByDescending(x => x.Id)
            .Select(message =>
            {
                var conversation = conversationDtos[message.ConversationId];
                return new ChatSearchResultDto
                {
                    ConversationId = conversation.Id,
                    ConversationTitle = conversation.Title,
                    ConversationKind = conversation.Kind,
                    ConversationIcon = conversation.Icon,
                    PeerUserId = conversation.PeerUserId,
                    Message = message
                };
            })
            .ToArray();

        return Task.FromResult<IReadOnlyCollection<ChatSearchResultDto>>(results);
    }

    public Task<ChatConversationDto> GetConversationAsync(int conversationId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var (conversation, _) = RequireMembership(conversationId, me);
        if (conversation.Kind == ChatConversationKind.Group)
        {
            EnsureActiveGroupOwner(conversation);
        }

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

    public async Task<ChatConversationDto> PinMessageAsync(int conversationId, int? messageId, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var (conversation, mine) = RequireMembership(conversationId, me);
        if (conversation.Kind == ChatConversationKind.Group)
        {
            EnsureActiveGroupOwner(conversation);
            ValidationHelper.Guard(mine.Role is ChatParticipantRole.Admin or ChatParticipantRole.Owner, "Закреплять сообщения в групповом чате могут только администраторы.");
        }

        if (messageId is > 0)
        {
            var message = unitOfWork.GetObjectByKey<ChatMessage>(messageId.Value);
            ValidationHelper.Guard(
                message is not null && message.Conversation?.Oid == conversation.Oid && message.DeletedAtUtc is null && message.Kind == ChatMessageKind.Text,
                "Сообщение не найдено.");
            conversation.PinnedMessageId = message!.Oid;
            conversation.PinnedByUserId = me;
            conversation.PinnedAtUtc = DateTime.UtcNow;
        }
        else
        {
            conversation.PinnedMessageId = 0;
            conversation.PinnedByUserId = 0;
            conversation.PinnedAtUtc = null;
        }

        unitOfWork.CommitChanges();
        await PublishConversationUpdatedAsync(conversation, cancellationToken);
        return BuildConversationDtos([conversation], me).Single();
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
}

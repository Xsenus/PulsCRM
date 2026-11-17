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
    Task<ChatConversationDto> PinMessageAsync(int conversationId, int? messageId, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<ChatSearchResultDto>> SearchMessagesAsync(string? query, int? conversationId, int take, CancellationToken cancellationToken);
    Task<ChatMessagePageDto> GetMessagesAsync(int conversationId, int? beforeMessageId, int take, CancellationToken cancellationToken);
    Task<ChatMessageDto> SendMessageAsync(int conversationId, ChatSendMessageRequest request, CancellationToken cancellationToken);
    Task<ChatMessageDto> EditMessageAsync(int messageId, string? text, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<ChatMessageDto>> ForwardMessageAsync(int messageId, IReadOnlyCollection<int> conversationIds, CancellationToken cancellationToken);
    Task<ChatMessageDto> DeleteMessageAsync(int messageId, CancellationToken cancellationToken);
    Task<ChatMessageDto> ToggleReactionAsync(int messageId, string? emoji, CancellationToken cancellationToken);
    Task MarkReadAsync(int conversationId, int? messageId, CancellationToken cancellationToken);
    Task MarkDeliveredAsync(IReadOnlyCollection<ChatDeliveredItem> items, CancellationToken cancellationToken);
    Task<ChatUnreadSummaryDto> GetUnreadSummaryAsync(CancellationToken cancellationToken);
    Task<ChatAttachmentDto> UploadAttachmentAsync(int conversationId, ChatAttachmentUploadCommand command, CancellationToken cancellationToken);
    Task<(ChatAttachmentDto Metadata, Stream Content)?> OpenAttachmentAsync(int attachmentId, bool thumbnail, CancellationToken cancellationToken);
    Task DeletePendingAttachmentAsync(int attachmentId, CancellationToken cancellationToken);
    /// <summary>
    /// Рассылает «печатает». <paramref name="userId"/> передает SignalR-хаб, где HttpContext недоступен;
    /// null — текущий пользователь HTTP-запроса.
    /// </summary>
    Task NotifyTypingAsync(int conversationId, int? userId, CancellationToken cancellationToken);
    Task<ChatUserSettingsDto> GetSettingsAsync(CancellationToken cancellationToken);
    Task<ChatUserSettingsDto> UpdateSettingsAsync(ChatUserSettingsDto request, CancellationToken cancellationToken);
    Task<ChatDockStateDto> GetDockStateAsync(CancellationToken cancellationToken);
    Task<ChatDockStateDto> UpdateDockStateAsync(ChatDockStateDto request, CancellationToken cancellationToken);
    /// <summary>
    /// Сохраняет подписку браузера на Web Push (повторная — обновляет ключи и владельца).
    /// </summary>
    Task SavePushSubscriptionAsync(ChatPushSubscriptionRequest request, string? userAgent, CancellationToken cancellationToken);
    Task DeletePushSubscriptionAsync(string? endpoint, CancellationToken cancellationToken);
}

/// <summary>
/// Подписка браузера (PushSubscription.toJSON()): адрес и ключи шифрования.
/// </summary>
public sealed class ChatPushSubscriptionRequest
{
    public string? Endpoint { get; set; }
    public ChatPushSubscriptionKeys? Keys { get; set; }
}

public sealed class ChatPushPublicKeyDto
{
    public string PublicKey { get; set; } = string.Empty;
}

public sealed class ChatPushSubscriptionKeys
{
    public string? P256dh { get; set; }
    public string? Auth { get; set; }
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

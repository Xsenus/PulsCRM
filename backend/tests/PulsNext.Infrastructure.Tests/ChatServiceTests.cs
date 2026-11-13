using System.ComponentModel.DataAnnotations;
using System.Text;
using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Chat;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class ChatServiceTests : IDisposable
{
    private const int Alice = 1;
    private const int Bob = 2;
    private const int Carol = 3;
    private const int Fired = 4;
    private const int Outsider = 5;

    private readonly ChatUnitOfWork _unitOfWork = new(new SimpleDataLayer(new InMemoryDataStore()));
    private readonly FakeCurrentUser _currentUser = new();
    private readonly FakeDirectory _directory = new();
    private readonly RecordingPublisher _publisher = new();
    private readonly MemoryFileStore _fileStore = new();
    private readonly ChatService _service;

    public ChatServiceTests()
    {
        _service = new ChatService(_unitOfWork, _currentUser, _directory, _publisher, _fileStore, Microsoft.Extensions.Options.Options.Create(new ChatOptions()));
    }

    public void Dispose() => _unitOfWork.Dispose();

    [Fact]
    public async Task OpenDirect_ReturnsSameConversationForBothSides()
    {
        As(Alice);
        var fromAlice = await _service.OpenDirectAsync(Bob, CancellationToken.None);

        As(Bob);
        var fromBob = await _service.OpenDirectAsync(Alice, CancellationToken.None);

        Assert.Equal(fromAlice.Id, fromBob.Id);
        Assert.Equal(ChatConversationKind.Direct, fromBob.Kind);
        Assert.Equal("Алиса", fromBob.Title);
        Assert.Equal(Alice, fromBob.PeerUserId);
        Assert.Single(new XPQuery<ChatConversation>(_unitOfWork));
    }

    [Fact]
    public async Task OpenDirect_WithFiredUser_IsRejected()
    {
        As(Alice);
        await Assert.ThrowsAsync<ValidationException>(() => _service.OpenDirectAsync(Fired, CancellationToken.None));
    }

    [Fact]
    public async Task SendMessage_CountsUnreadForPeerUntilMarkedRead()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Привет" }, CancellationToken.None);
        var second = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Как дела?" }, CancellationToken.None);

        Assert.Equal(0, (await _service.GetUnreadSummaryAsync(CancellationToken.None)).TotalUnread);

        As(Bob);
        var list = await _service.GetConversationsAsync(includeArchived: false, CancellationToken.None);
        var item = Assert.Single(list);
        Assert.Equal(2, item.UnreadCount);
        Assert.Equal("Как дела?", item.LastMessage?.Text);
        Assert.Equal(2, (await _service.GetUnreadSummaryAsync(CancellationToken.None)).TotalUnread);

        await _service.MarkReadAsync(conversation.Id, second.Id, CancellationToken.None);

        Assert.Equal(0, (await _service.GetUnreadSummaryAsync(CancellationToken.None)).TotalUnread);
        var readEvent = Assert.Single(_publisher.Events, x => x.Name == ChatEventNames.ReadStateChanged);
        Assert.Equal([Alice, Bob], readEvent.UserIds.Order());
    }

    [Fact]
    public async Task SendMessage_PublishesToActiveParticipantsOnly()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        _publisher.Events.Clear();

        var message = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Привет" }, CancellationToken.None);

        var created = Assert.Single(_publisher.Events);
        Assert.Equal(ChatEventNames.MessageCreated, created.Name);
        Assert.Equal([Alice, Bob], created.UserIds.Order());
        Assert.Equal(message.Id, ((ChatMessageDto)created.Payload).Id);
    }

    [Fact]
    public async Task Outsider_CannotReadOrWriteConversation()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        var message = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Секрет" }, CancellationToken.None);

        As(Outsider);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetMessagesAsync(conversation.Id, null, 50, CancellationToken.None));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Привет" }, CancellationToken.None));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.ToggleReactionAsync(message.Id, "👍", CancellationToken.None));
        Assert.Empty(await _service.GetConversationsAsync(includeArchived: true, CancellationToken.None));
    }

    [Fact]
    public async Task EditMessage_OnlyAuthorCanEdit()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        var message = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Опечатка" }, CancellationToken.None);

        var edited = await _service.EditMessageAsync(message.Id, "Исправлено", CancellationToken.None);
        Assert.Equal("Исправлено", edited.Text);
        Assert.NotNull(edited.EditedAtUtc);
        Assert.Equal(DateTimeKind.Utc, edited.EditedAtUtc!.Value.Kind);

        As(Bob);
        await Assert.ThrowsAsync<ValidationException>(() => _service.EditMessageAsync(message.Id, "Чужое", CancellationToken.None));
    }

    [Fact]
    public async Task DeleteMessage_HidesTextAttachmentsAndReactions()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        var attachment = await UploadAsync(conversation.Id, "photo.png", "image/png");
        var message = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Смотри", AttachmentIds = [attachment.Id] }, CancellationToken.None);
        await _service.ToggleReactionAsync(message.Id, "👍", CancellationToken.None);

        As(Bob);
        await Assert.ThrowsAsync<ValidationException>(() => _service.DeleteMessageAsync(message.Id, CancellationToken.None));

        As(Alice);
        var deleted = await _service.DeleteMessageAsync(message.Id, CancellationToken.None);

        Assert.True(deleted.IsDeleted);
        Assert.Null(deleted.Text);
        Assert.Empty(deleted.Attachments);
        Assert.Empty(deleted.Reactions);
        Assert.Empty(_fileStore.Files);
        Assert.Null(await _service.OpenAttachmentAsync(attachment.Id, CancellationToken.None));
    }

    [Fact]
    public async Task GroupAdmin_CanDeleteMemberMessage_MemberCannotDeleteOthers()
    {
        As(Alice);
        var group = await _service.CreateGroupAsync(new ChatCreateGroupRequest { Title = "Отдел", MemberUserIds = [Bob, Carol] }, CancellationToken.None);

        As(Bob);
        var fromBob = await _service.SendMessageAsync(group.Id, new ChatSendMessageRequest { Text = "Спам" }, CancellationToken.None);

        As(Carol);
        await Assert.ThrowsAsync<ValidationException>(() => _service.DeleteMessageAsync(fromBob.Id, CancellationToken.None));

        As(Alice);
        Assert.True((await _service.DeleteMessageAsync(fromBob.Id, CancellationToken.None)).IsDeleted);
    }

    [Fact]
    public async Task ToggleReaction_AddsAndRemovesPerUser()
    {
        As(Alice);
        var group = await _service.CreateGroupAsync(new ChatCreateGroupRequest { Title = "Отдел", MemberUserIds = [Bob] }, CancellationToken.None);
        var message = await _service.SendMessageAsync(group.Id, new ChatSendMessageRequest { Text = "Готово" }, CancellationToken.None);
        await _service.ToggleReactionAsync(message.Id, "👍", CancellationToken.None);

        As(Bob);
        var afterBob = await _service.ToggleReactionAsync(message.Id, "👍", CancellationToken.None);
        var like = Assert.Single(afterBob.Reactions);
        Assert.Equal(2, like.Count);
        Assert.True(like.ReactedByMe);

        var afterUndo = await _service.ToggleReactionAsync(message.Id, "👍", CancellationToken.None);
        Assert.Equal(1, Assert.Single(afterUndo.Reactions).Count);
        Assert.False(afterUndo.Reactions.Single().ReactedByMe);

        await Assert.ThrowsAsync<ValidationException>(() => _service.ToggleReactionAsync(message.Id, "ok", CancellationToken.None));
    }

    [Fact]
    public async Task Reply_ContainsPreviewOfOriginal()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        var question = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Когда отчет?" }, CancellationToken.None);

        As(Bob);
        var answer = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Завтра", ReplyToMessageId = question.Id }, CancellationToken.None);

        Assert.NotNull(answer.ReplyTo);
        Assert.Equal(question.Id, answer.ReplyTo!.Id);
        Assert.Equal("Когда отчет?", answer.ReplyTo.Text);
        Assert.Equal("Алиса", answer.ReplyTo.SenderName);
    }

    [Fact]
    public async Task Attachments_PendingVisibleToUploaderOnly_SentVisibleToParticipants()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        var attachment = await UploadAsync(conversation.Id, "отчет.pdf", "application/pdf");
        Assert.False(attachment.IsImage);
        Assert.Null(attachment.MessageId);

        As(Bob);
        Assert.Null(await _service.OpenAttachmentAsync(attachment.Id, CancellationToken.None));
        await Assert.ThrowsAsync<ValidationException>(() => _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { AttachmentIds = [attachment.Id] }, CancellationToken.None));

        As(Alice);
        var message = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { AttachmentIds = [attachment.Id] }, CancellationToken.None);
        Assert.Equal("отчет.pdf", Assert.Single(message.Attachments).FileName);

        As(Bob);
        var opened = await _service.OpenAttachmentAsync(attachment.Id, CancellationToken.None);
        Assert.NotNull(opened);
        using var reader = new StreamReader(opened!.Value.Content);
        Assert.Equal("содержимое отчет.pdf", await reader.ReadToEndAsync());

        As(Outsider);
        Assert.Null(await _service.OpenAttachmentAsync(attachment.Id, CancellationToken.None));
    }

    [Fact]
    public async Task UploadAttachment_DetectsImagesAndRejectsOversizedFiles()
    {
        var service = new ChatService(_unitOfWork, _currentUser, _directory, _publisher, _fileStore, Microsoft.Extensions.Options.Options.Create(new ChatOptions { MaxAttachmentBytes = 10 }));
        As(Alice);
        var conversation = await service.OpenDirectAsync(Bob, CancellationToken.None);

        var image = await service.UploadAttachmentAsync(conversation.Id, new ChatAttachmentUploadCommand
        {
            Content = new MemoryStream([1, 2, 3]),
            FileName = "снимок.jpg",
            ContentType = null
        }, CancellationToken.None);
        Assert.True(image.IsImage);
        Assert.Equal("image/jpeg", image.ContentType);

        await Assert.ThrowsAsync<ValidationException>(() => service.UploadAttachmentAsync(conversation.Id, new ChatAttachmentUploadCommand
        {
            Content = new MemoryStream(new byte[11]),
            FileName = "big.bin"
        }, CancellationToken.None));
    }

    [Fact]
    public async Task SendMessage_WithSameClientMessageId_DoesNotDuplicate()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        var first = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Раз", ClientMessageId = "c-1" }, CancellationToken.None);
        var retry = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Раз", ClientMessageId = "c-1" }, CancellationToken.None);

        Assert.Equal(first.Id, retry.Id);
        Assert.Single((await _service.GetMessagesAsync(conversation.Id, null, 50, CancellationToken.None)).Items);
    }

    [Fact]
    public async Task GetMessages_PagesFromNewestBackwards()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        for (var i = 1; i <= 5; i++)
        {
            await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = $"#{i}" }, CancellationToken.None);
        }

        var latest = await _service.GetMessagesAsync(conversation.Id, null, 2, CancellationToken.None);
        Assert.Equal(["#4", "#5"], latest.Items.Select(x => x.Text));
        Assert.True(latest.HasMoreBefore);

        var older = await _service.GetMessagesAsync(conversation.Id, latest.Items.First().Id, 10, CancellationToken.None);
        Assert.Equal(["#1", "#2", "#3"], older.Items.Select(x => x.Text));
        Assert.False(older.HasMoreBefore);
    }

    [Fact]
    public async Task Group_MembershipRules()
    {
        As(Alice);
        await Assert.ThrowsAsync<ValidationException>(() => _service.CreateGroupAsync(new ChatCreateGroupRequest { Title = "С уволенным", MemberUserIds = [Bob, Fired] }, CancellationToken.None));

        var group = await _service.CreateGroupAsync(new ChatCreateGroupRequest { Title = "Отдел", Icon = "📊", MemberUserIds = [Bob] }, CancellationToken.None);
        Assert.Equal(ChatParticipantRole.Owner, group.MyRole);
        Assert.Equal("📊", group.Icon);

        As(Bob);
        await Assert.ThrowsAsync<ValidationException>(() => _service.AddMembersAsync(group.Id, [Carol], CancellationToken.None));

        As(Alice);
        var withCarol = await _service.AddMembersAsync(group.Id, [Carol], CancellationToken.None);
        Assert.Equal(3, withCarol.Participants.Count);

        var withoutCarol = await _service.RemoveMemberAsync(group.Id, Carol, CancellationToken.None);
        Assert.Equal(2, withoutCarol.Participants.Count);
        Assert.Contains(_publisher.Events, x => x.Name == ChatEventNames.ConversationRemoved && x.UserIds.SequenceEqual([Carol]));

        As(Carol);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetMessagesAsync(group.Id, null, 50, CancellationToken.None));

        As(Alice);
        await _service.LeaveAsync(group.Id, CancellationToken.None);

        As(Bob);
        var remaining = await _service.GetConversationAsync(group.Id, CancellationToken.None);
        Assert.Equal(ChatParticipantRole.Owner, remaining.MyRole);
        Assert.Single(remaining.Participants);
    }

    [Fact]
    public async Task ArchivedConversation_ReturnsOnNewMessage()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);

        As(Bob);
        await _service.UpdatePreferencesAsync(conversation.Id, new ChatConversationPreferencesRequest { IsArchived = true }, CancellationToken.None);
        Assert.Empty(await _service.GetConversationsAsync(includeArchived: false, CancellationToken.None));

        As(Alice);
        await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Ау" }, CancellationToken.None);

        As(Bob);
        Assert.Single(await _service.GetConversationsAsync(includeArchived: false, CancellationToken.None));
    }

    [Fact]
    public async Task MutedConversation_IsExcludedFromUnreadSummary()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Привет" }, CancellationToken.None);

        As(Bob);
        await _service.UpdatePreferencesAsync(conversation.Id, new ChatConversationPreferencesRequest { IsMuted = true }, CancellationToken.None);

        Assert.Equal(0, (await _service.GetUnreadSummaryAsync(CancellationToken.None)).TotalUnread);
        Assert.Equal(1, Assert.Single(await _service.GetConversationsAsync(false, CancellationToken.None)).UnreadCount);
    }

    [Fact]
    public async Task Settings_AreStoredPerUserAndValidated()
    {
        As(Alice);
        var defaults = await _service.GetSettingsAsync(CancellationToken.None);
        Assert.True(defaults.SoundEnabled);
        Assert.Equal(ChatSoundNames.Default, defaults.SoundName);

        await _service.UpdateSettingsAsync(new ChatUserSettingsDto { SoundEnabled = false, SoundName = "pop", SoundVolume = 30 }, CancellationToken.None);
        var saved = await _service.GetSettingsAsync(CancellationToken.None);
        Assert.False(saved.SoundEnabled);
        Assert.Equal("pop", saved.SoundName);
        Assert.Equal(30, saved.SoundVolume);

        await Assert.ThrowsAsync<ValidationException>(() => _service.UpdateSettingsAsync(new ChatUserSettingsDto { SoundName = "unknown" }, CancellationToken.None));
        await Assert.ThrowsAsync<ValidationException>(() => _service.UpdateSettingsAsync(new ChatUserSettingsDto { SoundVolume = 150 }, CancellationToken.None));

        As(Bob);
        Assert.True((await _service.GetSettingsAsync(CancellationToken.None)).SoundEnabled);
    }

    [Fact]
    public async Task SendMessage_RejectsEmptyAndTooLongText()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);

        await Assert.ThrowsAsync<ValidationException>(() => _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "   " }, CancellationToken.None));
        await Assert.ThrowsAsync<ValidationException>(() => _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = new string('a', 8001) }, CancellationToken.None));
    }

    [Fact]
    public async Task NotifyTyping_GoesToOtherParticipantsOnly_AndUsesExplicitUser()
    {
        As(Alice);
        var group = await _service.CreateGroupAsync(new ChatCreateGroupRequest { Title = "Отдел", MemberUserIds = [Bob, Carol] }, CancellationToken.None);
        _publisher.Events.Clear();

        As(Outsider);
        await _service.NotifyTypingAsync(group.Id, Bob, CancellationToken.None);

        var typing = Assert.Single(_publisher.Events);
        Assert.Equal(ChatEventNames.Typing, typing.Name);
        Assert.Equal([Alice, Carol], typing.UserIds.Order());
        Assert.Equal("Борис", ((ChatTypingEventDto)typing.Payload).DisplayName);

        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.NotifyTypingAsync(group.Id, null, CancellationToken.None));
    }

    private void As(int userId) => _currentUser.UserId = userId;

    private Task<ChatAttachmentDto> UploadAsync(int conversationId, string fileName, string contentType)
        => _service.UploadAttachmentAsync(conversationId, new ChatAttachmentUploadCommand
        {
            Content = new MemoryStream(Encoding.UTF8.GetBytes($"содержимое {fileName}")),
            FileName = fileName,
            ContentType = contentType
        }, CancellationToken.None);

    private sealed class FakeCurrentUser : ICurrentUserAccessor
    {
        public int UserId { get; set; }

        public int? GetLegacyUserId() => UserId;

        public string? GetLogin() => $"user{UserId}";
    }

    private sealed class FakeDirectory : IChatUserDirectory
    {
        private readonly Dictionary<int, ChatUserDto> _users = new()
        {
            [Alice] = new ChatUserDto { Id = Alice, Login = "alice", DisplayName = "Алиса" },
            [Bob] = new ChatUserDto { Id = Bob, Login = "bob", DisplayName = "Борис" },
            [Carol] = new ChatUserDto { Id = Carol, Login = "carol", DisplayName = "Вера" },
            [Fired] = new ChatUserDto { Id = Fired, Login = "fired", DisplayName = "Уволенный", IsInactive = true },
            [Outsider] = new ChatUserDto { Id = Outsider, Login = "out", DisplayName = "Посторонний" }
        };

        public IReadOnlyDictionary<int, ChatUserDto> GetUsers(IEnumerable<int> userIds)
            => userIds.Distinct().Where(_users.ContainsKey).ToDictionary(x => x, x => _users[x]);

        public IReadOnlyCollection<ChatUserDto> Search(string? search, int take)
            => _users.Values.Where(x => !x.IsInactive).Take(take).ToArray();
    }

    private sealed class RecordingPublisher : IChatEventPublisher
    {
        public List<(IReadOnlyCollection<int> UserIds, string Name, object Payload)> Events { get; } = new();

        public Task PublishAsync(IReadOnlyCollection<int> userIds, string eventName, object payload, CancellationToken cancellationToken)
        {
            Events.Add((userIds, eventName, payload));
            return Task.CompletedTask;
        }
    }

    private sealed class MemoryFileStore : IChatFileStore
    {
        public Dictionary<string, byte[]> Files { get; } = new();

        public Task<string> SaveAsync(byte[] content, string storedFileName, DateTime nowUtc, CancellationToken cancellationToken)
        {
            var path = $"test/{storedFileName}";
            Files[path] = content;
            return Task.FromResult(path);
        }

        public Stream OpenRead(string relativePath) => new MemoryStream(Files[relativePath]);

        public void Delete(string relativePath) => Files.Remove(relativePath);
    }
}

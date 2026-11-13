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
        Assert.Null(await _service.OpenAttachmentAsync(attachment.Id, false, CancellationToken.None));
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
        Assert.Null(await _service.OpenAttachmentAsync(attachment.Id, false, CancellationToken.None));
        await Assert.ThrowsAsync<ValidationException>(() => _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { AttachmentIds = [attachment.Id] }, CancellationToken.None));

        As(Alice);
        var message = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { AttachmentIds = [attachment.Id] }, CancellationToken.None);
        Assert.Equal("отчет.pdf", Assert.Single(message.Attachments).FileName);

        As(Bob);
        var opened = await _service.OpenAttachmentAsync(attachment.Id, false, CancellationToken.None);
        Assert.NotNull(opened);
        using var reader = new StreamReader(opened!.Value.Content);
        Assert.Equal("содержимое отчет.pdf", await reader.ReadToEndAsync());

        As(Outsider);
        Assert.Null(await _service.OpenAttachmentAsync(attachment.Id, false, CancellationToken.None));
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
    public async Task UploadAttachment_StoresThumbnailAndServesItSeparately()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        var original = new byte[4096];
        byte[] thumbnailBytes = [0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4];

        var image = await _service.UploadAttachmentAsync(conversation.Id, new ChatAttachmentUploadCommand
        {
            Content = new MemoryStream(original),
            FileName = "фото.png",
            ContentType = "image/png",
            Thumbnail = new MemoryStream(thumbnailBytes),
            Width = 4000,
            Height = 3000
        }, CancellationToken.None);

        Assert.True(image.HasThumbnail);
        Assert.Equal(4000, image.Width);
        Assert.Equal(3000, image.Height);
        Assert.Equal(2, _fileStore.Files.Count);

        await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { AttachmentIds = [image.Id] }, CancellationToken.None);

        As(Bob);
        var thumbnail = await _service.OpenAttachmentAsync(image.Id, true, CancellationToken.None);
        Assert.NotNull(thumbnail);
        Assert.Equal("image/jpeg", thumbnail!.Value.Metadata.ContentType);
        Assert.Equal(thumbnailBytes, ReadAll(thumbnail.Value.Content));

        var full = await _service.OpenAttachmentAsync(image.Id, false, CancellationToken.None);
        Assert.Equal("image/png", full!.Value.Metadata.ContentType);
        Assert.Equal(original.Length, ReadAll(full.Value.Content).Length);

        As(Alice);
        var message = Assert.Single((await _service.GetMessagesAsync(conversation.Id, null, 50, CancellationToken.None)).Items);
        await _service.DeleteMessageAsync(message.Id, CancellationToken.None);
        Assert.Empty(_fileStore.Files);
    }

    [Fact]
    public async Task UploadAttachment_IgnoresInvalidThumbnails()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);

        // Не картинка по сигнатуре.
        var fake = await _service.UploadAttachmentAsync(conversation.Id, new ChatAttachmentUploadCommand
        {
            Content = new MemoryStream(new byte[2048]),
            FileName = "a.jpg",
            Thumbnail = new MemoryStream("<script>alert(1)</script>"u8.ToArray()),
            Width = -5,
            Height = 100
        }, CancellationToken.None);
        Assert.False(fake.HasThumbnail);
        Assert.Null(fake.Width);

        // Больше предела.
        var oversized = new byte[ChatService.MaxThumbnailBytes + 10];
        oversized[0] = 0xFF; oversized[1] = 0xD8; oversized[2] = 0xFF;
        var big = await _service.UploadAttachmentAsync(conversation.Id, new ChatAttachmentUploadCommand
        {
            Content = new MemoryStream(new byte[ChatService.MaxThumbnailBytes * 2]),
            FileName = "b.jpg",
            Thumbnail = new MemoryStream(oversized)
        }, CancellationToken.None);
        Assert.False(big.HasThumbnail);

        // Не изображение — копия не нужна.
        var pdf = await _service.UploadAttachmentAsync(conversation.Id, new ChatAttachmentUploadCommand
        {
            Content = new MemoryStream(new byte[2048]),
            FileName = "c.pdf",
            ContentType = "application/pdf",
            Thumbnail = new MemoryStream([0xFF, 0xD8, 0xFF, 0xE0]),
            Width = 10,
            Height = 10
        }, CancellationToken.None);
        Assert.False(pdf.HasThumbnail);
        Assert.Null(pdf.Width);
        Assert.Equal(3, _fileStore.Files.Count);

        // Без копии ?thumbnail=true отдает оригинал.
        var opened = await _service.OpenAttachmentAsync(fake.Id, true, CancellationToken.None);
        Assert.Equal(2048, ReadAll(opened!.Value.Content).Length);

        await _service.DeletePendingAttachmentAsync(fake.Id, CancellationToken.None);
        Assert.Equal(2, _fileStore.Files.Count);
    }

    [Fact]
    public async Task PinMessage_InDirectChat_VisibleToBothAndClearedOnDelete()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        var message = await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Реквизиты: ИНН 7701234567" }, CancellationToken.None);

        As(Bob);
        _publisher.Events.Clear();
        var pinned = await _service.PinMessageAsync(conversation.Id, message.Id, CancellationToken.None);
        Assert.Equal(message.Id, pinned.PinnedMessage?.Id);
        Assert.True(pinned.CanPinMessages);
        Assert.Contains(_publisher.Events, x => x.Name == ChatEventNames.ConversationUpdated && x.UserIds.Contains(Alice));

        As(Alice);
        Assert.Equal("Реквизиты: ИНН 7701234567", (await _service.GetConversationAsync(conversation.Id, CancellationToken.None)).PinnedMessage?.Text);

        await _service.DeleteMessageAsync(message.Id, CancellationToken.None);
        Assert.Null((await _service.GetConversationAsync(conversation.Id, CancellationToken.None)).PinnedMessage);
    }

    [Fact]
    public async Task PinMessage_InGroup_OnlyAdminsAndOnlyOwnConversationMessages()
    {
        As(Alice);
        var group = await _service.CreateGroupAsync(new ChatCreateGroupRequest { Title = "Отдел", MemberUserIds = [Bob] }, CancellationToken.None);
        var other = await _service.OpenDirectAsync(Carol, CancellationToken.None);
        var foreign = await _service.SendMessageAsync(other.Id, new ChatSendMessageRequest { Text = "Чужой диалог" }, CancellationToken.None);

        As(Bob);
        var message = await _service.SendMessageAsync(group.Id, new ChatSendMessageRequest { Text = "План на неделю" }, CancellationToken.None);
        Assert.False((await _service.GetConversationAsync(group.Id, CancellationToken.None)).CanPinMessages);
        await Assert.ThrowsAsync<ValidationException>(() => _service.PinMessageAsync(group.Id, message.Id, CancellationToken.None));

        As(Alice);
        await Assert.ThrowsAsync<ValidationException>(() => _service.PinMessageAsync(group.Id, foreign.Id, CancellationToken.None));
        var systemMessage = (await _service.GetMessagesAsync(group.Id, null, 50, CancellationToken.None)).Items.First(x => x.Kind == ChatMessageKind.System);
        await Assert.ThrowsAsync<ValidationException>(() => _service.PinMessageAsync(group.Id, systemMessage.Id, CancellationToken.None));

        Assert.Equal(message.Id, (await _service.PinMessageAsync(group.Id, message.Id, CancellationToken.None)).PinnedMessage?.Id);
        Assert.Null((await _service.PinMessageAsync(group.Id, null, CancellationToken.None)).PinnedMessage);
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

        Assert.False(defaults.DesktopNotificationsEnabled);

        await _service.UpdateSettingsAsync(new ChatUserSettingsDto { SoundEnabled = false, SoundName = "pop", SoundVolume = 30, DesktopNotificationsEnabled = true }, CancellationToken.None);
        var saved = await _service.GetSettingsAsync(CancellationToken.None);
        Assert.True(saved.DesktopNotificationsEnabled);
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

    [Fact]
    public async Task DirectConversationWithFiredEmployee_IsHiddenEverywhere()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        As(Bob);
        await _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Привет" }, CancellationToken.None);

        _directory.Fire(Bob);

        As(Alice);
        Assert.Empty(await _service.GetConversationsAsync(includeArchived: true, CancellationToken.None));
        Assert.Equal(0, (await _service.GetUnreadSummaryAsync(CancellationToken.None)).TotalUnread);
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetConversationAsync(conversation.Id, CancellationToken.None));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.GetMessagesAsync(conversation.Id, null, 50, CancellationToken.None));
        await Assert.ThrowsAsync<KeyNotFoundException>(() => _service.SendMessageAsync(conversation.Id, new ChatSendMessageRequest { Text = "Ау" }, CancellationToken.None));
        await Assert.ThrowsAsync<ValidationException>(() => _service.OpenDirectAsync(Bob, CancellationToken.None));
    }

    [Fact]
    public async Task GroupConversation_HidesFiredMembersButStaysAvailable()
    {
        As(Alice);
        var group = await _service.CreateGroupAsync(new ChatCreateGroupRequest { Title = "Отдел", MemberUserIds = [Bob, Carol] }, CancellationToken.None);

        _directory.Fire(Carol);

        var reloaded = await _service.GetConversationAsync(group.Id, CancellationToken.None);
        Assert.Equal([Alice, Bob], reloaded.Participants.Select(x => x.UserId).Order());
        Assert.Single(await _service.GetConversationsAsync(includeArchived: false, CancellationToken.None));
        await _service.SendMessageAsync(group.Id, new ChatSendMessageRequest { Text = "Работаем дальше" }, CancellationToken.None);
    }

    [Fact]
    public async Task DockState_IsStoredPerUserAndValidated()
    {
        As(Alice);
        Assert.Equivalent(new ChatDockStateDto(), await _service.GetDockStateAsync(CancellationToken.None));

        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        var saved = await _service.UpdateDockStateAsync(new ChatDockStateDto { Open = true, ConversationId = conversation.Id, Width = 520, Height = 700 }, CancellationToken.None);
        Assert.Equivalent(new ChatDockStateDto { Open = true, ConversationId = conversation.Id, Width = 520, Height = 700 }, saved);
        Assert.Equivalent(saved, await _service.GetDockStateAsync(CancellationToken.None));

        var reset = await _service.UpdateDockStateAsync(new ChatDockStateDto { Open = false, ConversationId = conversation.Id }, CancellationToken.None);
        Assert.Null(reset.Width);
        Assert.False(reset.Open);

        await Assert.ThrowsAsync<ValidationException>(() => _service.UpdateDockStateAsync(new ChatDockStateDto { Open = true, Width = 500 }, CancellationToken.None));
        await Assert.ThrowsAsync<ValidationException>(() => _service.UpdateDockStateAsync(new ChatDockStateDto { Open = true, Width = 50, Height = 50 }, CancellationToken.None));

        As(Bob);
        Assert.False((await _service.GetDockStateAsync(CancellationToken.None)).Open);
    }

    [Fact]
    public async Task DockState_DoesNotKeepInaccessibleConversation()
    {
        As(Alice);
        var conversation = await _service.OpenDirectAsync(Bob, CancellationToken.None);
        await _service.UpdateDockStateAsync(new ChatDockStateDto { Open = true, ConversationId = conversation.Id }, CancellationToken.None);

        As(Outsider);
        var foreign = await _service.UpdateDockStateAsync(new ChatDockStateDto { Open = true, ConversationId = conversation.Id }, CancellationToken.None);
        Assert.Null(foreign.ConversationId);

        _directory.Fire(Bob);
        As(Alice);
        var state = await _service.GetDockStateAsync(CancellationToken.None);
        Assert.True(state.Open);
        Assert.Null(state.ConversationId);
    }

    [Fact]
    public async Task DockState_FirstSave_KeepsNotificationDefaults()
    {
        As(Alice);
        await _service.UpdateDockStateAsync(new ChatDockStateDto { Open = true }, CancellationToken.None);

        var settings = await _service.GetSettingsAsync(CancellationToken.None);
        Assert.Equivalent(new ChatUserSettingsDto(), settings);
    }

    [Fact]
    public async Task Group_WhenOwnerIsFired_OldestAdminBecomesOwner()
    {
        As(Alice);
        var group = await _service.CreateGroupAsync(new ChatCreateGroupRequest { Title = "Отдел", MemberUserIds = [Bob, Carol] }, CancellationToken.None);
        await _service.SetMemberRoleAsync(group.Id, Carol, ChatParticipantRole.Admin, CancellationToken.None);

        _directory.Fire(Alice);

        As(Bob);
        var forBob = await _service.GetConversationAsync(group.Id, CancellationToken.None);
        Assert.Equal(ChatParticipantRole.Member, forBob.MyRole);
        Assert.Equal(ChatParticipantRole.Owner, forBob.Participants.Single(x => x.UserId == Carol).Role);
        Assert.Contains("Вера теперь владелец чата", forBob.LastMessage!.Text);

        As(Carol);
        await _service.AddMembersAsync(group.Id, [Outsider], CancellationToken.None);
        await _service.SetMemberRoleAsync(group.Id, Bob, ChatParticipantRole.Admin, CancellationToken.None);

        // Повторная проверка ничего не меняет и не плодит системных сообщений.
        var messagesBefore = (await _service.GetMessagesAsync(group.Id, null, 100, CancellationToken.None)).Items.Count;
        await _service.GetConversationsAsync(includeArchived: false, CancellationToken.None);
        Assert.Equal(messagesBefore, (await _service.GetMessagesAsync(group.Id, null, 100, CancellationToken.None)).Items.Count);
    }

    [Fact]
    public async Task Group_WhenOwnerIsFiredAndNoAdmins_OldestMemberBecomesOwnerAndCanManage()
    {
        As(Alice);
        var group = await _service.CreateGroupAsync(new ChatCreateGroupRequest { Title = "Отдел", MemberUserIds = [Bob, Carol] }, CancellationToken.None);

        _directory.Fire(Alice);

        As(Carol);
        var list = await _service.GetConversationsAsync(includeArchived: false, CancellationToken.None);
        var owner = Assert.Single(list).Participants.Single(x => x.Role == ChatParticipantRole.Owner);
        Assert.Contains(owner.UserId, new[] { Bob, Carol });

        As(owner.UserId);
        var renamed = await _service.UpdateGroupAsync(group.Id, new ChatUpdateGroupRequest { Title = "Отдел продаж" }, CancellationToken.None);
        Assert.Equal("Отдел продаж", renamed.Title);
    }

    private void As(int userId) => _currentUser.UserId = userId;

    private static byte[] ReadAll(Stream stream)
    {
        using var memory = new MemoryStream();
        stream.CopyTo(memory);
        stream.Dispose();
        return memory.ToArray();
    }

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

        public void Fire(int userId) => _users[userId].IsInactive = true;

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

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

        EnsureCanWrite(conversation, me);

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
            MentionedUserIds = FormatMentions(ResolveMentions(conversation, me, text, request.MentionedUserIds)),
            CreatedAtUtc = now
        };

        var order = 0;
        foreach (var attachment in attachmentIds.Select(id => attachments.First(x => x.Oid == id)))
        {
            attachment.Message = message;
            attachment.SortOrder = order++;
        }

        unitOfWork.CommitChanges();
        return await CompleteNewMessageAsync(conversation, mine, message, now, cancellationToken);
    }

    public async Task<IReadOnlyCollection<ChatMessageDto>> ForwardMessageAsync(int messageId, IReadOnlyCollection<int> conversationIds, CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var source = RequireVisibleMessage(messageId, me);
        ValidationHelper.Guard(source.Kind == ChatMessageKind.Text && source.DeletedAtUtc is null, "Это сообщение переслать нельзя.");
        var participation = FindParticipant(source.Conversation!.Oid, me);
        ValidationHelper.Guard(participation is { LeftAtUtc: null }, "Это сообщение переслать нельзя.");

        var targetIds = (conversationIds ?? Array.Empty<int>()).Where(x => x > 0).Distinct().ToArray();
        ValidationHelper.Guard(targetIds.Length > 0, "Выберите, куда переслать сообщение.");
        ValidationHelper.Guard(targetIds.Length <= MaxForwardTargets, $"Переслать можно не больше чем в {MaxForwardTargets} диалогов за раз.");
        var targets = targetIds.Select(id => RequireMembership(id, me)).ToList();
        foreach (var (conversation, _) in targets)
        {
            EnsureCanWrite(conversation, me);
        }

        // При пересылке пересланного автором остается автор оригинала.
        var originalAuthorId = source.ForwardedFromUserId > 0 ? source.ForwardedFromUserId : source.SenderUserId;
        var originalAuthorName = source.ForwardedFromUserId > 0 && !string.IsNullOrWhiteSpace(source.ForwardedFromName)
            ? source.ForwardedFromName!
            : GetDisplayName(originalAuthorId);
        var sourceAttachments = new XPQuery<ChatAttachment>(unitOfWork)
            .Where(x => x.Message == source)
            .ToList()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Oid)
            .ToList();

        var result = new List<ChatMessageDto>(targets.Count);
        foreach (var (conversation, mine) in targets)
        {
            var now = DateTime.UtcNow;
            var message = new ChatMessage(unitOfWork)
            {
                Conversation = conversation,
                SenderUserId = me,
                Kind = ChatMessageKind.Text,
                Text = source.Text,
                ForwardedFromUserId = originalAuthorId,
                ForwardedFromName = Truncate(originalAuthorName, 256),
                CreatedAtUtc = now
            };

            // Файлы копируются: у копии свой жизненный цикл (удаление оригинала ее не затрагивает).
            foreach (var attachment in sourceAttachments)
            {
                await CopyAttachmentAsync(attachment, conversation, message, me, now, cancellationToken);
            }

            unitOfWork.CommitChanges();
            result.Add(await CompleteNewMessageAsync(conversation, mine, message, now, cancellationToken));
        }

        return result;
    }

    private async Task CopyAttachmentAsync(ChatAttachment source, ChatConversation conversation, ChatMessage message, int me, DateTime now, CancellationToken cancellationToken)
    {
        var extension = Path.GetExtension(source.StoredFileName ?? string.Empty);
        var storedFileName = $"{Guid.NewGuid():N}{(extension.Length <= 16 ? extension : string.Empty)}";
        var bytes = await ReadStoredFileAsync(source.RelativePath, cancellationToken);
        ValidationHelper.Guard(bytes is not null, $"Файл «{source.OriginalFileName}» больше недоступен, переслать его нельзя.");
        var copy = new ChatAttachment(unitOfWork)
        {
            Conversation = conversation,
            Message = message,
            UploadedByUserId = me,
            OriginalFileName = source.OriginalFileName,
            StoredFileName = storedFileName,
            RelativePath = await fileStore.SaveAsync(bytes!, storedFileName, now, cancellationToken),
            ContentType = source.ContentType,
            Length = source.Length,
            Sha256 = source.Sha256,
            SortOrder = source.SortOrder,
            UploadedAtUtc = now,
            ImageWidth = source.ImageWidth,
            ImageHeight = source.ImageHeight,
            PreviewDataUrl = source.PreviewDataUrl
        };

        var thumbnail = await ReadStoredFileAsync(source.ThumbnailRelativePath, cancellationToken);
        if (thumbnail is not null)
        {
            var thumbnailName = $"{Path.GetFileNameWithoutExtension(storedFileName)}.thumb{Path.GetExtension(source.ThumbnailRelativePath)}";
            copy.ThumbnailRelativePath = await fileStore.SaveAsync(thumbnail, thumbnailName, now, cancellationToken);
            copy.ThumbnailContentType = source.ThumbnailContentType;
            copy.ThumbnailLength = source.ThumbnailLength;
        }
    }

    private async Task<byte[]?> ReadStoredFileAsync(string? relativePath, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            return null;
        }

        try
        {
            await using var stream = fileStore.OpenRead(relativePath);
            using var memory = new MemoryStream();
            await stream.CopyToAsync(memory, cancellationToken);
            return memory.ToArray();
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException or KeyNotFoundException)
        {
            return null;
        }
    }

    /// <summary>
    /// Общая часть отправки: последнее сообщение диалога, «прочитано» у автора, возврат из архива и рассылка.
    /// </summary>
    private async Task<ChatMessageDto> CompleteNewMessageAsync(ChatConversation conversation, ChatParticipant mine, ChatMessage message, DateTime now, CancellationToken cancellationToken)
    {
        conversation.LastMessageId = message.Oid;
        conversation.LastMessageAtUtc = now;
        mine.LastReadMessageId = message.Oid;
        mine.LastReadAtUtc = now;
        foreach (var participant in GetParticipants(conversation.Oid).Where(x => x.LeftAtUtc == null && x.IsArchived))
        {
            participant.IsArchived = false;
        }

        unitOfWork.CommitChanges();

        var dto = BuildMessageDtos([message], mine.UserId).Single();
        await eventPublisher.PublishAsync(GetActiveUserIds(conversation.Oid), ChatEventNames.MessageCreated, dto, cancellationToken);
        EnqueuePushNotifications(conversation, message, dto);
        return dto;
    }
}

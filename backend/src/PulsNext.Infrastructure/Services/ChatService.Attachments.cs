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

        var contentType = NormalizeContentType(command.ContentType, extension);
        var isImage = ImageContentTypes.Contains(contentType);
        var attachment = new ChatAttachment(unitOfWork)
        {
            Conversation = conversation,
            UploadedByUserId = me,
            OriginalFileName = fileName,
            StoredFileName = storedFileName,
            RelativePath = relativePath,
            ContentType = contentType,
            Length = bytes.LongLength,
            Sha256 = HashHelper.ComputeSha256(bytes),
            UploadedAtUtc = now
        };

        if (IsAudioContentType(contentType) && command.DurationMs is > 0 and <= MaxAudioDurationMs)
        {
            attachment.AudioDurationMs = command.DurationMs.Value;
        }

        if (isImage)
        {
            attachment.PreviewDataUrl = NormalizePreviewDataUrl(command.PreviewDataUrl);
            if (command.Width is > 0 and <= MaxImageSide && command.Height is > 0 and <= MaxImageSide)
            {
                attachment.ImageWidth = command.Width.Value;
                attachment.ImageHeight = command.Height.Value;
            }

            if (command.Thumbnail is not null)
            {
                var thumbnail = await ReadThumbnailAsync(command.Thumbnail, cancellationToken);
                // Копия должна быть действительно меньше оригинала, иначе она бессмысленна.
                if (thumbnail is not null && thumbnail.Value.Bytes.LongLength < bytes.LongLength)
                {
                    var thumbnailName = $"{Path.GetFileNameWithoutExtension(storedFileName)}.thumb{thumbnail.Value.Extension}";
                    attachment.ThumbnailRelativePath = await fileStore.SaveAsync(thumbnail.Value.Bytes, thumbnailName, now, cancellationToken);
                    attachment.ThumbnailContentType = thumbnail.Value.ContentType;
                    attachment.ThumbnailLength = thumbnail.Value.Bytes.LongLength;
                }
            }
        }

        unitOfWork.CommitChanges();
        return ToAttachmentDto(attachment);
    }

    public Task<(ChatAttachmentDto Metadata, Stream Content)?> OpenAttachmentAsync(int attachmentId, bool thumbnail, CancellationToken cancellationToken)
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

        var metadata = ToAttachmentDto(attachment);
        if (thumbnail && !string.IsNullOrWhiteSpace(attachment.ThumbnailRelativePath))
        {
            try
            {
                var thumbnailStream = fileStore.OpenRead(attachment.ThumbnailRelativePath);
                metadata.ContentType = attachment.ThumbnailContentType ?? "image/jpeg";
                metadata.Length = attachment.ThumbnailLength;
                return Task.FromResult<(ChatAttachmentDto, Stream)?>((metadata, thumbnailStream));
            }
            catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
            {
                // Копия пропала с диска — отдаем оригинал, лента от этого не ломается.
            }
        }

        var stream = fileStore.OpenRead(attachment.RelativePath ?? string.Empty);
        return Task.FromResult<(ChatAttachmentDto, Stream)?>((metadata, stream));
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
        TryDeleteFile(attachment.ThumbnailRelativePath);
        attachment.Delete();
        unitOfWork.CommitChanges();
        return Task.CompletedTask;
    }
}

using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using Microsoft.Extensions.Logging.Abstractions;
using PulsNext.Domain.Chat;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class ChatAttachmentCleanupTests
{
    [Fact]
    public async Task RemovesOnlyOldPendingAttachmentsWithFiles()
    {
        using var unitOfWork = new ChatUnitOfWork(new SimpleDataLayer(new InMemoryDataStore()));
        var store = new RecordingFileStore();
        var now = DateTime.UtcNow;

        var conversation = new ChatConversation(unitOfWork) { Kind = ChatConversationKind.Direct, CreatedAtUtc = now, UpdatedAtUtc = now, LastMessageAtUtc = now };
        var message = new ChatMessage(unitOfWork) { Conversation = conversation, SenderUserId = 1, Text = "Файл", CreatedAtUtc = now };
        var oldPending = Attachment(unitOfWork, conversation, null, "old-pending", now.AddHours(-30));
        var freshPending = Attachment(unitOfWork, conversation, null, "fresh-pending", now.AddHours(-2));
        var oldSent = Attachment(unitOfWork, conversation, message, "old-sent", now.AddDays(-10));
        unitOfWork.CommitChanges();
        var oldPendingId = oldPending.Oid;

        var cleaner = new ChatAttachmentCleaner(unitOfWork, store, NullLogger<ChatAttachmentCleaner>.Instance);
        var removed = await cleaner.RemovePendingAsync(now.AddHours(-24), CancellationToken.None);

        Assert.Equal(1, removed);
        Assert.Equal(["old-pending"], store.Deleted);
        // XPO удаляет записи мягко (GCRecord): запросы приложения их больше не видят.
        var remaining = new XPQuery<ChatAttachment>(unitOfWork).Select(x => x.Oid).ToList();
        Assert.DoesNotContain(oldPendingId, remaining);
        Assert.Contains(freshPending.Oid, remaining);
        Assert.Contains(oldSent.Oid, remaining);

        Assert.Equal(0, await cleaner.RemovePendingAsync(now.AddHours(-24), CancellationToken.None));
    }

    [Fact]
    public async Task RemovesRecordEvenWhenFileCannotBeDeleted()
    {
        using var unitOfWork = new ChatUnitOfWork(new SimpleDataLayer(new InMemoryDataStore()));
        var now = DateTime.UtcNow;
        var conversation = new ChatConversation(unitOfWork) { Kind = ChatConversationKind.Direct, CreatedAtUtc = now, UpdatedAtUtc = now, LastMessageAtUtc = now };
        for (var index = 0; index < 3; index++)
        {
            Attachment(unitOfWork, conversation, null, $"locked-{index}", now.AddDays(-2));
        }

        unitOfWork.CommitChanges();

        var cleaner = new ChatAttachmentCleaner(unitOfWork, new RecordingFileStore { ThrowOnDelete = true }, NullLogger<ChatAttachmentCleaner>.Instance);
        Assert.Equal(3, await cleaner.RemovePendingAsync(now.AddHours(-24), CancellationToken.None));
        Assert.Empty(new XPQuery<ChatAttachment>(unitOfWork));
    }

    private static ChatAttachment Attachment(ChatUnitOfWork unitOfWork, ChatConversation conversation, ChatMessage? message, string path, DateTime uploadedAtUtc)
        => new(unitOfWork)
        {
            Conversation = conversation,
            Message = message,
            UploadedByUserId = 1,
            OriginalFileName = path + ".bin",
            StoredFileName = path,
            RelativePath = path,
            ContentType = "application/octet-stream",
            Length = 1,
            UploadedAtUtc = uploadedAtUtc
        };

    private sealed class RecordingFileStore : IChatFileStore
    {
        public List<string> Deleted { get; } = new();
        public bool ThrowOnDelete { get; init; }

        public Task<string> SaveAsync(byte[] content, string storedFileName, DateTime nowUtc, CancellationToken cancellationToken)
            => Task.FromResult(storedFileName);

        public Stream OpenRead(string relativePath) => new MemoryStream();

        public void Delete(string relativePath)
        {
            if (ThrowOnDelete)
            {
                throw new IOException("Файл занят другим процессом.");
            }

            Deleted.Add(relativePath);
        }
    }
}

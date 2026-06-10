using System.Text;
using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using MimeKit;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class MailComposerTests
{
    [Fact]
    public async Task BuildAsync_UsesHtmlAndGeneratedPlainTextBody()
    {
        using var session = CreateSession();
        var composer = new MailComposer(new StubFileStorageService());
        var item = CreateDispatchItem(session, new MailCampaign(session)
        {
            Name = "Campaign fallback",
            Subject = "Monthly digest",
            HtmlBody = "<h1>Hello&nbsp;team</h1><p>Balance &amp; reports</p>"
        });

        var message = await composer.BuildAsync(item, CreateProfile(session), CancellationToken.None);

        Assert.Equal("Monthly digest", message.Subject);
        Assert.Equal("<h1>Hello&nbsp;team</h1><p>Balance &amp; reports</p>", message.HtmlBody);
        Assert.Equal("Hello team Balance & reports", message.TextBody);
        Assert.Equal("sender@example.com", ((MailboxAddress)message.From.Single()).Address);
        Assert.Equal("reply@example.com", ((MailboxAddress)message.ReplyTo.Single()).Address);
        Assert.Equal("client@example.com", ((MailboxAddress)message.To.Single()).Address);
        Assert.False(string.IsNullOrWhiteSpace(message.MessageId));
    }

    [Fact]
    public async Task BuildAsync_AddsRegularAttachmentFromStorage()
    {
        using var session = CreateSession();
        var storage = new StubFileStorageService(new StoredFileContent("source.txt", "text/plain", "Report body"));
        var composer = new MailComposer(storage);
        var campaign = new MailCampaign(session)
        {
            Name = "Attachment campaign",
            Subject = "Attachment subject",
            PlainTextBody = "See attached file."
        };

        _ = new MailCampaignAttachment(session)
        {
            Campaign = campaign,
            StoredFile = new MailStoredFile(session),
            AttachmentKind = AttachmentKind.File,
            DisplayName = "report.txt",
            SortOrder = 1
        };

        var message = await composer.BuildAsync(CreateDispatchItem(session, campaign), CreateProfile(session), CancellationToken.None);
        var attachment = Assert.Single(message.Attachments.OfType<MimePart>());

        Assert.Equal("report.txt", attachment.FileName);
        Assert.Equal("Report body", ReadMimePartText(attachment));
        Assert.DoesNotContain(message.BodyParts.OfType<MimePart>(), x => x.ContentId is not null);
    }

    [Fact]
    public async Task BuildAsync_AddsInlineImageWithContentId()
    {
        using var session = CreateSession();
        var storage = new StubFileStorageService(new StoredFileContent("logo.png", "image/png", "fake-image-bytes"));
        var composer = new MailComposer(storage);
        var campaign = new MailCampaign(session)
        {
            Name = "Inline campaign",
            Subject = "Inline subject",
            HtmlBody = "<p><img src=\"cid:logo-content\"></p>"
        };

        _ = new MailCampaignAttachment(session)
        {
            Campaign = campaign,
            StoredFile = new MailStoredFile(session),
            AttachmentKind = AttachmentKind.InlineImage,
            DisplayName = "logo.png",
            ContentId = "logo-content",
            SortOrder = 1
        };

        var message = await composer.BuildAsync(CreateDispatchItem(session, campaign), CreateProfile(session), CancellationToken.None);
        var inlineResource = Assert.Single(message.BodyParts.OfType<MimePart>(), x => x.ContentId == "logo-content");

        Assert.Equal("logo.png", inlineResource.FileName);
        Assert.Equal("fake-image-bytes", ReadMimePartText(inlineResource));
        Assert.Empty(message.Attachments);
    }

    private static Session CreateSession()
    {
        var dataLayer = new SimpleDataLayer(new InMemoryDataStore());
        return new Session(dataLayer);
    }

    private static MailDispatchItem CreateDispatchItem(Session session, MailCampaign campaign)
    {
        return new MailDispatchItem(session)
        {
            Campaign = campaign,
            RecipientEmail = "client@example.com",
            RecipientDisplayName = "Client",
            LegacyOrgName = "Client Org"
        };
    }

    private static MailTransportProfile CreateProfile(Session session)
    {
        return new MailTransportProfile(session)
        {
            SenderEmail = "sender@example.com",
            SenderName = "CRM Sender",
            ReplyToEmail = "reply@example.com"
        };
    }

    private static string ReadMimePartText(MimePart part)
    {
        using var memory = new MemoryStream();
        Assert.NotNull(part.Content);
        part.Content.DecodeTo(memory);
        return Encoding.UTF8.GetString(memory.ToArray());
    }

    private sealed record StoredFileContent(string FileName, string ContentType, string Content);

    private sealed class StubFileStorageService(params StoredFileContent[] files) : IFileStorageService
    {
        private readonly StoredFileContent[] _files = files.Length > 0
            ? files
            : [new StoredFileContent("empty.txt", "text/plain", string.Empty)];

        public Task<StoredFileDto> SaveAsync(FileUploadCommand command, CancellationToken cancellationToken)
            => throw new NotSupportedException();

        public Task<StoredFileDto?> GetAsync(int id, CancellationToken cancellationToken)
            => Task.FromResult<StoredFileDto?>(CreateMetadata(id, _files[Math.Clamp(id, 0, _files.Length - 1)]));

        public Task<(StoredFileDto Metadata, Stream Content)?> OpenReadAsync(int id, CancellationToken cancellationToken)
        {
            var content = _files[Math.Clamp(id, 0, _files.Length - 1)];
            var metadata = CreateMetadata(id, content);
            Stream stream = new MemoryStream(Encoding.UTF8.GetBytes(content.Content));
            return Task.FromResult<(StoredFileDto Metadata, Stream Content)?>(new ValueTuple<StoredFileDto, Stream>(metadata, stream));
        }

        public string GetAbsolutePath(MailStoredFile file) => file.RelativePath ?? string.Empty;

        private static StoredFileDto CreateMetadata(int id, StoredFileContent content)
        {
            return new StoredFileDto
            {
                Id = id,
                OriginalFileName = content.FileName,
                StoredFileName = content.FileName,
                RelativePath = content.FileName,
                ContentType = content.ContentType,
                Length = Encoding.UTF8.GetByteCount(content.Content),
                UploadedAtUtc = DateTime.UtcNow
            };
        }
    }
}

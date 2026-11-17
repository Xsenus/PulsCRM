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

        var settings = GetOrCreateSettings(me);
        settings.NotificationsEnabled = request.NotificationsEnabled;
        settings.SoundEnabled = request.SoundEnabled;
        settings.SoundName = request.SoundName;
        settings.SoundVolume = request.SoundVolume;
        settings.ShowMessagePreview = request.ShowMessagePreview;
        settings.DesktopNotificationsEnabled = request.DesktopNotificationsEnabled;
        settings.UpdatedAtUtc = DateTime.UtcNow;
        unitOfWork.CommitChanges();

        return Task.FromResult(ToSettingsDto(settings));
    }

    public Task<ChatDockStateDto> GetDockStateAsync(CancellationToken cancellationToken)
    {
        var me = CurrentUserId;
        var settings = new XPQuery<ChatUserSettings>(unitOfWork).FirstOrDefault(x => x.UserId == me);
        if (settings is null)
        {
            return Task.FromResult(new ChatDockStateDto());
        }

        var conversationId = settings.DockConversationId > 0 && CanAccessConversation(settings.DockConversationId, me)
            ? settings.DockConversationId
            : (int?)null;
        var hasSize = settings.DockWidth > 0 && settings.DockHeight > 0;
        return Task.FromResult(new ChatDockStateDto
        {
            Open = settings.DockOpen,
            ConversationId = conversationId,
            Width = hasSize ? settings.DockWidth : null,
            Height = hasSize ? settings.DockHeight : null
        });
    }

    public Task<ChatDockStateDto> UpdateDockStateAsync(ChatDockStateDto request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        var me = CurrentUserId;
        ValidationHelper.Guard(request.Width is null == request.Height is null, "Укажите и ширину, и высоту окна.");
        ValidationHelper.Guard(request.Width is null || request.Width is >= ChatDockStateDto.MinSize and <= ChatDockStateDto.MaxSize, "Недопустимая ширина окна.");
        ValidationHelper.Guard(request.Height is null || request.Height is >= ChatDockStateDto.MinSize and <= ChatDockStateDto.MaxSize, "Недопустимая высота окна.");

        var settings = GetOrCreateSettings(me);
        settings.DockOpen = request.Open;
        // Чужой или недоступный диалог не запоминаем — окно откроется со списком.
        settings.DockConversationId = request.ConversationId is > 0 && CanAccessConversation(request.ConversationId.Value, me) ? request.ConversationId.Value : 0;
        settings.DockWidth = request.Width ?? 0;
        settings.DockHeight = request.Height ?? 0;
        settings.UpdatedAtUtc = DateTime.UtcNow;
        unitOfWork.CommitChanges();

        return GetDockStateAsync(cancellationToken);
    }
}

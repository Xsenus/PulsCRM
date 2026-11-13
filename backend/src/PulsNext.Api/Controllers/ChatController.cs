using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.Extensions.Options;
using PulsNext.Api.Models;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Возвращает 404, если модуль чата выключен. Срабатывает до создания контроллера,
/// поэтому выключенный чат не требует подключения к ChatDb.
/// </summary>
public sealed class ChatEnabledAttribute : Attribute, IResourceFilter
{
    public void OnResourceExecuting(ResourceExecutingContext context)
    {
        var feature = context.HttpContext.RequestServices.GetService(typeof(ChatFeature)) as ChatFeature;
        if (feature is not { IsEnabled: true })
        {
            context.Result = new NotFoundObjectResult(new ApiErrorResponse { Message = "Чат отключен на сервере." });
        }
    }

    public void OnResourceExecuted(ResourceExecutedContext context)
    {
    }
}

/// <summary>
/// Состояние модуля чата. Доступно и при выключенном чате, чтобы интерфейс знал, показывать ли раздел.
/// </summary>
[ApiController]
[Authorize]
[Route("api/chat/status")]
public sealed class ChatStatusController(ChatFeature feature, IOptions<ChatOptions> chatOptions, ICurrentUserAccessor currentUserAccessor) : ControllerBase
{
    /// <summary>
    /// Включен ли чат и его ограничения.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(ChatStatusDto), StatusCodes.Status200OK)]
    public ActionResult<ChatStatusDto> Get()
    {
        var options = chatOptions.Value;
        return Ok(new ChatStatusDto
        {
            Enabled = feature.IsEnabled,
            CurrentUserId = currentUserAccessor.GetLegacyUserId() ?? 0,
            MaxAttachmentBytes = options.MaxAttachmentBytes,
            MaxAttachmentsPerMessage = options.MaxAttachmentsPerMessage,
            MaxMessageLength = options.MaxMessageLength
        });
    }
}

/// <summary>
/// Чат сотрудников: личные и групповые диалоги, сообщения, вложения, реакции.
/// </summary>
[ApiController]
[Authorize]
[ChatEnabled]
[Route("api/chat")]
public sealed class ChatController(IChatService chatService) : ControllerBase
{
    /// <summary>
    /// Поиск сотрудников, которым можно написать.
    /// </summary>
    [HttpGet("users")]
    [ProducesResponseType(typeof(IReadOnlyCollection<ChatUserDto>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyCollection<ChatUserDto>> SearchUsers([FromQuery] string? search, [FromQuery] int? take)
        => Ok(chatService.SearchUsers(search, take ?? 30));

    /// <summary>
    /// Диалоги текущего пользователя: закрепленные сверху, затем по времени последнего сообщения.
    /// </summary>
    [HttpGet("conversations")]
    [ProducesResponseType(typeof(IReadOnlyCollection<ChatConversationDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<ChatConversationDto>>> GetConversations([FromQuery] bool includeArchived, CancellationToken cancellationToken)
        => Ok(await chatService.GetConversationsAsync(includeArchived, cancellationToken));

    /// <summary>
    /// Диалог по id.
    /// </summary>
    [HttpGet("conversations/{id:int}")]
    [ProducesResponseType(typeof(ChatConversationDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<ChatConversationDto>> GetConversation([FromRoute] int id, CancellationToken cancellationToken)
        => Ok(await chatService.GetConversationAsync(id, cancellationToken));

    /// <summary>
    /// Открывает личный диалог с сотрудником (создает, если его еще нет).
    /// </summary>
    [HttpPost("conversations/direct")]
    [ProducesResponseType(typeof(ChatConversationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatConversationDto>> OpenDirect([FromBody] ChatCreateDirectRequest request, CancellationToken cancellationToken)
        => Ok(await chatService.OpenDirectAsync(request.UserId, cancellationToken));

    /// <summary>
    /// Создает групповой чат. Создатель становится его владельцем.
    /// </summary>
    [HttpPost("conversations/group")]
    [ProducesResponseType(typeof(ChatConversationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatConversationDto>> CreateGroup([FromBody] ChatCreateGroupRequest request, CancellationToken cancellationToken)
        => Ok(await chatService.CreateGroupAsync(request, cancellationToken));

    /// <summary>
    /// Меняет название, описание и иконку группового чата.
    /// </summary>
    [HttpPut("conversations/{id:int}")]
    [ProducesResponseType(typeof(ChatConversationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatConversationDto>> UpdateGroup([FromRoute] int id, [FromBody] ChatUpdateGroupRequest request, CancellationToken cancellationToken)
        => Ok(await chatService.UpdateGroupAsync(id, request, cancellationToken));

    /// <summary>
    /// Добавляет участников в групповой чат.
    /// </summary>
    [HttpPost("conversations/{id:int}/members")]
    [ProducesResponseType(typeof(ChatConversationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatConversationDto>> AddMembers([FromRoute] int id, [FromBody] ChatMembersRequest request, CancellationToken cancellationToken)
        => Ok(await chatService.AddMembersAsync(id, request.UserIds, cancellationToken));

    /// <summary>
    /// Исключает участника из группового чата.
    /// </summary>
    [HttpDelete("conversations/{id:int}/members/{userId:int}")]
    [ProducesResponseType(typeof(ChatConversationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatConversationDto>> RemoveMember([FromRoute] int id, [FromRoute] int userId, CancellationToken cancellationToken)
        => Ok(await chatService.RemoveMemberAsync(id, userId, cancellationToken));

    /// <summary>
    /// Назначает или снимает администратора группового чата (только создатель).
    /// </summary>
    [HttpPut("conversations/{id:int}/members/{userId:int}/role")]
    [ProducesResponseType(typeof(ChatConversationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatConversationDto>> SetMemberRole([FromRoute] int id, [FromRoute] int userId, [FromBody] ChatParticipantRoleRequest request, CancellationToken cancellationToken)
        => Ok(await chatService.SetMemberRoleAsync(id, userId, request.Role, cancellationToken));

    /// <summary>
    /// Выход из группового чата.
    /// </summary>
    [HttpPost("conversations/{id:int}/leave")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Leave([FromRoute] int id, CancellationToken cancellationToken)
    {
        await chatService.LeaveAsync(id, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Личные настройки диалога: без звука, закреплен, в архиве.
    /// </summary>
    [HttpPut("conversations/{id:int}/preferences")]
    [ProducesResponseType(typeof(ChatConversationDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatConversationDto>> UpdatePreferences([FromRoute] int id, [FromBody] ChatConversationPreferencesRequest request, CancellationToken cancellationToken)
        => Ok(await chatService.UpdatePreferencesAsync(id, request, cancellationToken));

    /// <summary>
    /// Сообщения диалога, от новых к старым страницами; внутри страницы — по возрастанию.
    /// </summary>
    [HttpGet("conversations/{id:int}/messages")]
    [ProducesResponseType(typeof(ChatMessagePageDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatMessagePageDto>> GetMessages([FromRoute] int id, [FromQuery] int? before, [FromQuery] int? take, CancellationToken cancellationToken)
        => Ok(await chatService.GetMessagesAsync(id, before, take ?? 0, cancellationToken));

    /// <summary>
    /// Отправляет сообщение. Вложения загружаются заранее через <c>POST conversations/{id}/attachments</c>.
    /// </summary>
    [HttpPost("conversations/{id:int}/messages")]
    [ProducesResponseType(typeof(ChatMessageDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatMessageDto>> SendMessage([FromRoute] int id, [FromBody] ChatSendMessageRequest request, CancellationToken cancellationToken)
        => Ok(await chatService.SendMessageAsync(id, request, cancellationToken));

    /// <summary>
    /// Отмечает диалог прочитанным до указанного сообщения.
    /// </summary>
    [HttpPost("conversations/{id:int}/read")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> MarkRead([FromRoute] int id, [FromBody] ChatMarkReadRequest? request, CancellationToken cancellationToken)
    {
        await chatService.MarkReadAsync(id, request?.MessageId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Сообщает собеседникам, что пользователь печатает.
    /// </summary>
    [HttpPost("conversations/{id:int}/typing")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> Typing([FromRoute] int id, CancellationToken cancellationToken)
    {
        await chatService.NotifyTypingAsync(id, null, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Редактирует свое сообщение.
    /// </summary>
    [HttpPut("messages/{messageId:int}")]
    [ProducesResponseType(typeof(ChatMessageDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatMessageDto>> EditMessage([FromRoute] int messageId, [FromBody] ChatEditMessageRequest request, CancellationToken cancellationToken)
        => Ok(await chatService.EditMessageAsync(messageId, request.Text, cancellationToken));

    /// <summary>
    /// Удаляет сообщение: свое — всегда, чужое — администратор группового чата.
    /// </summary>
    [HttpDelete("messages/{messageId:int}")]
    [ProducesResponseType(typeof(ChatMessageDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatMessageDto>> DeleteMessage([FromRoute] int messageId, CancellationToken cancellationToken)
        => Ok(await chatService.DeleteMessageAsync(messageId, cancellationToken));

    /// <summary>
    /// Ставит или снимает реакцию на сообщение.
    /// </summary>
    [HttpPost("messages/{messageId:int}/reactions")]
    [ProducesResponseType(typeof(ChatMessageDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatMessageDto>> ToggleReaction([FromRoute] int messageId, [FromBody] ChatReactionRequest request, CancellationToken cancellationToken)
        => Ok(await chatService.ToggleReactionAsync(messageId, request.Emoji, cancellationToken));

    /// <summary>
    /// Загружает вложение для будущего сообщения в диалоге.
    /// </summary>
    [HttpPost("conversations/{id:int}/attachments")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ChatAttachmentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ChatAttachmentDto>> UploadAttachment([FromRoute] int id, [FromForm] ChatAttachmentUploadRequest request, CancellationToken cancellationToken)
    {
        if (request.File is null || request.File.Length == 0)
        {
            throw new ValidationException("Файл не выбран.");
        }

        await using var stream = request.File.OpenReadStream();
        return Ok(await chatService.UploadAttachmentAsync(id, new ChatAttachmentUploadCommand
        {
            Content = stream,
            FileName = request.File.FileName,
            ContentType = request.File.ContentType
        }, cancellationToken));
    }

    /// <summary>
    /// Удаляет загруженное, но еще не отправленное вложение.
    /// </summary>
    [HttpDelete("attachments/{attachmentId:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    public async Task<IActionResult> DeletePendingAttachment([FromRoute] int attachmentId, CancellationToken cancellationToken)
    {
        await chatService.DeletePendingAttachmentAsync(attachmentId, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Скачивает вложение. С <c>inline=true</c> изображение отдается для просмотра в браузере.
    /// </summary>
    [HttpGet("attachments/{attachmentId:int}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadAttachment([FromRoute] int attachmentId, [FromQuery] bool inline, CancellationToken cancellationToken)
    {
        var opened = await chatService.OpenAttachmentAsync(attachmentId, cancellationToken);
        if (opened is null)
        {
            return NotFound();
        }

        var (metadata, content) = opened.Value;
        Response.Headers["X-Content-Type-Options"] = "nosniff";
        if (inline && metadata.IsImage)
        {
            Response.Headers["Cache-Control"] = "private, max-age=86400";
            return File(content, metadata.ContentType, enableRangeProcessing: true);
        }

        return File(content, metadata.ContentType, metadata.FileName, enableRangeProcessing: true);
    }

    /// <summary>
    /// Число непрочитанных сообщений (без диалогов «без звука»).
    /// </summary>
    [HttpGet("unread")]
    [ProducesResponseType(typeof(ChatUnreadSummaryDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatUnreadSummaryDto>> GetUnread(CancellationToken cancellationToken)
        => Ok(await chatService.GetUnreadSummaryAsync(cancellationToken));

    /// <summary>
    /// Настройки оповещений чата текущего пользователя.
    /// </summary>
    [HttpGet("settings")]
    [ProducesResponseType(typeof(ChatUserSettingsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatUserSettingsDto>> GetSettings(CancellationToken cancellationToken)
        => Ok(await chatService.GetSettingsAsync(cancellationToken));

    /// <summary>
    /// Состояние плавающего окна чата: открыто ли, какой диалог и размер.
    /// </summary>
    [HttpGet("dock")]
    [ProducesResponseType(typeof(ChatDockStateDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatDockStateDto>> GetDockState(CancellationToken cancellationToken)
        => Ok(await chatService.GetDockStateAsync(cancellationToken));

    /// <summary>
    /// Сохраняет состояние плавающего окна чата.
    /// </summary>
    [HttpPut("dock")]
    [ProducesResponseType(typeof(ChatDockStateDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ChatDockStateDto>> UpdateDockState([FromBody] ChatDockStateDto request, CancellationToken cancellationToken)
        => Ok(await chatService.UpdateDockStateAsync(request, cancellationToken));

    /// <summary>
    /// Сохраняет настройки оповещений: звук, громкость, предпросмотр текста.
    /// </summary>
    [HttpPut("settings")]
    [ProducesResponseType(typeof(ChatUserSettingsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ChatUserSettingsDto>> UpdateSettings([FromBody] ChatUserSettingsDto request, CancellationToken cancellationToken)
        => Ok(await chatService.UpdateSettingsAsync(request, cancellationToken));
}

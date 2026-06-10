using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Api.Models;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Управление кампаниями рассылок, предпросмотром и статистикой отправок.
/// </summary>
[ApiController]
[Authorize]
[Route("api/campaigns")]
public sealed class CampaignsController(ICampaignService campaignService, IStatisticsService statisticsService) : ControllerBase
{
    /// <summary>
    /// Возвращает постраничный список кампаний.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<CampaignListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<CampaignListItemDto>>> Get([FromQuery] CampaignListQuery query, CancellationToken cancellationToken)
    {
        var result = await campaignService.GetAsync(
            query.Search,
            query.Status,
            query.Skip ?? 0,
            query.Take ?? 100,
            cancellationToken);

        return Ok(result);
    }

    /// <summary>
    /// Возвращает полную карточку кампании.
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(CampaignDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CampaignDetailsDto>> GetById([FromRoute] int id, CancellationToken cancellationToken)
    {
        var result = await campaignService.GetByIdAsync(id, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Создает новую кампанию рассылки.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(CampaignDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CampaignDetailsDto>> Create([FromBody] CampaignUpsertRequest request, CancellationToken cancellationToken)
    {
        return Ok(await campaignService.UpsertAsync(null, request, cancellationToken));
    }

    /// <summary>
    /// Обновляет существующую кампанию рассылки.
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(CampaignDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CampaignDetailsDto>> Update([FromRoute] int id, [FromBody] CampaignUpsertRequest request, CancellationToken cancellationToken)
    {
        return Ok(await campaignService.UpsertAsync(id, request, cancellationToken));
    }

    /// <summary>
    /// Удаляет кампанию.
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete([FromRoute] int id, CancellationToken cancellationToken)
    {
        await campaignService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Строит предпросмотр расписания на основании параметров кампании.
    /// </summary>
    [HttpPost("preview-schedule")]
    [ProducesResponseType(typeof(IReadOnlyCollection<ScheduleOccurrenceDto>), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<IReadOnlyCollection<ScheduleOccurrenceDto>>> PreviewSchedule([FromBody] SchedulePreviewRequest request, CancellationToken cancellationToken)
    {
        return Ok(await campaignService.PreviewScheduleAsync(request, cancellationToken));
    }

    /// <summary>
    /// Строит предпросмотр списка получателей без фактической отправки писем.
    /// </summary>
    [HttpPost("preview-recipients")]
    [ProducesResponseType(typeof(CampaignRecipientPreviewDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CampaignRecipientPreviewDto>> PreviewRecipients([FromBody] CampaignUpsertRequest request, CancellationToken cancellationToken)
    {
        return Ok(await campaignService.PreviewRecipientsAsync(request, cancellationToken));
    }

    /// <summary>
    /// Проверяет готовность кампании к запуску без фактической отправки писем.
    /// </summary>
    [HttpPost("readiness")]
    [ProducesResponseType(typeof(CampaignReadinessDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<CampaignReadinessDto>> CheckReadiness([FromBody] CampaignUpsertRequest request, CancellationToken cancellationToken)
    {
        return Ok(await campaignService.CheckReadinessAsync(request, cancellationToken));
    }

    /// <summary>
    /// Меняет статус кампании.
    /// </summary>
    [HttpPost("{id:int}/status")]
    [ProducesResponseType(typeof(CampaignDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CampaignDetailsDto>> ChangeStatus([FromRoute] int id, [FromBody] CampaignStatusChangeRequest request, CancellationToken cancellationToken)
    {
        return Ok(await campaignService.ChangeStatusAsync(id, request.Status, cancellationToken));
    }

    /// <summary>
    /// Запускает кампанию вручную и формирует новую партию отправки.
    /// </summary>
    [HttpPost("{id:int}/run")]
    [ProducesResponseType(typeof(DispatchBatchDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DispatchBatchDto>> Run([FromRoute] int id, [FromBody] CampaignManualRunRequest request, CancellationToken cancellationToken)
    {
        return Ok(await campaignService.RunAsync(id, request, cancellationToken));
    }

    /// <summary>
    /// Возвращает статистику отправок по кампании.
    /// </summary>
    [HttpGet("{id:int}/stats")]
    [ProducesResponseType(typeof(CampaignStatisticsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<CampaignStatisticsDto>> GetStatistics([FromRoute] int id, CancellationToken cancellationToken)
    {
        return Ok(await statisticsService.GetCampaignStatisticsAsync(id, cancellationToken));
    }
}

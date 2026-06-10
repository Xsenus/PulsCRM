using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Api.Models;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Диагностика очереди рассылок и операторские действия с элементами отправки.
/// </summary>
[ApiController]
[Authorize]
[Route("api/dispatch")]
public sealed class DispatchController(IDispatchDiagnosticsService dispatchDiagnosticsService) : ControllerBase
{
    /// <summary>
    /// Возвращает элементы очереди отправки с фильтрами по статусу, кампании и партии.
    /// </summary>
    [HttpGet("items")]
    [ProducesResponseType(typeof(PagedResult<DispatchItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<DispatchItemDto>>> GetItems([FromQuery] DispatchItemListQuery query, CancellationToken cancellationToken)
    {
        return Ok(await dispatchDiagnosticsService.GetItemsAsync(query, cancellationToken));
    }

    /// <summary>
    /// Возвращает партии отправки с фильтром по кампании.
    /// </summary>
    [HttpGet("batches")]
    [ProducesResponseType(typeof(PagedResult<DispatchBatchDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<DispatchBatchDto>>> GetBatches([FromQuery] DispatchBatchListQuery query, CancellationToken cancellationToken)
    {
        return Ok(await dispatchDiagnosticsService.GetBatchesAsync(query, cancellationToken));
    }

    /// <summary>
    /// Возвращает ошибочный или отложенный элемент в очередь на ближайшую попытку.
    /// </summary>
    [HttpPost("items/{id:int}/retry")]
    [ProducesResponseType(typeof(DispatchItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DispatchItemDto>> RetryItem([FromRoute] int id, CancellationToken cancellationToken)
    {
        return Ok(await dispatchDiagnosticsService.RetryItemAsync(id, cancellationToken));
    }

    /// <summary>
    /// Отменяет элемент очереди, если письмо еще не было отправлено.
    /// </summary>
    [HttpPost("items/{id:int}/cancel")]
    [ProducesResponseType(typeof(DispatchItemDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<DispatchItemDto>> CancelItem([FromRoute] int id, CancellationToken cancellationToken)
    {
        return Ok(await dispatchDiagnosticsService.CancelItemAsync(id, cancellationToken));
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Api.Models;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Настройка SMTP-профилей, используемых рассылками.
/// </summary>
[ApiController]
[Authorize]
[Route("api/transport-profiles")]
public sealed class TransportProfilesController(ITransportProfileService transportProfileService) : ControllerBase
{
    /// <summary>
    /// Возвращает все транспортные профили.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<TransportProfileDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<TransportProfileDto>>> Get(CancellationToken cancellationToken)
    {
        return Ok(await transportProfileService.GetAllAsync(cancellationToken));
    }

    /// <summary>
    /// Возвращает транспортный профиль по идентификатору.
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(TransportProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransportProfileDto>> GetById([FromRoute] int id, CancellationToken cancellationToken)
    {
        var result = await transportProfileService.GetByIdAsync(id, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Создает новый транспортный профиль.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(TransportProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<TransportProfileDto>> Create([FromBody] TransportProfileUpsertRequest request, CancellationToken cancellationToken)
    {
        return Ok(await transportProfileService.UpsertAsync(null, request, cancellationToken));
    }

    /// <summary>
    /// Обновляет существующий транспортный профиль.
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(TransportProfileDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransportProfileDto>> Update([FromRoute] int id, [FromBody] TransportProfileUpsertRequest request, CancellationToken cancellationToken)
    {
        return Ok(await transportProfileService.UpsertAsync(id, request, cancellationToken));
    }

    /// <summary>
    /// Удаляет транспортный профиль.
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete([FromRoute] int id, CancellationToken cancellationToken)
    {
        await transportProfileService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    /// <summary>
    /// Выполняет тест подключения для выбранного профиля.
    /// </summary>
    [HttpPost("{id:int}/test")]
    [ProducesResponseType(typeof(TransportProfileTestResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TransportProfileTestResultDto>> Test([FromRoute] int id, CancellationToken cancellationToken)
    {
        return Ok(await transportProfileService.TestAsync(id, cancellationToken));
    }
}

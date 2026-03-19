using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Api.Models;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Работа с карточками организаций и их справочниками.
/// </summary>
[ApiController]
[Authorize]
[Route("api/organizations")]
public sealed class OrganizationsController(IOrganizationService organizationService) : ControllerBase
{
    /// <summary>
    /// Возвращает постраничный список организаций.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<OrganizationListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<OrganizationListItemDto>>> Get([FromQuery] OrganizationListQuery query, CancellationToken cancellationToken)
    {
        var result = await organizationService.GetAsync(
            query.Search,
            ParseRaionIds(query),
            query.Skip ?? 0,
            query.Take ?? 100,
            cancellationToken);

        return Ok(result);
    }

    /// <summary>
    /// Возвращает агрегированный список районов для фильтрации организаций.
    /// </summary>
    [HttpGet("raions")]
    [ProducesResponseType(typeof(IReadOnlyCollection<OrganizationRaionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<OrganizationRaionDto>>> GetRaions([FromQuery] OrganizationRaionsQuery query, CancellationToken cancellationToken)
    {
        return Ok(await organizationService.GetRaionsAsync(query.Search, cancellationToken));
    }

    /// <summary>
    /// Возвращает справочники, необходимые для формы редактирования организации.
    /// </summary>
    [HttpGet("lookups")]
    [ProducesResponseType(typeof(OrganizationEditorLookupsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<OrganizationEditorLookupsDto>> GetLookups(CancellationToken cancellationToken)
    {
        return Ok(await organizationService.GetLookupsAsync(cancellationToken));
    }

    /// <summary>
    /// Возвращает карточку организации по идентификатору.
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(OrganizationDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrganizationDetailsDto>> GetById([FromRoute] int id, CancellationToken cancellationToken)
    {
        var result = await organizationService.GetByIdAsync(id, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Создает новую организацию.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(OrganizationDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<OrganizationDetailsDto>> Create([FromBody] OrganizationUpsertRequest request, CancellationToken cancellationToken)
    {
        return Ok(await organizationService.UpsertAsync(null, request, cancellationToken));
    }

    /// <summary>
    /// Обновляет существующую организацию.
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(OrganizationDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<OrganizationDetailsDto>> Update([FromRoute] int id, [FromBody] OrganizationUpsertRequest request, CancellationToken cancellationToken)
    {
        return Ok(await organizationService.UpsertAsync(id, request, cancellationToken));
    }

    /// <summary>
    /// Удаляет организацию.
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete([FromRoute] int id, CancellationToken cancellationToken)
    {
        await organizationService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }

    private static IReadOnlyCollection<int> ParseRaionIds(OrganizationListQuery query)
    {
        if (!string.IsNullOrWhiteSpace(query.RaionIds))
        {
            return query.RaionIds
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .Select(value => int.TryParse(value, out var parsed) ? parsed : 0)
                .Where(value => value != 0)
                .Distinct()
                .ToArray();
        }

        return query.RaionId is > 0 ? [query.RaionId.Value] : [];
    }
}

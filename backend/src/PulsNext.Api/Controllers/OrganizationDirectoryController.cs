using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Справочник организаций только для чтения — для любого вошедшего сотрудника: поиск, реквизиты и контакты.
/// Полная карточка и редактирование — /api/organizations, только администраторам.
/// </summary>
[ApiController]
[Authorize]
[Route("api/organization-directory")]
public sealed class OrganizationDirectoryController(IOrganizationDirectoryService directoryService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<OrganizationDirectoryItemDto>), StatusCodes.Status200OK)]
    public ActionResult<PagedResult<OrganizationDirectoryItemDto>> Search([FromQuery] string? search, [FromQuery] int? skip, [FromQuery] int? take)
        => Ok(directoryService.Search(search, skip ?? 0, take ?? 25));

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(OrganizationDirectoryCardDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<OrganizationDirectoryCardDto> GetCard([FromRoute] int id)
        => directoryService.GetCard(id) is { } card ? Ok(card) : NotFound();
}

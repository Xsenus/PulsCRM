using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Справочник коллег для всех сотрудников: рабочие контакты и фото, без служебных данных.
/// Полная карточка сотрудника (логин, права, код 1С) — только администраторам, в /api/employees.
/// </summary>
[ApiController]
[Authorize]
[Route("api/colleagues")]
public sealed class ColleaguesController(IColleagueService colleagueService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(IReadOnlyCollection<ColleagueDto>), StatusCodes.Status200OK)]
    public ActionResult<IReadOnlyCollection<ColleagueDto>> GetAll() => Ok(colleagueService.GetAll());

    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(ColleagueDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public ActionResult<ColleagueDto> GetById([FromRoute] int id)
        => colleagueService.GetById(id) is { } colleague ? Ok(colleague) : NotFound();

    [HttpGet("{id:int}/photo")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetPhoto([FromRoute] int id)
    {
        if (colleagueService.GetPhoto(id) is not { } photo)
        {
            return NotFound();
        }

        Response.Headers.CacheControl = "private, max-age=3600";
        return File(photo.Content, photo.ContentType);
    }
}

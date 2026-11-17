using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// «Мои задачи» на дашборде — для любого вошедшего сотрудника: только поручения ему и от него.
/// Полный список задач (все сотрудники) — /api/work, только администраторам.
/// </summary>
[ApiController]
[Authorize]
[Route("api/my-work")]
public sealed class MyWorkController(IMyWorkService myWorkService) : ControllerBase
{
    [HttpGet]
    [ProducesResponseType(typeof(MyWorkDto), StatusCodes.Status200OK)]
    public ActionResult<MyWorkDto> Get([FromQuery] int? take) => Ok(myWorkService.Get(take ?? 10));
}

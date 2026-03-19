using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Api.Models;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Просмотр рабочих задач, пришедших из legacy-части системы.
/// </summary>
[ApiController]
[Authorize]
[Route("api/work")]
public sealed class WorkController(IWorkService workService) : ControllerBase
{
    /// <summary>
    /// Возвращает список задач с фильтрацией по сотруднику, организации и статусу.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<WorkItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<WorkItemDto>>> Get([FromQuery] WorkListQuery query, CancellationToken cancellationToken)
    {
        var result = await workService.GetAsync(
            query.Search,
            query.OrgId,
            query.EmployeeId,
            query.OnlyOpen ?? false,
            query.Skip ?? 0,
            query.Take ?? 200,
            cancellationToken);

        return Ok(result);
    }
}

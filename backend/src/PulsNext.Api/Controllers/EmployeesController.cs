using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Api.Models;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Управление пользователями и сотрудниками CRM.
/// </summary>
[ApiController]
[Authorize]
[Route("api/employees")]
public sealed class EmployeesController(IEmployeeService employeeService) : ControllerBase
{
    /// <summary>
    /// Возвращает постраничный список сотрудников.
    /// </summary>
    [HttpGet]
    [ProducesResponseType(typeof(PagedResult<EmployeeListItemDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<PagedResult<EmployeeListItemDto>>> Get([FromQuery] EmployeeListQuery query, CancellationToken cancellationToken)
    {
        var result = await employeeService.GetAsync(
            query.Search,
            query.Skip ?? 0,
            query.Take ?? 100,
            query.IncludeDismissed ?? false,
            cancellationToken);

        return Ok(result);
    }

    /// <summary>
    /// Возвращает справочники, необходимые для формы редактирования сотрудника.
    /// </summary>
    [HttpGet("lookups")]
    [ProducesResponseType(typeof(EmployeeEditorLookupsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<EmployeeEditorLookupsDto>> GetLookups(CancellationToken cancellationToken)
    {
        return Ok(await employeeService.GetLookupsAsync(cancellationToken));
    }

    /// <summary>
    /// Возвращает карточку сотрудника по идентификатору.
    /// </summary>
    [HttpGet("{id:int}")]
    [ProducesResponseType(typeof(EmployeeDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployeeDetailsDto>> GetById([FromRoute] int id, CancellationToken cancellationToken)
    {
        var result = await employeeService.GetByIdAsync(id, cancellationToken);
        return result is null ? NotFound() : Ok(result);
    }

    /// <summary>
    /// Создает нового сотрудника.
    /// </summary>
    [HttpPost]
    [ProducesResponseType(typeof(EmployeeDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<EmployeeDetailsDto>> Create([FromBody] EmployeeUpsertRequest request, CancellationToken cancellationToken)
    {
        return Ok(await employeeService.UpsertAsync(null, request, cancellationToken));
    }

    /// <summary>
    /// Обновляет существующего сотрудника.
    /// </summary>
    [HttpPut("{id:int}")]
    [ProducesResponseType(typeof(EmployeeDetailsDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<ActionResult<EmployeeDetailsDto>> Update([FromRoute] int id, [FromBody] EmployeeUpsertRequest request, CancellationToken cancellationToken)
    {
        return Ok(await employeeService.UpsertAsync(id, request, cancellationToken));
    }

    /// <summary>
    /// Удаляет сотрудника.
    /// </summary>
    [HttpDelete("{id:int}")]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status404NotFound)]
    public async Task<IActionResult> Delete([FromRoute] int id, CancellationToken cancellationToken)
    {
        await employeeService.DeleteAsync(id, cancellationToken);
        return NoContent();
    }
}

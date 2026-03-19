using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Api.Models;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Служебные эндпоинты для проверки доступности API.
/// </summary>
[ApiController]
[AllowAnonymous]
[Route("health")]
public sealed class HealthController : ControllerBase
{
    /// <summary>
    /// Возвращает признак доступности API и текущее серверное время в UTC.
    /// </summary>
    /// <remarks>
    /// Эндпоинт не требует авторизации и используется балансировщиками, мониторингом и CI-проверками.
    /// </remarks>
    [HttpGet]
    [ProducesResponseType(typeof(HealthStatusResponse), StatusCodes.Status200OK)]
    public ActionResult<HealthStatusResponse> Get()
    {
        return Ok(new HealthStatusResponse
        {
            Status = "ok",
            Utc = DateTime.UtcNow
        });
    }
}

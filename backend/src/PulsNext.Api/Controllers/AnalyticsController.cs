using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Api.Models;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Аналитические отчеты по данным legacy-системы.
/// </summary>
[ApiController]
[Authorize]
[Route("api/analytics")]
public sealed class AnalyticsController(IParusLicenseAnalyticsService parusLicenseAnalyticsService) : ControllerBase
{
    /// <summary>
    /// Возвращает аналитику по лицензиям Парус 10 и Парус Торнадо за выбранный период.
    /// </summary>
    [HttpGet("parus-licenses")]
    [ProducesResponseType(typeof(ParusLicenseAnalyticsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ParusLicenseAnalyticsDto>> GetParusLicenses([FromQuery] ParusLicenseAnalyticsQuery query, CancellationToken cancellationToken)
    {
        var from = query.DateFromUtc ?? new DateTime(DateTime.UtcNow.Year, 1, 1);
        var to = query.DateToUtc ?? new DateTime(from.Year, 12, 31);

        return Ok(await parusLicenseAnalyticsService.GetAsync(from, to, cancellationToken));
    }
}

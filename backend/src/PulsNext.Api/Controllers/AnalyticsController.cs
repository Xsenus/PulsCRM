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

    /// <summary>
    /// Скачивает файл лицензии Парус из legacy-карточки организации.
    /// </summary>
    [HttpGet("parus-licenses/{clientId:int}/file")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> DownloadParusLicenseFile([FromRoute] int clientId, CancellationToken cancellationToken)
    {
        var file = await parusLicenseAnalyticsService.GetLicenseFileAsync(clientId, cancellationToken);
        if (file is null)
        {
            return NotFound();
        }

        return File(file.Content, file.ContentType, file.FileName);
    }
}

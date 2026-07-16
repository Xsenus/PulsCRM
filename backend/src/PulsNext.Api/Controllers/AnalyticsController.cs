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
public sealed class AnalyticsController(
    IParusLicenseAnalyticsService parusLicenseAnalyticsService,
    IParusLicenseImportService parusLicenseImportService) : ControllerBase
{
    /// <summary>
    /// Возвращает аналитику по лицензиям Парус 10 и Парус Торнадо за выбранный период.
    /// </summary>
    [HttpGet("parus-licenses")]
    [ProducesResponseType(typeof(ParusLicenseAnalyticsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<ParusLicenseAnalyticsDto>> GetParusLicenses([FromQuery] ParusLicenseAnalyticsQuery query, CancellationToken cancellationToken)
    {
        var from = query.DateFromUtc ?? query.From ?? new DateTime(DateTime.UtcNow.Year, 1, 1);
        var to = query.DateToUtc ?? query.To ?? new DateTime(from.Year, 12, 31);

        return Ok(await parusLicenseAnalyticsService.GetAsync(
            from,
            to,
            query.Search,
            query.Status,
            query.SalaryOnly == true,
            query.Skip ?? 0,
            query.Take ?? 10,
            cancellationToken));
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

    [HttpPost("parus-licenses/import-info")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ParusLicenseInfoImportResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ParusLicenseInfoImportResultDto>> ImportParusLicenseInfo(
        [FromForm] ParusLicenseInfoImportRequest request,
        CancellationToken cancellationToken)
    {
        if (request.File is null || request.File.Length == 0)
        {
            return BadRequest(new ApiErrorResponse { Message = "Файл XML не выбран." });
        }

        await using var stream = request.File.OpenReadStream();
        return Ok(await parusLicenseImportService.ImportInfoAsync(stream, request.File.FileName, request.DryRun, cancellationToken));
    }

    [HttpPost("parus-licenses/import-files")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ParusLicenseFileImportResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ParusLicenseFileImportResultDto>> ImportParusLicenseFiles(
        [FromForm] ParusLicenseFilesImportRequest request,
        CancellationToken cancellationToken)
    {
        var files = request.Files.Where(file => file.Length > 0).ToArray();
        if (files.Length == 0)
        {
            return BadRequest(new ApiErrorResponse { Message = "Файлы лицензий не выбраны." });
        }

        var importFiles = files.Select(file => new ParusLicenseFileImportItem(file.FileName, file.Length, file.OpenReadStream)).ToArray();
        return Ok(await parusLicenseImportService.ImportFilesAsync(importFiles, request.DryRun, cancellationToken));
    }

    [HttpPost("parus-licenses/import-cards")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ParusLicenseCardImportResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ParusLicenseCardImportResultDto>> ImportParusLicenseCards(
        [FromForm] ParusLicenseCardImportRequest request,
        CancellationToken cancellationToken)
    {
        if (request.File is null || request.File.Length == 0)
        {
            return BadRequest(new ApiErrorResponse { Message = "Файл с карточками лицензий не выбран." });
        }

        await using var stream = request.File.OpenReadStream();
        return Ok(await parusLicenseImportService.ImportCardInfoAsync(stream, request.File.FileName, request.DryRun, cancellationToken));
    }

    [HttpPost("parus-licenses/import-batch")]
    [Consumes("multipart/form-data")]
    [ProducesResponseType(typeof(ParusLicenseBatchImportResultDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<ParusLicenseBatchImportResultDto>> ImportParusLicenseBatch(
        [FromForm] ParusLicenseBatchImportRequest request,
        CancellationToken cancellationToken)
    {
        var files = request.Files.Where(file => file.Length > 0).ToArray();
        if (files.Length == 0)
        {
            return BadRequest(new ApiErrorResponse { Message = "Файлы для импорта Парус не выбраны." });
        }

        var importFiles = files.Select(file => new ParusLicenseFileImportItem(file.FileName, file.Length, file.OpenReadStream)).ToArray();
        return Ok(await parusLicenseImportService.ImportBatchAsync(importFiles, request.DryRun, cancellationToken));
    }
}

using System.Reflection;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Domain.Legacy;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Protected administrative diagnostics for the API environment.
/// </summary>
[ApiController]
[Authorize(Policy = AccessPolicies.Admin)]
[Route("api/diagnostics")]
public sealed class DiagnosticsController(
    IStorageDiagnosticsService storageDiagnosticsService,
    IDatabaseInfoService databaseInfoService,
    ICurrentUserAccessor currentUserAccessor,
    LegacyUnitOfWork legacyUnitOfWork) : ControllerBase
{
    /// <summary>
    /// Checks storage, uploads and Data Protection keys directory access.
    /// </summary>
    [HttpGet("storage")]
    [ProducesResponseType(typeof(StorageDiagnosticsDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<StorageDiagnosticsDto>> GetStorage(CancellationToken cancellationToken)
    {
        return Ok(await storageDiagnosticsService.CheckAsync(cancellationToken));
    }

    /// <summary>
    /// Состояние системы: базы, диск, ключи, место под файлы, очередь рассылок, последние ошибки журнала.
    /// </summary>
    [HttpGet("status")]
    [ProducesResponseType(typeof(SystemStatusDto), StatusCodes.Status200OK)]
    public async Task<ActionResult<SystemStatusDto>> GetStatus([FromServices] ISystemStatusService statusService, CancellationToken cancellationToken)
        => Ok(await statusService.GetAsync(cancellationToken));

    /// <summary>
    /// Файл журнала API за день (api-yyyyMMdd.log).
    /// </summary>
    [HttpGet("logs/{fileName}")]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public IActionResult GetLogFile([FromRoute] string fileName, [FromServices] ISystemStatusService statusService)
    {
        var path = statusService.GetLogFilePath(fileName);
        if (path is null)
        {
            return NotFound();
        }

        // Файл может дописываться прямо сейчас — открываем с общим доступом на запись.
        var stream = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete);
        return File(stream, "text/plain; charset=utf-8", fileName);
    }

    [HttpGet("database")]
    [ProducesResponseType(typeof(DatabaseInfoDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public ActionResult<DatabaseInfoDto> GetDatabase()
    {
        if (!IsCurrentUserRoot())
        {
            return Forbid();
        }

        var info = databaseInfoService.GetLegacyDatabaseInfo();
        info.ApplicationVersion = GetApplicationVersion();
        return Ok(info);
    }

    private static string GetApplicationVersion()
    {
        var assembly = typeof(DiagnosticsController).Assembly;
        return assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion
            ?? assembly.GetName().Version?.ToString()
            ?? "unknown";
    }

    private bool IsCurrentUserRoot()
    {
        var userId = currentUserAccessor.GetLegacyUserId();
        if (userId is null or <= 0)
        {
            return false;
        }

        return legacyUnitOfWork.GetObjectByKey<LegacyUser>(userId.Value)?.FlRoot == true;
    }
}

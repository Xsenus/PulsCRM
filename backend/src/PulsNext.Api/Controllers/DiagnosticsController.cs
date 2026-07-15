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
[Authorize]
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

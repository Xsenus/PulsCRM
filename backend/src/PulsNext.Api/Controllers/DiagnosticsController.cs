using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Protected administrative diagnostics for the API environment.
/// </summary>
[ApiController]
[Authorize]
[Route("api/diagnostics")]
public sealed class DiagnosticsController(IStorageDiagnosticsService storageDiagnosticsService) : ControllerBase
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
}

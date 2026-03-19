using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Api.Models;
using PulsNext.Infrastructure;

namespace PulsNext.Api.Controllers;

/// <summary>
/// Авторизация и получение информации о текущем пользователе.
/// </summary>
[ApiController]
[Route("api/auth")]
public sealed class AuthController(IAuthService authService) : ControllerBase
{
    /// <summary>
    /// Выполняет вход пользователя и выдает JWT-токен.
    /// </summary>
    /// <remarks>
    /// В ответе возвращается токен доступа, срок его действия и профиль пользователя, который будет работать в системе.
    /// </remarks>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(AuthResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request, CancellationToken cancellationToken)
    {
        var response = await authService.LoginAsync(request, cancellationToken);
        return Ok(response);
    }

    /// <summary>
    /// Возвращает список пользователей, подходящих для выбора на форме входа.
    /// </summary>
    [HttpGet("users")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(IReadOnlyCollection<LoginUserOptionDto>), StatusCodes.Status200OK)]
    public async Task<ActionResult<IReadOnlyCollection<LoginUserOptionDto>>> GetUsers([FromQuery] LoginUsersQuery query, CancellationToken cancellationToken)
    {
        var result = await authService.GetLoginUsersAsync(query.Search, query.Take ?? 12, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Возвращает профиль текущего авторизованного пользователя.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    [ProducesResponseType(typeof(CurrentUserDto), StatusCodes.Status200OK)]
    [ProducesResponseType(typeof(ApiErrorResponse), StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult<CurrentUserDto>> Me(CancellationToken cancellationToken)
    {
        var current = await authService.GetCurrentAsync(cancellationToken);
        return current is null ? Unauthorized() : Ok(current);
    }
}

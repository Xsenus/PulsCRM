using Microsoft.AspNetCore.Authorization;
using PulsNext.Domain.Legacy;

namespace PulsNext.Infrastructure;

/// <summary>
/// Политики доступа API. Администратор — сотрудник с флагом «Администратор системы» (set_User.FlRoot).
/// </summary>
public static class AccessPolicies
{
    /// <summary>
    /// Разделы администрирования: рассылки, организации, очередь, настройки, аналитика, таблица сотрудников.
    /// </summary>
    public const string Admin = "Admin";
}

/// <summary>
/// Права текущего пользователя.
/// </summary>
public interface IAccessService
{
    bool IsCurrentUserAdmin();
}

/// <summary>
/// Флаг администратора читается из базы на каждый запрос (в пределах запроса — один раз): снятие галочки
/// «Администратор системы» действует сразу, не дожидаясь истечения токена.
/// </summary>
public sealed class AccessService(LegacyUnitOfWork legacyUnitOfWork, ICurrentUserAccessor currentUserAccessor) : IAccessService
{
    private bool? _isAdmin;

    public bool IsCurrentUserAdmin()
    {
        if (_isAdmin is { } cached)
        {
            return cached;
        }

        var userId = currentUserAccessor.GetLegacyUserId();
        var user = userId is > 0 ? legacyUnitOfWork.GetObjectByKey<LegacyUser>(userId.Value) : null;
        _isAdmin = user is not null && user.FlRoot && !ColleagueRules.IsDismissed(user);
        return _isAdmin.Value;
    }
}

public sealed class AdminRequirement : IAuthorizationRequirement;

public sealed class AdminAuthorizationHandler(IAccessService accessService) : AuthorizationHandler<AdminRequirement>
{
    protected override Task HandleRequirementAsync(AuthorizationHandlerContext context, AdminRequirement requirement)
    {
        if (context.User.Identity?.IsAuthenticated == true && accessService.IsCurrentUserAdmin())
        {
            context.Succeed(requirement);
        }

        return Task.CompletedTask;
    }
}

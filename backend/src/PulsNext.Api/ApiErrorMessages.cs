using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Logging;

namespace PulsNext.Api;

public static class LoginRateLimit
{
    public const string PolicyName = "login";
    public const int PermitsPerMinute = 20;
}

/// <summary>
/// Текст ошибки для клиента. Сообщения бизнес-проверок (ValidationException, InvalidOperationException и т. п.)
/// показываются как есть — они написаны для пользователя; текст прочих исключений (SQL, сеть, ошибки кода)
/// может раскрыть устройство сервера, поэтому пользователь видит общее сообщение с кодом, а детали — в журнале.
/// </summary>
public static class ApiErrorMessages
{
    public static string ForClient(Exception? error, string traceId, ILogger logger)
    {
        switch (error)
        {
            case null:
                return "Непредвиденная ошибка сервера.";
            case UnauthorizedAccessException
                or KeyNotFoundException
                or System.ComponentModel.DataAnnotations.ValidationException
                or InvalidOperationException
                or PulsNext.Infrastructure.LoginThrottledException:
                return error.Message;
            default:
                logger.LogError(error, "Необработанная ошибка запроса {TraceId}", traceId);
                return $"Внутренняя ошибка сервера. Сообщите администратору код: {traceId}.";
        }
    }
}

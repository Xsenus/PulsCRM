using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using PulsNext.Domain.Mailing;

namespace PulsNext.Api.Models;

/// <summary>
/// Стандартная модель ошибки API.
/// </summary>
public sealed class ApiErrorResponse
{
    /// <summary>
    /// Текст ошибки, пригодный для показа пользователю или логирования.
    /// </summary>
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// Состояние сервиса для внешней проверки доступности.
/// </summary>
public sealed class HealthStatusResponse
{
    /// <summary>
    /// Краткий статус сервиса.
    /// </summary>
    public string Status { get; set; } = "ok";

    /// <summary>
    /// Время ответа сервера в UTC.
    /// </summary>
    public DateTime Utc { get; set; }
}

/// <summary>
/// Параметры поиска пользователей, доступных для авторизации.
/// </summary>
public sealed class LoginUsersQuery
{
    /// <summary>
    /// Фильтр по логину или имени пользователя.
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// Максимальное количество записей в ответе. По умолчанию используется 12.
    /// </summary>
    public int? Take { get; set; }
}

/// <summary>
/// Параметры списка сотрудников.
/// </summary>
public sealed class EmployeeListQuery
{
    /// <summary>
    /// Поиск по логину, имени, почте или телефону.
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// Количество записей, которое нужно пропустить.
    /// </summary>
    public int? Skip { get; set; }

    /// <summary>
    /// Максимальное количество записей в выборке. По умолчанию используется 100.
    /// </summary>
    public int? Take { get; set; }

    /// <summary>
    /// Включать ли уволенных сотрудников в результат.
    /// </summary>
    public bool? IncludeDismissed { get; set; }
}

/// <summary>
/// Параметры списка организаций.
/// </summary>
public sealed class OrganizationListQuery
{
    /// <summary>
    /// Поиск по названию, ИНН и связанным реквизитам организации.
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// Устаревший способ фильтрации по одному району. Сохранен для совместимости.
    /// </summary>
    public int? RaionId { get; set; }

    /// <summary>
    /// CSV-список идентификаторов районов. Если заполнен, имеет приоритет над <see cref="RaionId" />.
    /// </summary>
    public string? RaionIds { get; set; }

    /// <summary>
    /// Возвращать только организации, у которых найден хотя бы один email.
    /// </summary>
    public bool? HasEmail { get; set; }

    /// <summary>
    /// Количество записей, которое нужно пропустить.
    /// </summary>
    public int? Skip { get; set; }

    /// <summary>
    /// Максимальное количество записей в выборке. По умолчанию используется 100.
    /// </summary>
    public int? Take { get; set; }
}

/// <summary>
/// Параметры поиска районов организаций.
/// </summary>
public sealed class OrganizationRaionsQuery
{
    /// <summary>
    /// Поиск по названию района.
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// Считать районы только по организациям, у которых найден хотя бы один email.
    /// </summary>
    public bool? HasEmail { get; set; }
}

/// <summary>
/// Параметры списка рабочих задач.
/// </summary>
public sealed class WorkListQuery
{
    /// <summary>
    /// Поиск по задаче, сообщению, комментарию и связанным сущностям.
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// Фильтр по организации.
    /// </summary>
    public int? OrgId { get; set; }

    /// <summary>
    /// Фильтр по исполнителю или автору задачи.
    /// </summary>
    public int? EmployeeId { get; set; }

    /// <summary>
    /// Если true, возвращаются только незавершенные задачи.
    /// </summary>
    public bool? OnlyOpen { get; set; }

    /// <summary>
    /// Количество записей, которое нужно пропустить.
    /// </summary>
    public int? Skip { get; set; }

    /// <summary>
    /// Максимальное количество записей в выборке. По умолчанию используется 200.
    /// </summary>
    public int? Take { get; set; }
}

/// <summary>
/// Параметры списка рассылок.
/// </summary>
public sealed class CampaignListQuery
{
    /// <summary>
    /// Поиск по названию, теме письма и связанным данным кампании.
    /// </summary>
    public string? Search { get; set; }

    /// <summary>
    /// Фильтр по статусу кампании.
    /// </summary>
    public CampaignStatus? Status { get; set; }

    /// <summary>
    /// Количество записей, которое нужно пропустить.
    /// </summary>
    public int? Skip { get; set; }

    /// <summary>
    /// Максимальное количество записей в выборке. По умолчанию используется 100.
    /// </summary>
    public int? Take { get; set; }
}

/// <summary>
/// Данные multipart/form-data для загрузки файла.
/// </summary>
public sealed class FileUploadRequest
{
    /// <summary>
    /// Файл, который нужно сохранить в хранилище.
    /// </summary>
    [FromForm(Name = "file")]
    public IFormFile? File { get; set; }

    /// <summary>
    /// Признак публичного доступа к файлу.
    /// </summary>
    [FromForm(Name = "isPublic")]
    public bool IsPublic { get; set; }
}

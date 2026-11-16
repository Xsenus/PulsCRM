using DevExpress.Xpo;
using PulsNext.Domain.Legacy;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

/// <summary>
/// Коллега в справочнике, доступном всем сотрудникам: только рабочие контакты, без логина, прав доступа,
/// кода 1С, комментария и года рождения.
/// </summary>
public sealed class ColleagueDto
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string? Position { get; set; }
    public string? Department { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    /// <summary>
    /// Внутренний (добавочный) номер.
    /// </summary>
    public string? InternalPhone { get; set; }
    /// <summary>
    /// День рождения без года: месяц 1–12 и день 1–31; null — не указан.
    /// </summary>
    public int? BirthdayMonth { get; set; }
    public int? BirthdayDay { get; set; }
    public bool HasPhoto { get; set; }
    public bool IsMale { get; set; }
}

internal static class ColleagueRules
{
    public const string DismissedGroupName = "Уволенные";

    public static bool IsDismissed(LegacyUser user)
        => string.Equals(user.UserGroup?.Name, DismissedGroupName, StringComparison.OrdinalIgnoreCase);

    public static byte[]? GetPhoto(LegacyUser user)
    {
        var avatar = user.UserInfo?.Avatar;
        return avatar is { Length: > 0 } ? avatar : user.UserInfo?.Photo is { Length: > 0 } photo ? photo : null;
    }
}

public interface IColleagueService
{
    IReadOnlyCollection<ColleagueDto> GetAll();
    ColleagueDto? GetById(int id);
    /// <summary>
    /// Фото работающего сотрудника; null — нет фото, сотрудник не найден или уволен.
    /// </summary>
    (byte[] Content, string ContentType)? GetPhoto(int id);
}

/// <summary>
/// Справочник коллег для всех сотрудников (карточки «Сотрудники», дашборд, карточки ссылок в чате).
/// Уволенные и служебные учетные записи без имени не показываются.
/// </summary>
public sealed class ColleagueService(LegacyUnitOfWork legacyUnitOfWork) : IColleagueService
{
    public IReadOnlyCollection<ColleagueDto> GetAll()
        => new XPQuery<LegacyUser>(legacyUnitOfWork)
            .ToList()
            .Where(IsVisible)
            .Select(ToDto)
            .OrderBy(x => x.FullName, StringComparer.CurrentCultureIgnoreCase)
            .ToArray();

    public ColleagueDto? GetById(int id)
    {
        var user = id > 0 ? legacyUnitOfWork.GetObjectByKey<LegacyUser>(id) : null;
        return user is not null && IsVisible(user) ? ToDto(user) : null;
    }

    public (byte[] Content, string ContentType)? GetPhoto(int id)
    {
        var user = id > 0 ? legacyUnitOfWork.GetObjectByKey<LegacyUser>(id) : null;
        if (user is null || !IsVisible(user))
        {
            return null;
        }

        var photo = ColleagueRules.GetPhoto(user);
        var contentType = BinaryImageHelper.DetectContentType(photo);
        return photo is null || contentType is null ? null : (photo, contentType);
    }

    private static bool IsVisible(LegacyUser user)
        => !ColleagueRules.IsDismissed(user) && !string.IsNullOrWhiteSpace(user.FullName ?? user.Name);

    private static ColleagueDto ToDto(LegacyUser user)
    {
        var info = user.UserInfo;
        var birthday = DateTimeHelper.NullIfMin(info?.BirthDay ?? DateTime.MinValue);
        var photo = ColleagueRules.GetPhoto(user);
        return new ColleagueDto
        {
            Id = user.Oid,
            FullName = (user.FullName ?? user.Name ?? string.Empty).Trim(),
            Position = TextHelper.NullIfWhiteSpace(info?.Dolgnost),
            Department = TextHelper.NullIfWhiteSpace(user.UserGroup?.FullName ?? user.UserGroup?.Name),
            Email = TextHelper.NullIfWhiteSpace(info?.Email),
            Phone = TextHelper.NullIfWhiteSpace(info?.Phone),
            InternalPhone = TextHelper.NullIfWhiteSpace(info?.PhoneWorkRedirect),
            BirthdayMonth = birthday?.Month,
            BirthdayDay = birthday?.Day,
            HasPhoto = BinaryImageHelper.DetectContentType(photo) is not null,
            IsMale = user.MaleFemale
        };
    }
}

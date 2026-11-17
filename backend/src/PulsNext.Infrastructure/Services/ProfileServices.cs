using DevExpress.Xpo;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

/// <summary>
/// Статус сотрудника: вид, пояснение и срок действия (UTC; null — пока не снимет сам).
/// </summary>
public sealed class UserStatusDto
{
    public string Kind { get; set; } = string.Empty;
    public string? Text { get; set; }
    public DateTime? UntilUtc { get; set; }
}

public sealed class UserStatusRequest
{
    public string? Kind { get; set; }
    public string? Text { get; set; }
    public DateTime? UntilUtc { get; set; }
}

/// <summary>
/// «Мой профиль»: то, что сотрудник видит о себе и может поменять сам.
/// </summary>
public sealed class MyProfileDto
{
    public int Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string? Position { get; set; }
    public string? Department { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? InternalPhone { get; set; }
    public bool HasPhoto { get; set; }
    public UserStatusDto? Status { get; set; }
}

public sealed class ProfileContactsRequest
{
    public string? Phone { get; set; }
    public string? InternalPhone { get; set; }
}

public sealed class ProfilePhotoRequest
{
    public string? ImageBase64 { get; set; }
}

public sealed class ProfilePasswordRequest
{
    public string? CurrentPassword { get; set; }
    public string? NewPassword { get; set; }
}

public interface IUserStatusService
{
    /// <summary>
    /// Действующие статусы (истекшие не возвращаются) по сотрудникам.
    /// </summary>
    IReadOnlyDictionary<int, UserStatusDto> GetActive();
    UserStatusDto? GetActive(int legacyUserId);
    UserStatusDto Set(int legacyUserId, UserStatusRequest request);
    void Clear(int legacyUserId);
}

/// <summary>
/// Статусы сотрудников в базе рассылок (таблица MailUserStatus).
/// </summary>
public sealed class UserStatusService(MailingUnitOfWork unitOfWork, TimeProvider? timeProvider = null) : IUserStatusService
{
    public const int MaxTextLength = 200;

    /// <summary>
    /// Виды статусов; custom — только текст сотрудника.
    /// </summary>
    public static readonly IReadOnlySet<string> Kinds = new HashSet<string>(StringComparer.Ordinal)
    {
        "meeting", "vacation", "sick", "business-trip", "remote", "away", "custom"
    };

    private DateTime UtcNow => (timeProvider ?? TimeProvider.System).GetUtcNow().UtcDateTime;

    public IReadOnlyDictionary<int, UserStatusDto> GetActive()
    {
        var now = UtcNow;
        return new XPQuery<MailUserStatus>(unitOfWork)
            .Where(x => x.UntilUtc == null || x.UntilUtc > now)
            .ToList()
            .GroupBy(x => x.LegacyUserId)
            .ToDictionary(x => x.Key, x => ToDto(x.First()));
    }

    public UserStatusDto? GetActive(int legacyUserId)
    {
        var entity = Find(legacyUserId);
        return entity is not null && IsActive(entity) ? ToDto(entity) : null;
    }

    public UserStatusDto Set(int legacyUserId, UserStatusRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var kind = TextHelper.NullIfWhiteSpace(request.Kind) ?? string.Empty;
        ValidationHelper.Guard(Kinds.Contains(kind), "Неизвестный статус.");
        var text = TextHelper.NullIfWhiteSpace(request.Text);
        ValidationHelper.Guard(text is null || text.Length <= MaxTextLength, $"Пояснение к статусу — не длиннее {MaxTextLength} символов.");
        ValidationHelper.Guard(kind != "custom" || text is not null, "Напишите свой статус.");
        DateTime? until = request.UntilUtc is { } value ? DateTimeHelper.ForceUtc(value) : null;
        ValidationHelper.Guard(until is null || until > UtcNow, "Срок статуса уже прошел.");

        var entity = Find(legacyUserId) ?? new MailUserStatus(unitOfWork) { LegacyUserId = legacyUserId };
        entity.Kind = kind;
        entity.Text = text;
        entity.UntilUtc = until;
        entity.UpdatedAtUtc = UtcNow;
        unitOfWork.CommitChanges();
        return ToDto(entity);
    }

    public void Clear(int legacyUserId)
    {
        if (Find(legacyUserId) is { } entity)
        {
            entity.Delete();
            unitOfWork.CommitChanges();
        }
    }

    private MailUserStatus? Find(int legacyUserId)
        => new XPQuery<MailUserStatus>(unitOfWork).FirstOrDefault(x => x.LegacyUserId == legacyUserId);

    private bool IsActive(MailUserStatus entity) => entity.UntilUtc is null || DateTimeHelper.ForceUtc(entity.UntilUtc.Value) > UtcNow;

    private static UserStatusDto ToDto(MailUserStatus entity) => new()
    {
        Kind = entity.Kind,
        Text = entity.Text,
        UntilUtc = entity.UntilUtc is { } until ? DateTimeHelper.ForceUtc(until) : null
    };
}

public interface IProfileService
{
    MyProfileDto Get();
    MyProfileDto UpdateContacts(ProfileContactsRequest request);
    MyProfileDto UpdatePhoto(ProfilePhotoRequest request);
    MyProfileDto DeletePhoto();
    void ChangePassword(ProfilePasswordRequest request);
    UserStatusDto SetStatus(UserStatusRequest request);
    void ClearStatus();
}

/// <summary>
/// «Мой профиль»: сотрудник сам меняет телефоны, фото, пароль и статус. Остальное (ФИО, должность, отдел,
/// e-mail, права) по-прежнему меняет администратор в карточке сотрудника.
/// </summary>
public sealed class ProfileService(
    LegacyUnitOfWork legacyUnitOfWork,
    ICurrentUserAccessor currentUserAccessor,
    IUserStatusService statusService,
    LoginThrottle? loginThrottle = null) : IProfileService
{
    public const int MaxPhoneLength = 100;
    public const int MaxPhotoBytes = 2 * 1024 * 1024;
    public const int MinPasswordLength = 6;

    public MyProfileDto Get() => ToDto(RequireCurrentUser());

    public MyProfileDto UpdateContacts(ProfileContactsRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var phone = TextHelper.NullIfWhiteSpace(request.Phone);
        var internalPhone = TextHelper.NullIfWhiteSpace(request.InternalPhone);
        ValidationHelper.Guard((phone?.Length ?? 0) <= MaxPhoneLength && (internalPhone?.Length ?? 0) <= MaxPhoneLength, $"Телефон — не длиннее {MaxPhoneLength} символов.");

        var user = RequireCurrentUser();
        var info = EnsureInfo(user);
        info.Phone = phone;
        info.PhoneWorkRedirect = internalPhone;
        legacyUnitOfWork.CommitChanges();
        return ToDto(user);
    }

    public MyProfileDto UpdatePhoto(ProfilePhotoRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        var base64 = TextHelper.NullIfWhiteSpace(request.ImageBase64);
        ValidationHelper.Guard(base64 is not null, "Выберите фото.");
        byte[] bytes;
        try
        {
            bytes = Convert.FromBase64String(base64!);
        }
        catch (FormatException)
        {
            throw new System.ComponentModel.DataAnnotations.ValidationException("Не удалось прочитать фото.");
        }

        ValidationHelper.Guard(bytes.Length <= MaxPhotoBytes, "Фото слишком большое — не больше 2 МБ.");
        ValidationHelper.Guard(IsImage(bytes), "Подходят фото в формате JPEG, PNG, GIF, BMP или WebP.");

        var user = RequireCurrentUser();
        EnsureInfo(user).Avatar = bytes;
        legacyUnitOfWork.CommitChanges();
        return ToDto(user);
    }

    public MyProfileDto DeletePhoto()
    {
        var user = RequireCurrentUser();
        if (user.UserInfo is { } info)
        {
            // Фото в карточке показывается из Avatar, а если его нет — из Photo: убираем оба.
            info.Avatar = null;
            info.Photo = null;
            legacyUnitOfWork.CommitChanges();
        }

        return ToDto(user);
    }

    public void ChangePassword(ProfilePasswordRequest request)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidationHelper.Guard(!string.IsNullOrEmpty(request.CurrentPassword), "Введите текущий пароль.");
        ValidationHelper.Guard(!string.IsNullOrEmpty(request.NewPassword) && request.NewPassword!.Length >= MinPasswordLength, $"Новый пароль — не короче {MinPasswordLength} символов.");
        ValidationHelper.Guard(request.NewPassword != request.CurrentPassword, "Новый пароль совпадает с текущим.");

        var user = RequireCurrentUser();
        var login = user.Name ?? user.Oid.ToString(System.Globalization.CultureInfo.InvariantCulture);
        // Подбор текущего пароля ограничен так же, как вход (по логину).
        loginThrottle?.EnsureAllowed(login, "profile");
        if (!string.Equals(user.Password, LegacyPasswordHasher.HashUnicodeMd5(request.CurrentPassword!), StringComparison.OrdinalIgnoreCase))
        {
            loginThrottle?.RegisterFailure(login, "profile");
            throw new System.ComponentModel.DataAnnotations.ValidationException("Текущий пароль указан неверно.");
        }

        loginThrottle?.RegisterSuccess(login, "profile");
        user.Password = LegacyPasswordHasher.HashUnicodeMd5(request.NewPassword!);
        legacyUnitOfWork.CommitChanges();
    }

    public UserStatusDto SetStatus(UserStatusRequest request) => statusService.Set(RequireCurrentUser().Oid, request);

    public void ClearStatus() => statusService.Clear(RequireCurrentUser().Oid);

    private LegacyUser RequireCurrentUser()
    {
        var id = currentUserAccessor.GetLegacyUserId() ?? throw new UnauthorizedAccessException("Пользователь не определен.");
        return legacyUnitOfWork.GetObjectByKey<LegacyUser>(id) ?? throw new UnauthorizedAccessException("Пользователь не найден.");
    }

    private static bool IsImage(byte[]? bytes) => ColleagueRules.IsImage(bytes);

    private LegacyUserInfo EnsureInfo(LegacyUser user)
        => user.UserInfo ??= new LegacyUserInfo(legacyUnitOfWork) { User = user };

    private MyProfileDto ToDto(LegacyUser user)
    {
        var info = user.UserInfo;
        return new MyProfileDto
        {
            Id = user.Oid,
            Login = user.Name ?? string.Empty,
            FullName = (user.FullName ?? user.Name ?? string.Empty).Trim(),
            Position = TextHelper.NullIfWhiteSpace(info?.Dolgnost),
            Department = TextHelper.NullIfWhiteSpace(user.UserGroup?.FullName ?? user.UserGroup?.Name),
            Email = TextHelper.NullIfWhiteSpace(info?.Email),
            Phone = TextHelper.NullIfWhiteSpace(info?.Phone),
            InternalPhone = TextHelper.NullIfWhiteSpace(info?.PhoneWorkRedirect),
            HasPhoto = IsImage(ColleagueRules.GetPhoto(user)),
            Status = statusService.GetActive(user.Oid)
        };
    }
}

using System.Security.Claims;
using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using Microsoft.AspNetCore.Authorization;
using PulsNext.Domain.Legacy;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class AccessAndColleagueServiceTests : IDisposable
{
    private readonly LegacyUnitOfWork _unitOfWork = new(new SimpleDataLayer(new InMemoryDataStore()));
    private readonly LegacyUser _admin;
    private readonly LegacyUser _employee;
    private readonly LegacyUser _dismissedAdmin;

    // PNG-сигнатура — этого достаточно, чтобы фото считалось изображением.
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];

    public AccessAndColleagueServiceTests()
    {
        var office = new LegacyUserGroup(_unitOfWork) { Name = "Бухгалтерия", FullName = "Бухгалтерия" };
        var dismissed = new LegacyUserGroup(_unitOfWork) { Name = "Уволенные" };
        _admin = new LegacyUser(_unitOfWork) { Name = "admin", FullName = "Админов Админ", FlRoot = true, UserGroup = office };
        _employee = new LegacyUser(_unitOfWork)
        {
            Name = "ivanov",
            Password = "secret-hash",
            FullName = "Иванов Иван",
            UserGroup = office,
            MaleFemale = true,
            UserInfo = new LegacyUserInfo(_unitOfWork)
            {
                Dolgnost = "Бухгалтер",
                Email = "ivanov@example.test",
                Phone = "+7 900 000-00-00",
                PhoneWorkRedirect = "123",
                S1cCode = "000123",
                Comment = "Служебная заметка",
                BirthDay = new DateTime(1990, 3, 8),
                Avatar = Png
            }
        };
        _dismissedAdmin = new LegacyUser(_unitOfWork) { Name = "old", FullName = "Бывший Сотрудник", FlRoot = true, UserGroup = dismissed };
        _ = new LegacyUser(_unitOfWork) { Name = "petrov", FullName = "Петров Петр", UserGroup = office, UserInfo = new LegacyUserInfo(_unitOfWork) { BirthDay = new DateTime(1900, 1, 1) } };
        _unitOfWork.CommitChanges();
    }

    public void Dispose() => _unitOfWork.Dispose();

    [Fact]
    public void OnlyWorkingUsersWithRootFlagAreAdmins()
    {
        Assert.True(Access(_admin.Oid).IsCurrentUserAdmin());
        Assert.False(Access(_employee.Oid).IsCurrentUserAdmin());
        Assert.False(Access(_dismissedAdmin.Oid).IsCurrentUserAdmin());
        Assert.False(Access(null).IsCurrentUserAdmin());
        Assert.False(Access(99999).IsCurrentUserAdmin());
    }

    [Fact]
    public void RemovingTheRootFlagTakesEffectOnTheNextRequest()
    {
        Assert.True(Access(_admin.Oid).IsCurrentUserAdmin());
        _admin.FlRoot = false;
        _unitOfWork.CommitChanges();
        Assert.False(Access(_admin.Oid).IsCurrentUserAdmin());
    }

    [Fact]
    public async Task AdminPolicyHandlerSucceedsOnlyForAdmins()
    {
        Assert.True(await Authorize(_admin.Oid));
        Assert.False(await Authorize(_employee.Oid));
    }

    [Fact]
    public void DirectoryShowsWorkContactsOnlyAndHidesDismissed()
    {
        var colleagues = new ColleagueService(_unitOfWork).GetAll();

        Assert.Equal(["Админов Админ", "Иванов Иван", "Петров Петр"], colleagues.Select(x => x.FullName));
        var ivanov = colleagues.Single(x => x.Id == _employee.Oid);
        Assert.Equal("Бухгалтер", ivanov.Position);
        Assert.Equal("Бухгалтерия", ivanov.Department);
        Assert.Equal("ivanov@example.test", ivanov.Email);
        Assert.Equal("+7 900 000-00-00", ivanov.Phone);
        Assert.Equal("123", ivanov.InternalPhone);
        Assert.Equal(3, ivanov.BirthdayMonth);
        Assert.Equal(8, ivanov.BirthdayDay);
        Assert.True(ivanov.HasPhoto);

        // Пустая дата рождения из legacy (1900 год) — «не указана».
        var petrov = colleagues.Single(x => x.FullName == "Петров Петр");
        Assert.Null(petrov.BirthdayMonth);
        Assert.False(petrov.HasPhoto);

        // В DTO нет логина, пароля, кода 1С, комментария и года рождения.
        var properties = typeof(ColleagueDto).GetProperties().Select(x => x.Name).ToArray();
        Assert.DoesNotContain("Login", properties);
        Assert.DoesNotContain("Password", properties);
        Assert.DoesNotContain("S1cCode", properties);
        Assert.DoesNotContain("Comment", properties);
        Assert.DoesNotContain("BirthDay", properties);
        Assert.DoesNotContain("IsRoot", properties);
    }

    [Fact]
    public void PhotoAndCardAreNotAvailableForDismissed()
    {
        var service = new ColleagueService(_unitOfWork);
        var photo = service.GetPhoto(_employee.Oid);
        Assert.Equal("image/png", photo!.Value.ContentType);
        Assert.NotNull(service.GetById(_employee.Oid));

        Assert.Null(service.GetById(_dismissedAdmin.Oid));
        Assert.Null(service.GetPhoto(_dismissedAdmin.Oid));
        Assert.Null(service.GetPhoto(_admin.Oid));
    }

    private AccessService Access(int? userId) => new(_unitOfWork, new FakeCurrentUser(userId));

    private async Task<bool> Authorize(int userId)
    {
        var requirement = new AdminRequirement();
        var principal = new ClaimsPrincipal(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, userId.ToString())], "Bearer"));
        var context = new AuthorizationHandlerContext([requirement], principal, null);
        await new AdminAuthorizationHandler(Access(userId)).HandleAsync(context);
        return context.HasSucceeded;
    }

    private sealed class FakeCurrentUser(int? userId) : ICurrentUserAccessor
    {
        public int? GetLegacyUserId() => userId;
        public string? GetLogin() => null;
    }
}

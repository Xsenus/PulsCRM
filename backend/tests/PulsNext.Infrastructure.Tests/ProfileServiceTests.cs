using System.ComponentModel.DataAnnotations;
using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class ProfileServiceTests : IDisposable
{
    private static readonly byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00];

    private readonly LegacyUnitOfWork _legacy = new(new SimpleDataLayer(new InMemoryDataStore()));
    private readonly MailingUnitOfWork _mailing;
    private readonly ManualTime _time = new();
    private readonly LegacyUser _user;
    private readonly LegacyUser _colleague;

    public ProfileServiceTests()
    {
        _mailing = new MailingUnitOfWork(new SimpleDataLayer(new InMemoryDataStore()));

        var office = new LegacyUserGroup(_legacy) { Name = "Отдел продаж" };
        _user = new LegacyUser(_legacy)
        {
            Name = "ivanov",
            FullName = "Иванов Иван",
            Password = LegacyPasswordHasher.HashUnicodeMd5("старый пароль"),
            UserGroup = office,
            UserInfo = new LegacyUserInfo(_legacy) { Dolgnost = "Менеджер", Email = "ivanov@example.test", Phone = "+7 900", Photo = Png }
        };
        _colleague = new LegacyUser(_legacy) { Name = "petrov", FullName = "Петров Петр", UserGroup = office };
        _legacy.CommitChanges();
    }

    public void Dispose()
    {
        _legacy.Dispose();
        _mailing.Dispose();
    }

    [Fact]
    public void ProfileShowsOwnDataAndContactsCanBeChanged()
    {
        var service = Service(_user.Oid);
        var profile = service.Get();
        Assert.Equal("ivanov", profile.Login);
        Assert.Equal("Менеджер", profile.Position);
        Assert.Equal("Отдел продаж", profile.Department);
        Assert.True(profile.HasPhoto);
        Assert.Null(profile.Status);

        var updated = service.UpdateContacts(new ProfileContactsRequest { Phone = " +7 913 111-22-33 ", InternalPhone = "205" });
        Assert.Equal("+7 913 111-22-33", updated.Phone);
        Assert.Equal("205", updated.InternalPhone);
        // E-mail и должность сотрудник сам не меняет.
        Assert.Equal("ivanov@example.test", updated.Email);
        Assert.Equal("Менеджер", _user.UserInfo!.Dolgnost);
    }

    [Fact]
    public void PhotoIsValidatedSavedAndRemoved()
    {
        var service = Service(_colleague.Oid);
        Assert.False(service.Get().HasPhoto);
        Assert.Throws<ValidationException>(() => service.UpdatePhoto(new ProfilePhotoRequest { ImageBase64 = Convert.ToBase64String([1, 2, 3, 4, 5]) }));
        Assert.Throws<ValidationException>(() => service.UpdatePhoto(new ProfilePhotoRequest { ImageBase64 = "не base64" }));
        Assert.Throws<ValidationException>(() => service.UpdatePhoto(new ProfilePhotoRequest { ImageBase64 = Convert.ToBase64String(new byte[ProfileService.MaxPhotoBytes + 1]) }));

        Assert.True(service.UpdatePhoto(new ProfilePhotoRequest { ImageBase64 = Convert.ToBase64String(Png) }).HasPhoto);
        Assert.Equal(Png, _colleague.UserInfo!.Avatar);

        // У Иванова фото было в Photo — удаление убирает и его.
        Assert.False(Service(_user.Oid).DeletePhoto().HasPhoto);
        Assert.Null(_user.UserInfo!.Photo);
    }

    [Fact]
    public void PasswordChangeChecksTheCurrentPasswordAndStopsGuessing()
    {
        var throttle = new LoginThrottle(_time);
        var service = Service(_user.Oid, throttle);

        Assert.Throws<ValidationException>(() => service.ChangePassword(new ProfilePasswordRequest { CurrentPassword = "старый пароль", NewPassword = "123" }));
        Assert.Throws<ValidationException>(() => service.ChangePassword(new ProfilePasswordRequest { CurrentPassword = "старый пароль", NewPassword = "старый пароль" }));

        service.ChangePassword(new ProfilePasswordRequest { CurrentPassword = "старый пароль", NewPassword = "новый пароль" });
        Assert.Equal(LegacyPasswordHasher.HashUnicodeMd5("новый пароль"), _user.Password);

        for (var attempt = 0; attempt < LoginThrottle.MaxFailures; attempt++)
        {
            Assert.Throws<ValidationException>(() => service.ChangePassword(new ProfilePasswordRequest { CurrentPassword = "угадываю", NewPassword = "другой пароль" }));
        }

        Assert.Throws<LoginThrottledException>(() => service.ChangePassword(new ProfilePasswordRequest { CurrentPassword = "новый пароль", NewPassword = "другой пароль" }));
    }

    [Fact]
    public void StatusIsShownToColleaguesUntilItExpires()
    {
        var service = Service(_user.Oid);
        Assert.Throws<ValidationException>(() => service.SetStatus(new UserStatusRequest { Kind = "party" }));
        Assert.Throws<ValidationException>(() => service.SetStatus(new UserStatusRequest { Kind = "custom" }));
        Assert.Throws<ValidationException>(() => service.SetStatus(new UserStatusRequest { Kind = "vacation", UntilUtc = _time.GetUtcNow().UtcDateTime.AddMinutes(-1) }));

        var until = _time.GetUtcNow().UtcDateTime.AddDays(3);
        service.SetStatus(new UserStatusRequest { Kind = "vacation", Text = "По срочным — Петров", UntilUtc = until });
        // Повторная установка заменяет статус, а не добавляет второй.
        var status = service.SetStatus(new UserStatusRequest { Kind = "vacation", Text = "По срочным — Петрову", UntilUtc = until });
        Assert.Equal("По срочным — Петрову", status.Text);
        Assert.Single(new XPQuery<MailUserStatus>(_mailing));

        var colleagues = new ColleagueService(_legacy, Statuses());
        Assert.Equal("vacation", colleagues.GetAll().Single(x => x.Id == _user.Oid).Status?.Kind);
        Assert.Null(colleagues.GetAll().Single(x => x.Id == _colleague.Oid).Status);
        Assert.Equal("vacation", colleagues.GetById(_user.Oid)?.Status?.Kind);
        Assert.Equal("vacation", service.Get().Status?.Kind);

        _time.Advance(TimeSpan.FromDays(3));
        Assert.Null(colleagues.GetAll().Single(x => x.Id == _user.Oid).Status);
        Assert.Null(service.Get().Status);

        service.SetStatus(new UserStatusRequest { Kind = "meeting" });
        Assert.Equal("meeting", service.Get().Status?.Kind);
        service.ClearStatus();
        Assert.Null(service.Get().Status);
        Assert.Empty(new XPQuery<MailUserStatus>(_mailing));
    }

    private UserStatusService Statuses() => new(_mailing, _time);

    private ProfileService Service(int userId, LoginThrottle? throttle = null)
        => new(_legacy, new FixedUser(userId), Statuses(), throttle);

    private sealed class FixedUser(int id) : ICurrentUserAccessor
    {
        public int? GetLegacyUserId() => id;
        public string? GetLogin() => null;
    }

    private sealed class ManualTime : TimeProvider
    {
        private DateTimeOffset _now = new(2026, 11, 17, 9, 0, 0, TimeSpan.Zero);

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan delta) => _now += delta;
    }
}

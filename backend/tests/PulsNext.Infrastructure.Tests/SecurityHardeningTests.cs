using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Legacy;
using PulsNext.Infrastructure.Internal;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class SecurityHardeningTests : IDisposable
{
    private readonly string _keysDirectory = Path.Combine(Path.GetTempPath(), $"puls-keys-{Guid.NewGuid():N}");

    public void Dispose()
    {
        if (Directory.Exists(_keysDirectory))
        {
            Directory.Delete(_keysDirectory, true);
        }
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("short-key")]
    [InlineData("REPLACE_WITH_LONG_RANDOM_SECRET_64_PLUS_CHARS")]
    [InlineData("CHANGE_ME_TO_LONG_RANDOM_SECRET")]
    public void PlaceholderOrShortKeysAreWeak(string? key) => Assert.True(JwtSigningKey.IsWeak(key));

    [Fact]
    public void ConfiguredStrongKeyIsUsedAsIs()
    {
        var key = JwtSigningKey.Resolve("a-very-long-and-random-production-secret-123456", _keysDirectory);
        Assert.False(key.Generated);
        Assert.Equal("a-very-long-and-random-production-secret-123456", key.Key);
        Assert.False(File.Exists(Path.Combine(_keysDirectory, JwtSigningKey.FileName)));
    }

    [Fact]
    public void WeakKeyIsReplacedByAGeneratedKeyThatSurvivesRestarts()
    {
        var first = JwtSigningKey.Resolve("REPLACE_WITH_LONG_RANDOM_SECRET_64_PLUS_CHARS", _keysDirectory);
        Assert.True(first.Generated);
        Assert.False(JwtSigningKey.IsWeak(first.Key));
        Assert.True(File.Exists(first.FilePath));

        // Следующий запуск — тот же ключ: выданные токены остаются действительными.
        var second = JwtSigningKey.Resolve("REPLACE_WITH_LONG_RANDOM_SECRET_64_PLUS_CHARS", _keysDirectory);
        Assert.Equal(first.Key, second.Key);
    }

    [Fact]
    public void LoginIsLockedAfterFiveFailuresForThatLoginAndAddressOnly()
    {
        var time = new ManualTime();
        var throttle = new LoginThrottle(time);
        for (var attempt = 0; attempt < LoginThrottle.MaxFailures; attempt++)
        {
            throttle.EnsureAllowed("ivanov", "10.0.0.5");
            throttle.RegisterFailure("Ivanov", "10.0.0.5");
        }

        var error = Assert.Throws<LoginThrottledException>(() => throttle.EnsureAllowed("IVANOV", "10.0.0.5"));
        Assert.Contains("15 мин", error.Message);

        // С другого компьютера и для другого логина вход открыт.
        throttle.EnsureAllowed("ivanov", "10.0.0.9");
        throttle.EnsureAllowed("petrov", "10.0.0.5");

        // Через 15 минут — снова можно.
        time.Advance(LoginThrottle.Lockout + TimeSpan.FromSeconds(1));
        throttle.EnsureAllowed("ivanov", "10.0.0.5");
    }

    [Fact]
    public void FailuresOutsideTheWindowAndSuccessfulLoginResetTheCounter()
    {
        var time = new ManualTime();
        var throttle = new LoginThrottle(time);
        for (var attempt = 0; attempt < LoginThrottle.MaxFailures - 1; attempt++)
        {
            throttle.RegisterFailure("ivanov", "10.0.0.5");
        }

        time.Advance(LoginThrottle.Window + TimeSpan.FromMinutes(1));
        throttle.RegisterFailure("ivanov", "10.0.0.5");
        throttle.EnsureAllowed("ivanov", "10.0.0.5");

        for (var attempt = 0; attempt < LoginThrottle.MaxFailures - 2; attempt++)
        {
            throttle.RegisterFailure("ivanov", "10.0.0.5");
        }

        throttle.RegisterSuccess("ivanov", "10.0.0.5");
        throttle.RegisterFailure("ivanov", "10.0.0.5");
        throttle.EnsureAllowed("ivanov", "10.0.0.5");
    }

    [Fact]
    public async Task AuthServiceCountsWrongPasswordsAndBlocksFurtherAttempts()
    {
        using var unitOfWork = new LegacyUnitOfWork(new SimpleDataLayer(new InMemoryDataStore()));
        _ = new LegacyUser(unitOfWork) { Name = "ivanov", FullName = "Иванов", Password = LegacyPasswordHasher.HashUnicodeMd5("secret") };
        unitOfWork.CommitChanges();
        var tokens = new JwtTokenFactory(Options.Create(new JwtOptions { SigningKey = new string('k', 64) }));
        var service = new AuthService(unitOfWork, new NoCurrentUser(), tokens, new LoginThrottle(new ManualTime()));

        for (var attempt = 0; attempt < LoginThrottle.MaxFailures; attempt++)
        {
            await Assert.ThrowsAsync<UnauthorizedAccessException>(() => service.LoginAsync(new LoginRequest { Login = "ivanov", Password = "wrong" }, CancellationToken.None));
        }

        // Даже верный пароль сейчас не принимается — подбор остановлен.
        await Assert.ThrowsAsync<LoginThrottledException>(() => service.LoginAsync(new LoginRequest { Login = "ivanov", Password = "secret" }, CancellationToken.None));
    }

    private sealed class ManualTime : TimeProvider
    {
        private DateTimeOffset _now = new(2026, 11, 16, 9, 0, 0, TimeSpan.Zero);

        public override DateTimeOffset GetUtcNow() => _now;

        public void Advance(TimeSpan delta) => _now += delta;
    }

    private sealed class NoCurrentUser : ICurrentUserAccessor
    {
        public int? GetLegacyUserId() => null;
        public string? GetLogin() => null;
    }
}

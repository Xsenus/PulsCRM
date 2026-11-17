using System.Collections.Concurrent;
using System.Security.Cryptography;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace PulsNext.Infrastructure;

/// <summary>
/// Ключ подписи токенов входа (JWT). Если в конфиге заглушка или слишком короткий ключ, используется
/// случайный ключ, созданный один раз и сохраненный в каталоге ключей (рядом с ключами Data Protection).
/// </summary>
public sealed record JwtSigningKey(string Key, bool Generated, string? FilePath)
{
    public const string FileName = "jwt-signing-key.txt";
    private const int MinimumLength = 32;

    /// <summary>
    /// Заглушка из примеров конфига или ключ короче 32 символов — по такому ключу токен может подделать
    /// любой, кто видел репозиторий или подобрал ключ.
    /// </summary>
    public static bool IsWeak(string? key)
        => string.IsNullOrWhiteSpace(key)
            || key.Trim().Length < MinimumLength
            || key.Contains("REPLACE_WITH", StringComparison.OrdinalIgnoreCase)
            || key.Contains("CHANGE_ME", StringComparison.OrdinalIgnoreCase);

    public static JwtSigningKey Resolve(string? configuredKey, string keysDirectory)
    {
        if (!IsWeak(configuredKey))
        {
            return new JwtSigningKey(configuredKey!.Trim(), false, null);
        }

        var path = Path.Combine(keysDirectory, FileName);
        if (File.Exists(path))
        {
            var stored = File.ReadAllText(path).Trim();
            if (!IsWeak(stored))
            {
                return new JwtSigningKey(stored, true, path);
            }
        }

        Directory.CreateDirectory(keysDirectory);
        var generated = Convert.ToBase64String(RandomNumberGenerator.GetBytes(64));
        File.WriteAllText(path, generated);
        return new JwtSigningKey(generated, true, path);
    }
}

/// <summary>
/// При запуске сообщает в журнал, что ключ подписи из конфига не используется.
/// </summary>
public sealed class JwtSigningKeyNoticeHostedService(JwtSigningKey key, ILogger<JwtSigningKeyNoticeHostedService> logger) : IHostedService
{
    public Task StartAsync(CancellationToken cancellationToken)
    {
        if (key.Generated)
        {
            // Штатная ситуация (ключ сгенерирован и сохранен), а не проблема: в списке предупреждений не нужна.
            logger.LogInformation(
                "Jwt:SigningKey в конфиге не задан, короткий или заглушка — для подписи входа используется случайный ключ из {Path}. "
                + "Чтобы задать свой, впишите в Jwt:SigningKey случайную строку от 32 символов.",
                key.FilePath);
        }

        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken) => Task.CompletedTask;
}

/// <summary>
/// Слишком много неудачных попыток входа — вход временно закрыт.
/// </summary>
public sealed class LoginThrottledException(TimeSpan retryAfter)
    : Exception($"Слишком много неудачных попыток входа. Попробуйте через {Math.Max(1, (int)Math.Ceiling(retryAfter.TotalMinutes))} мин.")
{
    public TimeSpan RetryAfter { get; } = retryAfter;
}

/// <summary>
/// Защита от подбора пароля: после 5 неудачных попыток за 15 минут для пары «логин + адрес» вход закрывается
/// на 15 минут. Пара, а не только логин, — чтобы чужие попытки с другого компьютера не блокировали сотрудника.
/// </summary>
public sealed class LoginThrottle(TimeProvider? timeProvider = null)
{
    public const int MaxFailures = 5;
    public static readonly TimeSpan Window = TimeSpan.FromMinutes(15);
    public static readonly TimeSpan Lockout = TimeSpan.FromMinutes(15);

    private readonly TimeProvider _time = timeProvider ?? TimeProvider.System;
    private readonly ConcurrentDictionary<string, Attempts> _attempts = new(StringComparer.Ordinal);

    private sealed record Attempts(int Failures, DateTimeOffset WindowStart, DateTimeOffset? LockedUntil);

    private static string KeyOf(string login, string? address) => $"{login.Trim().ToLowerInvariant()}|{address ?? "?"}";

    /// <summary>
    /// Бросает <see cref="LoginThrottledException"/>, если вход для пары сейчас закрыт.
    /// </summary>
    public void EnsureAllowed(string login, string? address)
    {
        if (_attempts.TryGetValue(KeyOf(login, address), out var attempts) && attempts.LockedUntil is { } until)
        {
            var left = until - _time.GetUtcNow();
            if (left > TimeSpan.Zero)
            {
                throw new LoginThrottledException(left);
            }
        }
    }

    public void RegisterFailure(string login, string? address)
    {
        var now = _time.GetUtcNow();
        _attempts.AddOrUpdate(
            KeyOf(login, address),
            _ => new Attempts(1, now, null),
            (_, current) =>
            {
                var fresh = now - current.WindowStart > Window || (current.LockedUntil is { } until && until <= now);
                var failures = fresh ? 1 : current.Failures + 1;
                var windowStart = fresh ? now : current.WindowStart;
                return new Attempts(failures, windowStart, failures >= MaxFailures ? now + Lockout : null);
            });

        // Не даем словарю расти бесконечно: старые записи выбрасываем.
        if (_attempts.Count > 10_000)
        {
            foreach (var pair in _attempts.Where(x => now - x.Value.WindowStart > Window + Lockout).ToList())
            {
                _attempts.TryRemove(pair.Key, out _);
            }
        }
    }

    public void RegisterSuccess(string login, string? address) => _attempts.TryRemove(KeyOf(login, address), out _);
}

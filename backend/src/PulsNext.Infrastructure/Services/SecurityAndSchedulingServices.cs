using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.Channels;
using DevExpress.Xpo;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure.Internal;
using Quartz;

namespace PulsNext.Infrastructure;

public interface IJwtTokenFactory
{
    AuthResponse Create(LegacyUser user);
}

public sealed class JwtTokenFactory(IOptions<JwtOptions> options) : IJwtTokenFactory
{
    public AuthResponse Create(LegacyUser user)
    {
        var currentUser = MappingHelper.ToCurrentUserDto(user);
        var now = DateTime.UtcNow;
        var expiresAtUtc = now.AddMinutes(Math.Max(5, options.Value.AccessTokenMinutes));

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Oid.ToString()),
            new(ClaimTypes.Name, user.Name ?? string.Empty),
            new(ClaimTypes.GivenName, user.FullName ?? user.Name ?? string.Empty),
            new("full_name", user.FullName ?? user.Name ?? string.Empty),
            new("is_root", user.FlRoot ? "true" : "false")
        };

        if (!string.IsNullOrWhiteSpace(user.UserGroup?.Name))
        {
            claims.Add(new Claim(ClaimTypes.Role, user.UserGroup.Name));
        }

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(options.Value.SigningKey));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: options.Value.Issuer,
            audience: options.Value.Audience,
            claims: claims,
            notBefore: now,
            expires: expiresAtUtc,
            signingCredentials: credentials);

        var handler = new JwtSecurityTokenHandler();

        return new AuthResponse
        {
            AccessToken = handler.WriteToken(token),
            ExpiresAtUtc = expiresAtUtc,
            User = currentUser
        };
    }
}

public interface ISecretProtector
{
    string Protect(string value);
    string Unprotect(string? protectedValue);
}

public sealed class DataProtectionSecretProtector(IDataProtectionProvider provider) : ISecretProtector
{
    private readonly IDataProtector _protector = provider.CreateProtector("PulsNext.Infrastructure.Secrets.v1");

    public string Protect(string value)
    {
        return _protector.Protect(value);
    }

    public string Unprotect(string? protectedValue)
    {
        return string.IsNullOrWhiteSpace(protectedValue) ? string.Empty : _protector.Unprotect(protectedValue);
    }
}

public interface IDispatchChannel
{
    ValueTask WriteAsync(int dispatchItemId, CancellationToken cancellationToken);
    bool TryWrite(int dispatchItemId);
    IAsyncEnumerable<int> ReadAllAsync(CancellationToken cancellationToken);
}

public sealed class DispatchChannel(IOptions<DispatchOptions> options) : IDispatchChannel
{
    private readonly Channel<int> _channel = Channel.CreateBounded<int>(new BoundedChannelOptions(Math.Max(100, options.Value.ChannelCapacity))
    {
        SingleReader = false,
        SingleWriter = false,
        FullMode = BoundedChannelFullMode.Wait
    });

    public ValueTask WriteAsync(int dispatchItemId, CancellationToken cancellationToken)
        => _channel.Writer.WriteAsync(dispatchItemId, cancellationToken);

    public bool TryWrite(int dispatchItemId)
        => _channel.Writer.TryWrite(dispatchItemId);

    public IAsyncEnumerable<int> ReadAllAsync(CancellationToken cancellationToken)
        => _channel.Reader.ReadAllAsync(cancellationToken);
}

public interface IScheduleCalculator
{
    DateTime? CalculateInitialNextRunUtc(MailCampaign campaign, DateTime nowUtc);
    DateTime? CalculateNextRunAfterExecution(MailCampaign campaign, DateTime executedAtUtc);
    IReadOnlyCollection<ScheduleOccurrenceDto> Preview(SchedulePreviewRequest request);
}

public sealed class ScheduleCalculator : IScheduleCalculator
{
    private static readonly IReadOnlyDictionary<string, string> TimeZoneFallbacks = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        [MailingDefaults.TimeZoneId] = "N. Central Asia Standard Time"
    };

    public DateTime? CalculateInitialNextRunUtc(MailCampaign campaign, DateTime nowUtc)
    {
        var startAtUtc = DateTimeHelper.NullIfMin(campaign.StartAtUtc) ?? nowUtc;
        return CalculateNextRun(
            campaign.ScheduleKind,
            campaign.CronExpression,
            campaign.TimeZoneId,
            startAtUtc,
            DateTimeHelper.NullIfMin(campaign.EndAtUtc),
            campaign.IntervalMinutes,
            campaign.RandomIntervalMinMinutes,
            campaign.RandomIntervalMaxMinutes,
            nowUtc,
            DateTimeHelper.NullIfMin(campaign.LastRunAtUtc),
            forInitialSchedule: true);
    }

    public DateTime? CalculateNextRunAfterExecution(MailCampaign campaign, DateTime executedAtUtc)
    {
        var startAtUtc = DateTimeHelper.NullIfMin(campaign.StartAtUtc) ?? executedAtUtc;
        return CalculateNextRun(
            campaign.ScheduleKind,
            campaign.CronExpression,
            campaign.TimeZoneId,
            startAtUtc,
            DateTimeHelper.NullIfMin(campaign.EndAtUtc),
            campaign.IntervalMinutes,
            campaign.RandomIntervalMinMinutes,
            campaign.RandomIntervalMaxMinutes,
            executedAtUtc,
            executedAtUtc,
            forInitialSchedule: false);
    }

    public IReadOnlyCollection<ScheduleOccurrenceDto> Preview(SchedulePreviewRequest request)
    {
        var count = Math.Clamp(request.Count, 1, 100);
        var occurrences = new List<ScheduleOccurrenceDto>(count);
        var cursorUtc = request.StartAtUtc?.ToUniversalTime() ?? DateTime.UtcNow;
        var lastRunUtc = (DateTime?)null;

        for (var i = 0; i < count; i++)
        {
            var nextUtc = CalculateNextRun(
                request.ScheduleKind,
                request.CronExpression,
                request.TimeZoneId,
                request.StartAtUtc?.ToUniversalTime() ?? cursorUtc,
                request.EndAtUtc?.ToUniversalTime(),
                request.IntervalMinutes,
                request.RandomIntervalMinMinutes,
                request.RandomIntervalMaxMinutes,
                cursorUtc,
                lastRunUtc,
                forInitialSchedule: i == 0);

            if (nextUtc is null)
            {
                break;
            }

            var timeZone = ResolveTimeZone(request.TimeZoneId);
            occurrences.Add(new ScheduleOccurrenceDto
            {
                Utc = nextUtc.Value,
                Local = TimeZoneInfo.ConvertTimeFromUtc(nextUtc.Value, timeZone)
            });

            if (request.ScheduleKind == ScheduleKind.OneTime)
            {
                break;
            }

            lastRunUtc = nextUtc.Value;
            cursorUtc = nextUtc.Value.AddSeconds(1);
        }

        return occurrences;
    }

    private static DateTime? CalculateNextRun(
        ScheduleKind scheduleKind,
        string? cronExpression,
        string? timeZoneId,
        DateTime startAtUtc,
        DateTime? endAtUtc,
        int intervalMinutes,
        int randomIntervalMinMinutes,
        int randomIntervalMaxMinutes,
        DateTime referenceUtc,
        DateTime? lastRunUtc,
        bool forInitialSchedule)
    {
        var start = startAtUtc.ToUniversalTime();
        var reference = referenceUtc.ToUniversalTime();
        DateTime? candidate = scheduleKind switch
        {
            ScheduleKind.OneTime => CalculateOneTime(start, reference, forInitialSchedule),
            ScheduleKind.FixedInterval => CalculateFixedInterval(start, reference, Math.Max(1, intervalMinutes)),
            ScheduleKind.RandomInterval => CalculateRandomInterval(start, reference, lastRunUtc, randomIntervalMinMinutes, randomIntervalMaxMinutes),
            ScheduleKind.Cron => CalculateCron(cronExpression, timeZoneId, start, reference),
            _ => null
        };

        if (candidate is null)
        {
            return null;
        }

        if (endAtUtc is not null && candidate > endAtUtc.Value.ToUniversalTime())
        {
            return null;
        }

        return candidate.Value;
    }

    private static DateTime? CalculateOneTime(DateTime startAtUtc, DateTime referenceUtc, bool forInitialSchedule)
    {
        if (forInitialSchedule)
        {
            return startAtUtc > referenceUtc ? startAtUtc : referenceUtc;
        }

        return null;
    }

    private static DateTime CalculateFixedInterval(DateTime startAtUtc, DateTime referenceUtc, int intervalMinutes)
    {
        if (referenceUtc <= startAtUtc)
        {
            return startAtUtc;
        }

        var interval = TimeSpan.FromMinutes(intervalMinutes);
        var ticks = (referenceUtc - startAtUtc).Ticks;
        var steps = Math.Max(0L, (long)Math.Ceiling(ticks / (double)interval.Ticks));
        return startAtUtc.AddTicks(steps * interval.Ticks);
    }

    private static DateTime CalculateRandomInterval(DateTime startAtUtc, DateTime referenceUtc, DateTime? lastRunUtc, int minMinutes, int maxMinutes)
    {
        var normalizedMin = Math.Max(1, Math.Min(minMinutes, maxMinutes));
        var normalizedMax = Math.Max(normalizedMin, Math.Max(minMinutes, maxMinutes));

        if (lastRunUtc is null)
        {
            return referenceUtc <= startAtUtc ? startAtUtc : referenceUtc;
        }

        var seedBytes = BitConverter.GetBytes(lastRunUtc.Value.Ticks ^ referenceUtc.Ticks);
        var seed = BitConverter.ToInt32(seedBytes, 0);
        var random = new Random(seed);
        var interval = random.Next(normalizedMin, normalizedMax + 1);
        return lastRunUtc.Value.ToUniversalTime().AddMinutes(interval);
    }

    private static DateTime? CalculateCron(string? cronExpression, string? timeZoneId, DateTime startAtUtc, DateTime referenceUtc)
    {
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(cronExpression), "Для расписания Cron нужно заполнить CronExpression.");

        var timeZone = ResolveTimeZone(timeZoneId);
        var expression = new CronExpression(cronExpression!)
        {
            TimeZone = timeZone
        };

        var baseUtc = referenceUtc > startAtUtc ? referenceUtc : startAtUtc;
        var next = expression.GetNextValidTimeAfter(new DateTimeOffset(baseUtc.AddSeconds(-1), TimeSpan.Zero));
        return next?.UtcDateTime;
    }

    private static TimeZoneInfo ResolveTimeZone(string? timeZoneId)
    {
        var candidate = string.IsNullOrWhiteSpace(timeZoneId) ? MailingDefaults.TimeZoneId : timeZoneId.Trim();

        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(candidate);
        }
        catch
        {
            if (TimeZoneFallbacks.TryGetValue(candidate, out var fallback))
            {
                try
                {
                    return TimeZoneInfo.FindSystemTimeZoneById(fallback);
                }
                catch
                {
                    return TimeZoneInfo.Utc;
                }
            }

            return TimeZoneInfo.Utc;
        }
    }
}

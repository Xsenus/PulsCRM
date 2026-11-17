using System.Diagnostics;
using System.Reflection;
using DevExpress.Xpo;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Chat;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;

namespace PulsNext.Infrastructure;

/// <summary>
/// Одна проверка: ok — в порядке, warn — стоит обратить внимание, error — не работает.
/// </summary>
public sealed record SystemCheckDto(string Name, string Status, string Detail, long DurationMs);

public sealed record StorageUsageDto(string Name, string Path, long Bytes, int Files);

public sealed class SystemStatusDto
{
    public string Version { get; set; } = string.Empty;
    public DateTime StartedAtUtc { get; set; }
    public DateTime CheckedAtUtc { get; set; }
    public string MachineName { get; set; } = string.Empty;
    /// <summary>
    /// Худший статус среди проверок.
    /// </summary>
    public string Overall { get; set; } = "ok";
    public IReadOnlyList<SystemCheckDto> Checks { get; set; } = [];
    public IReadOnlyList<StorageUsageDto> Storage { get; set; } = [];
    public long? DiskFreeBytes { get; set; }
    public long? DiskTotalBytes { get; set; }
    public int QueueDepth { get; set; }
    public int FailedLast24Hours { get; set; }
    public int SentLast24Hours { get; set; }
    public int? PushSubscriptions { get; set; }
    public string LogDirectory { get; set; } = string.Empty;
    public IReadOnlyList<string> LogFiles { get; set; } = [];
    public IReadOnlyList<LogEntryDto> RecentProblems { get; set; } = [];
}

/// <summary>
/// Каталоги, о которых знает страница состояния (журнал, вложения чата, загрузки рассылок, ключи).
/// </summary>
public sealed record SystemPaths(string StorageRoot, string Logs, string Uploads, string Keys, string? ChatFiles, string? BackupRoot = null);

public interface ISystemStatusService
{
    Task<SystemStatusDto> GetAsync(CancellationToken cancellationToken);

    /// <summary>
    /// Путь к файлу журнала за день, если он есть (имя проверяется — только api-yyyyMMdd.log из каталога журнала).
    /// </summary>
    string? GetLogFilePath(string fileName);
}

public sealed class SystemStatusService(
    IServiceProvider services,
    SystemPaths paths,
    RecentLogBuffer recentLog,
    ChatFeature chatFeature,
    JwtSigningKey jwtSigningKey) : ISystemStatusService
{
    public const long DiskWarnBytes = 5L * 1024 * 1024 * 1024;
    public const long DiskErrorBytes = 1L * 1024 * 1024 * 1024;
    private static readonly DateTime StartedAt = Process.GetCurrentProcess().StartTime.ToUniversalTime();

    public async Task<SystemStatusDto> GetAsync(CancellationToken cancellationToken)
    {
        var checks = new List<SystemCheckDto>
        {
            Check("База Пульса (SQL Server)", () =>
            {
                var users = new XPQuery<LegacyUser>(services.GetRequiredService<LegacyUnitOfWork>()).Count();
                return ("ok", $"Доступна, сотрудников: {users}.");
            }),
            Check("База рассылок (SQL Server)", () =>
            {
                var campaigns = new XPQuery<MailCampaign>(services.GetRequiredService<MailingUnitOfWork>()).Count();
                return ("ok", $"Доступна, кампаний: {campaigns}.");
            })
        };

        int? pushSubscriptions = null;
        if (chatFeature.IsEnabled)
        {
            checks.Add(Check("База чата (PostgreSQL)", () =>
            {
                var unitOfWork = services.GetRequiredService<ChatUnitOfWork>();
                var encoding = unitOfWork.ExecuteScalar("select pg_encoding_to_char(encoding) from pg_database where datname = current_database()") as string;
                pushSubscriptions = new XPQuery<ChatPushSubscription>(unitOfWork).Count();
                var result = ChatDatabaseEncodingCheck.Evaluate(encoding);
                return (result.IsUtf8 ? "ok" : "warn", result.IsUtf8 ? "Доступна, кодировка UTF8." : result.Message);
            }));
        }
        else
        {
            checks.Add(new SystemCheckDto("Чат", "ok", "Выключен в настройках (Chat:Enabled).", 0));
        }

        long? free = null;
        long? total = null;
        checks.Add(Check("Место на диске", () =>
        {
            var drive = new DriveInfo(Path.GetPathRoot(Path.GetFullPath(paths.StorageRoot))!);
            free = drive.AvailableFreeSpace;
            total = drive.TotalSize;
            var status = free < DiskErrorBytes ? "error" : free < DiskWarnBytes ? "warn" : "ok";
            return (status, $"Свободно {FormatBytes(free.Value)} из {FormatBytes(total.Value)} на диске {drive.Name}.");
        }));

        checks.Add(Check("Каталог ключей", () =>
        {
            Directory.CreateDirectory(paths.Keys);
            var probe = Path.Combine(paths.Keys, $".probe-{Guid.NewGuid():N}");
            File.WriteAllText(probe, "ok");
            File.Delete(probe);
            return ("ok", $"Запись есть: {paths.Keys}.");
        }));

        checks.Add(CheckBackups(paths.BackupRoot, DateTime.Now));

        checks.Add(new SystemCheckDto(
            "Ключ подписи входа",
            jwtSigningKey.Generated ? "warn" : "ok",
            jwtSigningKey.Generated
                ? $"В конфиге заглушка — используется сгенерированный ключ ({JwtSigningKey.FileName}). Это безопасно; не удаляйте файл."
                : "Задан в конфиге.",
            0));

        var overview = new OverviewService(services.GetRequiredService<LegacyUnitOfWork>(), services.GetRequiredService<MailingUnitOfWork>());
        DashboardDto? dashboard = null;
        try
        {
            dashboard = await overview.GetAsync(cancellationToken);
        }
        catch (Exception)
        {
            // Ошибка баз уже видна в проверках выше.
        }

        var storage = new List<StorageUsageDto>();
        if (paths.ChatFiles is not null)
        {
            storage.Add(Measure("Вложения чата", paths.ChatFiles));
        }

        storage.Add(Measure("Файлы рассылок", paths.Uploads));
        storage.Add(Measure("Журнал", paths.Logs));

        var problems = recentLog.Snapshot(50);
        if (problems.Any(x => x.Level is "Error" or "Critical" && x.TimestampUtc > DateTime.UtcNow.AddHours(-24)))
        {
            checks.Add(new SystemCheckDto("Ошибки за сутки", "warn", "В журнале есть ошибки за последние 24 часа — см. список ниже.", 0));
        }

        return new SystemStatusDto
        {
            Version = typeof(SystemStatusService).Assembly.GetCustomAttribute<AssemblyInformationalVersionAttribute>()?.InformationalVersion?.Split('+')[0] ?? "unknown",
            StartedAtUtc = StartedAt,
            CheckedAtUtc = DateTime.UtcNow,
            MachineName = Environment.MachineName,
            Overall = checks.Any(x => x.Status == "error") ? "error" : checks.Any(x => x.Status == "warn") ? "warn" : "ok",
            Checks = checks,
            Storage = storage,
            DiskFreeBytes = free,
            DiskTotalBytes = total,
            QueueDepth = dashboard?.QueueDepth ?? 0,
            FailedLast24Hours = dashboard?.FailedLast24Hours ?? 0,
            SentLast24Hours = dashboard?.SentLast24Hours ?? 0,
            PushSubscriptions = pushSubscriptions,
            LogDirectory = paths.Logs,
            LogFiles = Directory.Exists(paths.Logs)
                ? Directory.EnumerateFiles(paths.Logs, "api-*.log").Select(Path.GetFileName).OfType<string>().OrderDescending().Take(30).ToArray()
                : [],
            RecentProblems = problems
        };
    }

    /// <summary>
    /// Последняя резервная копия (папки yyyyMMdd-HHmmss из scripts/backup-puls.ps1): старше 36 часов или нет — внимание.
    /// </summary>
    public static SystemCheckDto CheckBackups(string? backupRoot, DateTime nowLocal)
    {
        const string name = "Резервная копия";
        if (string.IsNullOrWhiteSpace(backupRoot) || !Directory.Exists(backupRoot))
        {
            return new SystemCheckDto(name, "warn", $"Копий нет в {backupRoot ?? "(Backup:Root не задан)"} — настройте по docs/backup.md (scripts/register-backup-task.ps1).", 0);
        }

        var latest = Directory.EnumerateDirectories(backupRoot)
            .Select(Path.GetFileName)
            .Select(x => DateTime.TryParseExact(x, "yyyyMMdd-HHmmss", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.None, out var stamp) ? stamp : (DateTime?)null)
            .Where(x => x is not null)
            .Max();
        if (latest is null)
        {
            return new SystemCheckDto(name, "warn", $"В {backupRoot} нет ни одной копии — запустите задачу «Puls Next — резервная копия».", 0);
        }

        var age = nowLocal - latest.Value;
        var lastError = ReadLastBackupError(Path.Combine(backupRoot, "backup.log"));
        var detail = $"Последняя: {latest:dd.MM.yyyy HH:mm} ({FormatAge(age)} назад) в {backupRoot}.";
        if (lastError is not null)
        {
            return new SystemCheckDto(name, "error", $"{detail} Последний запуск с ошибкой: {lastError}", 0);
        }

        return new SystemCheckDto(name, age > TimeSpan.FromHours(36) ? "warn" : "ok", age > TimeSpan.FromHours(36) ? $"{detail} Копия устарела — проверьте задачу планировщика." : detail, 0);
    }

    /// <summary>
    /// Если последний запуск скрипта закончился ошибкой — ее текст (строка «ОШИБКА:» после последнего начала копии).
    /// </summary>
    private static string? ReadLastBackupError(string logPath)
    {
        try
        {
            if (!File.Exists(logPath))
            {
                return null;
            }

            var lines = File.ReadLines(logPath).TakeLast(200).ToList();
            var start = lines.FindLastIndex(x => x.Contains("=== Резервная копия", StringComparison.Ordinal));
            var error = lines.Skip(Math.Max(0, start)).LastOrDefault(x => x.Contains("ОШИБКА:", StringComparison.Ordinal));
            return error?[(error.IndexOf("ОШИБКА:", StringComparison.Ordinal) + "ОШИБКА:".Length)..].Trim();
        }
        catch (IOException)
        {
            return null;
        }
    }

    private static string FormatAge(TimeSpan age)
        => age.TotalHours < 1 ? $"{Math.Max(0, (int)age.TotalMinutes)} мин" : age.TotalDays < 2 ? $"{(int)age.TotalHours} ч" : $"{(int)age.TotalDays} дн";

    public string? GetLogFilePath(string fileName)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(fileName ?? string.Empty, @"^api-\d{8}\.log$"))
        {
            return null;
        }

        var path = Path.Combine(paths.Logs, fileName!);
        return File.Exists(path) ? path : null;
    }

    public static string FormatBytes(long bytes)
    {
        string[] units = ["Б", "КБ", "МБ", "ГБ", "ТБ"];
        double value = bytes;
        var unit = 0;
        while (value >= 1024 && unit < units.Length - 1)
        {
            value /= 1024;
            unit++;
        }

        return $"{value:0.#} {units[unit]}";
    }

    private static SystemCheckDto Check(string name, Func<(string Status, string Detail)> probe)
    {
        var watch = Stopwatch.StartNew();
        try
        {
            var (status, detail) = probe();
            return new SystemCheckDto(name, status, detail, watch.ElapsedMilliseconds);
        }
        catch (Exception exception)
        {
            return new SystemCheckDto(name, "error", $"Недоступно: {exception.GetBaseException().Message}", watch.ElapsedMilliseconds);
        }
    }

    private static StorageUsageDto Measure(string name, string path)
    {
        long bytes = 0;
        var files = 0;
        try
        {
            if (Directory.Exists(path))
            {
                foreach (var file in new DirectoryInfo(path).EnumerateFiles("*", SearchOption.AllDirectories))
                {
                    bytes += file.Length;
                    files++;
                }
            }
        }
        catch (Exception exception) when (exception is IOException or UnauthorizedAccessException)
        {
            // Нет доступа к части каталога — показываем то, что удалось посчитать.
        }

        return new StorageUsageDto(name, path, bytes, files);
    }
}

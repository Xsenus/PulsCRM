using System.Collections.Concurrent;
using System.Text;
using System.Threading.Channels;
using Microsoft.Extensions.Logging;

namespace PulsNext.Infrastructure;

/// <summary>
/// Запись журнала, видимая на странице «Состояние системы».
/// </summary>
public sealed record LogEntryDto(DateTime TimestampUtc, string Level, string Category, string Message, string? Exception);

/// <summary>
/// Последние предупреждения и ошибки в памяти API — для страницы «Состояние системы» без чтения файлов.
/// </summary>
public sealed class RecentLogBuffer
{
    public const int Capacity = 200;
    private readonly ConcurrentQueue<LogEntryDto> _entries = new();

    public void Add(LogEntryDto entry)
    {
        _entries.Enqueue(entry);
        while (_entries.Count > Capacity && _entries.TryDequeue(out _))
        {
        }
    }

    /// <summary>
    /// Новые сверху.
    /// </summary>
    public IReadOnlyList<LogEntryDto> Snapshot(int take = Capacity)
        => _entries.ToArray().Reverse().Take(take).ToArray();
}

/// <summary>
/// Журнал API в файлы: каталог logs внутри Storage:RootPath, файл на день (api-yyyyMMdd.log), хранятся
/// <see cref="RetentionDays"/> дней. Пишет в фоне, не задерживая запросы. Раньше журнал на IIS никуда не
/// сохранялся (stdout выключен), и ошибки было не найти.
/// </summary>
public sealed class FileLoggerProvider : ILoggerProvider
{
    public const int RetentionDays = 30;
    private readonly string _directory;
    private readonly LogLevel _minLevel;
    private readonly RecentLogBuffer _recent;
    private readonly Channel<LogEntryDto> _queue = Channel.CreateBounded<LogEntryDto>(new BoundedChannelOptions(10_000)
    {
        FullMode = BoundedChannelFullMode.DropOldest,
        SingleReader = true
    });
    private readonly Task _writer;
    private readonly Func<DateTime> _clock;

    public FileLoggerProvider(string directory, LogLevel minLevel, RecentLogBuffer recent, Func<DateTime>? clock = null)
    {
        _directory = directory;
        _minLevel = minLevel;
        _recent = recent;
        _clock = clock ?? (() => DateTime.UtcNow);
        Directory.CreateDirectory(directory);
        _writer = Task.Run(WriteLoopAsync);
    }

    public ILogger CreateLogger(string categoryName) => new FileLogger(this, categoryName);

    internal bool IsEnabled(LogLevel level) => level != LogLevel.None && level >= _minLevel;

    internal void Write(LogEntryDto entry)
    {
        if (entry.Level is "Warning" or "Error" or "Critical")
        {
            _recent.Add(entry);
        }

        _queue.Writer.TryWrite(entry);
    }

    /// <summary>
    /// Дожидается записи всего, что уже в очереди (для тестов и остановки).
    /// </summary>
    public async Task FlushAsync()
    {
        _queue.Writer.TryComplete();
        await _writer;
    }

    public void Dispose()
    {
        _queue.Writer.TryComplete();
        _writer.Wait(TimeSpan.FromSeconds(5));
    }

    public static string FileNameFor(DateTime utc) => $"api-{utc:yyyyMMdd}.log";

    private async Task WriteLoopAsync()
    {
        var lastCleanup = DateTime.MinValue;
        var buffer = new StringBuilder();
        while (await _queue.Reader.WaitToReadAsync())
        {
            buffer.Clear();
            DateTime? day = null;
            while (_queue.Reader.TryRead(out var entry))
            {
                // Записи за разные дни — в разные файлы.
                if (day is { } current && current != entry.TimestampUtc.Date)
                {
                    Append(current, buffer);
                    buffer.Clear();
                }

                day = entry.TimestampUtc.Date;
                buffer.Append(entry.TimestampUtc.ToString("yyyy-MM-dd HH:mm:ss.fff"))
                    .Append("Z [").Append(entry.Level).Append("] ")
                    .Append(entry.Category).Append(": ")
                    .AppendLine(entry.Message);
                if (entry.Exception is not null)
                {
                    buffer.AppendLine(entry.Exception);
                }
            }

            if (day is { } last)
            {
                Append(last, buffer);
            }

            var now = _clock();
            if (now - lastCleanup > TimeSpan.FromHours(6))
            {
                lastCleanup = now;
                DeleteOldFiles(now);
            }
        }
    }

    private void Append(DateTime day, StringBuilder text)
    {
        try
        {
            File.AppendAllText(Path.Combine(_directory, FileNameFor(day)), text.ToString(), Encoding.UTF8);
        }
        catch (IOException)
        {
            // Журнал не должен ронять API: при занятом файле запись теряется.
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private void DeleteOldFiles(DateTime now)
    {
        try
        {
            foreach (var file in Directory.EnumerateFiles(_directory, "api-*.log"))
            {
                if (File.GetLastWriteTimeUtc(file) < now.AddDays(-RetentionDays))
                {
                    File.Delete(file);
                }
            }
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private sealed class FileLogger(FileLoggerProvider provider, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

        public bool IsEnabled(LogLevel logLevel) => provider.IsEnabled(logLevel);

        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel))
            {
                return;
            }

            provider.Write(new LogEntryDto(provider._clock(), logLevel.ToString(), category, formatter(state, exception), exception?.ToString()));
        }
    }
}

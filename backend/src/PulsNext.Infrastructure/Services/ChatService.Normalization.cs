using System.Globalization;
using DevExpress.Xpo;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Chat;
using PulsNext.Domain.Legacy;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

public sealed partial class ChatService
{
    private void TryDeleteFile(string? relativePath)
    {
        if (string.IsNullOrWhiteSpace(relativePath))
        {
            return;
        }

        try
        {
            fileStore.Delete(relativePath);
        }
        catch (IOException)
        {
        }
        catch (UnauthorizedAccessException)
        {
        }
    }

    private string? NormalizeMessageText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return null;
        }

        var normalized = text.Replace("\r\n", "\n").Trim();
        ValidationHelper.Guard(normalized.Length <= Options.MaxMessageLength, $"Сообщение длиннее {Options.MaxMessageLength} символов.");
        return normalized;
    }

    private static string NormalizeRequired(string? value, int maxLength, string emptyMessage, string tooLongMessage)
    {
        var normalized = TextHelper.NullIfWhiteSpace(value);
        ValidationHelper.Guard(normalized is not null, emptyMessage);
        ValidationHelper.Guard(normalized!.Length <= maxLength, tooLongMessage);
        return normalized;
    }

    private static string? NormalizeOptional(string? value, int maxLength, string tooLongMessage)
    {
        var normalized = TextHelper.NullIfWhiteSpace(value);
        ValidationHelper.Guard(normalized is null || normalized.Length <= maxLength, tooLongMessage);
        return normalized;
    }

    /// <summary>
    /// Предел длительности голосового сообщения (браузер останавливает запись раньше).
    /// </summary>
    private const int MaxAudioDurationMs = 30 * 60 * 1000;

    private static bool IsAudioContentType(string? contentType)
        => contentType?.StartsWith("audio/", StringComparison.OrdinalIgnoreCase) == true;

    private static string NormalizeContentType(string? contentType, string extension)
    {
        // Параметры типа («audio/webm;codecs=opus») не храним: нужен сам тип.
        var normalized = TextHelper.NullIfWhiteSpace(contentType?.Split(';')[0])?.ToLowerInvariant();
        if (normalized is not null && normalized != "application/octet-stream" && normalized.Length <= 256)
        {
            return normalized;
        }

        return extension.ToLowerInvariant() switch
        {
            ".png" => "image/png",
            ".jpg" or ".jpeg" => "image/jpeg",
            ".gif" => "image/gif",
            ".webp" => "image/webp",
            ".bmp" => "image/bmp",
            ".pdf" => "application/pdf",
            ".txt" => "text/plain",
            ".webm" => "audio/webm",
            ".ogg" or ".oga" or ".opus" => "audio/ogg",
            ".m4a" => "audio/mp4",
            ".mp3" => "audio/mpeg",
            ".wav" => "audio/wav",
            _ => "application/octet-stream"
        };
    }

    private static string BuildDirectKey(int first, int second)
        => first < second ? $"{first}:{second}" : $"{second}:{first}";

    private static string? Truncate(string? value, int maxLength)
        => value is null || value.Length <= maxLength ? value : value[..maxLength] + "…";

    private static DateTime ForceUtc(DateTime value) => DateTimeHelper.ForceUtc(value);

    private static DateTime? ForceUtc(DateTime? value) => value is null ? null : DateTimeHelper.ForceUtc(value.Value);

    private static string FormatBytes(long bytes)
        => bytes >= 1024 * 1024 ? $"{bytes / (1024 * 1024)} МБ" : $"{Math.Max(1, bytes / 1024)} КБ";
}

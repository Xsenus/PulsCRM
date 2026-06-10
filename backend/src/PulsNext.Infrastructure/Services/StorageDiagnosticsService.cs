using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;

namespace PulsNext.Infrastructure;

public interface IStorageDiagnosticsService
{
    Task<StorageDiagnosticsDto> CheckAsync(CancellationToken cancellationToken);
}

public static class StoragePathHelper
{
    public static string GetAbsolutePath(string contentRootPath, string rootPath, string childPath)
    {
        return Path.GetFullPath(Path.Combine(contentRootPath, rootPath, childPath));
    }
}

public sealed class StorageDiagnosticsService(
    IHostEnvironment hostEnvironment,
    IOptions<StorageOptions> storageOptions) : IStorageDiagnosticsService
{
    public async Task<StorageDiagnosticsDto> CheckAsync(CancellationToken cancellationToken)
    {
        var options = storageOptions.Value;
        var keysPath = StoragePathHelper.GetAbsolutePath(hostEnvironment.ContentRootPath, options.RootPath, options.KeysPath);
        var uploadsPath = StoragePathHelper.GetAbsolutePath(hostEnvironment.ContentRootPath, options.RootPath, options.UploadsPath);

        var keys = await CheckPathAsync("DataProtectionKeys", keysPath, required: true, cancellationToken);
        var uploads = await CheckPathAsync("Uploads", uploadsPath, required: true, cancellationToken);

        return new StorageDiagnosticsDto
        {
            Status = keys.CanWrite && uploads.CanWrite ? "ok" : "error",
            CheckedAtUtc = DateTime.UtcNow,
            Keys = keys,
            Uploads = uploads,
            Notes = [
                "Data Protection keys must survive deploy and app pool restart.",
                "If keys are lost or unreadable, saved SMTP passwords may become impossible to decrypt."
            ]
        };
    }

    public static async Task<StoragePathDiagnosticsDto> CheckPathAsync(
        string name,
        string absolutePath,
        bool required,
        CancellationToken cancellationToken)
    {
        var result = new StoragePathDiagnosticsDto
        {
            Name = name,
            Path = absolutePath,
            Required = required
        };

        try
        {
            Directory.CreateDirectory(absolutePath);
            result.Exists = Directory.Exists(absolutePath);

            var probePath = Path.Combine(absolutePath, $".pulscrm-write-check-{Guid.NewGuid():N}.tmp");
            var probeValue = Guid.NewGuid().ToString("N");
            await File.WriteAllTextAsync(probePath, probeValue, cancellationToken);
            var readValue = await File.ReadAllTextAsync(probePath, cancellationToken);
            File.Delete(probePath);

            result.CanWrite = string.Equals(readValue, probeValue, StringComparison.Ordinal);
            result.Message = result.CanWrite ? "Directory is available for read and write." : "Probe content mismatch after reading.";
        }
        catch (OperationCanceledException)
        {
            throw;
        }
        catch (Exception ex)
        {
            result.Exists = Directory.Exists(absolutePath);
            result.CanWrite = false;
            result.Message = ex.Message;
        }

        return result;
    }
}

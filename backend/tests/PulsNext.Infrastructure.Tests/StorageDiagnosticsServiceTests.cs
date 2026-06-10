using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Options;
using PulsNext.Infrastructure;
using Xunit;

namespace PulsNext.Infrastructure.Tests;

public sealed class StorageDiagnosticsServiceTests
{
    [Fact]
    public void GetAbsolutePath_NormalizesRelativeStoragePath()
    {
        var contentRoot = Path.Combine(Path.GetTempPath(), "pulscrm-content-root");

        var actual = StoragePathHelper.GetAbsolutePath(contentRoot, "..", "keys");

        Assert.Equal(Path.GetFullPath(Path.Combine(contentRoot, "..", "keys")), actual);
    }

    [Fact]
    public async Task CheckPathAsync_CreatesDirectoryAndRemovesProbeFile()
    {
        var tempRoot = Path.Combine(Path.GetTempPath(), "pulscrm-storage-tests", Guid.NewGuid().ToString("N"));

        try
        {
            var result = await StorageDiagnosticsService.CheckPathAsync("Uploads", tempRoot, required: true, CancellationToken.None);

            Assert.Equal("Uploads", result.Name);
            Assert.Equal(tempRoot, result.Path);
            Assert.True(result.Required);
            Assert.True(result.Exists);
            Assert.True(result.CanWrite);
            Assert.Equal("Directory is available for read and write.", result.Message);
            Assert.Empty(Directory.GetFiles(tempRoot, ".pulscrm-write-check-*.tmp"));
        }
        finally
        {
            if (Directory.Exists(tempRoot))
            {
                Directory.Delete(tempRoot, recursive: true);
            }
        }
    }

    [Fact]
    public async Task CheckAsync_ReturnsOkWhenKeysAndUploadsAreWritable()
    {
        var tempRoot = Path.Combine(Path.GetTempPath(), "pulscrm-storage-tests", Guid.NewGuid().ToString("N"));

        try
        {
            var service = new StorageDiagnosticsService(
                new TestHostEnvironment { ContentRootPath = tempRoot },
                Options.Create(new StorageOptions
                {
                    RootPath = "storage",
                    KeysPath = "keys",
                    UploadsPath = "uploads"
                }));

            var result = await service.CheckAsync(CancellationToken.None);

            Assert.Equal("ok", result.Status);
            Assert.True(result.Keys.CanWrite);
            Assert.True(result.Uploads.CanWrite);
            Assert.Contains("Data Protection keys must survive deploy and app pool restart.", result.Notes);
        }
        finally
        {
            if (Directory.Exists(tempRoot))
            {
                Directory.Delete(tempRoot, recursive: true);
            }
        }
    }

    private sealed class TestHostEnvironment : IHostEnvironment
    {
        public string EnvironmentName { get; set; } = Environments.Development;
        public string ApplicationName { get; set; } = "PulsNext.Infrastructure.Tests";
        public string ContentRootPath { get; set; } = string.Empty;
        public IFileProvider ContentRootFileProvider { get; set; } = new NullFileProvider();
    }
}

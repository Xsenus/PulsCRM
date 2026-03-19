using System.Reflection;
using System.Text;
using Swashbuckle.AspNetCore.SwaggerUI;

namespace PulsNext.Api;

internal static class SwaggerUiCacheBusting
{
    private const string IndexResourceName = "Swashbuckle.AspNetCore.SwaggerUI.index.html";
    private static readonly string AssetVersion = typeof(SwaggerUIOptions).Assembly.GetName().Version?.ToString() ?? "1";
    private static readonly byte[] VersionedIndexBytes = BuildVersionedIndexBytes();

    public static string AppendVersion(string path)
    {
        return $"{path}?v={AssetVersion}";
    }

    public static Stream CreateVersionedIndexStream()
    {
        return new MemoryStream(VersionedIndexBytes, writable: false);
    }

    private static byte[] BuildVersionedIndexBytes()
    {
        var swaggerUiAssembly = typeof(SwaggerUIOptions).Assembly;
        using var stream = swaggerUiAssembly.GetManifestResourceStream(IndexResourceName)
            ?? throw new InvalidOperationException($"Embedded Swagger UI resource '{IndexResourceName}' was not found.");
        using var reader = new StreamReader(stream, Encoding.UTF8);

        var html = reader.ReadToEnd();

        html = html
            .Replace("./swagger-ui.css", AppendVersion("./swagger-ui.css"), StringComparison.Ordinal)
            .Replace("./index.css", AppendVersion("./index.css"), StringComparison.Ordinal)
            .Replace("./favicon-32x32.png", AppendVersion("./favicon-32x32.png"), StringComparison.Ordinal)
            .Replace("./favicon-16x16.png", AppendVersion("./favicon-16x16.png"), StringComparison.Ordinal)
            .Replace("./swagger-ui-bundle.js", AppendVersion("./swagger-ui-bundle.js"), StringComparison.Ordinal)
            .Replace("./swagger-ui-standalone-preset.js", AppendVersion("./swagger-ui-standalone-preset.js"), StringComparison.Ordinal)
            .Replace("index.js", AppendVersion("index.js"), StringComparison.Ordinal);

        return Encoding.UTF8.GetBytes(html);
    }
}

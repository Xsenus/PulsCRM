using System.Security.Claims;
using System.Data.Common;
using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Chat;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;

namespace PulsNext.Infrastructure;

public sealed class LegacyUnitOfWork(IDataLayer dataLayer, params IDisposable[] disposeOnDisconnect) : UnitOfWork(dataLayer, disposeOnDisconnect);

public sealed class MailingUnitOfWork(IDataLayer dataLayer, params IDisposable[] disposeOnDisconnect) : UnitOfWork(dataLayer, disposeOnDisconnect);

/// <summary>
/// Включен ли модуль чата в текущем запуске API.
/// </summary>
public sealed record ChatFeature(bool IsEnabled);

public interface ICurrentUserAccessor
{
    int? GetLegacyUserId();
    string? GetLogin();
}

public interface IDatabaseInfoService
{
    DatabaseInfoDto GetLegacyDatabaseInfo();
}

public sealed class HttpCurrentUserAccessor(IHttpContextAccessor httpContextAccessor) : ICurrentUserAccessor
{
    public int? GetLegacyUserId()
    {
        var value = httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(value, out var id) ? id : null;
    }

    public string? GetLogin() => httpContextAccessor.HttpContext?.User.FindFirstValue(ClaimTypes.Name);
}

public sealed class DatabaseInfoService(string legacyConnectionString) : IDatabaseInfoService
{
    public DatabaseInfoDto GetLegacyDatabaseInfo()
        => new()
        {
            DatabaseName = GetDatabaseName(legacyConnectionString)
        };

    private static string GetDatabaseName(string connectionString)
    {
        try
        {
            var builder = new DbConnectionStringBuilder
            {
                ConnectionString = connectionString
            };

            foreach (var key in new[] { "Initial Catalog", "Database" })
            {
                if (builder.TryGetValue(key, out var value) && value is not null && !string.IsNullOrWhiteSpace(value.ToString()))
                {
                    return value.ToString()!;
                }
            }
        }
        catch (ArgumentException)
        {
        }

        return "unknown";
    }
}

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddPulsNextInfrastructure(this IServiceCollection services, IConfiguration configuration, string contentRootPath)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<DispatchOptions>(configuration.GetSection(DispatchOptions.SectionName));
        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        services.Configure<LegacyDbOptions>(configuration.GetSection(LegacyDbOptions.SectionName));
        services.Configure<MailingDbOptions>(configuration.GetSection(MailingDbOptions.SectionName));

        var legacyConnectionString = GetConnectionString(configuration, contentRootPath, "LegacyDb");
        var mailingConnectionString = GetConnectionString(configuration, contentRootPath, "MailingDb");
        var autoCreateMailingSchema = configuration.GetSection(MailingDbOptions.SectionName).GetValue("AutoCreateSchema", true);

        services.AddHttpContextAccessor();
        services.AddSingleton<ICurrentUserAccessor, HttpCurrentUserAccessor>();
        services.AddSingleton<IDatabaseInfoService>(new DatabaseInfoService(legacyConnectionString));

        services.AddXpoCustomSession<LegacyUnitOfWork>(true, options =>
            options.UseConnectionString(legacyConnectionString)
                .UseAutoCreationOption(AutoCreateOption.SchemaAlreadyExists)
                .UseEntityTypes(LegacyPersistentTypes.All));

        services.AddXpoCustomSession<MailingUnitOfWork>(true, options =>
            options.UseConnectionString(mailingConnectionString)
                .UseAutoCreationOption(autoCreateMailingSchema ? AutoCreateOption.DatabaseAndSchema : AutoCreateOption.SchemaAlreadyExists)
                .UseEntityTypes(MailingPersistentTypes.All));

        services.Configure<ChatOptions>(configuration.GetSection(ChatOptions.SectionName));
        services.AddSingleton(new ChatFeature(IsChatEnabled(configuration, contentRootPath)));
        if (IsChatEnabled(configuration, contentRootPath))
        {
            var chatConnectionString = GetConnectionString(configuration, contentRootPath, "ChatDb");
            var autoCreateChatSchema = configuration.GetSection(ChatOptions.SectionName).GetValue(nameof(ChatOptions.AutoCreateSchema), true);
            services.AddXpoCustomSession<ChatUnitOfWork>(true, options =>
                options.UseConnectionString(chatConnectionString)
                    .UseAutoCreationOption(autoCreateChatSchema ? AutoCreateOption.DatabaseAndSchema : AutoCreateOption.SchemaAlreadyExists)
                    .UseEntityTypes(ChatPersistentTypes.All));
            services.AddScoped<IChatUserDirectory>(provider => new LegacyChatUserDirectory(new Lazy<LegacyUnitOfWork>(provider.GetRequiredService<LegacyUnitOfWork>)));
            services.AddSingleton<IChatFileStore, DiskChatFileStore>();
            services.TryAddSingleton<IChatEventPublisher, NullChatEventPublisher>();
            services.AddScoped<IChatService, ChatService>();
            services.AddScoped<IChatAttachmentCleaner, ChatAttachmentCleaner>();
            services.AddHostedService<ChatAttachmentCleanupHostedService>();
        }

        services.AddDataProtection()
            .PersistKeysToFileSystem(GetKeysDirectory(configuration, contentRootPath));

        services.AddSingleton<IDispatchChannel, DispatchChannel>();
        services.AddSingleton<IJwtTokenFactory, JwtTokenFactory>();
        services.AddSingleton<ISecretProtector, DataProtectionSecretProtector>();
        services.AddSingleton<IScheduleCalculator, ScheduleCalculator>();
        services.AddSingleton<ITransportProfileLimiter, TransportProfileLimiter>();
        services.AddScoped<IAuthService, AuthService>();
        services.AddScoped<IEmployeeService, EmployeeService>();
        services.AddScoped<IOverviewService, OverviewService>();
        services.AddScoped<IParusLicenseAnalyticsService, ParusLicenseAnalyticsService>();
        services.AddScoped<IParusLicenseImportService, ParusLicenseImportService>();
        services.AddScoped<IOrganizationService, OrganizationService>();
        services.AddScoped<IWorkService, WorkService>();
        services.AddScoped<IFileStorageService, FileStorageService>();
        services.AddScoped<IStorageDiagnosticsService, StorageDiagnosticsService>();
        services.AddScoped<ITransportProfileService, TransportProfileService>();
        services.AddScoped<ICampaignService, CampaignService>();
        services.AddScoped<IRecipientResolver, RecipientResolver>();
        services.AddScoped<IDispatchService, DispatchService>();
        services.AddScoped<IDispatchDiagnosticsService, DispatchDiagnosticsService>();
        services.AddScoped<IStatisticsService, StatisticsService>();
        services.AddScoped<IMailComposer, MailComposer>();
        services.AddScoped<IMailSender, MailSender>();

        return services;
    }

    private static string GetConnectionString(IConfiguration configuration, string contentRootPath, string name)
    {
        var productionConfigPath = Path.Combine(contentRootPath, "appsettings.Production.json");
        if (File.Exists(productionConfigPath))
        {
            var productionConfiguration = new ConfigurationBuilder()
                .AddJsonFile(productionConfigPath, optional: false, reloadOnChange: false)
                .Build();
            var productionConnectionString = productionConfiguration.GetConnectionString(name);
            if (!string.IsNullOrWhiteSpace(productionConnectionString))
            {
                return productionConnectionString;
            }
        }

        return configuration.GetConnectionString(name)
            ?? throw new InvalidOperationException($"ConnectionStrings:{name} is not configured.");
    }

    /// <summary>
    /// Чат включен, только если Chat:Enabled=true и задана строка ChatDb:
    /// без них API работает как раньше и не обращается к PostgreSQL.
    /// </summary>
    private static bool IsChatEnabled(IConfiguration configuration, string contentRootPath)
    {
        var enabled = GetProductionOverride(contentRootPath)?.GetSection(ChatOptions.SectionName).GetValue<bool?>(nameof(ChatOptions.Enabled))
            ?? configuration.GetSection(ChatOptions.SectionName).GetValue<bool>(nameof(ChatOptions.Enabled));
        if (!enabled)
        {
            return false;
        }

        var connectionString = GetProductionOverride(contentRootPath)?.GetConnectionString("ChatDb")
            ?? configuration.GetConnectionString("ChatDb");
        return !string.IsNullOrWhiteSpace(connectionString);
    }

    private static IConfiguration? GetProductionOverride(string contentRootPath)
    {
        var productionConfigPath = Path.Combine(contentRootPath, "appsettings.Production.json");
        return File.Exists(productionConfigPath)
            ? new ConfigurationBuilder().AddJsonFile(productionConfigPath, optional: false, reloadOnChange: false).Build()
            : null;
    }

    private static DirectoryInfo GetKeysDirectory(IConfiguration configuration, string contentRootPath)
    {
        var rootPath = configuration.GetSection(StorageOptions.SectionName).GetValue<string>(nameof(StorageOptions.RootPath)) ?? "../../../storage";
        var keysPath = configuration.GetSection(StorageOptions.SectionName).GetValue<string>(nameof(StorageOptions.KeysPath)) ?? "keys";

        var combined = StoragePathHelper.GetAbsolutePath(contentRootPath, rootPath, keysPath);
        Directory.CreateDirectory(combined);
        return new DirectoryInfo(combined);
    }
}

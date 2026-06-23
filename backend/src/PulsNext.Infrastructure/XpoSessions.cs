using System.Security.Claims;
using DevExpress.Xpo;
using DevExpress.Xpo.DB;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Options;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;

namespace PulsNext.Infrastructure;

public sealed class LegacyUnitOfWork(IDataLayer dataLayer, params IDisposable[] disposeOnDisconnect) : UnitOfWork(dataLayer, disposeOnDisconnect);

public sealed class MailingUnitOfWork(IDataLayer dataLayer, params IDisposable[] disposeOnDisconnect) : UnitOfWork(dataLayer, disposeOnDisconnect);

public interface ICurrentUserAccessor
{
    int? GetLegacyUserId();
    string? GetLogin();
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

public static class ServiceCollectionExtensions
{
    public static IServiceCollection AddPulsNextInfrastructure(this IServiceCollection services, IConfiguration configuration, string contentRootPath)
    {
        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.Configure<DispatchOptions>(configuration.GetSection(DispatchOptions.SectionName));
        services.Configure<StorageOptions>(configuration.GetSection(StorageOptions.SectionName));
        services.Configure<LegacyDbOptions>(configuration.GetSection(LegacyDbOptions.SectionName));
        services.Configure<MailingDbOptions>(configuration.GetSection(MailingDbOptions.SectionName));

        var legacyConnectionString = configuration.GetConnectionString("LegacyDb")
            ?? throw new InvalidOperationException("ConnectionStrings:LegacyDb is not configured.");
        var mailingConnectionString = configuration.GetConnectionString("MailingDb")
            ?? throw new InvalidOperationException("ConnectionStrings:MailingDb is not configured.");
        var autoCreateMailingSchema = configuration.GetSection(MailingDbOptions.SectionName).GetValue("AutoCreateSchema", true);

        services.AddHttpContextAccessor();
        services.AddSingleton<ICurrentUserAccessor, HttpCurrentUserAccessor>();

        services.AddXpoCustomSession<LegacyUnitOfWork>(true, options =>
            options.UseConnectionString(legacyConnectionString)
                .UseAutoCreationOption(AutoCreateOption.SchemaAlreadyExists)
                .UseEntityTypes(LegacyPersistentTypes.All));

        services.AddXpoCustomSession<MailingUnitOfWork>(true, options =>
            options.UseConnectionString(mailingConnectionString)
                .UseAutoCreationOption(autoCreateMailingSchema ? AutoCreateOption.DatabaseAndSchema : AutoCreateOption.SchemaAlreadyExists)
                .UseEntityTypes(MailingPersistentTypes.All));

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

    private static DirectoryInfo GetKeysDirectory(IConfiguration configuration, string contentRootPath)
    {
        var rootPath = configuration.GetSection(StorageOptions.SectionName).GetValue<string>(nameof(StorageOptions.RootPath)) ?? "../../../storage";
        var keysPath = configuration.GetSection(StorageOptions.SectionName).GetValue<string>(nameof(StorageOptions.KeysPath)) ?? "keys";

        var combined = StoragePathHelper.GetAbsolutePath(contentRootPath, rootPath, keysPath);
        Directory.CreateDirectory(combined);
        return new DirectoryInfo(combined);
    }
}

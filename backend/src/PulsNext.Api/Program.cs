using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http.Features;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using PulsNext.Api;
using PulsNext.Api.Models;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure;

var builder = WebApplication.CreateBuilder(args);
var importRequestSizeLimit = Math.Max(
    builder.Configuration.GetSection(StorageOptions.SectionName).GetValue<long>(nameof(StorageOptions.MaxFileSizeBytes), 25 * 1024 * 1024),
    builder.Configuration.GetSection("Import").GetValue<long>("MaxRequestSizeBytes", 200L * 1024 * 1024));

builder.Services.AddPulsNextInfrastructure(builder.Configuration, builder.Environment.ContentRootPath);
builder.Services.AddHostedService<SchedulerHostedService>();
builder.Services.AddHostedService<QueuePumpHostedService>();
builder.Services.AddHostedService<RecoveryHostedService>();
builder.Services.AddHostedService<SenderHostedService>();
builder.Services.AddControllers();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Puls Next Mailing API",
        Version = "v1",
        Description = "HTTP API для управления пользователями, организациями, задачами и почтовыми рассылками Puls CRM."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Укажите JWT-токен в формате: Bearer {token}"
    });

    options.AddSecurityRequirement(document => new OpenApiSecurityRequirement
    {
        [new OpenApiSecuritySchemeReference("Bearer", document)] = []
    });

    foreach (var xmlPath in GetSwaggerXmlDocumentationPaths())
    {
        options.IncludeXmlComments(xmlPath, includeControllerXmlComments: true);
    }
});

builder.WebHost.ConfigureKestrel(options =>
{
    options.Limits.MaxRequestBodySize = importRequestSizeLimit;
});

builder.Services.Configure<FormOptions>(options =>
{
    options.MultipartBodyLengthLimit = importRequestSizeLimit;
});

builder.Services.AddCors(options =>
{
    options.AddPolicy("web", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(_ => true)
                .AllowAnyHeader()
                .AllowAnyMethod();
            return;
        }

        policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:5173"])
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var jwtSection = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();
var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSection.SigningKey));

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.RequireHttpsMetadata = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtSection.Issuer,
            ValidAudience = jwtSection.Audience,
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.FromMinutes(1)
        };
    });

builder.Services.AddAuthorization();

var app = builder.Build();

app.UseExceptionHandler(handlerApp =>
{
    handlerApp.Run(async context =>
    {
        var error = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>()?.Error;
        var statusCode = error switch
        {
            UnauthorizedAccessException => StatusCodes.Status401Unauthorized,
            KeyNotFoundException => StatusCodes.Status404NotFound,
            System.ComponentModel.DataAnnotations.ValidationException => StatusCodes.Status400BadRequest,
            _ => StatusCodes.Status500InternalServerError
        };

        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";

        await context.Response.WriteAsJsonAsync(new ApiErrorResponse
        {
            Message = error?.Message ?? "Непредвиденная ошибка сервера."
        });
    });
});

app.UseSwagger();
app.UseSwaggerUI(options =>
{
    options.StylesPath = SwaggerUiCacheBusting.AppendVersion("./swagger-ui.css");
    options.ScriptBundlePath = SwaggerUiCacheBusting.AppendVersion("./swagger-ui-bundle.js");
    options.ScriptPresetsPath = SwaggerUiCacheBusting.AppendVersion("./swagger-ui-standalone-preset.js");
    options.IndexStream = SwaggerUiCacheBusting.CreateVersionedIndexStream;
});
app.UseCors("web");
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

static IEnumerable<string> GetSwaggerXmlDocumentationPaths()
{
    var assemblies = new[]
    {
        typeof(Program).Assembly,
        typeof(LoginRequest).Assembly,
        typeof(CampaignStatus).Assembly
    };

    return assemblies
        .Select(assembly => Path.Combine(AppContext.BaseDirectory, $"{assembly.GetName().Name}.xml"))
        .Where(File.Exists)
        .Distinct(StringComparer.OrdinalIgnoreCase);
}

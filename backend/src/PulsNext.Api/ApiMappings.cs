using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http.HttpResults;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure;

namespace PulsNext.Api;

public static class ApiMappings
{
    public static IEndpointRouteBuilder MapPulsNextApi(this IEndpointRouteBuilder app)
    {
        var api = app.MapGroup("/api");

        MapAuth(api);
        MapDashboard(api);
        MapEmployees(api);
        MapOrganizations(api);
        MapWork(api);
        MapTransportProfiles(api);
        MapFiles(api);
        MapCampaigns(api);

        return app;
    }

    private static void MapAuth(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/auth");

        group.MapPost("/login", async Task<Ok<AuthResponse>> (LoginRequest request, IAuthService authService, CancellationToken cancellationToken) =>
        {
            var response = await authService.LoginAsync(request, cancellationToken);
            return TypedResults.Ok(response);
        }).AllowAnonymous();

        group.MapGet("/users", async Task<Ok<IReadOnlyCollection<LoginUserOptionDto>>> (
            string? search,
            int? take,
            IAuthService authService,
            CancellationToken cancellationToken) =>
        {
            var result = await authService.GetLoginUsersAsync(search, take ?? 12, cancellationToken);
            return TypedResults.Ok(result);
        }).AllowAnonymous();

        group.MapGet("/me", async Task<Results<Ok<CurrentUserDto>, UnauthorizedHttpResult>> (IAuthService authService, CancellationToken cancellationToken) =>
        {
            var current = await authService.GetCurrentAsync(cancellationToken);
            return current is null ? TypedResults.Unauthorized() : TypedResults.Ok(current);
        }).RequireAuthorization();
    }

    private static void MapDashboard(RouteGroupBuilder api)
    {
        api.MapGet("/dashboard", async Task<Ok<DashboardDto>> (IOverviewService overviewService, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await overviewService.GetAsync(cancellationToken));
        }).RequireAuthorization();
    }

    private static void MapEmployees(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/employees").RequireAuthorization();

        group.MapGet(string.Empty, async Task<Ok<PagedResult<EmployeeListItemDto>>> (
            string? search,
            int? skip,
            int? take,
            bool? includeDismissed,
            IEmployeeService employeeService,
            CancellationToken cancellationToken) =>
        {
            var result = await employeeService.GetAsync(search, skip ?? 0, take ?? 100, includeDismissed ?? false, cancellationToken);
            return TypedResults.Ok(result);
        });

        group.MapGet("/{id:int}", async Task<Results<Ok<EmployeeListItemDto>, NotFound>> (int id, IEmployeeService employeeService, CancellationToken cancellationToken) =>
        {
            var result = await employeeService.GetByIdAsync(id, cancellationToken);
            return result is null ? TypedResults.NotFound() : TypedResults.Ok(result);
        });
    }

    private static void MapOrganizations(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/organizations").RequireAuthorization();

        group.MapGet(string.Empty, async Task<Ok<PagedResult<OrganizationListItemDto>>> (
            string? search,
            int? raionId,
            int? skip,
            int? take,
            IOrganizationService organizationService,
            CancellationToken cancellationToken) =>
        {
            var result = await organizationService.GetAsync(search, raionId, skip ?? 0, take ?? 100, cancellationToken);
            return TypedResults.Ok(result);
        });

        group.MapGet("/raions", async Task<Ok<IReadOnlyCollection<OrganizationRaionDto>>> (
            string? search,
            IOrganizationService organizationService,
            CancellationToken cancellationToken) =>
        {
            var result = await organizationService.GetRaionsAsync(search, cancellationToken);
            return TypedResults.Ok(result);
        });

        group.MapGet("/{id:int}", async Task<Results<Ok<OrganizationDetailsDto>, NotFound>> (int id, IOrganizationService organizationService, CancellationToken cancellationToken) =>
        {
            var result = await organizationService.GetByIdAsync(id, cancellationToken);
            return result is null ? TypedResults.NotFound() : TypedResults.Ok(result);
        });
    }

    private static void MapWork(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/work").RequireAuthorization();

        group.MapGet(string.Empty, async Task<Ok<PagedResult<WorkItemDto>>> (
            string? search,
            int? orgId,
            int? employeeId,
            bool? onlyOpen,
            int? skip,
            int? take,
            IWorkService workService,
            CancellationToken cancellationToken) =>
        {
            var result = await workService.GetAsync(search, orgId, employeeId, onlyOpen ?? false, skip ?? 0, take ?? 200, cancellationToken);
            return TypedResults.Ok(result);
        });
    }

    private static void MapTransportProfiles(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/transport-profiles").RequireAuthorization();

        group.MapGet(string.Empty, async Task<Ok<IReadOnlyCollection<TransportProfileDto>>> (ITransportProfileService service, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await service.GetAllAsync(cancellationToken));
        });

        group.MapGet("/{id:int}", async Task<Results<Ok<TransportProfileDto>, NotFound>> (int id, ITransportProfileService service, CancellationToken cancellationToken) =>
        {
            var result = await service.GetByIdAsync(id, cancellationToken);
            return result is null ? TypedResults.NotFound() : TypedResults.Ok(result);
        });

        group.MapPost(string.Empty, async Task<Ok<TransportProfileDto>> (TransportProfileUpsertRequest request, ITransportProfileService service, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await service.UpsertAsync(null, request, cancellationToken));
        });

        group.MapPut("/{id:int}", async Task<Ok<TransportProfileDto>> (int id, TransportProfileUpsertRequest request, ITransportProfileService service, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await service.UpsertAsync(id, request, cancellationToken));
        });

        group.MapDelete("/{id:int}", async Task<NoContent> (int id, ITransportProfileService service, CancellationToken cancellationToken) =>
        {
            await service.DeleteAsync(id, cancellationToken);
            return TypedResults.NoContent();
        });

        group.MapPost("/{id:int}/test", async Task<Ok<TransportProfileTestResultDto>> (int id, ITransportProfileService service, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await service.TestAsync(id, cancellationToken));
        });
    }

    private static void MapFiles(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/files").RequireAuthorization();

        group.MapPost(string.Empty, async Task<Ok<StoredFileDto>> (HttpRequest request, IFileStorageService fileStorageService, CancellationToken cancellationToken) =>
        {
            if (!request.HasFormContentType)
            {
                throw new System.ComponentModel.DataAnnotations.ValidationException("Ожидается multipart/form-data.");
            }

            var form = await request.ReadFormAsync(cancellationToken);
            var file = form.Files.FirstOrDefault() ?? throw new System.ComponentModel.DataAnnotations.ValidationException("Файл не передан.");
            await using var stream = file.OpenReadStream();
            var dto = await fileStorageService.SaveAsync(new FileUploadCommand
            {
                Content = stream,
                FileName = file.FileName,
                ContentType = file.ContentType,
                IsPublic = bool.TryParse(form["isPublic"].FirstOrDefault(), out var isPublic) && isPublic
            }, cancellationToken);

            return TypedResults.Ok(dto);
        });

        group.MapGet("/{id:int}", async Task<Results<Ok<StoredFileDto>, NotFound>> (int id, IFileStorageService fileStorageService, CancellationToken cancellationToken) =>
        {
            var dto = await fileStorageService.GetAsync(id, cancellationToken);
            return dto is null ? TypedResults.NotFound() : TypedResults.Ok(dto);
        });

        group.MapGet("/{id:int}/download", async Task<Results<FileStreamHttpResult, NotFound>> (int id, IFileStorageService fileStorageService, CancellationToken cancellationToken) =>
        {
            var opened = await fileStorageService.OpenReadAsync(id, cancellationToken);
            if (opened is null)
            {
                return TypedResults.NotFound();
            }

            return TypedResults.File(opened.Value.Content, opened.Value.Metadata.ContentType ?? "application/octet-stream", opened.Value.Metadata.OriginalFileName, enableRangeProcessing: true);
        });
    }

    private static void MapCampaigns(RouteGroupBuilder api)
    {
        var group = api.MapGroup("/campaigns").RequireAuthorization();

        group.MapGet(string.Empty, async Task<Ok<PagedResult<CampaignListItemDto>>> (
            string? search,
            CampaignStatus? status,
            int? skip,
            int? take,
            ICampaignService campaignService,
            CancellationToken cancellationToken) =>
        {
            var result = await campaignService.GetAsync(search, status, skip ?? 0, take ?? 100, cancellationToken);
            return TypedResults.Ok(result);
        });

        group.MapGet("/{id:int}", async Task<Results<Ok<CampaignDetailsDto>, NotFound>> (int id, ICampaignService campaignService, CancellationToken cancellationToken) =>
        {
            var result = await campaignService.GetByIdAsync(id, cancellationToken);
            return result is null ? TypedResults.NotFound() : TypedResults.Ok(result);
        });

        group.MapPost(string.Empty, async Task<Ok<CampaignDetailsDto>> (CampaignUpsertRequest request, ICampaignService campaignService, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await campaignService.UpsertAsync(null, request, cancellationToken));
        });

        group.MapPut("/{id:int}", async Task<Ok<CampaignDetailsDto>> (int id, CampaignUpsertRequest request, ICampaignService campaignService, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await campaignService.UpsertAsync(id, request, cancellationToken));
        });

        group.MapDelete("/{id:int}", async Task<NoContent> (int id, ICampaignService campaignService, CancellationToken cancellationToken) =>
        {
            await campaignService.DeleteAsync(id, cancellationToken);
            return TypedResults.NoContent();
        });

        group.MapPost("/preview-schedule", async Task<Ok<IReadOnlyCollection<ScheduleOccurrenceDto>>> (SchedulePreviewRequest request, ICampaignService campaignService, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await campaignService.PreviewScheduleAsync(request, cancellationToken));
        });

        group.MapPost("/preview-recipients", async Task<Ok<CampaignRecipientPreviewDto>> (CampaignUpsertRequest request, ICampaignService campaignService, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await campaignService.PreviewRecipientsAsync(request, cancellationToken));
        });

        group.MapPost("/{id:int}/status", async Task<Ok<CampaignDetailsDto>> (int id, CampaignStatusChangeRequest request, ICampaignService campaignService, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await campaignService.ChangeStatusAsync(id, request.Status, cancellationToken));
        });

        group.MapPost("/{id:int}/run", async Task<Ok<DispatchBatchDto>> (int id, CampaignManualRunRequest request, ICampaignService campaignService, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await campaignService.RunAsync(id, request, cancellationToken));
        });

        group.MapGet("/{id:int}/stats", async Task<Ok<CampaignStatisticsDto>> (int id, IStatisticsService statisticsService, CancellationToken cancellationToken) =>
        {
            return TypedResults.Ok(await statisticsService.GetCampaignStatisticsAsync(id, cancellationToken));
        });
    }
}

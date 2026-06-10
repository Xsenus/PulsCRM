using System.ComponentModel.DataAnnotations;
using DevExpress.Xpo;
using PulsNext.Domain.Legacy;
using PulsNext.Domain.Mailing;
using PulsNext.Infrastructure.Internal;

namespace PulsNext.Infrastructure;

public interface IAuthService
{
    Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<LoginUserOptionDto>> GetLoginUsersAsync(string? search, int take, CancellationToken cancellationToken);
    Task<CurrentUserDto?> GetCurrentAsync(CancellationToken cancellationToken);
}

public sealed class AuthService(
    LegacyUnitOfWork legacyUnitOfWork,
    ICurrentUserAccessor currentUserAccessor,
    IJwtTokenFactory jwtTokenFactory) : IAuthService
{
    public Task<AuthResponse> LoginAsync(LoginRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(request.Login), "Введите логин.");
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(request.Password), "Введите пароль.");

        var login = request.Login.Trim();
        var users = new XPQuery<LegacyUser>(legacyUnitOfWork).ToList();
        var user = users.FirstOrDefault(x => string.Equals(x.Name, login, StringComparison.OrdinalIgnoreCase));

        if (user is null)
        {
            throw new UnauthorizedAccessException("Пользователь не найден.");
        }

        if (string.Equals(user.UserGroup?.Name, "Уволенные", StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Пользователь уволен и не может войти в систему.");
        }

        var hash = LegacyPasswordHasher.HashUnicodeMd5(request.Password);
        if (!string.Equals(user.Password, hash, StringComparison.OrdinalIgnoreCase))
        {
            throw new UnauthorizedAccessException("Неверный пароль.");
        }

        return Task.FromResult(jwtTokenFactory.Create(user));
    }

    public Task<IReadOnlyCollection<LoginUserOptionDto>> GetLoginUsersAsync(string? search, int take, CancellationToken cancellationToken)
    {
        var term = TextHelper.NullIfWhiteSpace(search);
        IEnumerable<LegacyUser> query = new XPQuery<LegacyUser>(legacyUnitOfWork)
            .ToList()
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .Where(x => !string.Equals(x.UserGroup?.Name, "Уволенные", StringComparison.OrdinalIgnoreCase));

        if (!string.IsNullOrWhiteSpace(term))
        {
            query = query.Where(x => Contains(x.Name, term) || Contains(x.FullName, term));
        }

        var items = query
            .OrderBy(x => x.FullName ?? x.Name ?? string.Empty)
            .ThenBy(x => x.Name ?? string.Empty)
            .Take(NormalizeLoginUserTake(take))
            .Select(MappingHelper.ToLoginUserOptionDto)
            .ToArray();

        return Task.FromResult<IReadOnlyCollection<LoginUserOptionDto>>(items);
    }

    public Task<CurrentUserDto?> GetCurrentAsync(CancellationToken cancellationToken)
    {
        var legacyUserId = currentUserAccessor.GetLegacyUserId();
        if (legacyUserId is null)
        {
            return Task.FromResult<CurrentUserDto?>(null);
        }

        var user = legacyUnitOfWork.GetObjectByKey<LegacyUser>(legacyUserId.Value);
        return Task.FromResult(user is null ? null : MappingHelper.ToCurrentUserDto(user));
    }

    private static int NormalizeLoginUserTake(int take) => take <= 0 ? 12 : Math.Min(take, 50);

    private static bool Contains(string? source, string term)
        => !string.IsNullOrWhiteSpace(source) && source.Contains(term, StringComparison.OrdinalIgnoreCase);
}

public interface IEmployeeService
{
    Task<PagedResult<EmployeeListItemDto>> GetAsync(string? search, int skip, int take, bool includeDismissed, CancellationToken cancellationToken);
    Task<EmployeeEditorLookupsDto> GetLookupsAsync(CancellationToken cancellationToken);
    Task<EmployeeDetailsDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<EmployeeDetailsDto> UpsertAsync(int? id, EmployeeUpsertRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int id, CancellationToken cancellationToken);
}

public sealed class EmployeeService(
    LegacyUnitOfWork legacyUnitOfWork,
    ICurrentUserAccessor currentUserAccessor) : IEmployeeService
{
    public Task<PagedResult<EmployeeListItemDto>> GetAsync(string? search, int skip, int take, bool includeDismissed, CancellationToken cancellationToken)
    {
        var term = TextHelper.NullIfWhiteSpace(search);
        var query = new XPQuery<LegacyUser>(legacyUnitOfWork).ToList().AsEnumerable();

        if (!includeDismissed)
        {
            query = query.Where(x => !string.Equals(x.UserGroup?.Name, "Уволенные", StringComparison.OrdinalIgnoreCase));
        }

        if (!string.IsNullOrWhiteSpace(term))
        {
            query = query.Where(x => Contains(x.Name, term)
                || Contains(x.FullName, term)
                || Contains(x.UserInfo?.Email, term)
                || Contains(x.UserInfo?.Phone, term)
                || Contains(x.UserGroup?.Name, term));
        }

        var ordered = query.OrderBy(x => x.FullName ?? x.Name ?? string.Empty).ThenBy(x => x.Name ?? string.Empty).ToList();
        var totalCount = ordered.Count;
        var items = ordered.Skip(Math.Max(0, skip)).Take(NormalizeTake(take)).Select(MappingHelper.ToEmployeeDto).ToArray();

        return Task.FromResult(new PagedResult<EmployeeListItemDto>(items, totalCount));
    }

    public Task<EmployeeEditorLookupsDto> GetLookupsAsync(CancellationToken cancellationToken)
    {
        var groups = new XPQuery<LegacyUserGroup>(legacyUnitOfWork)
            .ToList()
            .Where(x => !string.IsNullOrWhiteSpace(x.Name) || !string.IsNullOrWhiteSpace(x.FullName))
            .Where(x => !IsPseudoUserGroup(x))
            .OrderBy(x => x.FullName ?? x.Name ?? string.Empty)
            .ThenBy(x => x.Name ?? string.Empty)
            .Select(x => new EmployeeLookupItemDto
            {
                Id = x.Oid,
                Name = x.FullName ?? x.Name ?? string.Empty
            })
            .ToArray();

        var rules = new XPQuery<LegacyRule>(legacyUnitOfWork)
            .ToList()
            .Where(x => !string.IsNullOrWhiteSpace(x.Name) || !string.IsNullOrWhiteSpace(x.FullName))
            .OrderBy(x => x.Index)
            .ThenBy(x => x.FullName ?? x.Name ?? string.Empty)
            .Select(x => new EmployeeLookupItemDto
            {
                Id = x.Oid,
                Name = x.FullName ?? x.Name ?? string.Empty
            })
            .ToArray();

        var privacyGroups = new XPQuery<LegacyPrivacyGroup>(legacyUnitOfWork)
            .ToList()
            .Where(x => !string.IsNullOrWhiteSpace(x.Name) || !string.IsNullOrWhiteSpace(x.FullName))
            .OrderByDescending(x => x.FlDefault)
            .ThenBy(x => x.PrivacyVariant)
            .ThenBy(x => x.FullName ?? x.Name ?? string.Empty)
            .Select(x => new EmployeeLookupItemDto
            {
                Id = x.Oid,
                Name = x.FullName ?? x.Name ?? string.Empty
            })
            .ToArray();

        var defaultGroupId = new XPQuery<LegacyUserGroup>(legacyUnitOfWork)
            .ToList()
            .Where(x => !IsPseudoUserGroup(x))
            .OrderByDescending(x => string.Equals(x.Name, "MainGroup", StringComparison.OrdinalIgnoreCase)
                || string.Equals(x.FullName, "Главная группа", StringComparison.OrdinalIgnoreCase))
            .ThenBy(x => x.FullName ?? x.Name ?? string.Empty)
            .Select(x => (int?)x.Oid)
            .FirstOrDefault();

        var defaultRuleId = new XPQuery<LegacyRule>(legacyUnitOfWork)
            .ToList()
            .OrderBy(x => x.Index)
            .ThenBy(x => x.FullName ?? x.Name ?? string.Empty)
            .Select(x => (int?)x.Oid)
            .FirstOrDefault();

        var defaultPrivacyGroupId = new XPQuery<LegacyPrivacyGroup>(legacyUnitOfWork)
            .ToList()
            .OrderByDescending(x => x.FlDefault)
            .ThenBy(x => x.PrivacyVariant)
            .ThenBy(x => x.FullName ?? x.Name ?? string.Empty)
            .Select(x => (int?)x.Oid)
            .FirstOrDefault();

        return Task.FromResult(new EmployeeEditorLookupsDto
        {
            Groups = groups,
            Rules = rules,
            PrivacyGroups = privacyGroups,
            DefaultGroupId = defaultGroupId,
            DefaultRuleId = defaultRuleId,
            DefaultPrivacyGroupId = defaultPrivacyGroupId
        });
    }

    public Task<EmployeeDetailsDto?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var user = legacyUnitOfWork.GetObjectByKey<LegacyUser>(id);
        return Task.FromResult(user is null ? null : MappingHelper.ToEmployeeDetailsDto(user));
    }

    public Task<EmployeeDetailsDto> UpsertAsync(int? id, EmployeeUpsertRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        EnsureCurrentRootAccess();

        var login = TextHelper.NullIfWhiteSpace(request.Login);
        var fullName = TextHelper.NullIfWhiteSpace(request.FullName);
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(fullName), "Введите ФИО.");
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(login), "Введите логин.");
        ValidationHelper.Guard(id is > 0 || !string.IsNullOrWhiteSpace(request.Password), "Для нового сотрудника нужно указать пароль.");
        ValidateOptionalEmail(request.Email);

        var hasDuplicateLogin = new XPQuery<LegacyUser>(legacyUnitOfWork)
            .ToList()
            .Any(x => x.Oid != (id ?? 0) && string.Equals(x.Name, login, StringComparison.OrdinalIgnoreCase));

        ValidationHelper.Guard(!hasDuplicateLogin, "Пользователь с таким логином уже существует.");

        var entity = id is > 0
            ? legacyUnitOfWork.GetObjectByKey<LegacyUser>(id.Value) ?? throw new KeyNotFoundException($"Сотрудник #{id} не найден.")
            : new LegacyUser(legacyUnitOfWork)
            {
                GId = Guid.NewGuid().ToString("N"),
                Index = 0,
                ImageIndex = 3,
                RuleSimple = 0
            };

        var hasDuplicateFullName = !string.Equals(entity.FullName, fullName, StringComparison.OrdinalIgnoreCase)
            && new XPQuery<LegacyUser>(legacyUnitOfWork)
                .ToList()
                .Any(x => x.Oid != entity.Oid && string.Equals(x.FullName, fullName, StringComparison.OrdinalIgnoreCase));

        ValidationHelper.Guard(!hasDuplicateFullName, "Сотрудник с таким ФИО уже существует.");

        entity.Name = login;
        entity.FullName = fullName;
        entity.FlRoot = request.IsRoot;
        entity.MaleFemale = request.IsMale;
        entity.UserGroup = request.UserGroupId is > 0
            ? legacyUnitOfWork.GetObjectByKey<LegacyUserGroup>(request.UserGroupId.Value) ?? throw new KeyNotFoundException($"Группа #{request.UserGroupId} не найдена.")
            : null;

        entity.Rule = request.RuleId is > 0
            ? legacyUnitOfWork.GetObjectByKey<LegacyRule>(request.RuleId.Value) ?? throw new KeyNotFoundException($"Набор правил #{request.RuleId} не найден.")
            : null;
        entity.RuleSimple = entity.Rule?.Index ?? 0;
        entity.PrivacyGroup = request.PrivacyGroupId is > 0
            ? legacyUnitOfWork.GetObjectByKey<LegacyPrivacyGroup>(request.PrivacyGroupId.Value) ?? throw new KeyNotFoundException($"Группа приватности #{request.PrivacyGroupId} не найдена.")
            : null;

        if (entity.UserInfo is null)
        {
            entity.UserInfo = new LegacyUserInfo(legacyUnitOfWork)
            {
                User = entity
            };
        }

        entity.UserInfo.User = entity;
        entity.UserInfo.Email = TextHelper.NullIfWhiteSpace(request.Email);
        entity.UserInfo.Phone = TextHelper.NullIfWhiteSpace(request.Phone);
        entity.UserInfo.PhoneWorkRedirect = TextHelper.NullIfWhiteSpace(request.PhoneWorkRedirect);
        entity.UserInfo.Site = TextHelper.NullIfWhiteSpace(request.Site);
        entity.UserInfo.Address = TextHelper.NullIfWhiteSpace(request.Address);
        entity.UserInfo.Dolgnost = TextHelper.NullIfWhiteSpace(request.Position);
        entity.UserInfo.ICQ = TextHelper.NullIfWhiteSpace(request.Icq);
        entity.UserInfo.Skype = TextHelper.NullIfWhiteSpace(request.Skype);
        entity.UserInfo.Comment = TextHelper.NullIfWhiteSpace(request.Comment);
        entity.UserInfo.S1cCode = TextHelper.NullIfWhiteSpace(request.S1cCode);
        entity.UserInfo.BirthDay = request.BirthDay?.Date ?? DateTime.MinValue;
        entity.UserInfo.Avatar = DecodeOptionalImage(request.AvatarBase64);
        entity.UserInfo.Photo = DecodeOptionalImage(request.PhotoBase64);

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            entity.Password = LegacyPasswordHasher.HashUnicodeMd5(request.Password);
        }

        legacyUnitOfWork.CommitChanges();
        return Task.FromResult(MappingHelper.ToEmployeeDetailsDto(entity));
    }

    public Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        EnsureCurrentRootAccess();

        var entity = legacyUnitOfWork.GetObjectByKey<LegacyUser>(id)
            ?? throw new KeyNotFoundException($"Сотрудник #{id} не найден.");

        var currentUserId = currentUserAccessor.GetLegacyUserId();
        ValidationHelper.Guard(currentUserId != id, "Нельзя удалить текущего пользователя.");
        ValidationHelper.Guard(!entity.FlRoot, "Нельзя удалить root-пользователя.");

        var dismissedGroup = new XPQuery<LegacyUserGroup>(legacyUnitOfWork)
            .ToList()
            .FirstOrDefault(x => string.Equals(x.Name, "Уволенные", StringComparison.OrdinalIgnoreCase));

        if (dismissedGroup is null)
        {
            throw new ValidationException("Не найдена группа 'Уволенные'.");
        }

        entity.UserGroup = dismissedGroup;
        entity.FlRoot = false;
        legacyUnitOfWork.CommitChanges();
        return Task.CompletedTask;
    }

    private static int NormalizeTake(int take) => take <= 0 ? 100 : Math.Min(take, 500);

    private static bool IsPseudoUserGroup(LegacyUserGroup group)
    {
        var name = (group.Name ?? group.FullName ?? string.Empty).Trim().ToLowerInvariant();
        return name is "все" or "итого" or "выбранные";
    }

    private void EnsureCurrentRootAccess()
    {
        var currentUserId = currentUserAccessor.GetLegacyUserId();
        if (currentUserId is null or <= 0)
        {
            throw new UnauthorizedAccessException("Недостаточно прав для изменения сотрудников.");
        }

        var currentUser = legacyUnitOfWork.GetObjectByKey<LegacyUser>(currentUserId.Value);
        if (currentUser is null || !currentUser.FlRoot)
        {
            throw new UnauthorizedAccessException("Недостаточно прав для изменения сотрудников.");
        }
    }

    private void ReplaceRaions(LegacyUser user, IReadOnlyCollection<int> raionIds)
    {
        var normalizedIds = raionIds.Where(x => x > 0).Distinct().ToArray();

        while (user.Raions.Count > 0)
        {
            user.Raions.Remove(user.Raions[0]);
        }

        foreach (var raionId in normalizedIds)
        {
            var raion = legacyUnitOfWork.GetObjectByKey<LegacyRaion>(raionId)
                ?? throw new KeyNotFoundException($"Район #{raionId} не найден.");
            user.Raions.Add(raion);
        }
    }

    private void ReplaceTasks(LegacyUser user, IReadOnlyCollection<int> taskIds)
    {
        var normalizedIds = taskIds.Where(x => x > 0).Distinct().ToArray();

        while (user.Tasks.Count > 0)
        {
            user.Tasks.Remove(user.Tasks[0]);
        }

        foreach (var taskId in normalizedIds)
        {
            var task = legacyUnitOfWork.GetObjectByKey<LegacyTask>(taskId)
                ?? throw new KeyNotFoundException($"Задача #{taskId} не найдена.");
            user.Tasks.Add(task);
        }
    }

    private static byte[]? DecodeOptionalImage(string? base64)
    {
        var normalized = TextHelper.NullIfWhiteSpace(base64);
        if (normalized is null)
        {
            return null;
        }

        try
        {
            return Convert.FromBase64String(normalized);
        }
        catch (FormatException)
        {
            throw new ValidationException("Некорректный формат изображения.");
        }
    }

    private static void ValidateOptionalEmail(string? value)
    {
        ValidationHelper.Guard(string.IsNullOrWhiteSpace(value) || EmailHelper.IsValid(value), "Введите корректный email.");
    }

    private static bool Contains(string? source, string term)
        => !string.IsNullOrWhiteSpace(source) && source.Contains(term, StringComparison.OrdinalIgnoreCase);
}

public interface IOrganizationService
{
    Task<PagedResult<OrganizationListItemDto>> GetAsync(string? search, IReadOnlyCollection<int> raionIds, bool hasEmail, int skip, int take, CancellationToken cancellationToken);
    Task<IReadOnlyCollection<OrganizationRaionDto>> GetRaionsAsync(string? search, bool hasEmail, CancellationToken cancellationToken);
    Task<OrganizationEditorLookupsDto> GetLookupsAsync(CancellationToken cancellationToken);
    Task<OrganizationDetailsDto?> GetByIdAsync(int id, CancellationToken cancellationToken);
    Task<OrganizationDetailsDto> UpsertAsync(int? id, OrganizationUpsertRequest request, CancellationToken cancellationToken);
    Task DeleteAsync(int id, CancellationToken cancellationToken);
}

public sealed class OrganizationService(
    LegacyUnitOfWork legacyUnitOfWork,
    MailingUnitOfWork mailingUnitOfWork,
    ICurrentUserAccessor currentUserAccessor) : IOrganizationService
{
    public Task<PagedResult<OrganizationListItemDto>> GetAsync(string? search, IReadOnlyCollection<int> raionIds, bool hasEmail, int skip, int take, CancellationToken cancellationToken)
    {
        var term = TextHelper.NullIfWhiteSpace(search);
        var query = ApplyOrganizationFilters(new XPQuery<LegacyOrg>(legacyUnitOfWork), term, NormalizeRaionIds(raionIds));

        List<LegacyOrg> itemsPage;
        int totalCount;

        if (hasEmail)
        {
            itemsPage = GetEmailFilteredOrganizationsPage(query, skip, take, out totalCount);
        }
        else
        {
            itemsPage = GetOrganizationsPage(query, skip, take, out totalCount);
        }

        var openWorkCounts = BuildOpenWorkCounts(itemsPage.Select(x => x.Oid).ToArray());
        var items = itemsPage
            .Select(x => MappingHelper.ToOrganizationDto(x, openWorkCounts.GetValueOrDefault(x.Oid)))
            .ToArray();

        return Task.FromResult(new PagedResult<OrganizationListItemDto>(items, totalCount));
    }

    public Task<IReadOnlyCollection<OrganizationRaionDto>> GetRaionsAsync(string? search, bool hasEmail, CancellationToken cancellationToken)
    {
        var term = TextHelper.NullIfWhiteSpace(search);
        var query = ApplyOrganizationFilters(new XPQuery<LegacyOrg>(legacyUnitOfWork), term, []);
        var source = hasEmail ? query.ToList().Where(OrganizationHasEmail) : query.AsEnumerable();
        var items = source
            .GroupBy(x => new
            {
                Id = x.Raion == null ? null : (int?)x.Raion.Oid,
                Name = x.Raion != null && x.Raion.Name != null ? x.Raion.Name : "Без района"
            })
            .Select(g => new OrganizationRaionDto
            {
                Id = g.Key.Id,
                Name = g.Key.Name,
                Count = g.Count()
            })
            .OrderBy(x => x.Name)
            .ToArray();

        return Task.FromResult<IReadOnlyCollection<OrganizationRaionDto>>(items);
    }

    private static List<LegacyOrg> GetOrganizationsPage(IQueryable<LegacyOrg> query, int skip, int take, out int totalCount)
    {
        totalCount = query.Count();
        return query.OrderBy(x => x.Name).ThenBy(x => x.Oid)
            .Skip(Math.Max(0, skip))
            .Take(NormalizeTake(take))
            .ToList();
    }

    private static List<LegacyOrg> GetEmailFilteredOrganizationsPage(IQueryable<LegacyOrg> query, int skip, int take, out int totalCount)
    {
        var filtered = query
            .ToList()
            .Where(OrganizationHasEmail)
            .OrderBy(x => x.Name)
            .ThenBy(x => x.Oid)
            .ToList();

        totalCount = filtered.Count;
        return filtered
            .Skip(Math.Max(0, skip))
            .Take(NormalizeTake(take))
            .ToList();
    }

    private static bool OrganizationHasEmail(LegacyOrg organization)
        => EmailHelper.CollectOrganizationEmails(organization).Count > 0;

    public Task<OrganizationEditorLookupsDto> GetLookupsAsync(CancellationToken cancellationToken)
    {
        var raions = new XPQuery<LegacyRaion>(legacyUnitOfWork)
            .ToList()
            .Where(x => !string.IsNullOrWhiteSpace(x.Name))
            .OrderBy(x => x.Name ?? string.Empty)
            .Select(x => new OrganizationLookupItemDto
            {
                Id = x.Oid,
                Name = x.Name ?? string.Empty
            })
            .ToArray();

        var orgTypes = new XPQuery<LegacyOrgType>(legacyUnitOfWork)
            .ToList()
            .Where(x => !string.IsNullOrWhiteSpace(x.Name) || !string.IsNullOrWhiteSpace(x.FullName))
            .OrderBy(x => x.FullName ?? x.Name ?? string.Empty)
            .ThenBy(x => x.Name ?? string.Empty)
            .Select(x => new OrganizationLookupItemDto
            {
                Id = x.Oid,
                Name = x.FullName ?? x.Name ?? string.Empty
            })
            .ToArray();

        return Task.FromResult(new OrganizationEditorLookupsDto
        {
            Raions = raions,
            OrgTypes = orgTypes
        });
    }

    public Task<OrganizationDetailsDto?> GetByIdAsync(int id, CancellationToken cancellationToken)
    {
        var organization = legacyUnitOfWork.GetObjectByKey<LegacyOrg>(id);
        if (organization is null)
        {
            return Task.FromResult<OrganizationDetailsDto?>(null);
        }

        var openWorkCounts = BuildOpenWorkCounts([organization.Oid]);
        return Task.FromResult<OrganizationDetailsDto?>(MappingHelper.ToOrganizationDetailsDto(organization, openWorkCounts.GetValueOrDefault(organization.Oid)));
    }

    public Task<OrganizationDetailsDto> UpsertAsync(int? id, OrganizationUpsertRequest request, CancellationToken cancellationToken)
    {
        ArgumentNullException.ThrowIfNull(request);
        ValidationHelper.Guard(!string.IsNullOrWhiteSpace(request.Name), "Введите название организации.");
        ValidateOptionalEmail(request.PrimaryEmail, "основной email");
        ValidateOptionalEmail(request.DirectorEmail, "email руководителя");
        ValidateOptionalEmail(request.SalaryEmail, "email зарплаты");
        ValidateOptionalEmail(request.OneCEmail, "email 1C");
        ValidateOptionalEmail(request.SiteEmail, "email сайта");

        var now = DateTime.UtcNow;
        var currentUser = currentUserAccessor.GetLegacyUserId() is int currentUserId && currentUserId > 0
            ? legacyUnitOfWork.GetObjectByKey<LegacyUser>(currentUserId)
            : null;

        var organization = id is > 0
            ? legacyUnitOfWork.GetObjectByKey<LegacyOrg>(id.Value) ?? throw new KeyNotFoundException($"Организация #{id} не найдена.")
            : new LegacyOrg(legacyUnitOfWork)
            {
                Date_create = now,
                User_create = currentUser,
                FlVisible = true
            };

        ApplyOrganizationChanges(organization, request, now, currentUser);

        legacyUnitOfWork.CommitChanges();

        var openWorkCounts = BuildOpenWorkCounts([organization.Oid]);
        return Task.FromResult(MappingHelper.ToOrganizationDetailsDto(organization, openWorkCounts.GetValueOrDefault(organization.Oid)));
    }

    public Task DeleteAsync(int id, CancellationToken cancellationToken)
    {
        var organization = legacyUnitOfWork.GetObjectByKey<LegacyOrg>(id)
            ?? throw new KeyNotFoundException($"Организация #{id} не найдена.");

        var hasContacts = organization.Contacts.Count > 0;
        if (hasContacts)
        {
            throw new ValidationException("Нельзя удалить организацию, у которой есть связанные контакты.");
        }

        var hasJobs = new XPQuery<LegacyJob>(legacyUnitOfWork).ToList().Any(x => x.Org != null && x.Org.Oid == id);
        if (hasJobs)
        {
            throw new ValidationException("Нельзя удалить организацию, у которой есть связанные задачи.");
        }

        var usedByCampaigns = new XPQuery<MailCampaignTargetOrganization>(mailingUnitOfWork).ToList().Any(x => x.LegacyOrgId == id);
        if (usedByCampaigns)
        {
            throw new ValidationException("Нельзя удалить организацию, которая используется в кампаниях.");
        }

        organization.OrgInfo?.Delete();
        organization.OrgInfoOther?.Delete();
        organization.Delete();
        legacyUnitOfWork.CommitChanges();
        return Task.CompletedTask;
    }

    private IQueryable<LegacyOrg> ApplyOrganizationFilters(IQueryable<LegacyOrg> query, string? term, IReadOnlyCollection<int> raionIds)
    {
        if (raionIds.Count > 0)
        {
            var normalizedIds = raionIds.Distinct().ToArray();
            var includeWithoutRaion = normalizedIds.Contains(-1);
            var positiveIds = normalizedIds.Where(x => x > 0).ToArray();

            if (includeWithoutRaion && positiveIds.Length > 0)
            {
                query = query.Where(x => x.Raion == null || positiveIds.Contains(x.Raion.Oid));
            }
            else if (includeWithoutRaion)
            {
                query = query.Where(x => x.Raion == null);
            }
            else
            {
                query = query.Where(x => x.Raion != null && positiveIds.Contains(x.Raion.Oid));
            }
        }

        if (!string.IsNullOrWhiteSpace(term))
        {
            query = query.Where(x =>
                (x.Name != null && x.Name.Contains(term))
                || (x.SmallName != null && x.SmallName.Contains(term))
                || (x.FullName != null && x.FullName.Contains(term))
                || (x.INN != null && x.INN.Contains(term))
                || (x.Raion != null && x.Raion.Name != null && x.Raion.Name.Contains(term))
                || (x.OrgType != null && x.OrgType.Name != null && x.OrgType.Name.Contains(term)));
        }

        return query;
    }

    private void ApplyOrganizationChanges(LegacyOrg organization, OrganizationUpsertRequest request, DateTime now, LegacyUser? currentUser)
    {
        EnsureOrganizationInfoSections(organization);

        organization.Name = request.Name.Trim();
        organization.SmallName = TextHelper.NullIfWhiteSpace(request.SmallName);
        organization.FullName = TextHelper.NullIfWhiteSpace(request.FullName);
        organization.INN = TextHelper.NullIfWhiteSpace(request.Inn);
        organization.Raion = request.RaionId is > 0
            ? legacyUnitOfWork.GetObjectByKey<LegacyRaion>(request.RaionId.Value) ?? throw new KeyNotFoundException($"Район #{request.RaionId} не найден.")
            : null;
        organization.OrgType = request.OrgTypeId is > 0
            ? legacyUnitOfWork.GetObjectByKey<LegacyOrgType>(request.OrgTypeId.Value) ?? throw new KeyNotFoundException($"Тип организации #{request.OrgTypeId} не найден.")
            : null;
        organization.FlVisible = request.Visible;
        organization.FlManager = request.IsManager;
        organization.Date_update = now;
        organization.User_update = currentUser;
        organization.Date_update_admin = now;
        organization.User_update_admin = currentUser;

        organization.OrgInfo!.Comment = TextHelper.NullIfWhiteSpace(request.Comment);
        organization.OrgInfo.OtherInfo = TextHelper.NullIfWhiteSpace(request.OtherInfo);
        organization.OrgInfo.KPP = TextHelper.NullIfWhiteSpace(request.Kpp);
        organization.OrgInfo.AddressU = TextHelper.NullIfWhiteSpace(request.AddressLegal);
        organization.OrgInfo.AddressF = TextHelper.NullIfWhiteSpace(request.AddressActual);
        organization.OrgInfo.Phone = TextHelper.NullIfWhiteSpace(request.Phone);
        organization.OrgInfo.Email = TextHelper.NullIfWhiteSpace(request.PrimaryEmail);
        organization.OrgInfo.Site = TextHelper.NullIfWhiteSpace(request.Site);
        organization.OrgInfo.Org = organization;

        organization.OrgInfoOther!.OGRN = TextHelper.NullIfWhiteSpace(request.Ogrn);
        organization.OrgInfoOther.RukEmail = TextHelper.NullIfWhiteSpace(request.DirectorEmail);
        organization.OrgInfoOther.ZpEmail = TextHelper.NullIfWhiteSpace(request.SalaryEmail);
        organization.OrgInfoOther.F1cEmail = TextHelper.NullIfWhiteSpace(request.OneCEmail);
        organization.OrgInfoOther.SiteEmail = TextHelper.NullIfWhiteSpace(request.SiteEmail);
        organization.OrgInfoOther.ZpWorking = request.SalaryEnabled;
        organization.OrgInfoOther.F1cWorkingB = request.OneCAccountingEnabled;
        organization.OrgInfoOther.F1cWorkingZ = request.OneCSalaryEnabled;
        organization.OrgInfoOther.F1cWorkingJKH = request.OneCHousingEnabled;
        organization.OrgInfoOther.ZpFIO = TextHelper.NullIfWhiteSpace(request.SalaryContactName);
        organization.OrgInfoOther.ZpPhone = TextHelper.NullIfWhiteSpace(request.SalaryContactPhone);
        organization.OrgInfoOther.F1cFIO = TextHelper.NullIfWhiteSpace(request.OneCContactName);
        organization.OrgInfoOther.F1cPhone = TextHelper.NullIfWhiteSpace(request.OneCContactPhone);
        organization.OrgInfoOther.SiteFIO = TextHelper.NullIfWhiteSpace(request.SiteContactName);
        organization.OrgInfoOther.SitePhone = TextHelper.NullIfWhiteSpace(request.SiteContactPhone);
        organization.OrgInfoOther.Org = organization;
    }

    private void EnsureOrganizationInfoSections(LegacyOrg organization)
    {
        if (organization.OrgInfo is null)
        {
            organization.OrgInfo = new LegacyOrgInfo(legacyUnitOfWork)
            {
                Org = organization
            };
        }

        if (organization.OrgInfoOther is null)
        {
            organization.OrgInfoOther = new LegacyOrgInfoOther(legacyUnitOfWork)
            {
                Org = organization
            };
        }
    }

    private Dictionary<int, int> BuildOpenWorkCounts(int[] organizationIds)
    {
        if (organizationIds.Length == 0)
        {
            return [];
        }

        var ids = new HashSet<int>(organizationIds);

        return new XPQuery<LegacyJob>(legacyUnitOfWork)
            .ToList()
            .Where(x => x.Org is not null && ids.Contains(x.Org.Oid) && DateTimeHelper.NullIfMin(x.DateCompleted) is null)
            .GroupBy(x => x.Org!.Oid)
            .ToDictionary(g => g.Key, g => g.Count());
    }

    private static IReadOnlyCollection<int> NormalizeRaionIds(IReadOnlyCollection<int> raionIds)
        => raionIds.Where(x => x != 0).Distinct().ToArray();

    private static int NormalizeTake(int take) => take <= 0 ? 100 : Math.Min(take, 500);

    private static bool Contains(string? source, string term)
        => !string.IsNullOrWhiteSpace(source) && source.Contains(term, StringComparison.OrdinalIgnoreCase);

    private static void ValidateOptionalEmail(string? value, string label)
    {
        ValidationHelper.Guard(string.IsNullOrWhiteSpace(value) || EmailHelper.IsValid(value), $"Введите корректный {label}.");
    }
}

public interface IWorkService
{
    Task<PagedResult<WorkItemDto>> GetAsync(string? search, int? orgId, int? employeeId, bool onlyOpen, int skip, int take, CancellationToken cancellationToken);
}

public sealed class WorkService(LegacyUnitOfWork legacyUnitOfWork) : IWorkService
{
    public Task<PagedResult<WorkItemDto>> GetAsync(string? search, int? orgId, int? employeeId, bool onlyOpen, int skip, int take, CancellationToken cancellationToken)
    {
        var term = TextHelper.NullIfWhiteSpace(search);
        IEnumerable<LegacyJob> query = new XPQuery<LegacyJob>(legacyUnitOfWork).ToList();

        if (orgId is > 0)
        {
            query = query.Where(x => x.Org?.Oid == orgId.Value);
        }

        if (employeeId is > 0)
        {
            query = query.Where(x => x.UserTo?.Oid == employeeId.Value || x.UserFrom?.Oid == employeeId.Value);
        }

        if (onlyOpen)
        {
            query = query.Where(x => DateTimeHelper.NullIfMin(x.DateCompleted) is null);
        }

        if (!string.IsNullOrWhiteSpace(term))
        {
            query = query.Where(x => Contains(x.Org?.Name, term)
                || Contains(x.UserFrom?.FullName, term)
                || Contains(x.UserFrom?.Name, term)
                || Contains(x.UserTo?.FullName, term)
                || Contains(x.UserTo?.Name, term)
                || Contains(x.CategoryJob?.Name, term)
                || Contains(x.Task?.Name, term)
                || Contains(x.Message, term)
                || Contains(x.Comment, term));
        }

        var ordered = query.OrderByDescending(x => DateTimeHelper.NullIfMin(x.Date_create) ?? DateTime.MinValue)
            .ThenByDescending(x => x.Oid)
            .ToList();
        var totalCount = ordered.Count;
        var items = ordered.Skip(Math.Max(0, skip)).Take(NormalizeTake(take)).Select(MappingHelper.ToWorkDto).ToArray();

        return Task.FromResult(new PagedResult<WorkItemDto>(items, totalCount));
    }

    private static int NormalizeTake(int take) => take <= 0 ? 100 : Math.Min(take, 1000);

    private static bool Contains(string? source, string term)
        => !string.IsNullOrWhiteSpace(source) && source.Contains(term, StringComparison.OrdinalIgnoreCase);
}

public interface IOverviewService
{
    Task<DashboardDto> GetAsync(CancellationToken cancellationToken);
}

public sealed class OverviewService(LegacyUnitOfWork legacyUnitOfWork, MailingUnitOfWork mailingUnitOfWork) : IOverviewService
{
    public Task<DashboardDto> GetAsync(CancellationToken cancellationToken)
    {
        var since = DateTime.UtcNow.AddHours(-24);

        var employeeCount = new XPQuery<LegacyUser>(legacyUnitOfWork)
            .ToList()
            .Count(x => !string.Equals(x.UserGroup?.Name, "Уволенные", StringComparison.OrdinalIgnoreCase));
        var organizationCount = new XPQuery<LegacyOrg>(legacyUnitOfWork).ToList().Count;
        var activeCampaignCount = new XPQuery<MailCampaign>(mailingUnitOfWork).ToList().Count(x => x.Status == CampaignStatus.Active);
        var items = new XPQuery<MailDispatchItem>(mailingUnitOfWork).ToList();

        var dto = new DashboardDto
        {
            Employees = employeeCount,
            Organizations = organizationCount,
            ActiveCampaigns = activeCampaignCount,
            QueueDepth = items.Count(x => x.Status is DispatchStatus.Queued or DispatchStatus.Processing or DispatchStatus.Deferred),
            SentLast24Hours = items.Count(x => x.Status == DispatchStatus.Sent && DateTimeHelper.NullIfMin(x.SentAtUtc) is DateTime sentAt && sentAt >= since),
            FailedLast24Hours = items.Count(x => x.Status == DispatchStatus.Failed && DateTimeHelper.NullIfMin(x.FailedAtUtc) is DateTime failedAt && failedAt >= since)
        };

        return Task.FromResult(dto);
    }
}

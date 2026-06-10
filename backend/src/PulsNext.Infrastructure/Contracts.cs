using PulsNext.Domain.Mailing;

namespace PulsNext.Infrastructure;

/// <summary>
/// Универсальная страница результата с элементами выборки и общим количеством записей.
/// </summary>
public sealed record PagedResult<T>(IReadOnlyCollection<T> Items, int TotalCount);

/// <summary>
/// Данные для входа пользователя по логину и паролю.
/// </summary>
public sealed class LoginRequest
{
    /// <summary>
    /// Логин пользователя в системе.
    /// </summary>
    public string Login { get; set; } = string.Empty;

    /// <summary>
    /// Пароль пользователя в открытом виде для проверки при входе.
    /// </summary>
    public string Password { get; set; } = string.Empty;
}

/// <summary>
/// Профиль текущего авторизованного пользователя.
/// </summary>
public sealed class CurrentUserDto
{
    public int Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public bool IsRoot { get; set; }
    public string? UserGroup { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? AvatarBase64 { get; set; }
    public string? AvatarContentType { get; set; }
}

/// <summary>
/// Краткая информация о пользователе, доступная на форме входа.
/// </summary>
public sealed class LoginUserOptionDto
{
    public int Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? UserGroup { get; set; }
}

/// <summary>
/// Результат успешной аутентификации.
/// </summary>
public sealed class AuthResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public DateTime ExpiresAtUtc { get; set; }
    public CurrentUserDto User { get; set; } = new();
}

/// <summary>
/// Краткая строка сотрудника для списков и таблиц.
/// </summary>
public class EmployeeListItemDto
{
    public int Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public string? UserGroup { get; set; }
    public string? RuleName { get; set; }
    public string? PrivacyGroupName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? PhoneWorkRedirect { get; set; }
    public string? Site { get; set; }
    public string? Address { get; set; }
    public string? Position { get; set; }
    public string? Icq { get; set; }
    public string? Skype { get; set; }
    public string? Comment { get; set; }
    public string? S1cCode { get; set; }
    public DateTime? BirthDay { get; set; }
    public bool IsRoot { get; set; }
    public bool IsMale { get; set; }
    public bool IsDismissed { get; set; }
}

/// <summary>
/// Универсальный элемент справочника сотрудников.
/// </summary>
public sealed class EmployeeLookupItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Набор справочников для формы редактирования сотрудника.
/// </summary>
public sealed class EmployeeEditorLookupsDto
{
    public IReadOnlyCollection<EmployeeLookupItemDto> Groups { get; set; } = Array.Empty<EmployeeLookupItemDto>();
    public IReadOnlyCollection<EmployeeLookupItemDto> Rules { get; set; } = Array.Empty<EmployeeLookupItemDto>();
    public IReadOnlyCollection<EmployeeLookupItemDto> PrivacyGroups { get; set; } = Array.Empty<EmployeeLookupItemDto>();
    public int? DefaultGroupId { get; set; }
    public int? DefaultRuleId { get; set; }
    public int? DefaultPrivacyGroupId { get; set; }
}

/// <summary>
/// Данные для создания или обновления карточки сотрудника.
/// </summary>
public sealed class EmployeeUpsertRequest
{
    public string Login { get; set; } = string.Empty;
    public string? FullName { get; set; }
    public int? UserGroupId { get; set; }
    public int? RuleId { get; set; }
    public int? PrivacyGroupId { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? PhoneWorkRedirect { get; set; }
    public string? Site { get; set; }
    public string? Address { get; set; }
    public string? Position { get; set; }
    public string? Icq { get; set; }
    public string? Skype { get; set; }
    public string? Comment { get; set; }
    public string? S1cCode { get; set; }
    public DateTime? BirthDay { get; set; }
    public bool IsMale { get; set; } = true;
    public bool IsRoot { get; set; }
    public string? Password { get; set; }
    public string? AvatarBase64 { get; set; }
    public string? AvatarContentType { get; set; }
    public string? PhotoBase64 { get; set; }
    public string? PhotoContentType { get; set; }
}

/// <summary>
/// Полная карточка сотрудника.
/// </summary>
public sealed class EmployeeDetailsDto : EmployeeListItemDto
{
    public int? UserGroupId { get; set; }
    public int? RuleId { get; set; }
    public int? PrivacyGroupId { get; set; }
    public string? AvatarBase64 { get; set; }
    public string? AvatarContentType { get; set; }
    public string? PhotoBase64 { get; set; }
    public string? PhotoContentType { get; set; }
}

/// <summary>
/// Контакт внутри карточки организации.
/// </summary>
public sealed class OrganizationContactDto
{
    public int Id { get; set; }
    public string? Fio { get; set; }
    public string? Position { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? Group { get; set; }
    public string? Status { get; set; }
    public string? Comment { get; set; }
}

/// <summary>
/// Район организации с количеством найденных карточек.
/// </summary>
public sealed class OrganizationTaskSummaryDto
{
    public int Id { get; set; }
    public string? Name { get; set; }
    public string? FullName { get; set; }
    public int TaskVariant { get; set; }
}

public sealed class OrganizationOneCSnapshotDto
{
    public string Key { get; set; } = string.Empty;
    public string Title { get; set; } = string.Empty;
    public string? Code { get; set; }
    public string? Raion { get; set; }
    public string? Name { get; set; }
    public string? FullName { get; set; }
    public string? Inn { get; set; }
    public string? Phone { get; set; }
    public string? OtherInfo { get; set; }
    public string? Comment { get; set; }
    public string? AddressLegal { get; set; }
    public string? AddressActual { get; set; }
}

public sealed class OrganizationInfoTaskDto
{
    public int Id { get; set; }
    public int Variant { get; set; }
    public string? Name { get; set; }
    public string? FullName { get; set; }
    public int Places { get; set; }
    public string? Comment { get; set; }
    public int? OrganizationCreatorId { get; set; }
    public string? OrganizationCreatorName { get; set; }
    public int? UpdatedById { get; set; }
    public string? UpdatedByName { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
}

public sealed class OrganizationEventDto
{
    public int Id { get; set; }
    public int? CategoryId { get; set; }
    public string? CategoryName { get; set; }
    public string? CategoryFullName { get; set; }
    public int? CategoryVariant { get; set; }
    public string? UserName { get; set; }
    public string? Name { get; set; }
    public string? FullName { get; set; }
    public string? Comment { get; set; }
    public DateTime? EventDateUtc { get; set; }
    public DateTime? CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? DateFromUtc { get; set; }
    public DateTime? DateToUtc { get; set; }
    public bool IsInProcess { get; set; }
    public bool? IsCompleted { get; set; }
    public int? TaskId { get; set; }
    public string? TaskName { get; set; }
    public int? TaskVariant { get; set; }
    public string? LicenseKey { get; set; }
    public double? LicenseAmount { get; set; }
    public string? LicenseAmountComment { get; set; }
}

public sealed class OrganizationParusLicenseDto
{
    public int Id { get; set; }
    public DateTime? CreatedAtUtc { get; set; }
    public string? Payer { get; set; }
    public string? MnemoOrg { get; set; }
    public string? RegNumberClient { get; set; }
    public string? RegNumberAbonement { get; set; }
    public DateTime? DateSinceUtc { get; set; }
    public DateTime? DateToUtc { get; set; }
    public string? Nomenclature { get; set; }
    public string? Modification { get; set; }
    public string? Number { get; set; }
    public string? Inn { get; set; }
}

public sealed class OrganizationParusOrderDto
{
    public int Id { get; set; }
    public DateTime? CreatedAtUtc { get; set; }
    public string? TypeOf { get; set; }
    public string? Number { get; set; }
    public DateTime? DateUtc { get; set; }
    public string? MnemoOrg { get; set; }
    public string? MnemoName { get; set; }
    public string? RegNumberClient { get; set; }
    public string? Payer { get; set; }
    public string? State { get; set; }
    public string? TypeOfShipment { get; set; }
    public decimal Discount { get; set; }
    public decimal Summa { get; set; }
    public DateTime? InvoiceDateUtc { get; set; }
    public string? InvoiceNumber { get; set; }
    public decimal CustomerAmount { get; set; }
}

public sealed class OrganizationContractDto
{
    public int Id { get; set; }
    public string? ExecutorName { get; set; }
    public string? FileTypeName { get; set; }
    public DateTime? DateUtc { get; set; }
    public DateTime? DateFromUtc { get; set; }
    public DateTime? DateToUtc { get; set; }
    public string? Number { get; set; }
    public string? FileName { get; set; }
    public string? Name { get; set; }
    public string? Comment { get; set; }
    public string? DocumentTransport { get; set; }
    public string? DocumentState { get; set; }
    public double? Summa { get; set; }
    public DateTime? CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public string? CreatedByName { get; set; }
    public string? UpdatedByName { get; set; }
    public DateTime? OneCDateUtc { get; set; }
    public int OneCTransferState { get; set; }
    public string? PurchaseNumber { get; set; }
    public bool IsProlongation { get; set; }
    public bool IsParus10Tornado { get; set; }
    public bool IsOneCHourSupport { get; set; }
    public bool HasItsDiscount { get; set; }
    public int LawNumber { get; set; }
}

public sealed class OrganizationAttachmentDto
{
    public int Id { get; set; }
    public string? PrivacyGroupName { get; set; }
    public string? ExecutorName { get; set; }
    public string? FileTypeName { get; set; }
    public string? AttachDocumentTypeName { get; set; }
    public DateTime? DateUtc { get; set; }
    public DateTime? DateFromUtc { get; set; }
    public DateTime? DateToUtc { get; set; }
    public string? Number { get; set; }
    public string? FileName { get; set; }
    public string? Name { get; set; }
    public string? Comment { get; set; }
    public string? DocumentTransport { get; set; }
    public string? DocumentState { get; set; }
    public double? Summa { get; set; }
    public bool IsCompleted { get; set; }
    public DateTime? CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public string? CreatedByName { get; set; }
    public string? UpdatedByName { get; set; }
}

public sealed class OrganizationRealizationDto
{
    public int Id { get; set; }
    public string? Number { get; set; }
    public DateTime? DateUtc { get; set; }
    public double? Summa { get; set; }
    public bool IsDone { get; set; }
    public string? EdoStatus { get; set; }
    public string? StatusName { get; set; }
    public string? ContractCode { get; set; }
    public string? ContractName { get; set; }
}

public sealed class OrganizationRaionDto
{
    public int? Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public int Count { get; set; }
}

/// <summary>
/// Универсальный элемент справочника организаций.
/// </summary>
public sealed class OrganizationLookupItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
}

/// <summary>
/// Набор справочников для формы редактирования организации.
/// </summary>
public sealed class OrganizationEditorLookupsDto
{
    public IReadOnlyCollection<OrganizationLookupItemDto> Raions { get; set; } = Array.Empty<OrganizationLookupItemDto>();
    public IReadOnlyCollection<OrganizationLookupItemDto> OrgTypes { get; set; } = Array.Empty<OrganizationLookupItemDto>();
}

/// <summary>
/// Данные для создания или обновления карточки организации.
/// </summary>
public sealed class OrganizationUpsertRequest
{
    public string Name { get; set; } = string.Empty;
    public string? SmallName { get; set; }
    public string? FullName { get; set; }
    public string? Inn { get; set; }
    public int? RaionId { get; set; }
    public int? OrgTypeId { get; set; }
    public bool Visible { get; set; } = true;
    public bool IsManager { get; set; }
    public string? Ogrn { get; set; }
    public string? Kpp { get; set; }
    public string? AddressLegal { get; set; }
    public string? AddressActual { get; set; }
    public string? Phone { get; set; }
    public string? Site { get; set; }
    public string? PrimaryEmail { get; set; }
    public string? DirectorEmail { get; set; }
    public string? SalaryEmail { get; set; }
    public string? OneCEmail { get; set; }
    public string? SiteEmail { get; set; }
    public string? Comment { get; set; }
    public string? OtherInfo { get; set; }
    public bool SalaryEnabled { get; set; }
    public bool OneCAccountingEnabled { get; set; }
    public bool OneCSalaryEnabled { get; set; }
    public bool OneCHousingEnabled { get; set; }
    public string? SalaryContactName { get; set; }
    public string? SalaryContactPhone { get; set; }
    public string? OneCContactName { get; set; }
    public string? OneCContactPhone { get; set; }
    public string? SiteContactName { get; set; }
    public string? SiteContactPhone { get; set; }
}

/// <summary>
/// Краткая строка организации для списков и выбора получателей.
/// </summary>
public class OrganizationListItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? SmallName { get; set; }
    public string? FullName { get; set; }
    public string? Inn { get; set; }
    public int? RaionId { get; set; }
    public string? Raion { get; set; }
    public int? OrgTypeId { get; set; }
    public string? OrgType { get; set; }
    public bool Visible { get; set; }
    public bool IsManager { get; set; }
    public IReadOnlyCollection<string> Emails { get; set; } = Array.Empty<string>();
    public int EmailCount { get; set; }
    public int ContactCount { get; set; }
    public int OpenWorkItems { get; set; }
}

/// <summary>
/// Полная карточка организации со служебной историей изменений и контактами.
/// </summary>
public sealed class OrganizationDetailsDto : OrganizationListItemDto
{
    public string? Ogrn { get; set; }
    public string? Okpo { get; set; }
    public string? Okved { get; set; }
    public string? Kpp { get; set; }
    public string? PfrNumber { get; set; }
    public string? FssNumber { get; set; }
    public string? BankName { get; set; }
    public string? BankBik { get; set; }
    public string? BankCity { get; set; }
    public string? BankCorrespondentAccount { get; set; }
    public string? BankAccount { get; set; }
    public string? PersonalAccount { get; set; }
    public string? FlagName { get; set; }
    public string? StatusName { get; set; }
    public string? AddressLegal { get; set; }
    public string? AddressActual { get; set; }
    public string? Phone { get; set; }
    public string? Site { get; set; }
    public double DebtAmount { get; set; }
    public double DebtActualAmount { get; set; }
    public double DebtMinus6Amount { get; set; }
    public string? PrimaryEmail { get; set; }
    public string? DirectorEmail { get; set; }
    public string? SalaryEmail { get; set; }
    public string? OneCEmail { get; set; }
    public string? SiteEmail { get; set; }
    public string? DirectorFullName { get; set; }
    public string? DirectorShortName { get; set; }
    public string? DirectorGenitiveName { get; set; }
    public string? DirectorPosition { get; set; }
    public string? DirectorPositionGenitive { get; set; }
    public string? DirectorPhone { get; set; }
    public string? DirectorSnils { get; set; }
    public string? AuthorityDocument { get; set; }
    public string? Comment { get; set; }
    public string? OtherInfo { get; set; }
    public string? AdditionalComment { get; set; }
    public string? TechnicsComment { get; set; }
    public string? ProcurementComment { get; set; }
    public string? EcpComment { get; set; }
    public string? EcpContractComment { get; set; }
    public string? InternetSpeed { get; set; }
    public string? Edo { get; set; }
    public string? PfrAgreementNumber { get; set; }
    public DateTime? PfrAgreementDateUtc { get; set; }
    public bool SalaryEnabled { get; set; }
    public bool OneCAccountingEnabled { get; set; }
    public bool OneCSalaryEnabled { get; set; }
    public bool OneCHousingEnabled { get; set; }
    public string? SalaryContactName { get; set; }
    public string? SalaryContactPhone { get; set; }
    public string? SalaryLabel { get; set; }
    public string? SalaryLicenseNumber { get; set; }
    public string? SalaryManualLicenseNumber { get; set; }
    public string? SalaryLicenseComposition { get; set; }
    public int SalaryDatabaseCount { get; set; }
    public int SalaryOrganizationCount { get; set; }
    public int SalaryExtraWorkplaces { get; set; }
    public string? SalaryComment { get; set; }
    public string? SalaryLeadName { get; set; }
    public DateTime? SalaryWorkBeginUtc { get; set; }
    public DateTime? SalaryWorkEndUtc { get; set; }
    public string? SalaryPlatform { get; set; }
    public string? SalaryConfiguration { get; set; }
    public string? SalaryRating { get; set; }
    public int? SalaryLicenseOrganizationId { get; set; }
    public string? SalaryLicenseOrganizationName { get; set; }
    public string? SalaryLicenseFileName { get; set; }
    public string? OneCContactName { get; set; }
    public string? OneCContactPhone { get; set; }
    public string? OneCComment { get; set; }
    public string? OneCSalaryComment { get; set; }
    public string? OneCAccountingChanges { get; set; }
    public string? OneCSalaryChanges { get; set; }
    public string? OneCLeadAccountingName { get; set; }
    public string? OneCLeadSalaryName { get; set; }
    public bool OneCBaseContract { get; set; }
    public string? OneCRegNumberAccounting { get; set; }
    public string? OneCRegNumberSalary { get; set; }
    public string? OneCPlatformAccounting { get; set; }
    public string? OneCPlatformSalary { get; set; }
    public string? OneCConfigurationAccounting { get; set; }
    public string? OneCConfigurationSalary { get; set; }
    public string? OneCContractVariant { get; set; }
    public string? OneCItsVariant { get; set; }
    public string? OneCItsLicenseNumber { get; set; }
    public string? OneCItsComment { get; set; }
    public string? OneCItsComposition { get; set; }
    public double? OneCItsAmount { get; set; }
    public string? OneCItsAmountComment { get; set; }
    public DateTime? OneCItsDateFromUtc { get; set; }
    public DateTime? OneCItsDateToUtc { get; set; }
    public bool OneCItsCompleted { get; set; }
    public string? SiteContactName { get; set; }
    public string? SiteContactPhone { get; set; }
    public string? SiteAlias { get; set; }
    public DateTime? SiteReadyAtUtc { get; set; }
    public string? SiteState { get; set; }
    public int? SiteBaseId { get; set; }
    public string? SiteComment { get; set; }
    public bool SiteOnSupport { get; set; }
    public string? SiteTemplate { get; set; }
    public DateTime? SiteLicenseDateFromUtc { get; set; }
    public DateTime? SiteLicenseDateToUtc { get; set; }
    public bool SiteLicenseCompleted { get; set; }
    public string? CreatedByName { get; set; }
    public string? UpdatedByName { get; set; }
    public string? UpdatedAdminByName { get; set; }
    public DateTime? CreatedAtUtc { get; set; }
    public DateTime? UpdatedAtUtc { get; set; }
    public DateTime? UpdatedAdminAtUtc { get; set; }
    public IReadOnlyCollection<OrganizationContactDto> Contacts { get; set; } = Array.Empty<OrganizationContactDto>();
    public IReadOnlyCollection<OrganizationTaskSummaryDto> Tasks { get; set; } = Array.Empty<OrganizationTaskSummaryDto>();
    public IReadOnlyCollection<OrganizationOneCSnapshotDto> OneCSnapshots { get; set; } = Array.Empty<OrganizationOneCSnapshotDto>();
    public IReadOnlyCollection<OrganizationInfoTaskDto> ProgramInfos { get; set; } = Array.Empty<OrganizationInfoTaskDto>();
    public IReadOnlyCollection<OrganizationEventDto> Events { get; set; } = Array.Empty<OrganizationEventDto>();
    public IReadOnlyCollection<OrganizationContractDto> Contracts { get; set; } = Array.Empty<OrganizationContractDto>();
    public IReadOnlyCollection<OrganizationAttachmentDto> Attachments { get; set; } = Array.Empty<OrganizationAttachmentDto>();
    public IReadOnlyCollection<OrganizationRealizationDto> Realizations { get; set; } = Array.Empty<OrganizationRealizationDto>();
    public IReadOnlyCollection<OrganizationParusLicenseDto> ParusLicenses { get; set; } = Array.Empty<OrganizationParusLicenseDto>();
    public IReadOnlyCollection<OrganizationParusOrderDto> ParusOrders { get; set; } = Array.Empty<OrganizationParusOrderDto>();
}

/// <summary>
/// Рабочая задача или поручение из legacy-части системы.
/// </summary>
public sealed class WorkItemDto
{
    public int Id { get; set; }
    public int? UserFromId { get; set; }
    public string? UserFromName { get; set; }
    public int? UserToId { get; set; }
    public string? UserToName { get; set; }
    public int? OrgId { get; set; }
    public string? OrgName { get; set; }
    public string? Category { get; set; }
    public string? Task { get; set; }
    public string? Message { get; set; }
    public string? Comment { get; set; }
    public DateTime? CreatedAtUtc { get; set; }
    public DateTime? DateFromUtc { get; set; }
    public DateTime? DateToUtc { get; set; }
    public DateTime? DateCompletedUtc { get; set; }
    public bool IsCompleted { get; set; }
}

/// <summary>
/// Сводные показатели для главной панели.
/// </summary>
public sealed class DashboardDto
{
    public int Employees { get; set; }
    public int Organizations { get; set; }
    public int ActiveCampaigns { get; set; }
    public int QueueDepth { get; set; }
    public int SentLast24Hours { get; set; }
    public int FailedLast24Hours { get; set; }
}

/// <summary>
/// Настройки SMTP-профиля, используемого для отправки писем.
/// </summary>
public sealed class TransportProfileDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; }
    public bool UseSsl { get; set; }
    public string? Username { get; set; }
    public string? SenderEmail { get; set; }
    public string? SenderName { get; set; }
    public string? ReplyToEmail { get; set; }
    public int MaxConnections { get; set; }
    public int MessagesPerMinute { get; set; }
    public bool IsDefault { get; set; }
    public bool IsEnabled { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

/// <summary>
/// Данные для создания или обновления SMTP-профиля.
/// </summary>
public sealed class TransportProfileUpsertRequest
{
    /// <summary>
    /// Название профиля, отображаемое в интерфейсе.
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// SMTP-хост или IP-адрес сервера.
    /// </summary>
    public string Host { get; set; } = string.Empty;

    /// <summary>
    /// SMTP-порт сервера.
    /// </summary>
    public int Port { get; set; } = 587;

    /// <summary>
    /// Нужно ли устанавливать TLS/SSL-соединение.
    /// </summary>
    public bool UseSsl { get; set; } = true;
    public string? Username { get; set; }
    public string? Password { get; set; }
    public string? SenderEmail { get; set; }
    public string? SenderName { get; set; }
    public string? ReplyToEmail { get; set; }
    public int MaxConnections { get; set; } = 2;
    public int MessagesPerMinute { get; set; } = 60;
    public bool IsDefault { get; set; }
    public bool IsEnabled { get; set; } = true;
}

/// <summary>
/// Результат тестового подключения транспортного профиля.
/// </summary>
public sealed class TransportProfileTestResultDto
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
}

/// <summary>
/// Внутренняя команда на сохранение файла в хранилище.
/// </summary>
public sealed class FileUploadCommand
{
    public required Stream Content { get; init; }
    public required string FileName { get; init; }
    public string? ContentType { get; init; }
    public bool IsPublic { get; init; }
}

/// <summary>
/// Метаданные сохраненного файла.
/// </summary>
public sealed class StoredFileDto
{
    public int Id { get; set; }
    public string OriginalFileName { get; set; } = string.Empty;
    public string StoredFileName { get; set; } = string.Empty;
    public string RelativePath { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public long Length { get; set; }
    public string? Sha256 { get; set; }
    public bool IsPublic { get; set; }
    public DateTime UploadedAtUtc { get; set; }
    public int UploadedByLegacyUserId { get; set; }
}

/// <summary>
/// Описание вложения, которое нужно привязать к кампании.
/// </summary>
public sealed class CampaignAttachmentRequest
{
    public int StoredFileId { get; set; }
    public AttachmentKind AttachmentKind { get; set; } = AttachmentKind.File;
    public string? DisplayName { get; set; }
    public string? ContentId { get; set; }
    public int SortOrder { get; set; }
}

/// <summary>
/// Вложение, уже сохраненное в кампании.
/// </summary>
public sealed class CampaignAttachmentDto
{
    public int Id { get; set; }
    public AttachmentKind AttachmentKind { get; set; }
    public string? DisplayName { get; set; }
    public string? ContentId { get; set; }
    public int SortOrder { get; set; }
    public StoredFileDto StoredFile { get; set; } = new();
}

/// <summary>
/// Организация, включенная в целевую аудиторию кампании.
/// </summary>
public sealed class CampaignTargetOrganizationDto
{
    public int Id { get; set; }
    public int LegacyOrgId { get; set; }
    public string? LegacyOrgName { get; set; }
    public string? LegacyRaionName { get; set; }
}

/// <summary>
/// Краткая строка кампании рассылки для списка.
/// </summary>
public sealed class CampaignListItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public CampaignStatus Status { get; set; }
    public ScheduleKind ScheduleKind { get; set; }
    public string? TimeZoneId { get; set; }
    public DateTime? NextRunAtUtc { get; set; }
    public DateTime? LastRunAtUtc { get; set; }
    public int TargetOrganizationsCount { get; set; }
    public int AttachmentsCount { get; set; }
    public string? TransportProfileName { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

/// <summary>
/// Данные для создания или обновления кампании рассылки.
/// </summary>
public sealed class CampaignUpsertRequest
{
    public string Name { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public string? HtmlBody { get; set; }
    public string? PlainTextBody { get; set; }
    public CampaignStatus Status { get; set; } = CampaignStatus.Draft;
    public int? TransportProfileId { get; set; }
    public ScheduleKind ScheduleKind { get; set; } = ScheduleKind.OneTime;
    public string? CronExpression { get; set; }
    public string? TimeZoneId { get; set; } = "Europe/Amsterdam";
    public DateTime? StartAtUtc { get; set; }
    public DateTime? EndAtUtc { get; set; }
    public int IntervalMinutes { get; set; } = 2;
    public int RandomIntervalMinMinutes { get; set; } = 1;
    public int RandomIntervalMaxMinutes { get; set; } = 5;
    public int MaxRecipientsPerRun { get; set; } = 0;
    public int MaxAttempts { get; set; } = 3;
    public bool UseOrgPrimaryEmail { get; set; } = true;
    public bool UseContactEmails { get; set; }
    public bool UseSalaryEmail { get; set; }
    public bool UseOneCEmail { get; set; }
    public bool UseSiteEmail { get; set; }
    public bool UseDirectorEmail { get; set; }
    public string? ManualRecipientsCsv { get; set; }
    public IReadOnlyCollection<int> TargetOrganizationIds { get; set; } = Array.Empty<int>();
    public IReadOnlyCollection<CampaignAttachmentRequest> Attachments { get; set; } = Array.Empty<CampaignAttachmentRequest>();
}

/// <summary>
/// Полная карточка кампании рассылки.
/// </summary>
public sealed class CampaignDetailsDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public string? HtmlBody { get; set; }
    public string? PlainTextBody { get; set; }
    public CampaignStatus Status { get; set; }
    public int? TransportProfileId { get; set; }
    public string? TransportProfileName { get; set; }
    public ScheduleKind ScheduleKind { get; set; }
    public string? CronExpression { get; set; }
    public string? TimeZoneId { get; set; }
    public DateTime? StartAtUtc { get; set; }
    public DateTime? EndAtUtc { get; set; }
    public int IntervalMinutes { get; set; }
    public int RandomIntervalMinMinutes { get; set; }
    public int RandomIntervalMaxMinutes { get; set; }
    public DateTime? NextRunAtUtc { get; set; }
    public DateTime? LastRunAtUtc { get; set; }
    public DateTime? LastRunStartedAtUtc { get; set; }
    public DateTime? LastRunFinishedAtUtc { get; set; }
    public int MaxRecipientsPerRun { get; set; }
    public int MaxAttempts { get; set; }
    public bool UseOrgPrimaryEmail { get; set; }
    public bool UseContactEmails { get; set; }
    public bool UseSalaryEmail { get; set; }
    public bool UseOneCEmail { get; set; }
    public bool UseSiteEmail { get; set; }
    public bool UseDirectorEmail { get; set; }
    public string? ManualRecipientsCsv { get; set; }
    public IReadOnlyCollection<CampaignTargetOrganizationDto> Targets { get; set; } = Array.Empty<CampaignTargetOrganizationDto>();
    public IReadOnlyCollection<CampaignAttachmentDto> Attachments { get; set; } = Array.Empty<CampaignAttachmentDto>();
    public DateTime CreatedAtUtc { get; set; }
    public DateTime UpdatedAtUtc { get; set; }
}

/// <summary>
/// Запрос на смену статуса кампании.
/// </summary>
public sealed class CampaignStatusChangeRequest
{
    /// <summary>
    /// Новый статус кампании.
    /// </summary>
    public CampaignStatus Status { get; set; }
}

/// <summary>
/// Параметры ручного запуска кампании.
/// </summary>
public sealed class CampaignManualRunRequest
{
    /// <summary>
    /// Плановое время запуска в UTC. Если не задано, используется текущее время.
    /// </summary>
    public DateTime? ScheduledAtUtc { get; set; }

    /// <summary>
    /// Комментарий оператора к ручному запуску.
    /// </summary>
    public string? Comment { get; set; }
}

/// <summary>
/// Параметры расчета будущих запусков кампании без фактической отправки.
/// </summary>
public sealed class SchedulePreviewRequest
{
    /// <summary>
    /// Тип расписания, который нужно рассчитать.
    /// </summary>
    public ScheduleKind ScheduleKind { get; set; } = ScheduleKind.OneTime;

    /// <summary>
    /// Cron-выражение для режима <c>Cron</c>.
    /// </summary>
    public string? CronExpression { get; set; }

    /// <summary>
    /// Идентификатор часового пояса, в котором интерпретируется расписание.
    /// </summary>
    public string? TimeZoneId { get; set; } = "Europe/Amsterdam";

    /// <summary>
    /// Начало действия расписания в UTC.
    /// </summary>
    public DateTime? StartAtUtc { get; set; }

    /// <summary>
    /// Конец действия расписания в UTC.
    /// </summary>
    public DateTime? EndAtUtc { get; set; }
    public int IntervalMinutes { get; set; } = 2;
    public int RandomIntervalMinMinutes { get; set; } = 1;
    public int RandomIntervalMaxMinutes { get; set; } = 5;

    /// <summary>
    /// Количество будущих запусков, которое нужно вернуть в ответе.
    /// </summary>
    public int Count { get; set; } = 10;
}

/// <summary>
/// Одна рассчитанная точка запуска кампании.
/// </summary>
public sealed class ScheduleOccurrenceDto
{
    public DateTime Utc { get; set; }
    public DateTime Local { get; set; }
}

/// <summary>
/// Один получатель в предпросмотре аудитории кампании.
/// </summary>
public sealed class CampaignRecipientPreviewItemDto
{
    public int LegacyOrgId { get; set; }
    public string? LegacyOrgName { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public RecipientSourceKind SourceKind { get; set; }
}

/// <summary>
/// Результат предпросмотра получателей кампании.
/// </summary>
public sealed class CampaignRecipientPreviewDto
{
    public int OrganizationCount { get; set; }
    public int RecipientCount { get; set; }
    public IReadOnlyCollection<CampaignRecipientPreviewItemDto> Items { get; set; } = Array.Empty<CampaignRecipientPreviewItemDto>();
}

/// <summary>
/// Результат проверки готовности кампании к запуску.
/// </summary>
public sealed class CampaignReadinessDto
{
    public bool IsReady { get; set; }
    public int OrganizationCount { get; set; }
    public int RecipientCount { get; set; }
    public IReadOnlyCollection<CampaignReadinessItemDto> Items { get; set; } = Array.Empty<CampaignReadinessItemDto>();
}

/// <summary>
/// Один пункт проверки готовности кампании.
/// </summary>
public sealed class CampaignReadinessItemDto
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public bool IsBlocking { get; set; }
}

/// <summary>
/// Партия отправки, созданная при запуске кампании.
/// </summary>
public sealed class DispatchBatchDto
{
    public int Id { get; set; }
    public DispatchTriggerKind TriggerKind { get; set; }
    public string? TriggerComment { get; set; }
    public DateTime? ScheduledAtUtc { get; set; }
    public DateTime CreatedAtUtc { get; set; }
    public DateTime? CompletedAtUtc { get; set; }
    public int TotalRecipients { get; set; }
    public int QueuedCount { get; set; }
    public int ProcessingCount { get; set; }
    public int SentCount { get; set; }
    public int FailedCount { get; set; }
    public int CancelledCount { get; set; }
    public string? CorrelationId { get; set; }
}

/// <summary>
/// Отдельная запись очереди отправки по одному получателю.
/// </summary>
public sealed class DispatchItemDto
{
    public int Id { get; set; }
    public int LegacyOrgId { get; set; }
    public string? LegacyOrgName { get; set; }
    public string? RecipientEmail { get; set; }
    public string? RecipientDisplayName { get; set; }
    public RecipientSourceKind SourceKind { get; set; }
    public DispatchStatus Status { get; set; }
    public int AttemptCount { get; set; }
    public DateTime? QueuedAtUtc { get; set; }
    public DateTime? StartedAtUtc { get; set; }
    public DateTime? SentAtUtc { get; set; }
    public DateTime? FailedAtUtc { get; set; }
    public DateTime? NextAttemptAtUtc { get; set; }
    public string? ErrorMessage { get; set; }
    public string? SmtpResponse { get; set; }
    public string? MessageId { get; set; }
}

/// <summary>
/// Статистика отправки по кампании с последними партиями и элементами очереди.
/// </summary>
public sealed class CampaignStatisticsDto
{
    public int CampaignId { get; set; }
    public int TotalItems { get; set; }
    public int Queued { get; set; }
    public int Processing { get; set; }
    public int Sent { get; set; }
    public int Failed { get; set; }
    public int Deferred { get; set; }
    public int Cancelled { get; set; }
    public DateTime? LastBatchScheduledAtUtc { get; set; }
    public DateTime? LastBatchCompletedAtUtc { get; set; }
    public IReadOnlyCollection<DispatchBatchDto> RecentBatches { get; set; } = Array.Empty<DispatchBatchDto>();
    public IReadOnlyCollection<DispatchItemDto> RecentItems { get; set; } = Array.Empty<DispatchItemDto>();
}

/// <summary>
/// Результат единичной отправки письма через транспорт.
/// </summary>
public sealed class MailSendResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? SmtpResponse { get; set; }
    public string? MessageId { get; set; }
}

/// <summary>
/// Набор правил выбора получателей кампании.
/// </summary>
public sealed class CampaignRecipientSelection
{
    public IReadOnlyCollection<int> TargetOrganizationIds { get; set; } = Array.Empty<int>();
    public bool UseOrgPrimaryEmail { get; set; }
    public bool UseContactEmails { get; set; }
    public bool UseSalaryEmail { get; set; }
    public bool UseOneCEmail { get; set; }
    public bool UseSiteEmail { get; set; }
    public bool UseDirectorEmail { get; set; }
    public string? ManualRecipientsCsv { get; set; }
}

/// <summary>
/// Получатель, вычисленный после применения правил выбора аудитории.
/// </summary>
public sealed class ResolvedRecipient
{
    public int LegacyOrgId { get; set; }
    public string? LegacyOrgName { get; set; }
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public RecipientSourceKind SourceKind { get; set; }
}

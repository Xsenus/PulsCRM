export type CampaignStatus = 'Draft' | 'Active' | 'Paused' | 'Completed' | 'Archived';
export type ScheduleKind = 'OneTime' | 'FixedInterval' | 'RandomInterval' | 'Cron';
export type AttachmentKind = 'File' | 'InlineImage';

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
}

export interface CurrentUserDto {
  id: number;
  login: string;
  fullName: string;
  isRoot: boolean;
  userGroup?: string;
  email?: string;
  phone?: string;
  avatarBase64?: string;
  avatarContentType?: string;
}

export interface DatabaseInfoDto {
  databaseName: string;
  applicationVersion?: string;
}

export interface LoginUserOptionDto {
  id: number;
  login: string;
  fullName?: string;
  userGroup?: string;
}

export interface AuthResponse {
  accessToken: string;
  expiresAtUtc: string;
  user: CurrentUserDto;
}

export interface DashboardDto {
  employees: number;
  organizations: number;
  activeCampaigns: number;
  queueDepth: number;
  sentLast24Hours: number;
  failedLast24Hours: number;
}

export interface ParusLicenseAnalyticsSummaryDto {
  licenseGroups: number;
  licenseRecords: number;
  clients: number;
  activeAtPeriodEnd: number;
  expiredAtPeriodEnd: number;
  renewed: number;
  withoutRenewal: number;
  expiringInPeriod: number;
  newLicenses: number;
  lost: number;
}

export interface ParusLicenseAnalyticsPeriodDto extends ParusLicenseAnalyticsSummaryDto {
  year: number;
  dateFromUtc: string;
  dateToUtc: string;
}

export interface ParusLicenseAnalyticsProductDto {
  name: string;
  licenseGroups: number;
  licenseRecords: number;
  clients: number;
  activeAtPeriodEnd: number;
  expiredAtPeriodEnd: number;
  renewed: number;
  withoutRenewal: number;
  lost: number;
}

export interface ParusLicenseAnalyticsGroupDto {
  key: string;
  number: string;
  nomenclature?: string;
  modification?: string;
  product?: string;
  clientId: number;
  clientName: string;
  inn?: string;
  mnemoOrg?: string;
  payer?: string;
  regNumberClient?: string;
  regNumberAbonement?: string;
  firstDateSinceUtc?: string;
  lastDateToUtc?: string;
  records: number;
  activeAtPeriodEnd: boolean;
  expiredAtPeriodEnd: boolean;
  renewedInPeriod: boolean;
  withoutRenewal: boolean;
}

export interface ParusLicenseAnalyticsComponentDto {
  id: number;
  number?: string;
  quantity?: string;
  regNumberAbonement?: string;
  regNumberClient?: string;
  nomenclature?: string;
  modification?: string;
  product?: string;
}

export interface ParusLicenseAnalyticsLicensePeriodDto {
  key: string;
  licenseNumber: string;
  dateSinceUtc: string;
  dateToUtc: string;
  componentsCount: number;
  activeAtPeriodEnd: boolean;
  expiredAtPeriodEnd: boolean;
  hasLicenseFile: boolean;
  licenseFileName?: string;
  components: ParusLicenseAnalyticsComponentDto[];
}

export interface ParusLicenseAnalyticsOrganizationGroupDto {
  key: string;
  clientId: number;
  clientName: string;
  inn?: string;
  mnemoOrg?: string;
  licenseNumber: string;
  licenseComposition?: string;
  databaseCount: number;
  organizationCount: number;
  extraWorkplaces: number;
  periodsCount: number;
  componentsCount: number;
  activeAtPeriodEnd: boolean;
  expiredAtPeriodEnd: boolean;
  renewedInPeriod: boolean;
  withoutRenewal: boolean;
  expiringInPeriod: boolean;
  newInPeriod: boolean;
  lostInPeriod: boolean;
  periods: ParusLicenseAnalyticsLicensePeriodDto[];
}

export interface ParusLicenseAnalyticsDto {
  dateFromUtc: string;
  dateToUtc: string;
  summary: ParusLicenseAnalyticsSummaryDto;
  periods: ParusLicenseAnalyticsPeriodDto[];
  products: ParusLicenseAnalyticsProductDto[];
  groups: ParusLicenseAnalyticsGroupDto[];
  organizationGroupsTotalCount: number;
  organizationGroups: ParusLicenseAnalyticsOrganizationGroupDto[];
}

export interface ParusLicenseInfoImportResultDto {
  fileName: string;
  dryRun: boolean;
  totalRows: number;
  componentRows: number;
  importedRows: number;
  updatedRows: number;
  duplicateRows: number;
  skippedRows: number;
  missingOrganizationRows: number;
  invalidRows: number;
  updatedOrganizations: number;
  missingOrganizations: string[];
  errors: string[];
}

export interface ParusLicenseFileImportItemDto {
  fileName: string;
  status: string;
  licenseNumber?: string;
  organizationId?: number;
  organizationName?: string;
  message: string;
}

export interface ParusLicenseFileImportResultDto {
  dryRun: boolean;
  totalFiles: number;
  importedFiles: number;
  duplicateFiles: number;
  missingLicenseFiles: number;
  skippedFiles: number;
  totalBytes: number;
  items: ParusLicenseFileImportItemDto[];
}

export interface ParusLicenseCardImportResultDto {
  fileName: string;
  dryRun: boolean;
  totalRows: number;
  matchedRows: number;
  updatedOrganizations: number;
  unchangedOrganizations: number;
  duplicateRows: number;
  missingLicenseRows: number;
  invalidRows: number;
  missingLicenses: string[];
  errors: string[];
}

export interface ParusLicenseImportLogItemDto {
  stage: string;
  status: string;
  fileName?: string;
  licenseNumber?: string;
  organizationId?: number;
  organizationName?: string;
  message: string;
}

export interface ParusLicenseBatchImportResultDto {
  dryRun: boolean;
  totalFiles: number;
  expandedFiles: number;
  licenseInfoFiles: number;
  cardInfoFiles: number;
  licenseFiles: number;
  skippedFiles: number;
  skippedFileNames: string[];
  errors: string[];
  infoResults: ParusLicenseInfoImportResultDto[];
  cardResults: ParusLicenseCardImportResultDto[];
  fileResult?: ParusLicenseFileImportResultDto;
  logItems: ParusLicenseImportLogItemDto[];
}

export interface EmployeeListItemDto {
  id: number;
  login: string;
  fullName?: string;
  userGroup?: string;
  ruleName?: string;
  privacyGroupName?: string;
  email?: string;
  phone?: string;
  phoneWorkRedirect?: string;
  site?: string;
  address?: string;
  position?: string;
  icq?: string;
  skype?: string;
  comment?: string;
  s1cCode?: string;
  birthDay?: string;
  isRoot: boolean;
  isMale: boolean;
  isDismissed: boolean;
}

export interface EmployeeLookupItemDto {
  id: number;
  name: string;
}

export interface EmployeeEditorLookupsDto {
  groups: EmployeeLookupItemDto[];
  rules: EmployeeLookupItemDto[];
  privacyGroups: EmployeeLookupItemDto[];
  defaultGroupId?: number;
  defaultRuleId?: number;
  defaultPrivacyGroupId?: number;
}

export interface EmployeeUpsertRequest {
  login: string;
  fullName?: string;
  userGroupId?: number;
  ruleId?: number;
  privacyGroupId?: number;
  email?: string;
  phone?: string;
  phoneWorkRedirect?: string;
  site?: string;
  address?: string;
  position?: string;
  icq?: string;
  skype?: string;
  comment?: string;
  s1cCode?: string;
  birthDay?: string;
  isMale: boolean;
  isRoot: boolean;
  password?: string;
  avatarBase64?: string;
  avatarContentType?: string;
  photoBase64?: string;
  photoContentType?: string;
}

export interface EmployeeDetailsDto extends EmployeeListItemDto {
  userGroupId?: number;
  ruleId?: number;
  privacyGroupId?: number;
  avatarBase64?: string;
  avatarContentType?: string;
  photoBase64?: string;
  photoContentType?: string;
}

export interface OrganizationContactDto {
  id: number;
  fio?: string;
  position?: string;
  phone?: string;
  email?: string;
  group?: string;
  status?: string;
  comment?: string;
}

export interface OrganizationTaskSummaryDto {
  id: number;
  name?: string;
  fullName?: string;
  taskVariant: number;
}

export interface OrganizationOneCSnapshotDto {
  key: string;
  title: string;
  code?: string;
  raion?: string;
  name?: string;
  fullName?: string;
  inn?: string;
  phone?: string;
  otherInfo?: string;
  comment?: string;
  addressLegal?: string;
  addressActual?: string;
}

export interface OrganizationInfoTaskDto {
  id: number;
  variant: number;
  name?: string;
  fullName?: string;
  places: number;
  comment?: string;
  organizationCreatorId?: number;
  organizationCreatorName?: string;
  updatedById?: number;
  updatedByName?: string;
  updatedAtUtc?: string;
}

export interface OrganizationEventDto {
  id: number;
  categoryId?: number;
  categoryName?: string;
  categoryFullName?: string;
  categoryVariant?: number;
  userName?: string;
  name?: string;
  fullName?: string;
  comment?: string;
  eventDateUtc?: string;
  createdAtUtc?: string;
  updatedAtUtc?: string;
  dateFromUtc?: string;
  dateToUtc?: string;
  isInProcess: boolean;
  isCompleted?: boolean;
  taskId?: number;
  taskName?: string;
  taskVariant?: number;
  licenseKey?: string;
  licenseAmount?: number;
  licenseAmountComment?: string;
}

export interface OrganizationParusLicenseDto {
  id: number;
  createdAtUtc?: string;
  payer?: string;
  mnemoOrg?: string;
  regNumberClient?: string;
  regNumberAbonement?: string;
  dateSinceUtc?: string;
  dateToUtc?: string;
  nomenclature?: string;
  modification?: string;
  number?: string;
  inn?: string;
}

export interface OrganizationParusOrderDto {
  id: number;
  createdAtUtc?: string;
  typeOf?: string;
  number?: string;
  dateUtc?: string;
  mnemoOrg?: string;
  mnemoName?: string;
  regNumberClient?: string;
  payer?: string;
  state?: string;
  typeOfShipment?: string;
  discount: number;
  summa: number;
  invoiceDateUtc?: string;
  invoiceNumber?: string;
  customerAmount: number;
}

export interface OrganizationContractDto {
  id: number;
  executorName?: string;
  fileTypeName?: string;
  dateUtc?: string;
  dateFromUtc?: string;
  dateToUtc?: string;
  number?: string;
  fileName?: string;
  name?: string;
  comment?: string;
  documentTransport?: string;
  documentState?: string;
  summa?: number;
  createdAtUtc?: string;
  updatedAtUtc?: string;
  createdByName?: string;
  updatedByName?: string;
  oneCDateUtc?: string;
  oneCTransferState: number;
  purchaseNumber?: string;
  isProlongation: boolean;
  isParus10Tornado: boolean;
  isOneCHourSupport: boolean;
  hasItsDiscount: boolean;
  lawNumber: number;
}

export interface OrganizationAttachmentDto {
  id: number;
  privacyGroupName?: string;
  executorName?: string;
  fileTypeName?: string;
  attachDocumentTypeName?: string;
  dateUtc?: string;
  dateFromUtc?: string;
  dateToUtc?: string;
  number?: string;
  fileName?: string;
  name?: string;
  comment?: string;
  documentTransport?: string;
  documentState?: string;
  summa?: number;
  isCompleted: boolean;
  createdAtUtc?: string;
  updatedAtUtc?: string;
  createdByName?: string;
  updatedByName?: string;
}

export interface OrganizationRealizationDto {
  id: number;
  number?: string;
  dateUtc?: string;
  summa?: number;
  isDone: boolean;
  edoStatus?: string;
  statusName?: string;
  contractCode?: string;
  contractName?: string;
}

export interface OrganizationRaionDto {
  id?: number;
  name: string;
  count: number;
}

export interface OrganizationLookupItemDto {
  id: number;
  name: string;
}

export interface OrganizationEditorLookupsDto {
  raions: OrganizationLookupItemDto[];
  orgTypes: OrganizationLookupItemDto[];
}

export interface OrganizationUpsertRequest {
  name: string;
  smallName?: string;
  fullName?: string;
  inn?: string;
  raionId?: number;
  orgTypeId?: number;
  visible: boolean;
  isManager: boolean;
  ogrn?: string;
  kpp?: string;
  addressLegal?: string;
  addressActual?: string;
  phone?: string;
  site?: string;
  primaryEmail?: string;
  directorEmail?: string;
  salaryEmail?: string;
  oneCEmail?: string;
  siteEmail?: string;
  comment?: string;
  otherInfo?: string;
  salaryEnabled: boolean;
  oneCAccountingEnabled: boolean;
  oneCSalaryEnabled: boolean;
  oneCHousingEnabled: boolean;
  salaryContactName?: string;
  salaryContactPhone?: string;
  oneCContactName?: string;
  oneCContactPhone?: string;
  siteContactName?: string;
  siteContactPhone?: string;
}

export interface OrganizationListItemDto {
  id: number;
  name: string;
  smallName?: string;
  fullName?: string;
  inn?: string;
  raionId?: number;
  raion?: string;
  orgTypeId?: number;
  orgType?: string;
  visible: boolean;
  isManager: boolean;
  emails: string[];
  emailCount: number;
  contactCount: number;
  openWorkItems: number;
}

export interface OrganizationDetailsDto extends OrganizationListItemDto {
  ogrn?: string;
  okpo?: string;
  okved?: string;
  kpp?: string;
  pfrNumber?: string;
  fssNumber?: string;
  bankName?: string;
  bankBik?: string;
  bankCity?: string;
  bankCorrespondentAccount?: string;
  bankAccount?: string;
  personalAccount?: string;
  flagName?: string;
  statusName?: string;
  addressLegal?: string;
  addressActual?: string;
  phone?: string;
  site?: string;
  debtAmount: number;
  debtActualAmount: number;
  debtMinus6Amount: number;
  primaryEmail?: string;
  directorEmail?: string;
  salaryEmail?: string;
  oneCEmail?: string;
  siteEmail?: string;
  directorFullName?: string;
  directorShortName?: string;
  directorGenitiveName?: string;
  directorPosition?: string;
  directorPositionGenitive?: string;
  directorPhone?: string;
  directorSnils?: string;
  authorityDocument?: string;
  comment?: string;
  otherInfo?: string;
  additionalComment?: string;
  technicsComment?: string;
  procurementComment?: string;
  ecpComment?: string;
  ecpContractComment?: string;
  internetSpeed?: string;
  edo?: string;
  pfrAgreementNumber?: string;
  pfrAgreementDateUtc?: string;
  salaryEnabled: boolean;
  oneCAccountingEnabled: boolean;
  oneCSalaryEnabled: boolean;
  oneCHousingEnabled: boolean;
  salaryContactName?: string;
  salaryContactPhone?: string;
  salaryLabel?: string;
  salaryLicenseNumber?: string;
  salaryManualLicenseNumber?: string;
  salaryLicenseComposition?: string;
  salaryDatabaseCount: number;
  salaryOrganizationCount: number;
  salaryExtraWorkplaces: number;
  salaryComment?: string;
  salaryLeadName?: string;
  salaryWorkBeginUtc?: string;
  salaryWorkEndUtc?: string;
  salaryPlatform?: string;
  salaryConfiguration?: string;
  salaryRating?: string;
  salaryLicenseOrganizationId?: number;
  salaryLicenseOrganizationName?: string;
  salaryLicenseFileName?: string;
  oneCContactName?: string;
  oneCContactPhone?: string;
  oneCComment?: string;
  oneCSalaryComment?: string;
  oneCAccountingChanges?: string;
  oneCSalaryChanges?: string;
  oneCLeadAccountingName?: string;
  oneCLeadSalaryName?: string;
  oneCBaseContract: boolean;
  oneCRegNumberAccounting?: string;
  oneCRegNumberSalary?: string;
  oneCPlatformAccounting?: string;
  oneCPlatformSalary?: string;
  oneCConfigurationAccounting?: string;
  oneCConfigurationSalary?: string;
  oneCContractVariant?: string;
  oneCItsVariant?: string;
  oneCItsLicenseNumber?: string;
  oneCItsComment?: string;
  oneCItsComposition?: string;
  oneCItsAmount?: number;
  oneCItsAmountComment?: string;
  oneCItsDateFromUtc?: string;
  oneCItsDateToUtc?: string;
  oneCItsCompleted: boolean;
  siteContactName?: string;
  siteContactPhone?: string;
  siteAlias?: string;
  siteReadyAtUtc?: string;
  siteState?: string;
  siteBaseId?: number;
  siteComment?: string;
  siteOnSupport: boolean;
  siteTemplate?: string;
  siteLicenseDateFromUtc?: string;
  siteLicenseDateToUtc?: string;
  siteLicenseCompleted: boolean;
  createdByName?: string;
  updatedByName?: string;
  updatedAdminByName?: string;
  createdAtUtc?: string;
  updatedAtUtc?: string;
  updatedAdminAtUtc?: string;
  contacts: OrganizationContactDto[];
  tasks: OrganizationTaskSummaryDto[];
  oneCSnapshots: OrganizationOneCSnapshotDto[];
  programInfos: OrganizationInfoTaskDto[];
  events: OrganizationEventDto[];
  contracts: OrganizationContractDto[];
  attachments: OrganizationAttachmentDto[];
  realizations: OrganizationRealizationDto[];
  parusLicenses: OrganizationParusLicenseDto[];
  parusOrders: OrganizationParusOrderDto[];
}

export interface WorkItemDto {
  id: number;
  userFromId?: number;
  userFromName?: string;
  userToId?: number;
  userToName?: string;
  orgId?: number;
  orgName?: string;
  category?: string;
  task?: string;
  message?: string;
  comment?: string;
  createdAtUtc?: string;
  dateFromUtc?: string;
  dateToUtc?: string;
  dateCompletedUtc?: string;
  isCompleted: boolean;
}

export interface TransportProfileDto {
  id: number;
  name: string;
  host: string;
  port: number;
  useSsl: boolean;
  username?: string;
  senderEmail?: string;
  senderName?: string;
  replyToEmail?: string;
  maxConnections: number;
  messagesPerMinute: number;
  isDefault: boolean;
  isEnabled: boolean;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface TransportProfileUpsertRequest {
  name: string;
  host: string;
  port: number;
  useSsl: boolean;
  username?: string;
  password?: string;
  senderEmail?: string;
  senderName?: string;
  replyToEmail?: string;
  maxConnections: number;
  messagesPerMinute: number;
  isDefault: boolean;
  isEnabled: boolean;
}

export interface StoredFileDto {
  id: number;
  originalFileName: string;
  storedFileName: string;
  relativePath: string;
  contentType?: string;
  length: number;
  sha256?: string;
  isPublic: boolean;
  uploadedAtUtc: string;
  uploadedByLegacyUserId: number;
}

export interface CampaignAttachmentRequest {
  storedFileId: number;
  attachmentKind: number;
  displayName?: string;
  contentId?: string;
  sortOrder: number;
}

export interface CampaignAttachmentDto {
  id: number;
  attachmentKind: number;
  displayName?: string;
  contentId?: string;
  sortOrder: number;
  storedFile: StoredFileDto;
}

export interface CampaignTargetOrganizationDto {
  id: number;
  legacyOrgId: number;
  legacyOrgName?: string;
  legacyRaionName?: string;
}

export interface CampaignListItemDto {
  id: number;
  name: string;
  subject?: string;
  status: number;
  scheduleKind: number;
  timeZoneId?: string;
  nextRunAtUtc?: string;
  lastRunAtUtc?: string;
  targetOrganizationsCount: number;
  attachmentsCount: number;
  transportProfileName?: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CampaignDetailsDto {
  id: number;
  name: string;
  subject?: string;
  htmlBody?: string;
  plainTextBody?: string;
  status: number;
  transportProfileId?: number;
  transportProfileName?: string;
  scheduleKind: number;
  cronExpression?: string;
  timeZoneId?: string;
  startAtUtc?: string;
  endAtUtc?: string;
  intervalMinutes: number;
  randomIntervalMinMinutes: number;
  randomIntervalMaxMinutes: number;
  nextRunAtUtc?: string;
  lastRunAtUtc?: string;
  lastRunStartedAtUtc?: string;
  lastRunFinishedAtUtc?: string;
  maxRecipientsPerRun: number;
  maxAttempts: number;
  useOrgPrimaryEmail: boolean;
  useContactEmails: boolean;
  useSalaryEmail: boolean;
  useOneCEmail: boolean;
  useSiteEmail: boolean;
  useDirectorEmail: boolean;
  manualRecipientsCsv?: string;
  targets: CampaignTargetOrganizationDto[];
  attachments: CampaignAttachmentDto[];
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CampaignUpsertRequest {
  name: string;
  subject?: string;
  htmlBody?: string;
  plainTextBody?: string;
  status: number;
  transportProfileId?: number;
  scheduleKind: number;
  cronExpression?: string;
  timeZoneId?: string;
  startAtUtc?: string;
  endAtUtc?: string;
  intervalMinutes: number;
  randomIntervalMinMinutes: number;
  randomIntervalMaxMinutes: number;
  maxRecipientsPerRun: number;
  maxAttempts: number;
  useOrgPrimaryEmail: boolean;
  useContactEmails: boolean;
  useSalaryEmail: boolean;
  useOneCEmail: boolean;
  useSiteEmail: boolean;
  useDirectorEmail: boolean;
  manualRecipientsCsv?: string;
  targetOrganizationIds: number[];
  attachments: CampaignAttachmentRequest[];
}

export interface SchedulePreviewRequest {
  scheduleKind: number;
  cronExpression?: string;
  timeZoneId?: string;
  startAtUtc?: string;
  endAtUtc?: string;
  intervalMinutes: number;
  randomIntervalMinMinutes: number;
  randomIntervalMaxMinutes: number;
  count: number;
}

export interface ScheduleOccurrenceDto {
  utc: string;
  local: string;
}

export interface CampaignRecipientPreviewItemDto {
  legacyOrgId: number;
  legacyOrgName?: string;
  email: string;
  displayName?: string;
  sourceKind: number;
}

export interface CampaignRecipientPreviewDto {
  organizationCount: number;
  recipientCount: number;
  items: CampaignRecipientPreviewItemDto[];
}

export interface CampaignReadinessItemDto {
  key: string;
  label: string;
  status: 'ok' | 'warning' | 'error' | string;
  message: string;
  isBlocking: boolean;
}

export interface CampaignReadinessDto {
  isReady: boolean;
  organizationCount: number;
  recipientCount: number;
  items: CampaignReadinessItemDto[];
}

export interface DispatchBatchDto {
  id: number;
  triggerKind: number;
  triggerComment?: string;
  scheduledAtUtc?: string;
  createdAtUtc: string;
  completedAtUtc?: string;
  totalRecipients: number;
  queuedCount: number;
  processingCount: number;
  sentCount: number;
  failedCount: number;
  cancelledCount: number;
  correlationId?: string;
}

export interface DispatchItemDto {
  id: number;
  legacyOrgId: number;
  legacyOrgName?: string;
  recipientEmail?: string;
  recipientDisplayName?: string;
  sourceKind: number;
  status: number;
  attemptCount: number;
  queuedAtUtc?: string;
  startedAtUtc?: string;
  sentAtUtc?: string;
  failedAtUtc?: string;
  nextAttemptAtUtc?: string;
  errorMessage?: string;
  smtpResponse?: string;
  messageId?: string;
}

export interface DispatchItemListQuery {
  status?: number;
  campaignId?: number;
  batchId?: number;
  search?: string;
  skip?: number;
  take?: number;
}

export interface DispatchBatchListQuery {
  campaignId?: number;
  skip?: number;
  take?: number;
}

export interface CampaignStatisticsDto {
  campaignId: number;
  totalItems: number;
  queued: number;
  processing: number;
  sent: number;
  failed: number;
  deferred: number;
  cancelled: number;
  lastBatchScheduledAtUtc?: string;
  lastBatchCompletedAtUtc?: string;
  recentBatches: DispatchBatchDto[];
  recentItems: DispatchItemDto[];
  failedItems: DispatchItemDto[];
  deferredItems: DispatchItemDto[];
}

export interface CampaignStatusChangeRequest {
  status: number;
}

export interface CampaignManualRunRequest {
  scheduledAtUtc?: string;
  comment?: string;
}

export interface TransportProfileTestResultDto {
  success: boolean;
  message: string;
}

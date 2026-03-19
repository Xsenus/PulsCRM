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

export interface EmployeeListItemDto {
  id: number;
  login: string;
  fullName?: string;
  userGroup?: string;
  email?: string;
  phone?: string;
  isDismissed: boolean;
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
  createdByName?: string;
  updatedByName?: string;
  updatedAdminByName?: string;
  createdAtUtc?: string;
  updatedAtUtc?: string;
  updatedAdminAtUtc?: string;
  contacts: OrganizationContactDto[];
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

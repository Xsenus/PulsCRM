import React, { useEffect, useMemo, useState } from 'react';
import type {
  OrganizationAttachmentDto,
  OrganizationContactDto,
  OrganizationContractDto,
  OrganizationDetailsDto,
  OrganizationEditorLookupsDto,
  OrganizationLookupItemDto,
  OrganizationParusLicenseDto,
  OrganizationParusOrderDto,
  OrganizationRealizationDto,
  OrganizationUpsertRequest
} from '../app/types';
import { OrganizationEditorForm } from './OrganizationEditorForm';
import { OrganizationBankDetails } from './organization/OrganizationBankDetails';
import { OrganizationDirectorDetails } from './organization/OrganizationDirectorDetails';
import { OrganizationHistoryWorkspace } from './organization/OrganizationHistoryWorkspace';
import { OrganizationHistoryTabs, type OrganizationHistoryTab } from './organization/OrganizationHistoryTabs';
import { OrganizationLegacyNotes } from './organization/OrganizationLegacyNotes';
import { OrganizationOneCDetails } from './organization/OrganizationOneCDetails';
import { OrganizationProgramBlocks } from './organization/OrganizationProgramBlocks';
import {
  OrganizationRelationsOverview,
  type OrganizationRelationTab,
  type OrganizationRelationsOverviewItem
} from './organization/OrganizationRelationsOverview';
import { OrganizationRelationsWorkspace, type OrganizationRelationsTableSettings } from './organization/OrganizationRelationsWorkspace';
import { OrganizationSalaryDetails } from './organization/OrganizationSalaryDetails';
import { OrganizationSiteDetails } from './organization/OrganizationSiteDetails';
import { OrganizationSidebar } from './organization/OrganizationSidebar';
import { OrganizationStatusBar } from './organization/OrganizationStatusBar';
import { OrganizationSupportSummary, type OrganizationSupportSummaryItem } from './organization/OrganizationSupportSummary';
import { OrganizationViewTabs, type OrganizationViewTab } from './organization/OrganizationViewTabs';
import type { PreviewCardItem } from './organization/RelationPreviewCard';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

type LicenseStatusTone = 'ok' | 'warn' | 'danger' | 'muted';

interface OrganizationRecordWorkspaceProps {
  details: OrganizationDetailsDto | null;
  draft: OrganizationUpsertRequest;
  lookups: OrganizationEditorLookupsDto | null;
  disabled: boolean;
  isDirty: boolean;
  raionName?: string;
  orgTypeName?: string;
  onDraftChange: (next: OrganizationUpsertRequest) => void;
  tableSettings: {
    events: string;
  } & OrganizationRelationsTableSettings;
}

function getLookupName(items: OrganizationLookupItemDto[] | undefined, id?: number) {
  return id ? items?.find((item) => item.id === id)?.name : undefined;
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

function uniqueDefined(values: Array<string | undefined>) {
  return Array.from(new Set(values
    .map((value) => value?.trim())
    .filter((value): value is string => !!value)));
}

function formatDateOnly(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function getDaysUntil(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const targetDate = new Date(value);
  if (Number.isNaN(targetDate.getTime())) {
    return undefined;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  targetDate.setHours(0, 0, 0, 0);
  return Math.round((targetDate.getTime() - today.getTime()) / DAY_IN_MS);
}

function getLicenseStatus(
  dateFrom: string | undefined,
  dateTo: string | undefined,
  labels: {
    active: string;
    warning: string;
    expired: string;
  }
): { tone: LicenseStatusTone; label: string; hint: string } {
  const fromLabel = formatDateOnly(dateFrom);
  const toLabel = formatDateOnly(dateTo);
  if (!fromLabel || !toLabel) {
    return {
      tone: 'muted',
      label: 'Данные не заполнены',
      hint: 'В legacy не найден актуальный период лицензии.'
    };
  }

  const daysLeft = getDaysUntil(dateTo);
  const periodLabel = `с ${fromLabel} по ${toLabel}`;
  if (daysLeft === undefined) {
    return {
      tone: 'muted',
      label: 'Данные не заполнены',
      hint: periodLabel
    };
  }

  if (daysLeft < 0) {
    return {
      tone: 'danger',
      label: labels.expired,
      hint: `${periodLabel}, истекла ${Math.abs(daysLeft)} дн. назад.`
    };
  }

  if (daysLeft <= 30) {
    return {
      tone: 'warn',
      label: labels.warning,
      hint: `${periodLabel}, осталось ${daysLeft} дн.`
    };
  }

  return {
    tone: 'ok',
    label: labels.active,
    hint: `${periodLabel}, запас ${daysLeft} дн.`
  };
}

function shortText(value?: string | null, maxLength = 92) {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function buildContactPreviewItems(items: OrganizationContactDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.fio || `Контакт #${item.id}`,
    caption: [item.position, item.phone || item.email].filter(Boolean).join(' • ') || undefined
  }));
}

function buildAttachmentPreviewItems(items: OrganizationAttachmentDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.name || item.fileName || item.number || `Документ #${item.id}`,
    caption: [item.attachDocumentTypeName, formatDateOnly(item.dateUtc)].filter(Boolean).join(' • ') || undefined
  }));
}

function buildContractPreviewItems(items: OrganizationContractDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.name || item.fileName || item.number || `Договор #${item.id}`,
    caption: [formatDateOnly(item.dateUtc), item.summa === undefined || item.summa === null ? undefined : formatMoney(item.summa)].filter(Boolean).join(' • ') || undefined
  }));
}

function buildRealizationPreviewItems(items: OrganizationRealizationDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.contractName || item.number || `Реализация #${item.id}`,
    caption: [formatDateOnly(item.dateUtc), item.summa === undefined || item.summa === null ? undefined : formatMoney(item.summa)].filter(Boolean).join(' • ') || undefined
  }));
}

function buildLicensePreviewItems(items: OrganizationParusLicenseDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.modification || item.nomenclature || `Лицензия #${item.id}`,
    caption: [item.regNumberClient, formatDateOnly(item.dateToUtc)].filter(Boolean).join(' • ') || undefined
  }));
}

function buildOrderPreviewItems(items: OrganizationParusOrderDto[]): PreviewCardItem[] {
  return items.slice(0, 3).map((item) => ({
    key: String(item.id),
    title: item.payer || item.mnemoOrg || `Заказ #${item.id}`,
    caption: [formatDateOnly(item.dateUtc), formatMoney(item.summa)].filter(Boolean).join(' • ') || undefined
  }));
}

export function OrganizationRecordWorkspace({
  details,
  draft,
  lookups,
  disabled,
  isDirty,
  raionName,
  orgTypeName,
  onDraftChange,
  tableSettings
}: OrganizationRecordWorkspaceProps) {
  const [viewTab, setViewTab] = useState<OrganizationViewTab>('profile');
  const [relationTab, setRelationTab] = useState<OrganizationRelationTab>('contacts');
  const [historyTab, setHistoryTab] = useState<OrganizationHistoryTab>('events');

  useEffect(() => {
    setViewTab('profile');
    setRelationTab('contacts');
    setHistoryTab('events');
  }, [details?.id]);

  const resolvedRaionName = details?.raion ?? raionName ?? getLookupName(lookups?.raions, draft.raionId);
  const resolvedOrgTypeName = details?.orgType ?? orgTypeName ?? getLookupName(lookups?.orgTypes, draft.orgTypeId);
  const emailChips = useMemo(
    () => uniqueDefined([
      ...(details?.emails ?? []),
      draft.primaryEmail,
      draft.directorEmail,
      draft.salaryEmail,
      draft.oneCEmail,
      draft.siteEmail
    ]),
    [details?.emails, draft.directorEmail, draft.oneCEmail, draft.primaryEmail, draft.salaryEmail, draft.siteEmail]
  );
  const oneCLicenseStatus = useMemo(
    () => getLicenseStatus(details?.oneCItsDateFromUtc, details?.oneCItsDateToUtc, {
      active: 'Лицензия актуальна',
      warning: 'Срок скоро закончится',
      expired: 'Срок лицензионного сопровождения истек'
    }),
    [details?.oneCItsDateFromUtc, details?.oneCItsDateToUtc]
  );
  const siteLicenseStatus = useMemo(
    () => getLicenseStatus(details?.siteLicenseDateFromUtc, details?.siteLicenseDateToUtc, {
      active: 'Домен делегирован',
      warning: 'Делегирование скоро закончится',
      expired: 'Срок делегирования домена истек'
    }),
    [details?.siteLicenseDateFromUtc, details?.siteLicenseDateToUtc]
  );
  const supportCards = useMemo<OrganizationSupportSummaryItem[]>(() => ([
    {
      key: 'ecp',
      title: 'ЭЦП',
      tone: details?.bankName ? 'ok' : 'muted',
      value: details?.bankName || 'Реквизиты не заполнены',
      hint: details?.pfrAgreementNumber ? `Соглашение ПФР №${details.pfrAgreementNumber}` : 'Банк и соглашение ПФР'
    },
    {
      key: 'salary',
      title: 'Зарплата',
      tone: details?.salaryEnabled ? 'ok' : 'muted',
      value: details?.salaryLeadName || (details?.salaryEnabled ? 'Модуль активен' : 'Не используется'),
      hint: details?.salaryLicenseNumber ? `ЛО ${details.salaryLicenseNumber}` : 'Контакт и лицензия'
    },
    {
      key: 'onec',
      title: '1С',
      tone: oneCLicenseStatus.tone,
      value: oneCLicenseStatus.label,
      hint: oneCLicenseStatus.hint
    },
    {
      key: 'site',
      title: 'Сайт',
      tone: siteLicenseStatus.tone,
      value: siteLicenseStatus.label,
      hint: siteLicenseStatus.hint
    }
  ]), [details?.bankName, details?.pfrAgreementNumber, details?.salaryEnabled, details?.salaryLeadName, details?.salaryLicenseNumber, oneCLicenseStatus, siteLicenseStatus]);
  const relationCards = useMemo<OrganizationRelationsOverviewItem[]>(() => ([
    {
      key: 'contacts' as const,
      title: 'Контакты',
      count: details?.contacts.length ?? 0,
      description: 'Люди, должности и способы связи',
      items: buildContactPreviewItems(details?.contacts ?? [])
    },
    {
      key: 'documents' as const,
      title: 'Документы',
      count: details?.attachments.length ?? 0,
      description: 'Вложения и сопроводительные файлы',
      items: buildAttachmentPreviewItems(details?.attachments ?? [])
    },
    {
      key: 'contracts' as const,
      title: 'Договоры',
      count: details?.contracts.length ?? 0,
      description: 'Договорные записи и статусы',
      items: buildContractPreviewItems(details?.contracts ?? [])
    },
    {
      key: 'realizations' as const,
      title: 'Реализации',
      count: details?.realizations.length ?? 0,
      description: 'Финансовые документы по организации',
      items: buildRealizationPreviewItems(details?.realizations ?? [])
    },
    {
      key: 'licenses' as const,
      title: 'Лицензии Парус',
      count: details?.parusLicenses.length ?? 0,
      description: 'История лицензий и модификаций',
      items: buildLicensePreviewItems(details?.parusLicenses ?? [])
    },
    {
      key: 'orders' as const,
      title: 'Заказы Парус',
      count: details?.parusOrders.length ?? 0,
      description: 'Заказы, поставщики и суммы',
      items: buildOrderPreviewItems(details?.parusOrders ?? [])
    }
  ]), [details?.attachments, details?.contacts, details?.contracts, details?.parusLicenses, details?.parusOrders, details?.realizations]);

  const openRelations = (tab: OrganizationRelationTab) => {
    setViewTab('relations');
    setRelationTab(tab);
  };

  const openHistory = (tab: OrganizationHistoryTab) => {
    setViewTab('history');
    setHistoryTab(tab);
  };

  return (
    <div className="organization-record-shell">
      <OrganizationStatusBar
        visible={draft.visible}
        isManager={draft.isManager}
        isDirty={isDirty}
        raionName={resolvedRaionName}
        orgTypeName={resolvedOrgTypeName}
        statusName={details?.statusName}
        flagName={details?.flagName}
      />

      <OrganizationViewTabs activeTab={viewTab} onChange={setViewTab} />

      <div className="organization-record-layout">
        <div className="organization-record-main">
          {viewTab === 'profile' ? (
            <section className="panel organization-card-panel">
              <div className="organization-tab-stack">
                <OrganizationEditorForm value={draft} lookups={lookups} section="main" disabled={disabled} onChange={onDraftChange} />
                <OrganizationEditorForm value={draft} lookups={lookups} section="contacts" disabled={disabled} onChange={onDraftChange} />

                <OrganizationDirectorDetails details={details} />

                <OrganizationLegacyNotes details={details} />
              </div>
            </section>
          ) : null}

          {viewTab === 'support' ? (
            <section className="panel organization-card-panel">
              <div className="organization-tab-stack">
                <OrganizationSupportSummary items={supportCards} />

                <OrganizationEditorForm value={draft} lookups={lookups} section="programs" disabled={disabled} onChange={onDraftChange} />

                <OrganizationBankDetails details={details} />

                <OrganizationSalaryDetails details={details} />

                <OrganizationOneCDetails details={details} licenseStatus={oneCLicenseStatus} />

                <OrganizationSiteDetails details={details} licenseStatus={siteLicenseStatus} />

                <OrganizationProgramBlocks items={details?.programInfos} />
              </div>
            </section>
          ) : null}

          {viewTab === 'relations' ? (
            <section className="panel organization-card-panel">
              {details ? (
                <div className="organization-tab-stack">
                  <OrganizationRelationsOverview cards={relationCards} activeTab={relationTab} onChange={setRelationTab} />

                  <OrganizationRelationsWorkspace activeTab={relationTab} details={details} tableSettings={tableSettings} />
                </div>
              ) : (
                <div className="empty-state organization-record-inline-empty">Связанные данные появятся после сохранения организации.</div>
              )}
            </section>
          ) : null}

          {viewTab === 'history' ? (
            <section className="panel organization-card-panel">
              {details ? (
                <div className="organization-tab-stack">
                  <OrganizationHistoryTabs activeTab={historyTab} onChange={setHistoryTab} />
                  <OrganizationHistoryWorkspace
                    activeTab={historyTab}
                    details={details}
                    emailCount={emailChips.length}
                    eventsSettingsKey={tableSettings.events}
                  />
                </div>
              ) : (
                <div className="empty-state organization-record-inline-empty">История станет доступна после первого сохранения карточки.</div>
              )}
            </section>
          ) : null}
        </div>

        <OrganizationSidebar
          details={details}
          draft={draft}
          emailChips={emailChips}
          onOpenRelations={openRelations}
          onOpenHistory={openHistory}
        />
      </div>
    </div>
  );
}

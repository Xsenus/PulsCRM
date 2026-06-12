import React, { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../app/format';
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
import { DataTable } from './DataTable';
import { OrganizationEditorForm } from './OrganizationEditorForm';
import { OrganizationAuditSummary } from './organization/OrganizationAuditSummary';
import { OrganizationBankDetails } from './organization/OrganizationBankDetails';
import { OrganizationDirectorDetails } from './organization/OrganizationDirectorDetails';
import { OrganizationEventTimeline } from './organization/OrganizationEventTimeline';
import { OrganizationEventViewModeTabs, type OrganizationEventViewMode } from './organization/OrganizationEventViewModeTabs';
import { OrganizationHistoryTabs, type OrganizationHistoryTab } from './organization/OrganizationHistoryTabs';
import { OrganizationLegacyNotes } from './organization/OrganizationLegacyNotes';
import { OrganizationOneCDetails } from './organization/OrganizationOneCDetails';
import { OrganizationProgramBlocks } from './organization/OrganizationProgramBlocks';
import {
  OrganizationRelationsOverview,
  type OrganizationRelationTab,
  type OrganizationRelationsOverviewItem
} from './organization/OrganizationRelationsOverview';
import { OrganizationSalaryDetails } from './organization/OrganizationSalaryDetails';
import { OrganizationSiteDetails } from './organization/OrganizationSiteDetails';
import { OrganizationSidebar } from './organization/OrganizationSidebar';
import { OrganizationSnapshotDetails } from './organization/OrganizationSnapshotDetails';
import { OrganizationSnapshotTabs } from './organization/OrganizationSnapshotTabs';
import { OrganizationStatusBar } from './organization/OrganizationStatusBar';
import { OrganizationSupportSummary, type OrganizationSupportSummaryItem } from './organization/OrganizationSupportSummary';
import { OrganizationViewTabs, type OrganizationViewTab } from './organization/OrganizationViewTabs';
import type { PreviewCardItem } from './organization/RelationPreviewCard';

const EMPTY_VALUE = '-';
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
    contacts: string;
    events: string;
    documents: string;
    contracts: string;
    realizations: string;
    licenses: string;
    orders: string;
  };
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

function formatCount(value?: number | null) {
  return new Intl.NumberFormat('ru-RU').format(value ?? 0);
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

function formatContractOneCState(value: number) {
  switch (value) {
    case 1:
      return 'К отправке в 1С';
    case 2:
      return 'Обработано';
    case 3:
      return 'Игнорировать';
    default:
      return EMPTY_VALUE;
  }
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
  const [eventViewMode, setEventViewMode] = useState<OrganizationEventViewMode>('timeline');
  const [snapshotKey, setSnapshotKey] = useState('');

  useEffect(() => {
    setViewTab('profile');
    setRelationTab('contacts');
    setHistoryTab('events');
    setEventViewMode('timeline');
  }, [details?.id]);

  useEffect(() => {
    const firstSnapshot = details?.oneCSnapshots[0];
    if (!firstSnapshot) {
      setSnapshotKey('');
      return;
    }

    setSnapshotKey((current) => (current && details?.oneCSnapshots.some((item) => item.key === current) ? current : firstSnapshot.key));
  }, [details?.oneCSnapshots]);

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
  const activeSnapshot = details?.oneCSnapshots.find((item) => item.key === snapshotKey) ?? details?.oneCSnapshots[0];
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

  const renderRelationsWorkspace = () => {
    switch (relationTab) {
      case 'contacts':
        return (
          <DataTable
            rows={details?.contacts ?? []}
            getRowKey={(row) => row.id}
            settingsKey={tableSettings.contacts}
            emptyText="Контактов пока нет"
            columns={[
              { key: 'fio', title: 'ФИО', width: 220, minWidth: 180, render: (row) => row.fio || EMPTY_VALUE },
              { key: 'position', title: 'Должность', width: 200, minWidth: 160, render: (row) => row.position || EMPTY_VALUE },
              { key: 'group', title: 'Группа', width: 160, minWidth: 130, render: (row) => row.group || EMPTY_VALUE },
              { key: 'status', title: 'Статус', width: 160, minWidth: 130, render: (row) => row.status || EMPTY_VALUE },
              { key: 'phone', title: 'Телефон', width: 170, minWidth: 140, render: (row) => row.phone || EMPTY_VALUE },
              { key: 'email', title: 'Email', width: 210, minWidth: 180, render: (row) => row.email || EMPTY_VALUE },
              { key: 'comment', title: 'Комментарий', width: 280, minWidth: 220, visible: false, render: (row) => row.comment || EMPTY_VALUE }
            ]}
          />
        );
      case 'documents':
        return (
          <DataTable
            rows={details?.attachments ?? []}
            getRowKey={(row) => row.id}
            settingsKey={tableSettings.documents}
            emptyText="Документов пока нет"
            columns={[
              { key: 'privacyGroupName', title: '!', width: 120, minWidth: 90, visible: false, render: (row) => row.privacyGroupName || EMPTY_VALUE },
              { key: 'executorName', title: 'Исполнитель', width: 170, minWidth: 140, render: (row) => row.executorName || EMPTY_VALUE },
              { key: 'fileTypeName', title: 'Тип файла', width: 110, minWidth: 90, render: (row) => row.fileTypeName || EMPTY_VALUE },
              { key: 'attachDocumentTypeName', title: 'Тип документа', width: 170, minWidth: 140, render: (row) => row.attachDocumentTypeName || EMPTY_VALUE },
              { key: 'dateUtc', title: 'Дата', width: 120, minWidth: 110, render: (row) => formatDateOnly(row.dateUtc) || EMPTY_VALUE },
              { key: 'number', title: 'Номер', width: 150, minWidth: 130, render: (row) => row.number || EMPTY_VALUE },
              { key: 'fileName', title: 'Файл', width: 220, minWidth: 180, render: (row) => row.fileName || EMPTY_VALUE },
              { key: 'name', title: 'Наименование', width: 260, minWidth: 220, render: (row) => row.name || EMPTY_VALUE },
              { key: 'documentTransport', title: 'Транспорт', width: 170, minWidth: 140, render: (row) => row.documentTransport || EMPTY_VALUE },
              { key: 'documentState', title: 'Состояние', width: 170, minWidth: 140, render: (row) => row.documentState || EMPTY_VALUE },
              { key: 'summa', title: 'Сумма', width: 140, minWidth: 120, visible: false, render: (row) => row.summa === undefined || row.summa === null ? EMPTY_VALUE : formatMoney(row.summa) },
              { key: 'isCompleted', title: 'Готов', width: 90, minWidth: 80, render: (row) => (row.isCompleted ? 'Да' : 'Нет') }
            ]}
          />
        );
      case 'contracts':
        return (
          <DataTable
            rows={details?.contracts ?? []}
            getRowKey={(row) => row.id}
            settingsKey={tableSettings.contracts}
            emptyText="Договоров пока нет"
            columns={[
              { key: 'executorName', title: 'Исполнитель', width: 170, minWidth: 150, render: (row) => row.executorName || EMPTY_VALUE },
              { key: 'fileTypeName', title: 'Тип', width: 110, minWidth: 90, render: (row) => row.fileTypeName || EMPTY_VALUE },
              { key: 'dateUtc', title: 'Дата', width: 120, minWidth: 110, render: (row) => formatDateOnly(row.dateUtc) || EMPTY_VALUE },
              { key: 'dateFromUtc', title: 'С', width: 120, minWidth: 110, render: (row) => formatDateOnly(row.dateFromUtc) || EMPTY_VALUE },
              { key: 'dateToUtc', title: 'По', width: 120, minWidth: 110, render: (row) => formatDateOnly(row.dateToUtc) || EMPTY_VALUE },
              { key: 'number', title: 'Номер', width: 150, minWidth: 130, render: (row) => row.number || EMPTY_VALUE },
              { key: 'fileName', title: 'Файл', width: 220, minWidth: 180, render: (row) => row.fileName || EMPTY_VALUE },
              { key: 'name', title: 'Наименование', width: 260, minWidth: 220, render: (row) => row.name || EMPTY_VALUE },
              { key: 'documentTransport', title: 'Транспорт', width: 170, minWidth: 140, render: (row) => row.documentTransport || EMPTY_VALUE },
              { key: 'documentState', title: 'Состояние', width: 170, minWidth: 140, render: (row) => row.documentState || EMPTY_VALUE },
              { key: 'summa', title: 'Сумма', width: 140, minWidth: 120, render: (row) => row.summa === undefined || row.summa === null ? EMPTY_VALUE : formatMoney(row.summa) },
              { key: 'oneCTransferState', title: '1С', width: 150, minWidth: 120, render: (row) => formatContractOneCState(row.oneCTransferState) }
            ]}
          />
        );
      case 'realizations':
        return (
          <DataTable
            rows={details?.realizations ?? []}
            getRowKey={(row) => row.id}
            settingsKey={tableSettings.realizations}
            emptyText="Реализаций пока нет"
            columns={[
              { key: 'dateUtc', title: 'Дата', width: 120, minWidth: 110, render: (row) => formatDateOnly(row.dateUtc) || EMPTY_VALUE },
              { key: 'number', title: 'Номер', width: 150, minWidth: 130, render: (row) => row.number || EMPTY_VALUE },
              { key: 'contractCode', title: 'Код', width: 90, minWidth: 70, render: (row) => row.contractCode || EMPTY_VALUE },
              { key: 'contractName', title: 'Договор', width: 220, minWidth: 180, render: (row) => row.contractName || EMPTY_VALUE },
              { key: 'statusName', title: 'Статус', width: 170, minWidth: 140, render: (row) => row.statusName || EMPTY_VALUE },
              { key: 'edoStatus', title: 'ЭДО', width: 170, minWidth: 140, render: (row) => row.edoStatus || EMPTY_VALUE },
              { key: 'summa', title: 'Сумма', width: 140, minWidth: 120, render: (row) => row.summa === undefined || row.summa === null ? EMPTY_VALUE : formatMoney(row.summa) },
              { key: 'isDone', title: 'Готово', width: 90, minWidth: 80, render: (row) => (row.isDone ? 'Да' : 'Нет') }
            ]}
          />
        );
      case 'licenses':
        return (
          <DataTable
            rows={details?.parusLicenses ?? []}
            getRowKey={(row) => row.id}
            settingsKey={tableSettings.licenses}
            emptyText="Лицензий Парус пока нет"
            columns={[
              { key: 'dateSinceUtc', title: 'Дата выдачи', width: 160, minWidth: 140, render: (row) => formatDateTime(row.dateSinceUtc) || EMPTY_VALUE },
              { key: 'dateToUtc', title: 'Дата окончания', width: 160, minWidth: 140, render: (row) => formatDateTime(row.dateToUtc) || EMPTY_VALUE },
              { key: 'nomenclature', title: 'Версия', width: 200, minWidth: 170, render: (row) => row.nomenclature || EMPTY_VALUE },
              { key: 'mnemoOrg', title: 'Мнемокод', width: 150, minWidth: 130, render: (row) => row.mnemoOrg || EMPTY_VALUE },
              { key: 'regNumberClient', title: 'Номер ЛО', width: 160, minWidth: 140, render: (row) => row.regNumberClient || EMPTY_VALUE },
              { key: 'modification', title: 'Модификация', width: 260, minWidth: 220, render: (row) => row.modification || EMPTY_VALUE },
              { key: 'number', title: 'Кол-во', width: 100, minWidth: 90, render: (row) => row.number || EMPTY_VALUE }
            ]}
          />
        );
      case 'orders':
        return (
          <DataTable
            rows={details?.parusOrders ?? []}
            getRowKey={(row) => row.id}
            settingsKey={tableSettings.orders}
            emptyText="Заказов Парус пока нет"
            columns={[
              { key: 'payer', title: 'Провайдер', width: 200, minWidth: 170, render: (row) => row.payer || EMPTY_VALUE },
              { key: 'typeOf', title: 'Тип', width: 170, minWidth: 140, render: (row) => row.typeOf || EMPTY_VALUE },
              { key: 'dateUtc', title: 'Дата', width: 150, minWidth: 130, render: (row) => formatDateTime(row.dateUtc) || EMPTY_VALUE },
              { key: 'mnemoOrg', title: 'Клиент', width: 170, minWidth: 140, render: (row) => row.mnemoOrg || EMPTY_VALUE },
              { key: 'discount', title: 'Скидка', width: 120, minWidth: 110, render: (row) => formatMoney(row.discount) },
              { key: 'summa', title: 'Сумма с налогами', width: 170, minWidth: 150, render: (row) => formatMoney(row.summa) },
              { key: 'invoiceNumber', title: 'Номер накладной', width: 170, minWidth: 150, render: (row) => row.invoiceNumber || EMPTY_VALUE },
              { key: 'customerAmount', title: 'Цена клиента', width: 160, minWidth: 140, render: (row) => formatMoney(row.customerAmount) },
              { key: 'state', title: 'Состояние', width: 160, minWidth: 130, render: (row) => row.state || EMPTY_VALUE }
            ]}
          />
        );
      default:
        return null;
    }
  };

  const renderHistoryContent = () => {
    if (historyTab === 'events') {
      return (
        <div className="organization-tab-stack">
          <div className="organization-history-toolbar">
            <div className="section-header-inline">
              <h4>События организации</h4>
              <span className="field-hint">{formatCount(details?.events.length ?? 0)} записей</span>
            </div>
            <OrganizationEventViewModeTabs activeMode={eventViewMode} onChange={setEventViewMode} />
          </div>
          {eventViewMode === 'timeline' ? (
            <OrganizationEventTimeline events={details?.events ?? []} />
          ) : (
            <DataTable
              rows={details?.events ?? []}
              getRowKey={(row) => row.id}
              settingsKey={tableSettings.events}
              emptyText="Событий пока нет"
              columns={[
                { key: 'eventDateUtc', title: 'Дата', width: 160, minWidth: 140, render: (row) => formatDateTime(row.eventDateUtc) || EMPTY_VALUE },
                { key: 'userName', title: 'Сотрудник', width: 190, minWidth: 160, render: (row) => row.userName || EMPTY_VALUE },
                { key: 'categoryName', title: 'Категория', width: 170, minWidth: 140, render: (row) => row.categoryName || row.categoryFullName || EMPTY_VALUE },
                { key: 'taskName', title: 'Задача', width: 180, minWidth: 150, render: (row) => row.taskName || EMPTY_VALUE },
                { key: 'name', title: 'Наименование', width: 220, minWidth: 180, render: (row) => row.name || EMPTY_VALUE },
                { key: 'comment', title: 'Комментарий', width: 300, minWidth: 240, render: (row) => row.comment || EMPTY_VALUE },
                { key: 'dateFromUtc', title: 'Дата с', width: 160, minWidth: 140, render: (row) => formatDateTime(row.dateFromUtc) || EMPTY_VALUE },
                { key: 'dateToUtc', title: 'Дата по', width: 160, minWidth: 140, render: (row) => formatDateTime(row.dateToUtc) || EMPTY_VALUE },
                { key: 'isInProcess', title: 'В процессе', width: 120, minWidth: 110, render: (row) => (row.isInProcess ? 'Да' : 'Нет') },
                { key: 'isCompleted', title: 'Завершено', width: 120, minWidth: 110, render: (row) => row.isCompleted === undefined ? EMPTY_VALUE : row.isCompleted ? 'Да' : 'Нет' }
              ]}
            />
          )}
        </div>
      );
    }

    if (historyTab === 'snapshots') {
      return details?.oneCSnapshots.length ? (
        <div className="organization-tab-stack">
          <OrganizationSnapshotTabs
            snapshots={details.oneCSnapshots}
            activeKey={activeSnapshot?.key}
            onChange={setSnapshotKey}
          />

          <OrganizationSnapshotDetails snapshot={activeSnapshot} />
        </div>
      ) : (
        <div className="empty-state organization-record-inline-empty">Снимки 1С по организации не найдены.</div>
      );
    }

    return <OrganizationAuditSummary details={details} emailCount={emailChips.length} />;
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

                  {renderRelationsWorkspace()}
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
                  {renderHistoryContent()}
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

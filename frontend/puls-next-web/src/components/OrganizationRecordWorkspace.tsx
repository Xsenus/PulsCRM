import React, { useEffect, useMemo, useState } from 'react';
import { formatDateTime } from '../app/format';
import type {
  OrganizationAttachmentDto,
  OrganizationContactDto,
  OrganizationContractDto,
  OrganizationDetailsDto,
  OrganizationEditorLookupsDto,
  OrganizationLookupItemDto,
  OrganizationOneCSnapshotDto,
  OrganizationParusLicenseDto,
  OrganizationParusOrderDto,
  OrganizationRealizationDto,
  OrganizationUpsertRequest
} from '../app/types';
import { DataTable } from './DataTable';
import { OrganizationEditorForm } from './OrganizationEditorForm';
import { OrganizationEventTimeline } from './organization/OrganizationEventTimeline';
import { OrganizationSidebar } from './organization/OrganizationSidebar';
import { OrganizationViewTabs, type OrganizationViewTab } from './organization/OrganizationViewTabs';
import { RelationPreviewCard, type PreviewCardItem } from './organization/RelationPreviewCard';

const EMPTY_VALUE = '-';
const PROGRAM_VARIANTS = [
  { variant: 0, shortLabel: 'Бух', title: 'Бухгалтерия' },
  { variant: 1, shortLabel: 'ЗП', title: 'Зарплата' },
  { variant: 2, shortLabel: 'ПХУ', title: 'Похозяйственный учет' },
  { variant: 3, shortLabel: 'РМИ', title: 'Реестр муниципального имущества' },
  { variant: 4, shortLabel: 'ЗУМО', title: 'Реестр земельных участков' },
  { variant: 5, shortLabel: 'ЖКХ', title: 'Жилищно-коммунальное хозяйство' },
  { variant: 6, shortLabel: 'Сайт', title: 'Представительство в интернете' },
  { variant: 7, shortLabel: 'ЭЦП', title: 'Сдача отчетности' },
  { variant: 8, shortLabel: 'ГМЗ', title: 'Государственное муниципальное задание' },
  { variant: 9, shortLabel: 'БО', title: 'Бюджетная отчетность' }
] as const;
const PROGRAM_VARIANT_SET = new Set<number>(PROGRAM_VARIANTS.map((item) => item.variant));
const DAY_IN_MS = 24 * 60 * 60 * 1000;

type OrganizationRelationTab = 'contacts' | 'documents' | 'contracts' | 'realizations' | 'licenses' | 'orders';
type OrganizationHistoryTab = 'events' | 'snapshots' | 'audit';
type OrganizationEventViewMode = 'timeline' | 'table';
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

function formatAuditValue(date?: string, author?: string) {
  const value = [formatDateTime(date), author].filter(Boolean).join(' • ');
  return value || EMPTY_VALUE;
}

function normalizeHref(url?: string) {
  const value = url?.trim();
  if (!value) {
    return undefined;
  }

  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function normalizePhoneHref(phone?: string) {
  const value = phone?.replace(/[^\d+]/g, '');
  return value ? `tel:${value}` : undefined;
}

function uniqueDefined(values: Array<string | undefined>) {
  return Array.from(new Set(values
    .map((value) => value?.trim())
    .filter((value): value is string => !!value)));
}

function textValue(value?: string | number | null) {
  if (typeof value === 'number') {
    return String(value);
  }

  return value?.toString().trim() || EMPTY_VALUE;
}

function renderPhone(value?: string | null) {
  const href = normalizePhoneHref(value ?? undefined);
  return href ? <a href={href}>{value}</a> : textValue(value);
}

function renderLink(value?: string | null) {
  const href = normalizeHref(value ?? undefined);
  return href ? <a href={href} target="_blank" rel="noreferrer">{value}</a> : textValue(value);
}

function renderMail(value?: string | null) {
  return value?.trim() ? <a href={`mailto:${value.trim()}`}>{value.trim()}</a> : EMPTY_VALUE;
}

function hasSnapshotData(snapshot: OrganizationOneCSnapshotDto | undefined) {
  if (!snapshot) {
    return false;
  }

  return Boolean(snapshot.code || snapshot.raion || snapshot.name || snapshot.fullName || snapshot.inn || snapshot.phone || snapshot.otherInfo || snapshot.comment || snapshot.addressLegal || snapshot.addressActual);
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

function getProgramVariantMeta(variant: number) {
  return PROGRAM_VARIANTS.find((item) => item.variant === variant);
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

function boolLabel(value?: boolean | null) {
  return value ? 'Да' : 'Нет';
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
  const programCards = useMemo(() => {
    const items = details?.programInfos ?? [];
    const itemByVariant = new Map(items.map((item) => [item.variant, item] as const));
    const knownItems = PROGRAM_VARIANTS.map((meta) => ({
      meta,
      item: itemByVariant.get(meta.variant)
    }));
    const extraItems = items.filter((item) => !PROGRAM_VARIANT_SET.has(item.variant));
    return { knownItems, extraItems };
  }, [details?.programInfos]);
  const activeSnapshot = details?.oneCSnapshots.find((item) => item.key === snapshotKey) ?? details?.oneCSnapshots[0];
  const supportCards = useMemo(() => ([
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
  const relationCards = useMemo(() => ([
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
            <div className="settings-tabs organization-card-tabs organization-card-tabs-inline">
              <button
                type="button"
                className={`settings-tab${eventViewMode === 'timeline' ? ' active' : ''}`}
                onClick={() => setEventViewMode('timeline')}
              >
                Лента
              </button>
              <button
                type="button"
                className={`settings-tab${eventViewMode === 'table' ? ' active' : ''}`}
                onClick={() => setEventViewMode('table')}
              >
                Таблица
              </button>
            </div>
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
          <div className="settings-tabs organization-card-tabs organization-card-tabs-inline">
            {details.oneCSnapshots.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`settings-tab${activeSnapshot?.key === item.key ? ' active' : ''}`}
                onClick={() => setSnapshotKey(item.key)}
              >
                {item.title}
              </button>
            ))}
          </div>

          {hasSnapshotData(activeSnapshot) ? (
            <div className="detail-grid">
              <div className="detail-card">
                <strong>Код</strong>
                <span>{textValue(activeSnapshot?.code)}</span>
              </div>
              <div className="detail-card">
                <strong>Район</strong>
                <span>{textValue(activeSnapshot?.raion)}</span>
              </div>
              <div className="detail-card">
                <strong>ИНН</strong>
                <span>{textValue(activeSnapshot?.inn)}</span>
              </div>
              <div className="detail-card detail-card-wide">
                <strong>Наименование</strong>
                <span>{textValue(activeSnapshot?.name)}</span>
              </div>
              <div className="detail-card detail-card-wide">
                <strong>Полное наименование</strong>
                <span>{textValue(activeSnapshot?.fullName)}</span>
              </div>
              <div className="detail-card">
                <strong>Телефон</strong>
                <span>{renderPhone(activeSnapshot?.phone)}</span>
              </div>
              <div className="detail-card detail-card-wide">
                <strong>Другая информация</strong>
                <span>{textValue(activeSnapshot?.otherInfo)}</span>
              </div>
              <div className="detail-card detail-card-wide">
                <strong>Комментарий</strong>
                <span>{textValue(activeSnapshot?.comment)}</span>
              </div>
              <div className="detail-card detail-card-wide">
                <strong>Юридический адрес</strong>
                <span>{textValue(activeSnapshot?.addressLegal)}</span>
              </div>
              <div className="detail-card detail-card-wide">
                <strong>Фактический адрес</strong>
                <span>{textValue(activeSnapshot?.addressActual)}</span>
              </div>
            </div>
          ) : (
            <div className="empty-state organization-record-inline-empty">В выбранном снимке нет данных.</div>
          )}
        </div>
      ) : (
        <div className="empty-state organization-record-inline-empty">Снимки 1С по организации не найдены.</div>
      );
    }

    return (
      <div className="organization-tab-stack">
        <div className="detail-list">
          <div>
            <strong>Создано</strong>
            <div className="field-hint">{formatAuditValue(details?.createdAtUtc, details?.createdByName)}</div>
          </div>
          <div>
            <strong>Обновлено</strong>
            <div className="field-hint">{formatAuditValue(details?.updatedAtUtc, details?.updatedByName)}</div>
          </div>
          <div>
            <strong>Админ. обновление</strong>
            <div className="field-hint">{formatAuditValue(details?.updatedAdminAtUtc, details?.updatedAdminByName)}</div>
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-card">
            <strong>Email-адресов</strong>
            <span>{formatCount(emailChips.length)}</span>
          </div>
          <div className="detail-card">
            <strong>Контактов</strong>
            <span>{formatCount(details?.contacts.length ?? 0)}</span>
          </div>
          <div className="detail-card">
            <strong>Событий</strong>
            <span>{formatCount(details?.events.length ?? 0)}</span>
          </div>
          <div className="detail-card">
            <strong>Договоров</strong>
            <span>{formatCount(details?.contracts.length ?? 0)}</span>
          </div>
          <div className="detail-card">
            <strong>Документов</strong>
            <span>{formatCount(details?.attachments.length ?? 0)}</span>
          </div>
          <div className="detail-card">
            <strong>Реализаций</strong>
            <span>{formatCount(details?.realizations.length ?? 0)}</span>
          </div>
          <div className="detail-card">
            <strong>Программных блоков</strong>
            <span>{formatCount(details?.programInfos.length ?? 0)}</span>
          </div>
          <div className="detail-card">
            <strong>Лицензий Парус</strong>
            <span>{formatCount(details?.parusLicenses.length ?? 0)}</span>
          </div>
          <div className="detail-card">
            <strong>Заказов Парус</strong>
            <span>{formatCount(details?.parusOrders.length ?? 0)}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="organization-record-shell">
      <section className="panel organization-record-status-bar">
        <div className="organization-card-chip-row">
          <span className={`organization-chip${draft.visible ? ' accent' : ''}`}>
            {draft.visible ? 'Видима' : 'Скрыта'}
          </span>
          {draft.isManager ? <span className="organization-chip accent">Для менеджера</span> : null}
          {resolvedRaionName ? <span className="organization-chip">{resolvedRaionName}</span> : null}
          {resolvedOrgTypeName ? <span className="organization-chip">{resolvedOrgTypeName}</span> : null}
          {details?.statusName ? <span className="organization-chip">{details.statusName}</span> : null}
          {details?.flagName ? <span className="organization-chip">{details.flagName}</span> : null}
        </div>
        <span className={`organization-status-pill organization-status-pill--${isDirty ? 'warn' : 'ok'}`}>
          {isDirty ? 'Черновик изменен' : 'Все изменения сохранены'}
        </span>
      </section>

      <OrganizationViewTabs activeTab={viewTab} onChange={setViewTab} />

      <div className="organization-record-layout">
        <div className="organization-record-main">
          {viewTab === 'profile' ? (
            <section className="panel organization-card-panel">
              <div className="organization-tab-stack">
                <OrganizationEditorForm value={draft} lookups={lookups} section="main" disabled={disabled} onChange={onDraftChange} />
                <OrganizationEditorForm value={draft} lookups={lookups} section="contacts" disabled={disabled} onChange={onDraftChange} />

                <div className="panel-subsection">
                  <div className="section-header-inline">
                    <h4>Руководитель и служебные реквизиты</h4>
                    <span className="field-hint">Данные из legacy-карточки организации</span>
                  </div>
                  <div className="detail-grid">
                    <div className="detail-card">
                      <strong>Руководитель</strong>
                      <span>{textValue(details?.directorFullName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Кратко</strong>
                      <span>{textValue(details?.directorShortName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>ФИО в родительном</strong>
                      <span>{textValue(details?.directorGenitiveName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Должность</strong>
                      <span>{textValue(details?.directorPosition)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Должность в родительном</strong>
                      <span>{textValue(details?.directorPositionGenitive)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Основание</strong>
                      <span>{textValue(details?.authorityDocument)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Телефон</strong>
                      <span>{renderPhone(details?.directorPhone)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Email</strong>
                      <span>{renderMail(details?.directorEmail)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>СНИЛС</strong>
                      <span>{textValue(details?.directorSnils)}</span>
                    </div>
                  </div>
                </div>

                <div className="panel-subsection">
                  <h4>Legacy-заметки</h4>
                  <div className="detail-list">
                    <div>
                      <strong>Дополнительный комментарий</strong>
                      <div className="field-hint">{textValue(details?.additionalComment)}</div>
                    </div>
                    <div>
                      <strong>Техника</strong>
                      <div className="field-hint">{textValue(details?.technicsComment)}</div>
                    </div>
                    <div>
                      <strong>Закупки</strong>
                      <div className="field-hint">{textValue(details?.procurementComment)}</div>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          {viewTab === 'support' ? (
            <section className="panel organization-card-panel">
              <div className="organization-tab-stack">
                <div className="organization-support-summary-grid">
                  {supportCards.map((item) => (
                    <div key={item.key} className="detail-card organization-support-summary-card">
                      <strong>{item.title}</strong>
                      <span className={`organization-status-pill organization-status-pill--${item.tone}`}>{item.value}</span>
                      <span className="field-hint">{item.hint}</span>
                    </div>
                  ))}
                </div>

                <OrganizationEditorForm value={draft} lookups={lookups} section="programs" disabled={disabled} onChange={onDraftChange} />

                <div className="panel-subsection">
                  <h4>ЭЦП и банковские реквизиты</h4>
                  <div className="detail-grid">
                    <div className="detail-card">
                      <strong>ОКВЭД</strong>
                      <span>{textValue(details?.okved)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>ОКПО</strong>
                      <span>{textValue(details?.okpo)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>ПФР</strong>
                      <span>{textValue(details?.pfrNumber)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>ФСС</strong>
                      <span>{textValue(details?.fssNumber)}</span>
                    </div>
                    <div className="detail-card detail-card-wide">
                      <strong>Банк</strong>
                      <span>{textValue(details?.bankName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>БИК</strong>
                      <span>{textValue(details?.bankBik)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Город банка</strong>
                      <span>{textValue(details?.bankCity)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Расчетный счет</strong>
                      <span>{textValue(details?.bankAccount)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Лицевой счет</strong>
                      <span>{textValue(details?.personalAccount)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Корр. счет</strong>
                      <span>{textValue(details?.bankCorrespondentAccount)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Соглашение с ПФР</strong>
                      <span>{textValue(details?.pfrAgreementNumber)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Дата соглашения</strong>
                      <span>{formatDateTime(details?.pfrAgreementDateUtc) || EMPTY_VALUE}</span>
                    </div>
                  </div>
                  <div className="detail-list">
                    <div>
                      <strong>Комментарий ЭЦП</strong>
                      <div className="field-hint">{textValue(details?.ecpComment)}</div>
                    </div>
                    <div>
                      <strong>Комментарий ЭЦП в договор</strong>
                      <div className="field-hint">{textValue(details?.ecpContractComment)}</div>
                    </div>
                  </div>
                </div>

                <div className="panel-subsection">
                  <h4>Зарплата</h4>
                  <div className="detail-grid">
                    <div className="detail-card">
                      <strong>Работают</strong>
                      <span>{boolLabel(details?.salaryEnabled)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Метка</strong>
                      <span>{textValue(details?.salaryLabel)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Телефон</strong>
                      <span>{renderPhone(details?.salaryContactPhone)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Email</strong>
                      <span>{renderMail(details?.salaryEmail)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Ответственный</strong>
                      <span>{textValue(details?.salaryLeadName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Номер ЛО</strong>
                      <span>{textValue(details?.salaryLicenseNumber)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Ручной номер ЛО</strong>
                      <span>{textValue(details?.salaryManualLicenseNumber)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Организация-источник ЛО</strong>
                      <span>{textValue(details?.salaryLicenseOrganizationName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Файл лицензии</strong>
                      <span>{textValue(details?.salaryLicenseFileName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Платформа</strong>
                      <span>{textValue(details?.salaryPlatform)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Конфигурация</strong>
                      <span>{textValue(details?.salaryConfiguration)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Оценка</strong>
                      <span>{textValue(details?.salaryRating)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Баз</strong>
                      <span>{textValue(details?.salaryDatabaseCount)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Организаций в базах</strong>
                      <span>{textValue(details?.salaryOrganizationCount)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Доп. мест</strong>
                      <span>{textValue(details?.salaryExtraWorkplaces)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Начало работы</strong>
                      <span>{formatDateTime(details?.salaryWorkBeginUtc) || EMPTY_VALUE}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Конец работы</strong>
                      <span>{formatDateTime(details?.salaryWorkEndUtc) || EMPTY_VALUE}</span>
                    </div>
                  </div>
                  <div className="detail-list">
                    <div>
                      <strong>Состав лицензии</strong>
                      <div className="field-hint">{textValue(details?.salaryLicenseComposition)}</div>
                    </div>
                    <div>
                      <strong>Комментарий ЗП</strong>
                      <div className="field-hint">{textValue(details?.salaryComment)}</div>
                    </div>
                  </div>
                </div>

                <div className="panel-subsection">
                  <h4>1С</h4>
                  <div className="detail-grid">
                    <div className="detail-card">
                      <strong>Контакт</strong>
                      <span>{textValue(details?.oneCContactName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Телефон</strong>
                      <span>{renderPhone(details?.oneCContactPhone)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Email</strong>
                      <span>{renderMail(details?.oneCEmail)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>1С Бухгалтерия</strong>
                      <span>{boolLabel(details?.oneCAccountingEnabled)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>1С Зарплата</strong>
                      <span>{boolLabel(details?.oneCSalaryEnabled)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>1С ЖКХ</strong>
                      <span>{boolLabel(details?.oneCHousingEnabled)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Ведущий Бух</strong>
                      <span>{textValue(details?.oneCLeadAccountingName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Ведущий ЗП</strong>
                      <span>{textValue(details?.oneCLeadSalaryName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Базовый договор</strong>
                      <span>{boolLabel(details?.oneCBaseContract)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Рег. номер Бух</strong>
                      <span>{textValue(details?.oneCRegNumberAccounting)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Рег. номер ЗП</strong>
                      <span>{textValue(details?.oneCRegNumberSalary)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Платформа Бух</strong>
                      <span>{textValue(details?.oneCPlatformAccounting)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Платформа ЗП</strong>
                      <span>{textValue(details?.oneCPlatformSalary)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Конфигурация Бух</strong>
                      <span>{textValue(details?.oneCConfigurationAccounting)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Конфигурация ЗП</strong>
                      <span>{textValue(details?.oneCConfigurationSalary)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Вариант договора</strong>
                      <span>{textValue(details?.oneCContractVariant)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>ИТС вариант</strong>
                      <span>{textValue(details?.oneCItsVariant)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Номер ИТС</strong>
                      <span>{textValue(details?.oneCItsLicenseNumber)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>ИТС с</strong>
                      <span>{formatDateTime(details?.oneCItsDateFromUtc) || EMPTY_VALUE}</span>
                    </div>
                    <div className="detail-card">
                      <strong>ИТС по</strong>
                      <span>{formatDateTime(details?.oneCItsDateToUtc) || EMPTY_VALUE}</span>
                    </div>
                    <div className="detail-card">
                      <strong>ИТС завершено</strong>
                      <span>{boolLabel(details?.oneCItsCompleted)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Статус ИТС</strong>
                      <span className={`organization-status-pill organization-status-pill--${oneCLicenseStatus.tone}`}>{oneCLicenseStatus.label}</span>
                      <span className="field-hint">{oneCLicenseStatus.hint}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Сумма ИТС</strong>
                      <span>{details?.oneCItsAmount === undefined || details?.oneCItsAmount === null ? EMPTY_VALUE : formatMoney(details.oneCItsAmount)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Комментарий суммы</strong>
                      <span>{textValue(details?.oneCItsAmountComment)}</span>
                    </div>
                  </div>
                  <div className="detail-list">
                    <div>
                      <strong>Комментарий Бух</strong>
                      <div className="field-hint">{textValue(details?.oneCComment)}</div>
                    </div>
                    <div>
                      <strong>Комментарий ЗП</strong>
                      <div className="field-hint">{textValue(details?.oneCSalaryComment)}</div>
                    </div>
                    <div>
                      <strong>Доработки Бух</strong>
                      <div className="field-hint">{textValue(details?.oneCAccountingChanges)}</div>
                    </div>
                    <div>
                      <strong>Доработки ЗП</strong>
                      <div className="field-hint">{textValue(details?.oneCSalaryChanges)}</div>
                    </div>
                    <div>
                      <strong>Комментарий ИТС</strong>
                      <div className="field-hint">{textValue(details?.oneCItsComment)}</div>
                    </div>
                    <div>
                      <strong>Состав ИТС</strong>
                      <div className="field-hint">{textValue(details?.oneCItsComposition)}</div>
                    </div>
                  </div>
                </div>

                <div className="panel-subsection">
                  <h4>Сайт</h4>
                  <div className="detail-grid">
                    <div className="detail-card">
                      <strong>Сайт</strong>
                      <span>{renderLink(details?.site)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Alias</strong>
                      <span>{textValue(details?.siteAlias)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Контакт</strong>
                      <span>{textValue(details?.siteContactName)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Телефон</strong>
                      <span>{renderPhone(details?.siteContactPhone)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Email</strong>
                      <span>{renderMail(details?.siteEmail)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Состояние</strong>
                      <span>{textValue(details?.siteState)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>На сопровождении</strong>
                      <span>{boolLabel(details?.siteOnSupport)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Шаблон</strong>
                      <span>{textValue(details?.siteTemplate)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>ID Base</strong>
                      <span>{textValue(details?.siteBaseId)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Создание</strong>
                      <span>{formatDateTime(details?.siteReadyAtUtc) || EMPTY_VALUE}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Лицензия с</strong>
                      <span>{formatDateTime(details?.siteLicenseDateFromUtc) || EMPTY_VALUE}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Лицензия по</strong>
                      <span>{formatDateTime(details?.siteLicenseDateToUtc) || EMPTY_VALUE}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Лицензия завершена</strong>
                      <span>{boolLabel(details?.siteLicenseCompleted)}</span>
                    </div>
                    <div className="detail-card">
                      <strong>Статус домена</strong>
                      <span className={`organization-status-pill organization-status-pill--${siteLicenseStatus.tone}`}>{siteLicenseStatus.label}</span>
                      <span className="field-hint">{siteLicenseStatus.hint}</span>
                    </div>
                  </div>
                  <div className="detail-list">
                    <div>
                      <strong>Комментарий по сайту</strong>
                      <div className="field-hint">{textValue(details?.siteComment)}</div>
                    </div>
                  </div>
                </div>

                <div className="panel-subsection">
                  <div className="section-header-inline">
                    <h4>Блоки программ</h4>
                    <span className="field-hint">{formatCount(details?.programInfos.length ?? 0)} записей</span>
                  </div>
                  <div className="detail-grid organization-program-grid">
                    {programCards.knownItems.map(({ meta, item }) => (
                      <div
                        key={meta.variant}
                        className={`detail-card organization-program-card${item ? '' : ' organization-program-card-empty'}`}
                      >
                        <div className="organization-program-card-heading">
                          <strong>{meta.shortLabel}</strong>
                          <span>{item?.fullName || item?.name || meta.title}</span>
                        </div>
                        <span>{item?.organizationCreatorName || 'Производитель не указан'}</span>
                        <span className="field-hint">Рабочих мест: {formatCount(item?.places ?? 0)}</span>
                        <span className="field-hint">
                          {item?.updatedAtUtc
                            ? `Обновлено: ${formatAuditValue(item.updatedAtUtc, item.updatedByName)}`
                            : item?.updatedByName
                              ? `Автор: ${item.updatedByName}`
                              : 'Запись пока не заполнена'}
                        </span>
                        <span>{item?.comment?.trim() || 'Комментарий не заполнен'}</span>
                      </div>
                    ))}
                  </div>

                  {programCards.extraItems.length ? (
                    <div className="detail-grid organization-program-grid">
                      {programCards.extraItems.map((item) => {
                        const meta = getProgramVariantMeta(item.variant);
                        return (
                          <div key={item.id} className="detail-card organization-program-card">
                            <div className="organization-program-card-heading">
                              <strong>{meta?.shortLabel || `#${item.variant}`}</strong>
                              <span>{item.fullName || item.name || `Блок #${item.id}`}</span>
                            </div>
                            <span>{item.organizationCreatorName || 'Производитель не указан'}</span>
                            <span className="field-hint">Рабочих мест: {formatCount(item.places)}</span>
                            <span className="field-hint">
                              {item.updatedAtUtc ? `Обновлено: ${formatAuditValue(item.updatedAtUtc, item.updatedByName)}` : `Автор: ${item.updatedByName || EMPTY_VALUE}`}
                            </span>
                            <span>{item.comment?.trim() || 'Комментарий не заполнен'}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>
          ) : null}

          {viewTab === 'relations' ? (
            <section className="panel organization-card-panel">
              {details ? (
                <div className="organization-tab-stack">
                  <div className="section-header-inline">
                    <h4>Связанные записи</h4>
                    <span className="field-hint">Быстрые карточки и полный список по каждому разделу</span>
                  </div>

                  <div className="organization-relations-grid">
                    {relationCards.map((card) => (
                      <RelationPreviewCard
                        key={card.key}
                        title={card.title}
                        count={card.count}
                        description={card.description}
                        items={card.items}
                        active={relationTab === card.key}
                        onClick={() => setRelationTab(card.key)}
                      />
                    ))}
                  </div>

                  <div className="settings-tabs organization-card-tabs organization-card-tabs-inline">
                    {relationCards.map((card) => (
                      <button
                        key={card.key}
                        type="button"
                        className={`settings-tab${relationTab === card.key ? ' active' : ''}`}
                        onClick={() => setRelationTab(card.key)}
                      >
                        {card.title}
                      </button>
                    ))}
                  </div>

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
                  <div className="settings-tabs organization-card-tabs organization-card-tabs-inline">
                    <button type="button" className={`settings-tab${historyTab === 'events' ? ' active' : ''}`} onClick={() => setHistoryTab('events')}>
                      События
                    </button>
                    <button type="button" className={`settings-tab${historyTab === 'snapshots' ? ' active' : ''}`} onClick={() => setHistoryTab('snapshots')}>
                      Снимки 1С
                    </button>
                    <button type="button" className={`settings-tab${historyTab === 'audit' ? ' active' : ''}`} onClick={() => setHistoryTab('audit')}>
                      Аудит
                    </button>
                  </div>
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

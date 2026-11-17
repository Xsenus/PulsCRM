import dayjs from 'dayjs';
import type { ParusLicenseAnalyticsOrganizationGroupDto } from '../../app/types';

export const GROUP_STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'active', label: 'Действуют' },
  { value: 'expired', label: 'Просрочены' },
  { value: 'renewed', label: 'Продлены' },
  { value: 'without-renewal', label: 'Без продления' },
  { value: 'expiring', label: 'Заканчиваются' },
  { value: 'new', label: 'Новые' },
  { value: 'lost', label: 'Ушли' }
];

export interface AnalyticsPeriodRange {
  from: string;
  to: string;
}

export function toApiDate(value: string) {
  return `${value}T00:00:00.000Z`;
}

export function formatCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

export function formatInputDate(value: string) {
  return dayjs(value).format('DD.MM.YYYY');
}

export function parseInputDate(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsed = dayjs(`${year}-${month}-${day}`);
  return parsed.isValid() && parsed.format('DD.MM.YYYY') === value
    ? parsed.format('YYYY-MM-DD')
    : null;
}

export function formatTypedDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('.');
}

export function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function formatQuantity(value?: string) {
  if (!value) {
    return '';
  }

  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? formatCount(number) : value;
}

export function getGroupStatusLabel(value: string) {
  return GROUP_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? GROUP_STATUS_OPTIONS[0].label;
}

export function getGroupExportStatus(row: {
  activeAtPeriodEnd: boolean;
  withoutRenewal?: boolean;
  expiredAtPeriodEnd: boolean;
}) {
  if (row.activeAtPeriodEnd) {
    return 'Действует';
  }

  if (row.withoutRenewal) {
    return 'Без продления';
  }

  if (row.expiredAtPeriodEnd) {
    return 'Просрочена';
  }

  return 'История';
}

export function buildLicenseMeta(row: ParusLicenseAnalyticsOrganizationGroupDto) {
  return [
    row.databaseCount > 0 ? `Баз: ${formatCount(row.databaseCount)}` : null,
    row.organizationCount > 0 ? `Организаций в базах: ${formatCount(row.organizationCount)}` : null,
    row.extraWorkplaces > 0 ? `Доп. мест: ${formatCount(row.extraWorkplaces)}` : null,
    row.licenseComposition || null
  ].filter(Boolean).join(' · ');
}

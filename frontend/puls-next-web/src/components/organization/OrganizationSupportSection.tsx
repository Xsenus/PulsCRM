import React, { useMemo } from 'react';
import type { OrganizationDetailsDto, OrganizationEditorLookupsDto, OrganizationUpsertRequest } from '../../app/types';
import { OrganizationEditorForm } from '../OrganizationEditorForm';
import { OrganizationBankDetails } from './OrganizationBankDetails';
import { OrganizationOneCDetails, type OrganizationLicenseStatusView } from './OrganizationOneCDetails';
import { OrganizationProgramBlocks } from './OrganizationProgramBlocks';
import { OrganizationSalaryDetails } from './OrganizationSalaryDetails';
import { OrganizationSiteDetails } from './OrganizationSiteDetails';
import { OrganizationSupportSummary, type OrganizationSupportSummaryItem } from './OrganizationSupportSummary';

const DAY_IN_MS = 24 * 60 * 60 * 1000;

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

function renderDateOnly(value?: string | null) {
  const formatted = formatDateOnly(value);
  return formatted ? <time dateTime={value ?? undefined}>{formatted}</time> : null;
}

function renderPeriodLabel(dateFrom: string, dateTo: string) {
  return (
    <>
      с {renderDateOnly(dateFrom)} по {renderDateOnly(dateTo)}
    </>
  );
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
): OrganizationLicenseStatusView {
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
  const periodLabel = renderPeriodLabel(dateFrom, dateTo);
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
      hint: <>{periodLabel}, истекла {Math.abs(daysLeft)} дн. назад.</>
    };
  }

  if (daysLeft <= 30) {
    return {
      tone: 'warn',
      label: labels.warning,
      hint: <>{periodLabel}, осталось {daysLeft} дн.</>
    };
  }

  return {
    tone: 'ok',
    label: labels.active,
    hint: <>{periodLabel}, запас {daysLeft} дн.</>
  };
}

export function OrganizationSupportSection({
  details,
  draft,
  lookups,
  disabled,
  onDraftChange
}: {
  details: OrganizationDetailsDto | null;
  draft: OrganizationUpsertRequest;
  lookups: OrganizationEditorLookupsDto | null;
  disabled: boolean;
  onDraftChange: (next: OrganizationUpsertRequest) => void;
}) {
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

  return (
    <>
      <OrganizationSupportSummary items={supportCards} />

      <OrganizationEditorForm value={draft} lookups={lookups} section="programs" disabled={disabled} onChange={onDraftChange} />

      <OrganizationBankDetails details={details} />

      <OrganizationSalaryDetails details={details} />

      <OrganizationOneCDetails details={details} licenseStatus={oneCLicenseStatus} />

      <OrganizationSiteDetails details={details} licenseStatus={siteLicenseStatus} />

      <OrganizationProgramBlocks items={details?.programInfos} />
    </>
  );
}

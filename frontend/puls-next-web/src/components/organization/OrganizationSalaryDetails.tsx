import React from 'react';
import { formatDateTime } from '../../app/format';

const EMPTY_VALUE = '-';

export interface OrganizationSalaryDetailsData {
  salaryEnabled?: boolean;
  salaryLabel?: string;
  salaryContactPhone?: string;
  salaryEmail?: string;
  salaryLeadName?: string;
  salaryLicenseNumber?: string;
  salaryManualLicenseNumber?: string;
  salaryLicenseOrganizationName?: string;
  salaryLicenseFileName?: string;
  salaryPlatform?: string;
  salaryConfiguration?: string;
  salaryRating?: string;
  salaryDatabaseCount?: number;
  salaryOrganizationCount?: number;
  salaryExtraWorkplaces?: number;
  salaryWorkBeginUtc?: string;
  salaryWorkEndUtc?: string;
  salaryLicenseComposition?: string;
  salaryComment?: string;
}

function textValue(value?: string | number | null) {
  if (typeof value === 'number') {
    return String(value);
  }

  return value?.toString().trim() || EMPTY_VALUE;
}

function boolLabel(value?: boolean | null) {
  if (value === undefined || value === null) {
    return EMPTY_VALUE;
  }

  return value ? 'Да' : 'Нет';
}

function normalizePhoneHref(phone?: string) {
  const value = phone?.replace(/[^\d+]/g, '');
  return value ? `tel:${value}` : undefined;
}

function renderPhone(value?: string | null) {
  const href = normalizePhoneHref(value ?? undefined);
  return href ? <a href={href}>{value}</a> : textValue(value);
}

function renderMail(value?: string | null) {
  return value?.trim() ? <a href={`mailto:${value.trim()}`}>{value.trim()}</a> : EMPTY_VALUE;
}

export function OrganizationSalaryDetails({ details }: { details?: OrganizationSalaryDetailsData | null }) {
  return (
    <div className="panel-subsection">
      <h4>Зарплата</h4>
      <div className="detail-grid" role="list" aria-label="Зарплатное сопровождение организации">
        <div className="detail-card" role="listitem">
          <strong>Работают</strong>
          <span>{boolLabel(details?.salaryEnabled)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Метка</strong>
          <span>{textValue(details?.salaryLabel)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Телефон</strong>
          <span>{renderPhone(details?.salaryContactPhone)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Email</strong>
          <span>{renderMail(details?.salaryEmail)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Ответственный</strong>
          <span>{textValue(details?.salaryLeadName)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Номер ЛО</strong>
          <span>{textValue(details?.salaryLicenseNumber)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Ручной номер ЛО</strong>
          <span>{textValue(details?.salaryManualLicenseNumber)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Организация-источник ЛО</strong>
          <span>{textValue(details?.salaryLicenseOrganizationName)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Файл лицензии</strong>
          <span>{textValue(details?.salaryLicenseFileName)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Платформа</strong>
          <span>{textValue(details?.salaryPlatform)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Конфигурация</strong>
          <span>{textValue(details?.salaryConfiguration)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Оценка</strong>
          <span>{textValue(details?.salaryRating)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Баз</strong>
          <span>{textValue(details?.salaryDatabaseCount)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Организаций в базах</strong>
          <span>{textValue(details?.salaryOrganizationCount)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Доп. мест</strong>
          <span>{textValue(details?.salaryExtraWorkplaces)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Начало работы</strong>
          <span>{formatDateTime(details?.salaryWorkBeginUtc) || EMPTY_VALUE}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Конец работы</strong>
          <span>{formatDateTime(details?.salaryWorkEndUtc) || EMPTY_VALUE}</span>
        </div>
      </div>
      <div className="detail-list" role="list" aria-label="Комментарии зарплатного сопровождения">
        <div role="listitem">
          <strong>Состав лицензии</strong>
          <div className="field-hint">{textValue(details?.salaryLicenseComposition)}</div>
        </div>
        <div role="listitem">
          <strong>Комментарий ЗП</strong>
          <div className="field-hint">{textValue(details?.salaryComment)}</div>
        </div>
      </div>
    </div>
  );
}

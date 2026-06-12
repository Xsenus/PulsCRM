import React from 'react';
import { formatDateTime } from '../../app/format';

const EMPTY_VALUE = '-';

export type OrganizationLicenseStatusTone = 'ok' | 'warn' | 'danger' | 'muted';

export interface OrganizationLicenseStatusView {
  tone: OrganizationLicenseStatusTone;
  label: string;
  hint: string;
}

export interface OrganizationOneCDetailsData {
  oneCContactName?: string;
  oneCContactPhone?: string;
  oneCEmail?: string;
  oneCAccountingEnabled?: boolean;
  oneCSalaryEnabled?: boolean;
  oneCHousingEnabled?: boolean;
  oneCLeadAccountingName?: string;
  oneCLeadSalaryName?: string;
  oneCBaseContract?: boolean;
  oneCRegNumberAccounting?: string;
  oneCRegNumberSalary?: string;
  oneCPlatformAccounting?: string;
  oneCPlatformSalary?: string;
  oneCConfigurationAccounting?: string;
  oneCConfigurationSalary?: string;
  oneCContractVariant?: string;
  oneCItsVariant?: string;
  oneCItsLicenseNumber?: string;
  oneCItsDateFromUtc?: string;
  oneCItsDateToUtc?: string;
  oneCItsCompleted?: boolean;
  oneCItsAmount?: number | null;
  oneCItsAmountComment?: string;
  oneCComment?: string;
  oneCSalaryComment?: string;
  oneCAccountingChanges?: string;
  oneCSalaryChanges?: string;
  oneCItsComment?: string;
  oneCItsComposition?: string;
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

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value ?? 0);
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

export function OrganizationOneCDetails({
  details,
  licenseStatus
}: {
  details?: OrganizationOneCDetailsData | null;
  licenseStatus: OrganizationLicenseStatusView;
}) {
  return (
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
          <span className={`organization-status-pill organization-status-pill--${licenseStatus.tone}`}>{licenseStatus.label}</span>
          <span className="field-hint">{licenseStatus.hint}</span>
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
  );
}

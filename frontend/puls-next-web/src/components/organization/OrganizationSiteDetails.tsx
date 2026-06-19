import React from 'react';
import { formatDateTime } from '../../app/format';
import type { OrganizationLicenseStatusView } from './OrganizationOneCDetails';

const EMPTY_VALUE = '-';

export interface OrganizationSiteDetailsData {
  site?: string;
  siteAlias?: string;
  siteContactName?: string;
  siteContactPhone?: string;
  siteEmail?: string;
  siteState?: string;
  siteOnSupport?: boolean;
  siteTemplate?: string;
  siteBaseId?: number;
  siteReadyAtUtc?: string;
  siteLicenseDateFromUtc?: string;
  siteLicenseDateToUtc?: string;
  siteLicenseCompleted?: boolean;
  siteComment?: string;
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

export function OrganizationSiteDetails({
  details,
  licenseStatus
}: {
  details?: OrganizationSiteDetailsData | null;
  licenseStatus: OrganizationLicenseStatusView;
}) {
  return (
    <div className="panel-subsection">
      <h4>Сайт</h4>
      <div className="detail-grid" role="list" aria-label="Параметры сайта организации">
        <div className="detail-card" role="listitem">
          <strong>Сайт</strong>
          <span>{renderLink(details?.site)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Alias</strong>
          <span>{textValue(details?.siteAlias)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Контакт</strong>
          <span>{textValue(details?.siteContactName)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Телефон</strong>
          <span>{renderPhone(details?.siteContactPhone)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Email</strong>
          <span>{renderMail(details?.siteEmail)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Состояние</strong>
          <span>{textValue(details?.siteState)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>На сопровождении</strong>
          <span>{boolLabel(details?.siteOnSupport)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Шаблон</strong>
          <span>{textValue(details?.siteTemplate)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>ID Base</strong>
          <span>{textValue(details?.siteBaseId)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Создание</strong>
          <span>{formatDateTime(details?.siteReadyAtUtc) || EMPTY_VALUE}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Лицензия с</strong>
          <span>{formatDateTime(details?.siteLicenseDateFromUtc) || EMPTY_VALUE}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Лицензия по</strong>
          <span>{formatDateTime(details?.siteLicenseDateToUtc) || EMPTY_VALUE}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Лицензия завершена</strong>
          <span>{boolLabel(details?.siteLicenseCompleted)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Статус домена</strong>
          <span className={`organization-status-pill organization-status-pill--${licenseStatus.tone}`}>{licenseStatus.label}</span>
          <span className="field-hint">{licenseStatus.hint}</span>
        </div>
      </div>
      <div className="detail-list" role="list" aria-label="Комментарии по сайту организации">
        <div role="listitem">
          <strong>Комментарий по сайту</strong>
          <div className="field-hint">{textValue(details?.siteComment)}</div>
        </div>
      </div>
    </div>
  );
}

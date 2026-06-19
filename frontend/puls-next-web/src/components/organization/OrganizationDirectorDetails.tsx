import React from 'react';

const EMPTY_VALUE = '-';

export interface OrganizationDirectorDetailsData {
  directorFullName?: string;
  directorShortName?: string;
  directorGenitiveName?: string;
  directorPosition?: string;
  directorPositionGenitive?: string;
  authorityDocument?: string;
  directorPhone?: string;
  directorEmail?: string;
  directorSnils?: string;
}

function textValue(value?: string | number | null) {
  if (typeof value === 'number') {
    return String(value);
  }

  return value?.toString().trim() || EMPTY_VALUE;
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

export function OrganizationDirectorDetails({ details }: { details?: OrganizationDirectorDetailsData | null }) {
  return (
    <div className="panel-subsection">
      <div className="section-header-inline">
        <h4>Руководитель и служебные реквизиты</h4>
        <span className="field-hint">Данные из legacy-карточки организации</span>
      </div>
      <div className="detail-grid" role="list" aria-label="Реквизиты руководителя организации">
        <div className="detail-card" role="listitem">
          <strong>Руководитель</strong>
          <span>{textValue(details?.directorFullName)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Кратко</strong>
          <span>{textValue(details?.directorShortName)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>ФИО в родительном</strong>
          <span>{textValue(details?.directorGenitiveName)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Должность</strong>
          <span>{textValue(details?.directorPosition)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Должность в родительном</strong>
          <span>{textValue(details?.directorPositionGenitive)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Основание</strong>
          <span>{textValue(details?.authorityDocument)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Телефон</strong>
          <span>{renderPhone(details?.directorPhone)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Email</strong>
          <span>{renderMail(details?.directorEmail)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>СНИЛС</strong>
          <span>{textValue(details?.directorSnils)}</span>
        </div>
      </div>
    </div>
  );
}

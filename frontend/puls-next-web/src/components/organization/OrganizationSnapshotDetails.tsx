import React from 'react';
import type { OrganizationOneCSnapshotDto } from '../../app/types';

const EMPTY_VALUE = '-';

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

function hasSnapshotData(snapshot: OrganizationOneCSnapshotDto | undefined) {
  if (!snapshot) {
    return false;
  }

  return Boolean(
    snapshot.code ||
      snapshot.raion ||
      snapshot.name ||
      snapshot.fullName ||
      snapshot.inn ||
      snapshot.phone ||
      snapshot.otherInfo ||
      snapshot.comment ||
      snapshot.addressLegal ||
      snapshot.addressActual
  );
}

export function OrganizationSnapshotDetails({ snapshot }: { snapshot?: OrganizationOneCSnapshotDto }) {
  if (!hasSnapshotData(snapshot)) {
    return <div className="empty-state organization-record-inline-empty" role="status">В выбранном снимке нет данных.</div>;
  }

  return (
    <div className="detail-grid" role="list" aria-label="Поля снимка 1С организации">
      <div className="detail-card" role="listitem">
        <strong>Код</strong>
        <span>{textValue(snapshot?.code)}</span>
      </div>
      <div className="detail-card" role="listitem">
        <strong>Район</strong>
        <span>{textValue(snapshot?.raion)}</span>
      </div>
      <div className="detail-card" role="listitem">
        <strong>ИНН</strong>
        <span>{textValue(snapshot?.inn)}</span>
      </div>
      <div className="detail-card detail-card-wide" role="listitem">
        <strong>Наименование</strong>
        <span>{textValue(snapshot?.name)}</span>
      </div>
      <div className="detail-card detail-card-wide" role="listitem">
        <strong>Полное наименование</strong>
        <span>{textValue(snapshot?.fullName)}</span>
      </div>
      <div className="detail-card" role="listitem">
        <strong>Телефон</strong>
        <span>{renderPhone(snapshot?.phone)}</span>
      </div>
      <div className="detail-card detail-card-wide" role="listitem">
        <strong>Другая информация</strong>
        <span>{textValue(snapshot?.otherInfo)}</span>
      </div>
      <div className="detail-card detail-card-wide" role="listitem">
        <strong>Комментарий</strong>
        <span>{textValue(snapshot?.comment)}</span>
      </div>
      <div className="detail-card detail-card-wide" role="listitem">
        <strong>Юридический адрес</strong>
        <span>{textValue(snapshot?.addressLegal)}</span>
      </div>
      <div className="detail-card detail-card-wide" role="listitem">
        <strong>Фактический адрес</strong>
        <span>{textValue(snapshot?.addressActual)}</span>
      </div>
    </div>
  );
}

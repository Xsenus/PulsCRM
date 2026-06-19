import React from 'react';
import { formatDateTime } from '../../app/format';
import type { OrganizationDetailsDto } from '../../app/types';

const EMPTY_VALUE = '-';

function formatCount(value?: number | null) {
  return new Intl.NumberFormat('ru-RU').format(value ?? 0);
}

function formatAuditValue(date?: string, author?: string) {
  const value = [formatDateTime(date), author].filter(Boolean).join(' • ');
  return value || EMPTY_VALUE;
}

export function OrganizationAuditSummary({
  details,
  emailCount
}: {
  details: OrganizationDetailsDto | null;
  emailCount: number;
}) {
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

      <div className="detail-grid" role="list" aria-label="Счетчики связанных данных организации">
        <div className="detail-card" role="listitem">
          <strong>Email-адресов</strong>
          <span>{formatCount(emailCount)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Контактов</strong>
          <span>{formatCount(details?.contacts.length ?? 0)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Событий</strong>
          <span>{formatCount(details?.events.length ?? 0)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Договоров</strong>
          <span>{formatCount(details?.contracts.length ?? 0)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Документов</strong>
          <span>{formatCount(details?.attachments.length ?? 0)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Реализаций</strong>
          <span>{formatCount(details?.realizations.length ?? 0)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Программных блоков</strong>
          <span>{formatCount(details?.programInfos.length ?? 0)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Лицензий Парус</strong>
          <span>{formatCount(details?.parusLicenses.length ?? 0)}</span>
        </div>
        <div className="detail-card" role="listitem">
          <strong>Заказов Парус</strong>
          <span>{formatCount(details?.parusOrders.length ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}

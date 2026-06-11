import React from 'react';
import { formatDateTime } from '../../app/format';
import type { OrganizationDetailsDto, OrganizationUpsertRequest } from '../../app/types';

const EMPTY_VALUE = '-';

type OrganizationRelationTab = 'contacts' | 'documents' | 'contracts' | 'realizations' | 'licenses' | 'orders';
type OrganizationHistoryTab = 'events' | 'snapshots' | 'audit';

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

function shortText(value?: string | null, maxLength = 92) {
  const normalized = value?.trim();
  if (!normalized) {
    return '';
  }

  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

export function OrganizationSidebar({
  details,
  draft,
  emailChips,
  onOpenRelations,
  onOpenHistory
}: {
  details: OrganizationDetailsDto | null;
  draft: OrganizationUpsertRequest;
  emailChips: string[];
  onOpenRelations: (tab: OrganizationRelationTab) => void;
  onOpenHistory: (tab: OrganizationHistoryTab) => void;
}) {
  return (
    <aside className="panel organization-record-sidebar">
      <div className="panel-subsection organization-sidebar-section">
        <div className="section-header-inline">
          <h4>Паспорт организации</h4>
          {details?.updatedAtUtc ? <span className="field-hint">{formatDateOnly(details.updatedAtUtc)}</span> : null}
        </div>
        <div className="detail-grid organization-sidebar-facts">
          <div className="detail-card">
            <strong>ИНН / КПП</strong>
            <span>{[draft.inn || details?.inn, draft.kpp || details?.kpp].filter(Boolean).join(' / ') || EMPTY_VALUE}</span>
          </div>
          <div className="detail-card">
            <strong>ОГРН</strong>
            <span>{draft.ogrn || details?.ogrn || EMPTY_VALUE}</span>
          </div>
          <div className="detail-card">
            <strong>Телефон</strong>
            <span>{renderPhone(draft.phone || details?.phone)}</span>
          </div>
          <div className="detail-card">
            <strong>Сайт</strong>
            <span>{renderLink(draft.site || details?.site)}</span>
          </div>
        </div>
      </div>

      <div className="panel-subsection organization-sidebar-section">
        <h4>Статус и сопровождение</h4>
        <div className="detail-list">
          <div>
            <strong>Последнее изменение</strong>
            <div className="field-hint">{formatAuditValue(details?.updatedAtUtc, details?.updatedByName)}</div>
          </div>
          <div>
            <strong>Юридический адрес</strong>
            <div className="field-hint">{draft.addressLegal || details?.addressLegal || EMPTY_VALUE}</div>
          </div>
          <div>
            <strong>Фактический адрес</strong>
            <div className="field-hint">{draft.addressActual || details?.addressActual || EMPTY_VALUE}</div>
          </div>
          <div>
            <strong>Интернет / ЭДО</strong>
            <div className="field-hint">
              {[details?.internetSpeed, details?.edo].filter(Boolean).join(' • ') || 'Не заполнено'}
            </div>
          </div>
        </div>
      </div>

      <div className="panel-subsection organization-sidebar-section">
        <h4>Финансовый контур</h4>
        <div className="detail-grid organization-sidebar-metrics">
          <div className="detail-card">
            <strong>Текущий долг</strong>
            <span>{formatMoney(details?.debtAmount)}</span>
          </div>
          <div className="detail-card">
            <strong>Актуальный долг</strong>
            <span>{formatMoney(details?.debtActualAmount)}</span>
          </div>
          <div className="detail-card">
            <strong>Долг -6</strong>
            <span>{formatMoney(details?.debtMinus6Amount)}</span>
          </div>
          <div className="detail-card">
            <strong>Открытые задачи</strong>
            <span>{formatCount(details?.openWorkItems ?? 0)}</span>
          </div>
        </div>
      </div>

      <div className="panel-subsection organization-sidebar-section">
        <h4>Быстрый доступ</h4>
        <div className="organization-sidebar-links">
          <button type="button" className="secondary-button button-inline" onClick={() => onOpenRelations('contacts')}>
            Контакты
          </button>
          <button type="button" className="secondary-button button-inline" onClick={() => onOpenRelations('documents')}>
            Документы
          </button>
          <button type="button" className="secondary-button button-inline" onClick={() => onOpenRelations('contracts')}>
            Договоры
          </button>
          <button type="button" className="secondary-button button-inline" onClick={() => onOpenHistory('events')}>
            События
          </button>
          <button type="button" className="secondary-button button-inline" onClick={() => onOpenHistory('snapshots')}>
            Снимки 1С
          </button>
        </div>
      </div>

      <div className="panel-subsection organization-sidebar-section">
        <div className="section-header-inline">
          <h4>Почтовые адреса</h4>
          <span className="field-hint">{emailChips.length}</span>
        </div>
        {emailChips.length ? (
          <div className="organization-email-list">
            {emailChips.map((email) => (
              <a key={email} href={`mailto:${email}`} className="organization-email-chip">{email}</a>
            ))}
          </div>
        ) : (
          <div className="field-hint">Почтовые адреса еще не заполнены.</div>
        )}
      </div>

      <div className="panel-subsection organization-sidebar-section">
        <div className="section-header-inline">
          <h4>Задачи организации</h4>
          <span className="field-hint">{details?.tasks.length ?? 0}</span>
        </div>
        {details?.tasks.length ? (
          <div className="organization-card-chip-row">
            {details.tasks.map((task) => (
              <span key={task.id} className="organization-chip">
                {task.fullName || task.name || `Задача #${task.id}`}
              </span>
            ))}
          </div>
        ) : (
          <div className="field-hint">Связанные задачи по организации не найдены.</div>
        )}
      </div>

      <div className="panel-subsection organization-sidebar-section">
        <h4>Контекст карточки</h4>
        <div className="detail-list">
          <div>
            <strong>Полное наименование</strong>
            <div className="field-hint">{draft.fullName || details?.fullName || EMPTY_VALUE}</div>
          </div>
          <div>
            <strong>Комментарий</strong>
            <div className="field-hint">{shortText(draft.comment || details?.comment, 180) || 'Не заполнен'}</div>
          </div>
          <div>
            <strong>Прочее</strong>
            <div className="field-hint">{shortText(draft.otherInfo || details?.otherInfo, 180) || 'Не заполнено'}</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

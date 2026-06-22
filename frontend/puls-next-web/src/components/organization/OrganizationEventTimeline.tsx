import React from 'react';
import { formatDateTime } from '../../app/format';
import type { OrganizationEventDto } from '../../app/types';

const EMPTY_VALUE = '-';

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

export function OrganizationEventTimeline({
  events
}: {
  events: OrganizationEventDto[];
}) {
  if (!events.length) {
    return <div className="empty-state organization-record-inline-empty" role="status">История событий по организации пока пуста.</div>;
  }

  return (
    <div className="organization-timeline" role="list" aria-label="История событий организации">
      {events.map((event, index) => {
        const title = event.name || event.taskName || event.categoryName || event.categoryFullName || `Событие #${event.id}`;
        const formattedEventDate = formatDateTime(event.eventDateUtc);
        const formattedCreatedDate = formatDateTime(event.createdAtUtc);
        const eventDate = formattedEventDate || formattedCreatedDate || EMPTY_VALUE;
        const eventDateSource = formattedEventDate ? event.eventDateUtc : formattedCreatedDate ? event.createdAtUtc : undefined;
        const meta = [
          event.userName,
          event.categoryName || event.categoryFullName,
          event.isInProcess ? 'в процессе' : undefined,
          event.isCompleted === undefined ? undefined : event.isCompleted ? 'завершено' : 'не завершено'
        ].filter(Boolean);
        const dateFrom = formatDateTime(event.dateFromUtc);
        const dateTo = formatDateTime(event.dateToUtc);
        const hasLicenseChips = Boolean(event.licenseKey || (event.licenseAmount !== undefined && event.licenseAmount !== null));
        return (
          <article key={event.id} className="organization-timeline-item" role="listitem">
            <div className="organization-timeline-marker" aria-hidden="true">
              <span className="organization-timeline-dot" />
              {index < events.length - 1 ? <span className="organization-timeline-stem" /> : null}
            </div>
            <div className="organization-timeline-card">
              <div className="organization-timeline-head">
                <div className="organization-timeline-head-main">
                  <strong>{title}</strong>
                  <span className="field-hint">
                    {eventDateSource ? <time dateTime={eventDateSource}>{eventDate}</time> : eventDate}
                  </span>
                </div>
                {hasLicenseChips ? (
                  <div className="organization-card-chip-row" role="list" aria-label={`Лицензионные признаки события: ${title}`}>
                    {event.licenseKey ? <span className="organization-chip" role="listitem">{event.licenseKey}</span> : null}
                    {event.licenseAmount !== undefined && event.licenseAmount !== null ? (
                      <span className="organization-chip" role="listitem">{formatMoney(event.licenseAmount)}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
              {meta.length ? <div className="organization-timeline-meta">{meta.join(' • ')}</div> : null}
              {dateFrom || dateTo ? (
                <div className="field-hint">
                  Период: {dateFrom ? <time dateTime={event.dateFromUtc}>{dateFrom}</time> : null}
                  {dateFrom && dateTo ? ' — ' : null}
                  {dateTo ? <time dateTime={event.dateToUtc}>{dateTo}</time> : null}
                </div>
              ) : null}
              {event.comment?.trim() ? <div className="organization-timeline-comment">{event.comment.trim()}</div> : null}
              {event.licenseAmountComment?.trim() ? (
                <div className="field-hint">Комментарий суммы: {event.licenseAmountComment.trim()}</div>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

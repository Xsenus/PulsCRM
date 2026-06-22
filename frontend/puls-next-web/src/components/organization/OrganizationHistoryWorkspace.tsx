import React, { useEffect, useState } from 'react';
import { formatDateTime } from '../../app/format';
import type { OrganizationDetailsDto, OrganizationEventDto } from '../../app/types';
import { DataTable } from '../DataTable';
import { OrganizationAuditSummary } from './OrganizationAuditSummary';
import { OrganizationEventTimeline } from './OrganizationEventTimeline';
import { OrganizationEventViewModeTabs, type OrganizationEventViewMode } from './OrganizationEventViewModeTabs';
import type { OrganizationHistoryTab } from './OrganizationHistoryTabs';
import { OrganizationSnapshotDetails } from './OrganizationSnapshotDetails';
import { OrganizationSnapshotTabs } from './OrganizationSnapshotTabs';

const EMPTY_VALUE = '-';

function formatCount(value?: number | null) {
  return new Intl.NumberFormat('ru-RU').format(value ?? 0);
}

function renderDateTime(value?: string | null) {
  const formatted = formatDateTime(value);
  return formatted ? <time dateTime={value ?? undefined}>{formatted}</time> : EMPTY_VALUE;
}

export function OrganizationHistoryWorkspace({
  activeTab,
  details,
  emailCount,
  eventsSettingsKey
}: {
  activeTab: OrganizationHistoryTab;
  details: OrganizationDetailsDto | null;
  emailCount: number;
  eventsSettingsKey: string;
}) {
  const [eventViewMode, setEventViewMode] = useState<OrganizationEventViewMode>('timeline');
  const [snapshotKey, setSnapshotKey] = useState('');

  useEffect(() => {
    setEventViewMode('timeline');
    setSnapshotKey('');
  }, [details?.id]);

  useEffect(() => {
    const firstSnapshot = details?.oneCSnapshots[0];
    if (!firstSnapshot) {
      setSnapshotKey('');
      return;
    }

    setSnapshotKey((current) => (current && details?.oneCSnapshots.some((item) => item.key === current) ? current : firstSnapshot.key));
  }, [details?.oneCSnapshots]);

  const activeSnapshot = details?.oneCSnapshots.find((item) => item.key === snapshotKey) ?? details?.oneCSnapshots[0];

  if (activeTab === 'events') {
    return (
      <div className="organization-tab-stack">
        <div className="organization-history-toolbar">
          <div className="section-header-inline">
            <h4>События организации</h4>
            <span className="field-hint">{formatCount(details?.events.length ?? 0)} записей</span>
          </div>
          <OrganizationEventViewModeTabs activeMode={eventViewMode} onChange={setEventViewMode} />
        </div>
        {eventViewMode === 'timeline' ? (
          <OrganizationEventTimeline events={details?.events ?? []} />
        ) : (
          <DataTable<OrganizationEventDto>
            rows={details?.events ?? []}
            getRowKey={(row) => row.id}
            settingsKey={eventsSettingsKey}
            emptyText="Событий пока нет"
            columns={[
              { key: 'eventDateUtc', title: 'Дата', width: 160, minWidth: 140, render: (row) => renderDateTime(row.eventDateUtc) },
              { key: 'userName', title: 'Сотрудник', width: 190, minWidth: 160, render: (row) => row.userName || EMPTY_VALUE },
              { key: 'categoryName', title: 'Категория', width: 170, minWidth: 140, render: (row) => row.categoryName || row.categoryFullName || EMPTY_VALUE },
              { key: 'taskName', title: 'Задача', width: 180, minWidth: 150, render: (row) => row.taskName || EMPTY_VALUE },
              { key: 'name', title: 'Наименование', width: 220, minWidth: 180, render: (row) => row.name || EMPTY_VALUE },
              { key: 'comment', title: 'Комментарий', width: 300, minWidth: 240, render: (row) => row.comment || EMPTY_VALUE },
              { key: 'dateFromUtc', title: 'Дата с', width: 160, minWidth: 140, render: (row) => renderDateTime(row.dateFromUtc) },
              { key: 'dateToUtc', title: 'Дата по', width: 160, minWidth: 140, render: (row) => renderDateTime(row.dateToUtc) },
              { key: 'isInProcess', title: 'В процессе', width: 120, minWidth: 110, render: (row) => (row.isInProcess ? 'Да' : 'Нет') },
              { key: 'isCompleted', title: 'Завершено', width: 120, minWidth: 110, render: (row) => row.isCompleted === undefined ? EMPTY_VALUE : row.isCompleted ? 'Да' : 'Нет' }
            ]}
          />
        )}
      </div>
    );
  }

  if (activeTab === 'snapshots') {
    return details?.oneCSnapshots.length ? (
      <div className="organization-tab-stack">
        <OrganizationSnapshotTabs
          snapshots={details.oneCSnapshots}
          activeKey={activeSnapshot?.key}
          onChange={setSnapshotKey}
        />

        <OrganizationSnapshotDetails snapshot={activeSnapshot} />
      </div>
    ) : (
      <div className="empty-state organization-record-inline-empty" role="status">Снимки 1С по организации не найдены.</div>
    );
  }

  return <OrganizationAuditSummary details={details} emailCount={emailCount} />;
}

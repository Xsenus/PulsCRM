import React, { useMemo, useState } from 'react';
import { buildProblemItems, filterDispatchItems, findLatestProblemItem, type DispatchStatusFilter } from '../app/campaignStats';
import { canRetryDispatchItem } from '../app/dispatchDiagnostics';
import { formatDateTime } from '../app/format';
import { dispatchStatusOptions, labelOf } from '../app/lookups';
import type { CampaignStatisticsDto, DispatchItemDto } from '../app/types';
import { LoadingButtonLabel } from './AppLoader';
import { DataTable } from './DataTable';
import { StatsCards } from './StatsCards';
import { StatusBadge, type StatusBadgeTone } from './StatusBadge';

interface CampaignStatsPanelProps {
  stats: CampaignStatisticsDto | null;
  loading?: boolean;
  onRefresh: () => Promise<void> | void;
  onRetryItem?: (itemId: number) => Promise<void> | void;
  batchesTableSettingsKey: string;
  itemsTableSettingsKey: string;
}

const dispatchStatusFilters: Array<{ id: DispatchStatusFilter; label: string }> = [
  { id: 'all', label: 'Все' },
  { id: 'queued', label: 'Очередь' },
  { id: 'processing', label: 'В работе' },
  { id: 'sent', label: 'Отправлено' },
  { id: 'failed', label: 'Ошибки' },
  { id: 'deferred', label: 'Отложено' }
];

function dispatchStatusTone(status: number): StatusBadgeTone {
  if (status === 2) {
    return 'success';
  }

  if (status === 3) {
    return 'danger';
  }

  if (status === 4) {
    return 'warning';
  }

  if (status === 1) {
    return 'info';
  }

  return 'neutral';
}

export function CampaignStatsPanel({ stats, loading = false, onRefresh, onRetryItem, batchesTableSettingsKey, itemsTableSettingsKey }: CampaignStatsPanelProps) {
  const [dispatchStatusFilter, setDispatchStatusFilter] = useState<DispatchStatusFilter>('all');
  const [retryingItemId, setRetryingItemId] = useState<number | null>(null);
  const filteredRecentItems = useMemo(
    () => stats ? filterDispatchItems(stats.recentItems, dispatchStatusFilter) : [],
    [dispatchStatusFilter, stats]
  );
  const latestProblemItem = useMemo(
    () => stats ? findLatestProblemItem(stats.failedItems, stats.deferredItems) : null,
    [stats]
  );
  const problemItems = useMemo(
    () => stats ? buildProblemItems(stats.failedItems, stats.deferredItems, 8) : [],
    [stats]
  );

  const retryProblemItem = async (item: DispatchItemDto) => {
    if (!onRetryItem || !canRetryDispatchItem(item)) {
      return;
    }

    setRetryingItemId(item.id);
    try {
      await onRetryItem(item.id);
    } finally {
      setRetryingItemId((current) => current === item.id ? null : current);
    }
  };

  if (!stats) {
    return (
      <section className="panel">
        <div className="empty-state">Статистика появится после сохранения и запуска кампании.</div>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-header-inline">
        <div>
          <h3>Статистика</h3>
          <div className="field-hint">
            {latestProblemItem?.errorMessage || latestProblemItem?.smtpResponse || 'Очередь без последних критичных сообщений.'}
          </div>
        </div>
        <button type="button" className="secondary-button button-inline" disabled={loading} onClick={() => void onRefresh()}>
          {loading ? <LoadingButtonLabel label="Обновляем" /> : 'Обновить'}
        </button>
      </div>

      <StatsCards
        items={[
          { label: 'Всего записей', value: stats.totalItems },
          { label: 'В очереди', value: stats.queued },
          { label: 'В обработке', value: stats.processing },
          { label: 'Отправлено', value: stats.sent },
          { label: 'Ошибок', value: stats.failed },
          { label: 'Отложено', value: stats.deferred }
        ]}
      />

      {problemItems.length > 0 ? (
        <div className="campaign-problem-list">
          {problemItems.map((item) => (
            <div key={item.id} className="campaign-problem-item">
              <div>
                <strong>{item.recipientEmail || 'Получатель не указан'}</strong>
                <span>{item.errorMessage || item.smtpResponse || 'Сообщение ожидает повторной обработки.'}</span>
              </div>
              <div className="campaign-problem-actions">
                <StatusBadge tone={dispatchStatusTone(item.status)}>
                  {labelOf(dispatchStatusOptions, item.status)}
                </StatusBadge>
                {onRetryItem && canRetryDispatchItem(item) ? (
                  <button
                    type="button"
                    className="secondary-button button-inline"
                    disabled={loading || retryingItemId === item.id}
                    onClick={() => void retryProblemItem(item)}
                  >
                    {retryingItemId === item.id ? <LoadingButtonLabel label="Возвращаем" /> : 'Повторить'}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="split-layout">
        <div className="panel-subsection">
          <h4>Последние пакеты</h4>
          <DataTable
            rows={stats.recentBatches}
            getRowKey={(row) => row.id}
            settingsKey={batchesTableSettingsKey}
            emptyText="Нет пакетов"
            columns={[
              { key: 'id', title: '#', width: 80, minWidth: 70, isPrimary: true, priority: 1, render: (row) => `Пакет #${row.id}` },
              { key: 'createdAtUtc', title: 'Создан', width: 170, minWidth: 150, priority: 2, render: (row) => formatDateTime(row.createdAtUtc) || '—' },
              { key: 'scheduledAtUtc', title: 'Запланирован', width: 170, minWidth: 150, priority: 3, render: (row) => formatDateTime(row.scheduledAtUtc) || '—' },
              { key: 'totalRecipients', title: 'Всего', width: 100, minWidth: 90, priority: 4, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.totalRecipients },
              { key: 'sentCount', title: 'Отправлено', width: 120, minWidth: 100, priority: 5, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.sentCount },
              { key: 'failedCount', title: 'Ошибок', width: 110, minWidth: 100, priority: 6, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.failedCount },
              { key: 'processingCount', title: 'В обработке', width: 130, minWidth: 110, priority: 7, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.processingCount }
            ]}
          />
        </div>

        <div className="panel-subsection">
          <div className="section-header-inline">
            <h4>Последние сообщения</h4>
            <div className="settings-tabs campaign-dispatch-filters" role="tablist" aria-label="Фильтр сообщений очереди">
              {dispatchStatusFilters.map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  className={`settings-tab${dispatchStatusFilter === filter.id ? ' active' : ''}`}
                  role="tab"
                  aria-selected={dispatchStatusFilter === filter.id}
                  onClick={() => setDispatchStatusFilter(filter.id)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
          <DataTable
            rows={filteredRecentItems}
            getRowKey={(row) => row.id}
            settingsKey={itemsTableSettingsKey}
            emptyText="Нет сообщений"
            columns={[
              { key: 'recipientEmail', title: 'Адрес', width: 240, minWidth: 200, isPrimary: true, priority: 1, render: (row) => row.recipientEmail || '—' },
              { key: 'legacyOrgName', title: 'Организация', width: 240, minWidth: 200, priority: 2, render: (row) => row.legacyOrgName || '—' },
              {
                key: 'status',
                title: 'Статус',
                width: 150,
                minWidth: 130,
                priority: 3,
                render: (row) => (
                  <StatusBadge tone={dispatchStatusTone(row.status)}>
                    {labelOf(dispatchStatusOptions, row.status)}
                  </StatusBadge>
                )
              },
              { key: 'attemptCount', title: 'Попыток', width: 100, minWidth: 90, priority: 4, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.attemptCount },
              { key: 'queuedAtUtc', title: 'Поставлено', width: 170, minWidth: 150, priority: 5, render: (row) => formatDateTime(row.queuedAtUtc) || '—' },
              { key: 'sentAtUtc', title: 'Отправлено', width: 170, minWidth: 150, priority: 6, render: (row) => formatDateTime(row.sentAtUtc) || '—' },
              { key: 'nextAttemptAtUtc', title: 'След. попытка', width: 170, minWidth: 150, priority: 7, render: (row) => formatDateTime(row.nextAttemptAtUtc) || '—' },
              { key: 'errorMessage', title: 'Ошибка', width: 280, minWidth: 220, priority: 8, render: (row) => row.errorMessage || '—' },
              { key: 'smtpResponse', title: 'SMTP ответ', width: 260, minWidth: 220, priority: 9, render: (row) => row.smtpResponse || row.messageId || '—' }
            ]}
          />
        </div>
      </div>
    </section>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  cancelDispatchItem,
  getDispatchBatches,
  getDispatchItems,
  retryDispatchItem
} from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { useAuth } from '../app/AuthContext';
import {
  buildDispatchBatchQuery,
  buildDispatchItemQuery,
  canCancelDispatchItem,
  canRetryDispatchItem,
  dispatchStatusOptions,
  getDispatchStatusLabel,
  getDispatchStatusTone
} from '../app/dispatchDiagnostics';
import { formatDateTime } from '../app/format';
import { loadStoredPageSize, PAGE_SIZE_OPTIONS } from '../app/table';
import { showToast } from '../app/toast';
import type { DispatchBatchDto, DispatchItemDto } from '../app/types';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { SearchPanel } from '../components/SearchPanel';
import { StatusBadge } from '../components/StatusBadge';

const EMPTY_VALUE = '—';
const DISPATCH_ITEMS_TABLE_STORAGE_ID = 'dispatch-items';
const DISPATCH_BATCHES_TABLE_STORAGE_ID = 'dispatch-batches';

type DispatchTab = 'items' | 'batches';

interface DispatchFilters {
  status?: number;
  campaignId?: number;
  batchId?: number;
  search: string;
}

function parseOptionalNumber(value: string) {
  if (!value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function formatNullableDate(value?: string) {
  return formatDateTime(value) || EMPTY_VALUE;
}

function itemProblemText(row: DispatchItemDto) {
  return row.errorMessage || row.smtpResponse || row.messageId || EMPTY_VALUE;
}

function itemDateText(row: DispatchItemDto) {
  return formatNullableDate(row.failedAtUtc || row.sentAtUtc || row.startedAtUtc || row.queuedAtUtc);
}

function batchProgress(row: DispatchBatchDto) {
  return `${row.sentCount}/${row.totalRecipients}`;
}

export function DispatchPage() {
  const { user } = useAuth();
  const currentUserId = String(user?.id ?? 'guest');
  const itemTableSettingsKey = `puls-table-settings:${DISPATCH_ITEMS_TABLE_STORAGE_ID}:${currentUserId}`;
  const batchTableSettingsKey = `puls-table-settings:${DISPATCH_BATCHES_TABLE_STORAGE_ID}:${currentUserId}`;
  const itemPageSizeStorageKey = `puls-page-size:${DISPATCH_ITEMS_TABLE_STORAGE_ID}:${currentUserId}`;
  const batchPageSizeStorageKey = `puls-page-size:${DISPATCH_BATCHES_TABLE_STORAGE_ID}:${currentUserId}`;

  const [tab, setTab] = useState<DispatchTab>('items');
  const [filters, setFilters] = useState<DispatchFilters>({ search: '' });
  const [appliedFilters, setAppliedFilters] = useState<DispatchFilters>({ search: '' });
  const [items, setItems] = useState<DispatchItemDto[]>([]);
  const [batches, setBatches] = useState<DispatchBatchDto[]>([]);
  const [itemsLoading, setItemsLoading] = useState(true);
  const [batchesLoading, setBatchesLoading] = useState(true);
  const [itemPage, setItemPage] = useState(1);
  const [batchPage, setBatchPage] = useState(1);
  const [itemPageSize, setItemPageSize] = useState(() => loadStoredPageSize(itemPageSizeStorageKey));
  const [batchPageSize, setBatchPageSize] = useState(() => loadStoredPageSize(batchPageSizeStorageKey));
  const [itemTotalCount, setItemTotalCount] = useState(0);
  const [batchTotalCount, setBatchTotalCount] = useState(0);
  const [cancelTarget, setCancelTarget] = useState<DispatchItemDto | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const summary = useMemo(() => ({
    queued: items.filter((item) => item.status === 0).length,
    processing: items.filter((item) => item.status === 1).length,
    failed: items.filter((item) => item.status === 3).length,
    deferred: items.filter((item) => item.status === 5).length
  }), [items]);

  const loadItems = async () => {
    setItemsLoading(true);
    try {
      const result = await getDispatchItems(buildDispatchItemQuery(
        appliedFilters,
        (itemPage - 1) * itemPageSize,
        itemPageSize
      ));
      setItems(result.items);
      setItemTotalCount(result.totalCount);
    } catch (error) {
      setItems([]);
      setItemTotalCount(0);
      throw error;
    } finally {
      setItemsLoading(false);
    }
  };

  const loadBatches = async () => {
    setBatchesLoading(true);
    try {
      const result = await getDispatchBatches(buildDispatchBatchQuery(
        { campaignId: appliedFilters.campaignId },
        (batchPage - 1) * batchPageSize,
        batchPageSize
      ));
      setBatches(result.items);
      setBatchTotalCount(result.totalCount);
    } catch (error) {
      setBatches([]);
      setBatchTotalCount(0);
      throw error;
    } finally {
      setBatchesLoading(false);
    }
  };

  const refresh = async () => {
    await Promise.all([loadItems(), loadBatches()]);
  };

  useEffect(() => {
    void loadItems().catch((error) => {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить сообщения очереди.'), 'error', 4000);
    });
  }, [appliedFilters, itemPage, itemPageSize]);

  useEffect(() => {
    void loadBatches().catch((error) => {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить партии отправки.'), 'error', 4000);
    });
  }, [appliedFilters.campaignId, batchPage, batchPageSize]);

  useEffect(() => {
    setItemPageSize(loadStoredPageSize(itemPageSizeStorageKey));
    setItemPage(1);
  }, [itemPageSizeStorageKey]);

  useEffect(() => {
    setBatchPageSize(loadStoredPageSize(batchPageSizeStorageKey));
    setBatchPage(1);
  }, [batchPageSizeStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(itemPageSizeStorageKey, String(itemPageSize));
  }, [itemPageSize, itemPageSizeStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(batchPageSizeStorageKey, String(batchPageSize));
  }, [batchPageSize, batchPageSizeStorageKey]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(itemTotalCount / itemPageSize));
    if (itemPage > totalPages) {
      setItemPage(totalPages);
    }
  }, [itemPage, itemPageSize, itemTotalCount]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(batchTotalCount / batchPageSize));
    if (batchPage > totalPages) {
      setBatchPage(totalPages);
    }
  }, [batchPage, batchPageSize, batchTotalCount]);

  const applySearchValue = (value: string) => {
    setAppliedFilters((current) => ({ ...current, search: value.trim() }));
    setItemPage(1);
  };

  const applyFilters = () => {
    setAppliedFilters({
      ...filters,
      search: filters.search.trim()
    });
    setItemPage(1);
    setBatchPage(1);
  };

  const resetFilters = () => {
    const nextFilters = { search: '' };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setItemPage(1);
    setBatchPage(1);
  };

  const retryItem = async (row: DispatchItemDto) => {
    setActionBusyId(row.id);
    try {
      await retryDispatchItem(row.id);
      showToast('Сообщение возвращено в очередь.', 'success');
      try {
        await refresh();
      } catch (error) {
        showToast(getApiErrorMessage(error, 'Сообщение возвращено в очередь, но список не обновился.'), 'error', 4000);
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось вернуть сообщение в очередь.'), 'error', 4000);
    } finally {
      setActionBusyId(null);
    }
  };

  const cancelItem = async () => {
    if (!cancelTarget) {
      return;
    }

    setCancelBusy(true);
    try {
      await cancelDispatchItem(cancelTarget.id);
      showToast('Сообщение отменено.', 'delete');
      setCancelTarget(null);
      try {
        await refresh();
      } catch (error) {
        showToast(getApiErrorMessage(error, 'Сообщение отменено, но список не обновился.'), 'error', 4000);
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось отменить сообщение.'), 'error', 4000);
    } finally {
      setCancelBusy(false);
    }
  };

  const renderItemActions = (row: DispatchItemDto) => (
    <RowActionsMenu
      actions={[
        {
          key: 'retry',
          label: 'Повторить',
          disabled: !canRetryDispatchItem(row) || actionBusyId === row.id,
          onClick: () => retryItem(row)
        },
        {
          key: 'cancel',
          label: 'Отменить',
          danger: true,
          disabled: !canCancelDispatchItem(row) || actionBusyId === row.id,
          onClick: () => setCancelTarget(row)
        }
      ]}
    />
  );

  return (
    <div className="page">
      <PageHeader
        title="Очередь рассылок"
        subtitle="Диагностика сообщений, партий отправки и повторных попыток без прямого доступа к SQL."
        actions={(
          <button
            type="button"
            className="secondary-button"
            onClick={() => void refresh().catch((error) => {
              showToast(getApiErrorMessage(error, 'Не удалось обновить очередь.'), 'error', 4000);
            })}
          >
            Обновить
          </button>
        )}
      />

      <div className="dispatch-summary-grid">
        <div className="metric-card">
          <div className="metric-label">В очереди на странице</div>
          <div className="metric-value">{summary.queued}</div>
        </div>
        <div className="metric-card">
          <div className="metric-label">В работе на странице</div>
          <div className="metric-value">{summary.processing}</div>
        </div>
        <div className="metric-card metric-card-danger">
          <div className="metric-label">Ошибки на странице</div>
          <div className="metric-value">{summary.failed}</div>
        </div>
        <div className="metric-card metric-card-warning">
          <div className="metric-label">Отложено на странице</div>
          <div className="metric-value">{summary.deferred}</div>
        </div>
      </div>

      <SearchPanel
        value={filters.search}
        placeholder="Email, организация, ошибка, SMTP-ответ"
        onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
        onSearch={() => applySearchValue(filters.search)}
        onClear={() => {
          setFilters((current) => ({ ...current, search: '' }));
          applySearchValue('');
        }}
        onDebouncedChange={applySearchValue}
        onRefresh={refresh}
        refreshSuccessMessage="Очередь обновлена."
        refreshErrorMessage="Не удалось обновить очередь."
      />

      <div className="panel toolbar-panel dispatch-filter-panel">
        <select
          className="form-select"
          value={filters.status ?? ''}
          onChange={(event) => setFilters((current) => ({
            ...current,
            status: event.target.value ? Number(event.target.value) : undefined
          }))}
        >
          <option value="">Все статусы</option>
          {dispatchStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <input
          className="form-input"
          inputMode="numeric"
          value={filters.campaignId ?? ''}
          placeholder="ID кампании"
          onChange={(event) => setFilters((current) => ({ ...current, campaignId: parseOptionalNumber(event.target.value) }))}
        />

        <input
          className="form-input"
          inputMode="numeric"
          value={filters.batchId ?? ''}
          placeholder="ID партии"
          onChange={(event) => setFilters((current) => ({ ...current, batchId: parseOptionalNumber(event.target.value) }))}
        />

        <button type="button" className="primary-button toolbar-button" onClick={applyFilters}>Применить</button>
        <button type="button" className="secondary-button toolbar-button" onClick={resetFilters}>Сбросить</button>
      </div>

      <div className="settings-tabs dispatch-tabs" role="tablist" aria-label="Раздел очереди">
        <button
          type="button"
          className={`settings-tab${tab === 'items' ? ' active' : ''}`}
          role="tab"
          aria-selected={tab === 'items'}
          onClick={() => setTab('items')}
        >
          Сообщения
        </button>
        <button
          type="button"
          className={`settings-tab${tab === 'batches' ? ' active' : ''}`}
          role="tab"
          aria-selected={tab === 'batches'}
          onClick={() => setTab('batches')}
        >
          Партии
        </button>
      </div>

      {tab === 'items' ? (
        <div className="panel">
          <DataTable
            rows={items}
            getRowKey={(row) => row.id}
            loading={itemsLoading}
            emptyText="Очередь сообщений пуста"
            settingsKey={itemTableSettingsKey}
            title="Сообщения очереди"
            mobileActions={(row) => <div className="dispatch-mobile-actions">{renderItemActions(row)}</div>}
            columns={[
              { key: 'id', title: 'ID', width: 90, minWidth: 80, priority: 1, render: (row) => row.id },
              {
                key: 'status',
                title: 'Статус',
                width: 140,
                minWidth: 120,
                priority: 2,
                render: (row) => (
                  <StatusBadge tone={getDispatchStatusTone(row.status)}>
                    {getDispatchStatusLabel(row.status)}
                  </StatusBadge>
                )
              },
              { key: 'recipientEmail', title: 'Получатель', width: 240, minWidth: 200, priority: 3, isPrimary: true, render: (row) => row.recipientEmail || EMPTY_VALUE },
              { key: 'legacyOrgName', title: 'Организация', width: 260, minWidth: 220, priority: 4, render: (row) => row.legacyOrgName || EMPTY_VALUE },
              { key: 'attemptCount', title: 'Попытки', width: 110, minWidth: 96, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.attemptCount },
              { key: 'eventDate', title: 'Последнее событие', width: 180, minWidth: 160, render: itemDateText },
              { key: 'nextAttemptAtUtc', title: 'Следующая попытка', width: 180, minWidth: 160, render: (row) => formatNullableDate(row.nextAttemptAtUtc) },
              { key: 'problem', title: 'Ошибка / SMTP', width: 300, minWidth: 220, render: (row) => <span className="dispatch-row-message">{itemProblemText(row)}</span> },
              { key: 'messageId', title: 'Message ID', width: 220, minWidth: 180, visible: false, render: (row) => row.messageId || EMPTY_VALUE },
              { key: 'legacyOrgId', title: 'ID организации', width: 130, minWidth: 110, visible: false, render: (row) => row.legacyOrgId || EMPTY_VALUE },
              {
                key: 'actions',
                title: 'Действия',
                width: 86,
                minWidth: 76,
                canHide: false,
                isActions: true,
                mobileVisible: false,
                headerClassName: 'organization-cell-right',
                className: 'organization-cell-right',
                render: renderItemActions
              }
            ]}
          />

          <Pagination
            page={itemPage}
            pageSize={itemPageSize}
            totalCount={itemTotalCount}
            onPageChange={setItemPage}
            onPageSizeChange={(value) => {
              setItemPageSize(value);
              setItemPage(1);
            }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </div>
      ) : (
        <div className="panel">
          <DataTable
            rows={batches}
            getRowKey={(row) => row.id}
            loading={batchesLoading}
            emptyText="Партий отправки пока нет"
            settingsKey={batchTableSettingsKey}
            title="Партии отправки"
            columns={[
              { key: 'id', title: 'ID', width: 90, minWidth: 80, priority: 1, isPrimary: true, render: (row) => row.id },
              { key: 'triggerKind', title: 'Источник', width: 140, minWidth: 120, priority: 2, render: (row) => row.triggerKind === 1 ? 'Вручную' : row.triggerKind === 2 ? 'Повтор' : 'Расписание' },
              { key: 'scheduledAtUtc', title: 'План', width: 180, minWidth: 160, render: (row) => formatNullableDate(row.scheduledAtUtc) },
              { key: 'createdAtUtc', title: 'Создана', width: 180, minWidth: 160, priority: 3, render: (row) => formatNullableDate(row.createdAtUtc) },
              { key: 'completedAtUtc', title: 'Завершена', width: 180, minWidth: 160, render: (row) => formatNullableDate(row.completedAtUtc) },
              { key: 'progress', title: 'Отправлено', width: 130, minWidth: 110, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: batchProgress },
              { key: 'queuedCount', title: 'Очередь', width: 110, minWidth: 96, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.queuedCount },
              { key: 'failedCount', title: 'Ошибки', width: 110, minWidth: 96, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.failedCount },
              { key: 'cancelledCount', title: 'Отменено', width: 120, minWidth: 100, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.cancelledCount },
              { key: 'correlationId', title: 'Correlation ID', width: 240, minWidth: 180, visible: false, render: (row) => row.correlationId || EMPTY_VALUE },
              { key: 'triggerComment', title: 'Комментарий', width: 260, minWidth: 200, visible: false, render: (row) => row.triggerComment || EMPTY_VALUE }
            ]}
          />

          <Pagination
            page={batchPage}
            pageSize={batchPageSize}
            totalCount={batchTotalCount}
            onPageChange={setBatchPage}
            onPageSizeChange={(value) => {
              setBatchPageSize(value);
              setBatchPage(1);
            }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
          />
        </div>
      )}

      <Modal
        open={!!cancelTarget}
        title="Отменить сообщение"
        onClose={() => !cancelBusy && setCancelTarget(null)}
        actions={(
          <>
            <button type="button" className="secondary-button" onClick={() => setCancelTarget(null)} disabled={cancelBusy}>
              Назад
            </button>
            <button type="button" className="primary-button danger-button" onClick={() => void cancelItem()} disabled={cancelBusy}>
              {cancelBusy ? 'Отмена...' : 'Отменить'}
            </button>
          </>
        )}
      >
        <div className="confirmation-copy">
          {cancelTarget
            ? `Отменить отправку письма для ${cancelTarget.recipientEmail || 'получателя без email'}?`
            : 'Сообщение не выбрано.'}
        </div>
      </Modal>
    </div>
  );
}

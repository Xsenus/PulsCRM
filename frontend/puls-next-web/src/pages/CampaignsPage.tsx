import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeCampaignStatus, deleteCampaign, getCampaigns, runCampaign } from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { useAuth } from '../app/AuthContext';
import { formatDateTime } from '../app/format';
import { campaignStatusOptions, labelOf, scheduleKindOptions } from '../app/lookups';
import { loadStoredPageSize, PAGE_SIZE_OPTIONS } from '../app/table';
import { showToast } from '../app/toast';
import type { CampaignListItemDto } from '../app/types';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { SearchPanel } from '../components/SearchPanel';
import { StatusBadge, type StatusBadgeTone } from '../components/StatusBadge';

const EMPTY_VALUE = '—';
const CAMPAIGNS_TABLE_STORAGE_ID = 'campaigns-list';
const campaignStatusQuickFilters: Array<{ label: string; value?: number }> = [
  { label: 'Все' },
  ...campaignStatusOptions
];

function buildCampaignQuickStatusFilterAriaLabel(label: string, active: boolean) {
  return `${label}: ${active ? 'текущий фильтр' : 'применить фильтр'}`;
}

function campaignStatusTone(status: number): StatusBadgeTone {
  if (status === 1) {
    return 'success';
  }

  if (status === 2) {
    return 'warning';
  }

  if (status === 3 || status === 4) {
    return 'neutral';
  }

  return 'info';
}

function renderDateTime(value?: string | null) {
  const formatted = formatDateTime(value);
  return formatted ? <time dateTime={value ?? undefined}>{formatted}</time> : EMPTY_VALUE;
}

export function CampaignsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = String(user?.id ?? 'guest');
  const tableSettingsKey = `puls-table-settings:${CAMPAIGNS_TABLE_STORAGE_ID}:${currentUserId}`;
  const pageSizeStorageKey = `puls-page-size:${CAMPAIGNS_TABLE_STORAGE_ID}:${currentUserId}`;

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [status, setStatus] = useState<number | undefined>();
  const [appliedStatus, setAppliedStatus] = useState<number | undefined>();
  const [rows, setRows] = useState<CampaignListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => loadStoredPageSize(pageSizeStorageKey));
  const [totalCount, setTotalCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<CampaignListItemDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [actionBusyId, setActionBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getCampaigns(appliedSearch, appliedStatus, (page - 1) * pageSize, pageSize);
      setRows(result.items);
      setTotalCount(result.totalCount);
    } catch (error) {
      setRows([]);
      setTotalCount(0);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load().catch((error) => {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить список кампаний.'), 'error', 4000);
    });
  }, [appliedSearch, appliedStatus, page, pageSize]);

  useEffect(() => {
    setPageSize(loadStoredPageSize(pageSizeStorageKey));
    setPage(1);
  }, [pageSizeStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(pageSizeStorageKey, String(pageSize));
  }, [pageSize, pageSizeStorageKey]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, pageSize, totalCount]);

  const applySearchValue = (value: string) => {
    const nextSearch = value.trim();
    setAppliedSearch((current) => (current === nextSearch ? current : nextSearch));
    setPage((current) => (current === 1 ? current : 1));
  };

  const applySearch = () => {
    applySearchValue(search);
  };

  const applyFilters = () => {
    setAppliedSearch(search.trim());
    setAppliedStatus(status);
    setPage(1);
  };

  const applyStatusFilter = (nextStatus?: number) => {
    setStatus(nextStatus);
    setAppliedStatus(nextStatus);
    setPage(1);
  };

  const clearSearch = () => {
    setSearch('');
    applySearchValue('');
  };

  const handleRun = async (id: number) => {
    setActionBusyId(id);
    try {
      await runCampaign(id, {});
      showToast('Кампания поставлена в очередь', 'success');
      try {
        await load();
      } catch (error) {
        showToast(getApiErrorMessage(error, 'Кампания запущена, но список не обновился.'), 'error', 4000);
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось запустить кампанию.'), 'error', 4000);
    } finally {
      setActionBusyId(null);
    }
  };

  const handlePauseResume = async (row: CampaignListItemDto) => {
    setActionBusyId(row.id);
    try {
      const nextStatus = row.status === 1 ? 2 : 1;
      await changeCampaignStatus(row.id, { status: nextStatus });
      showToast(nextStatus === 1 ? 'Кампания активирована' : 'Кампания поставлена на паузу', 'success');
      try {
        await load();
      } catch (error) {
        showToast(getApiErrorMessage(error, 'Статус изменен, но список не обновился.'), 'error', 4000);
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось изменить статус кампании.'), 'error', 4000);
    } finally {
      setActionBusyId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteBusy(true);

    try {
      await deleteCampaign(deleteTarget.id);
      showToast('Кампания удалена', 'delete');
      setDeleteTarget(null);
      try {
        await load();
      } catch (error) {
        showToast(getApiErrorMessage(error, 'Кампания удалена, но список не обновился.'), 'error', 4000);
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось удалить кампанию.'), 'error', 4000);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Рассылки"
        actions={<button type="button" className="primary-button" aria-label="Создать новую кампанию рассылки" onClick={() => navigate('/campaigns/new')}>Новая кампания</button>}
      />

      <SearchPanel
        value={search}
        placeholder="Поиск по названию, теме или SMTP профилю"
        inputAriaLabel="Поиск рассылок по названию, теме или SMTP профилю"
        onChange={setSearch}
        onSearch={applySearch}
        onClear={clearSearch}
        onDebouncedChange={applySearchValue}
        onRefresh={load}
        refreshSuccessMessage="Список кампаний обновлен."
        refreshErrorMessage="Не удалось обновить список кампаний."
      />

      <div className="panel toolbar-panel campaigns-filter-panel">
        <div className="campaign-status-filter-strip" aria-label="Быстрый фильтр рассылок по статусу">
          {campaignStatusQuickFilters.map((option) => {
            const isActive = appliedStatus === option.value;

            return (
              <button
                key={option.value ?? 'all'}
                type="button"
                className={`campaign-status-filter-button${isActive ? ' active' : ''}`}
                onClick={() => applyStatusFilter(option.value)}
                aria-pressed={isActive}
                aria-label={buildCampaignQuickStatusFilterAriaLabel(option.label, isActive)}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        <div className="campaign-filter-select-group">
          <select
            className="form-select"
            aria-label="Фильтр рассылок по статусу"
            value={status ?? ''}
            onChange={(event) => setStatus(event.target.value ? Number(event.target.value) : undefined)}
          >
            <option value="">Статус</option>
            {campaignStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>

          <button type="button" className="primary-button toolbar-button" aria-label="Применить фильтр рассылок по статусу" onClick={applyFilters}>Применить</button>
        </div>
      </div>

      <div className="panel">
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          loading={loading}
          emptyText="Нет кампаний"
          settingsKey={tableSettingsKey}
          title="Список кампаний"
          columns={[
            { key: 'name', title: 'Название', width: 240, minWidth: 200, isPrimary: true, priority: 1, render: (row) => row.name },
            { key: 'subject', title: 'Тема', width: 260, minWidth: 220, priority: 2, render: (row) => row.subject || EMPTY_VALUE },
            {
              key: 'status',
              title: 'Статус',
              width: 140,
              minWidth: 120,
              priority: 3,
              render: (row) => (
                <StatusBadge tone={campaignStatusTone(row.status)}>
                  {labelOf(campaignStatusOptions, row.status)}
                </StatusBadge>
              )
            },
            { key: 'scheduleKind', title: 'Расписание', width: 160, minWidth: 140, priority: 4, render: (row) => labelOf(scheduleKindOptions, row.scheduleKind) },
            { key: 'transportProfileName', title: 'SMTP профиль', width: 220, minWidth: 180, priority: 5, render: (row) => row.transportProfileName || EMPTY_VALUE },
            { key: 'targets', title: 'Орг.', width: 100, minWidth: 90, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.targetOrganizationsCount },
            { key: 'attachments', title: 'Вложений', width: 120, minWidth: 100, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.attachmentsCount },
            { key: 'nextRunAtUtc', title: 'Следующий запуск', width: 180, minWidth: 160, render: (row) => renderDateTime(row.nextRunAtUtc) },
            { key: 'lastRunAtUtc', title: 'Последний запуск', width: 180, minWidth: 160, render: (row) => renderDateTime(row.lastRunAtUtc) },
            { key: 'createdAtUtc', title: 'Создано', width: 180, minWidth: 160, visible: false, render: (row) => renderDateTime(row.createdAtUtc) },
            { key: 'updatedAtUtc', title: 'Обновлено', width: 180, minWidth: 160, visible: false, render: (row) => renderDateTime(row.updatedAtUtc) },
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
              render: (row) => (
                <RowActionsMenu
                  actions={[
                    { key: 'open', label: 'Открыть', primary: true, onClick: () => navigate(`/campaigns/${row.id}`) },
                    { key: 'run', label: 'Запустить', disabled: actionBusyId === row.id, busy: actionBusyId === row.id, onClick: () => handleRun(row.id) },
                    { key: 'toggle', label: row.status === 1 ? 'Поставить на паузу' : 'Активировать', disabled: actionBusyId === row.id, busy: actionBusyId === row.id, onClick: () => handlePauseResume(row) },
                    { key: 'delete', label: 'Удалить', danger: true, onClick: () => setDeleteTarget(row) }
                  ]}
                />
              )
            }
          ]}
        />

        <Pagination
          page={page}
          pageSize={pageSize}
          totalCount={totalCount}
          onPageChange={setPage}
          onPageSizeChange={(value) => {
            setPageSize(value);
            setPage(1);
          }}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
        />
      </div>

      <Modal
        open={!!deleteTarget}
        title="Удалить кампанию"
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        actions={(
          <>
            <button
              type="button"
              className="secondary-button"
              aria-label={deleteTarget ? `Отменить удаление кампании ${deleteTarget.name}` : 'Отменить удаление кампании'}
              onClick={() => setDeleteTarget(null)}
              disabled={deleteBusy}
            >
              Отмена
            </button>
            <button
              type="button"
              className="primary-button danger-button"
              aria-label={deleteTarget ? `Удалить кампанию ${deleteTarget.name}` : 'Удалить кампанию'}
              onClick={() => void handleDelete()}
              disabled={deleteBusy}
            >
              {deleteBusy ? 'Удаление...' : 'Удалить'}
            </button>
          </>
        )}
      >
        <div className="confirmation-copy">
          {deleteTarget
            ? `Удалить кампанию «${deleteTarget.name}» вместе с очередью и историей отправок?`
            : 'Кампания не выбрана.'}
        </div>
      </Modal>
    </div>
  );
}

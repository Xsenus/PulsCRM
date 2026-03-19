import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeCampaignStatus, deleteCampaign, getCampaigns, runCampaign } from '../app/api';
import { useAuth } from '../app/AuthContext';
import { formatDateTime } from '../app/format';
import { campaignStatusOptions, labelOf, scheduleKindOptions } from '../app/lookups';
import { loadStoredPageSize, PAGE_SIZE_OPTIONS } from '../app/table';
import { showToast } from '../app/toast';
import type { CampaignListItemDto } from '../app/types';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { SearchPanel } from '../components/SearchPanel';

const EMPTY_VALUE = '—';
const CAMPAIGNS_TABLE_STORAGE_ID = 'campaigns-list';

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

  const load = async () => {
    setLoading(true);
    try {
      const result = await getCampaigns(appliedSearch, appliedStatus, (page - 1) * pageSize, pageSize);
      setRows(result.items);
      setTotalCount(result.totalCount);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
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

  const clearSearch = () => {
    setSearch('');
    applySearchValue('');
  };

  const handleRun = async (id: number) => {
    await runCampaign(id, {});
    showToast('Кампания поставлена в очередь', 'success');
    await load();
  };

  const handlePauseResume = async (row: CampaignListItemDto) => {
    const nextStatus = row.status === 1 ? 2 : 1;
    await changeCampaignStatus(row.id, { status: nextStatus });
    showToast(nextStatus === 1 ? 'Кампания активирована' : 'Кампания поставлена на паузу', 'success');
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить кампанию вместе с очередью и историей?')) {
      return;
    }

    await deleteCampaign(id);
    showToast('Кампания удалена', 'delete');
    await load();
  };

  return (
    <div className="page">
      <PageHeader
        title="Рассылки"
        actions={<button type="button" className="primary-button" onClick={() => navigate('/campaigns/new')}>Новая кампания</button>}
      />

      <SearchPanel
        value={search}
        placeholder="Поиск по названию, теме или SMTP профилю"
        onChange={setSearch}
        onSearch={applySearch}
        onClear={clearSearch}
        onDebouncedChange={applySearchValue}
        onRefresh={load}
        refreshSuccessMessage="Список кампаний обновлен."
      />

      <div className="panel toolbar-panel toolbar-panel-grid">
        <select className="form-select" value={status ?? ''} onChange={(event) => setStatus(event.target.value ? Number(event.target.value) : undefined)}>
          <option value="">Статус</option>
          {campaignStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <button type="button" className="primary-button toolbar-button" onClick={applyFilters}>Применить</button>
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
            { key: 'name', title: 'Название', width: 240, minWidth: 200, render: (row) => row.name },
            { key: 'subject', title: 'Тема', width: 260, minWidth: 220, render: (row) => row.subject || EMPTY_VALUE },
            { key: 'status', title: 'Статус', width: 140, minWidth: 120, render: (row) => labelOf(campaignStatusOptions, row.status) },
            { key: 'scheduleKind', title: 'Расписание', width: 160, minWidth: 140, render: (row) => labelOf(scheduleKindOptions, row.scheduleKind) },
            { key: 'transportProfileName', title: 'SMTP профиль', width: 220, minWidth: 180, render: (row) => row.transportProfileName || EMPTY_VALUE },
            { key: 'targets', title: 'Орг.', width: 100, minWidth: 90, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.targetOrganizationsCount },
            { key: 'attachments', title: 'Вложений', width: 120, minWidth: 100, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.attachmentsCount },
            { key: 'nextRunAtUtc', title: 'Следующий запуск', width: 180, minWidth: 160, render: (row) => formatDateTime(row.nextRunAtUtc) || EMPTY_VALUE },
            { key: 'lastRunAtUtc', title: 'Последний запуск', width: 180, minWidth: 160, render: (row) => formatDateTime(row.lastRunAtUtc) || EMPTY_VALUE },
            { key: 'createdAtUtc', title: 'Создано', width: 180, minWidth: 160, visible: false, render: (row) => formatDateTime(row.createdAtUtc) || EMPTY_VALUE },
            { key: 'updatedAtUtc', title: 'Обновлено', width: 180, minWidth: 160, visible: false, render: (row) => formatDateTime(row.updatedAtUtc) || EMPTY_VALUE },
            {
              key: 'actions',
              title: 'Действия',
              width: 360,
              minWidth: 320,
              canHide: false,
              render: (row) => (
                <div className="button-group">
                  <button type="button" className="secondary-button button-inline" onClick={(event) => { event.stopPropagation(); navigate(`/campaigns/${row.id}`); }}>Открыть</button>
                  <button type="button" className="secondary-button button-inline" onClick={(event) => { event.stopPropagation(); void handleRun(row.id); }}>Запустить</button>
                  <button type="button" className="secondary-button button-inline" onClick={(event) => { event.stopPropagation(); void handlePauseResume(row); }}>
                    {row.status === 1 ? 'Пауза' : 'Активировать'}
                  </button>
                  <button type="button" className="secondary-button button-inline danger-button" onClick={(event) => { event.stopPropagation(); void handleDelete(row.id); }}>Удалить</button>
                </div>
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
    </div>
  );
}

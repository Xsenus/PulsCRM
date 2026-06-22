import React, { useEffect, useState } from 'react';
import { getEmployees, getOrganizations, getWork } from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { useAuth } from '../app/AuthContext';
import { formatDateTime } from '../app/format';
import { loadStoredPageSize, PAGE_SIZE_OPTIONS } from '../app/table';
import { showToast } from '../app/toast';
import type { EmployeeListItemDto, OrganizationListItemDto, WorkItemDto } from '../app/types';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { SearchPanel } from '../components/SearchPanel';
import { StatusBadge } from '../components/StatusBadge';

const EMPTY_VALUE = '—';
const WORK_TABLE_STORAGE_ID = 'work-list';

function renderDateTime(value?: string | null) {
  const formatted = formatDateTime(value);
  return formatted ? <time dateTime={value ?? undefined}>{formatted}</time> : EMPTY_VALUE;
}

interface WorkFilters {
  search: string;
  orgId?: number;
  employeeId?: number;
  onlyOpen: boolean;
}

export function WorkPage() {
  const { user } = useAuth();
  const currentUserId = String(user?.id ?? 'guest');
  const tableSettingsKey = `puls-table-settings:${WORK_TABLE_STORAGE_ID}:${currentUserId}`;
  const pageSizeStorageKey = `puls-page-size:${WORK_TABLE_STORAGE_ID}:${currentUserId}`;

  const [filters, setFilters] = useState<WorkFilters>({
    search: '',
    orgId: undefined,
    employeeId: undefined,
    onlyOpen: true
  });
  const [appliedFilters, setAppliedFilters] = useState<WorkFilters>({
    search: '',
    orgId: undefined,
    employeeId: undefined,
    onlyOpen: true
  });
  const [rows, setRows] = useState<WorkItemDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItemDto[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => loadStoredPageSize(pageSizeStorageKey));
  const [totalCount, setTotalCount] = useState(0);

  const loadLookups = async () => {
    try {
      const [employeeResponse, organizationResponse] = await Promise.all([
        getEmployees('', 0, 500),
        getOrganizations({ take: 500 })
      ]);

      setEmployees(employeeResponse.items);
      setOrganizations(organizationResponse.items);
    } catch (error) {
      setEmployees([]);
      setOrganizations([]);
      throw error;
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const result = await getWork(
        appliedFilters.search,
        appliedFilters.orgId,
        appliedFilters.employeeId,
        appliedFilters.onlyOpen,
        (page - 1) * pageSize,
        pageSize
      );
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
    void loadLookups().catch((error) => {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить фильтры задач.'), 'error', 4000);
    });
  }, []);

  useEffect(() => {
    void load().catch((error) => {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить задачи.'), 'error', 4000);
    });
  }, [appliedFilters, page, pageSize]);

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
    setAppliedFilters((current) => (current.search === nextSearch ? current : { ...current, search: nextSearch }));
    setPage((current) => (current === 1 ? current : 1));
  };

  const applySearch = () => {
    applySearchValue(filters.search);
  };

  const applyFilters = () => {
    const nextFilters = {
      search: filters.search.trim(),
      orgId: filters.orgId,
      employeeId: filters.employeeId,
      onlyOpen: filters.onlyOpen
    };

    setAppliedFilters((current) => (
      current.search === nextFilters.search
      && current.orgId === nextFilters.orgId
      && current.employeeId === nextFilters.employeeId
      && current.onlyOpen === nextFilters.onlyOpen
        ? current
        : nextFilters
    ));
    setPage((current) => (current === 1 ? current : 1));
  };

  const clearSearch = () => {
    setFilters((current) => ({ ...current, search: '' }));
    applySearchValue('');
  };

  const resetFilters = () => {
    const nextFilters: WorkFilters = {
      search: '',
      orgId: undefined,
      employeeId: undefined,
      onlyOpen: true
    };

    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setPage(1);
  };

  return (
    <div className="page">
      <PageHeader
        title="Работа"
        subtitle="Данные по сущности set_Job: задачи, комментарии, сроки и ответственные"
      />

      <SearchPanel
        value={filters.search}
        placeholder="Поиск по сообщению, задаче, сотруднику, организации"
        inputAriaLabel="Поиск задач по сообщению, задаче, сотруднику или организации"
        onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
        onSearch={applySearch}
        onClear={clearSearch}
        onDebouncedChange={applySearchValue}
        onRefresh={load}
        refreshSuccessMessage="Список задач обновлен."
        refreshErrorMessage="Не удалось обновить список задач."
      />

      <div className="panel toolbar-panel toolbar-panel-grid">
        <select
          className="form-select"
          aria-label="Фильтр задач по организации"
          value={filters.orgId ?? ''}
          onChange={(event) => setFilters((current) => ({ ...current, orgId: event.target.value ? Number(event.target.value) : undefined }))}
        >
          <option value="">Организация</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>{organization.name}</option>
          ))}
        </select>

        <select
          className="form-select"
          aria-label="Фильтр задач по сотруднику"
          value={filters.employeeId ?? ''}
          onChange={(event) => setFilters((current) => ({ ...current, employeeId: event.target.value ? Number(event.target.value) : undefined }))}
        >
          <option value="">Сотрудник</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.fullName || employee.login}</option>
          ))}
        </select>

        <label className="checkbox-option">
          <input
            type="checkbox"
            checked={filters.onlyOpen}
            onChange={(event) => setFilters((current) => ({ ...current, onlyOpen: event.target.checked }))}
          />
          <span>Только открытые</span>
        </label>

        <button type="button" className="primary-button toolbar-button" onClick={applyFilters}>Применить</button>
        <button type="button" className="secondary-button toolbar-button" onClick={resetFilters}>Сбросить</button>
      </div>

      <div className="panel">
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          loading={loading}
          emptyText="Нет данных"
          settingsKey={tableSettingsKey}
          title="Список задач"
          columns={[
            { key: 'task', title: 'Задача', width: 260, minWidth: 220, isPrimary: true, priority: 1, render: (row) => row.task || row.message || EMPTY_VALUE },
            { key: 'orgName', title: 'Организация', width: 240, minWidth: 200, priority: 2, render: (row) => row.orgName || EMPTY_VALUE },
            { key: 'userFromName', title: 'От кого', width: 200, minWidth: 170, priority: 5, render: (row) => row.userFromName || EMPTY_VALUE },
            { key: 'userToName', title: 'Кому', width: 200, minWidth: 170, priority: 4, render: (row) => row.userToName || EMPTY_VALUE },
            { key: 'category', title: 'Категория', width: 170, minWidth: 140, priority: 6, render: (row) => row.category || EMPTY_VALUE },
            { key: 'message', title: 'Сообщение', width: 320, minWidth: 240, priority: 3, render: (row) => row.message || EMPTY_VALUE },
            { key: 'comment', title: 'Комментарий', width: 280, minWidth: 220, visible: false, render: (row) => row.comment || EMPTY_VALUE },
            { key: 'createdAtUtc', title: 'Создано', width: 180, minWidth: 160, priority: 8, render: (row) => renderDateTime(row.createdAtUtc) },
            { key: 'dateToUtc', title: 'Срок', width: 180, minWidth: 160, priority: 7, render: (row) => renderDateTime(row.dateToUtc) },
            { key: 'dateCompletedUtc', title: 'Завершено', width: 180, minWidth: 160, visible: false, render: (row) => renderDateTime(row.dateCompletedUtc) },
            {
              key: 'isCompleted',
              title: 'Статус',
              width: 130,
              minWidth: 110,
              priority: 9,
              render: (row) => (
                <StatusBadge tone={row.isCompleted ? 'success' : 'warning'}>
                  {row.isCompleted ? 'Завершено' : 'Открыто'}
                </StatusBadge>
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

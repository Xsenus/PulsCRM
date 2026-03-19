import React, { useEffect, useState } from 'react';
import { getEmployees, getOrganizations, getWork } from '../app/api';
import { useAuth } from '../app/AuthContext';
import { formatDateTime } from '../app/format';
import { loadStoredPageSize, PAGE_SIZE_OPTIONS } from '../app/table';
import type { EmployeeListItemDto, OrganizationListItemDto, WorkItemDto } from '../app/types';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { SearchPanel } from '../components/SearchPanel';

const EMPTY_VALUE = '—';
const WORK_TABLE_STORAGE_ID = 'work-list';

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
    const [employeeResponse, organizationResponse] = await Promise.all([
      getEmployees('', 0, 500),
      getOrganizations({ take: 500 })
    ]);

    setEmployees(employeeResponse.items);
    setOrganizations(organizationResponse.items);
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLookups();
  }, []);

  useEffect(() => {
    void load();
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

  return (
    <div className="page">
      <PageHeader
        title="Работа"
        subtitle="Данные по сущности set_Job: задачи, комментарии, сроки и ответственные"
      />

      <SearchPanel
        value={filters.search}
        placeholder="Поиск по сообщению, задаче, сотруднику, организации"
        onChange={(value) => setFilters((current) => ({ ...current, search: value }))}
        onSearch={applySearch}
        onClear={clearSearch}
        onDebouncedChange={applySearchValue}
        onRefresh={load}
        refreshSuccessMessage="Список задач обновлен."
      />

      <div className="panel toolbar-panel toolbar-panel-grid">
        <select
          className="form-select"
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
            { key: 'orgName', title: 'Организация', width: 240, minWidth: 200, render: (row) => row.orgName || EMPTY_VALUE },
            { key: 'userFromName', title: 'От кого', width: 200, minWidth: 170, render: (row) => row.userFromName || EMPTY_VALUE },
            { key: 'userToName', title: 'Кому', width: 200, minWidth: 170, render: (row) => row.userToName || EMPTY_VALUE },
            { key: 'category', title: 'Категория', width: 170, minWidth: 140, render: (row) => row.category || EMPTY_VALUE },
            { key: 'task', title: 'Задача', width: 260, minWidth: 220, render: (row) => row.task || EMPTY_VALUE },
            { key: 'message', title: 'Сообщение', width: 320, minWidth: 240, render: (row) => row.message || EMPTY_VALUE },
            { key: 'comment', title: 'Комментарий', width: 280, minWidth: 220, visible: false, render: (row) => row.comment || EMPTY_VALUE },
            { key: 'createdAtUtc', title: 'Создано', width: 180, minWidth: 160, render: (row) => formatDateTime(row.createdAtUtc) || EMPTY_VALUE },
            { key: 'dateToUtc', title: 'Срок', width: 180, minWidth: 160, render: (row) => formatDateTime(row.dateToUtc) || EMPTY_VALUE },
            { key: 'dateCompletedUtc', title: 'Завершено', width: 180, minWidth: 160, visible: false, render: (row) => formatDateTime(row.dateCompletedUtc) || EMPTY_VALUE },
            { key: 'isCompleted', title: 'Готово', width: 110, minWidth: 90, render: (row) => (row.isCompleted ? 'Да' : 'Нет') }
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

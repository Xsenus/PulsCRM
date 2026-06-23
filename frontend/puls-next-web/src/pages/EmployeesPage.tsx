import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteEmployee, getEmployees } from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { useAuth } from '../app/AuthContext';
import { formatDate } from '../app/format';
import { loadStoredPageSize, PAGE_SIZE_OPTIONS } from '../app/table';
import { showToast } from '../app/toast';
import type { EmployeeListItemDto } from '../app/types';
import { DataTable, type DataTableColumn } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { SearchPanel } from '../components/SearchPanel';

const EMPTY_VALUE = '—';
const EMPLOYEES_TABLE_STORAGE_ID = 'employees-list';

interface RowContextMenuState {
  row: EmployeeListItemDto;
  x: number;
  y: number;
}

function formatBoolean(value: boolean) {
  return value ? 'Да' : 'Нет';
}

function formatGender(value: boolean) {
  return value ? 'Мужчина' : 'Женщина';
}

const employeeColumns: Array<DataTableColumn<EmployeeListItemDto>> = [
  { key: 'id', title: 'ID', width: 96, minWidth: 80, visible: false, render: (row) => row.id },
  { key: 'login', title: 'Логин', width: 180, minWidth: 150, priority: 2, render: (row) => row.login },
  { key: 'fullName', title: 'ФИО', width: 260, minWidth: 220, isPrimary: true, priority: 1, render: (row) => row.fullName || EMPTY_VALUE },
  { key: 'userGroup', title: 'Группа', width: 180, minWidth: 150, render: (row) => row.userGroup || EMPTY_VALUE },
  { key: 'ruleName', title: 'Набор правил', width: 220, minWidth: 180, visible: false, render: (row) => row.ruleName || EMPTY_VALUE },
  { key: 'privacyGroupName', title: 'Приватность', width: 220, minWidth: 180, visible: false, render: (row) => row.privacyGroupName || EMPTY_VALUE },
  { key: 'position', title: 'Должность', width: 220, minWidth: 180, visible: false, render: (row) => row.position || EMPTY_VALUE },
  { key: 'email', title: 'Почта', width: 240, minWidth: 210, render: (row) => row.email || EMPTY_VALUE },
  { key: 'phone', title: 'Телефон', width: 180, minWidth: 150, render: (row) => row.phone || EMPTY_VALUE },
  { key: 'phoneWorkRedirect', title: 'Внутр. №', width: 130, minWidth: 110, visible: false, render: (row) => row.phoneWorkRedirect || EMPTY_VALUE },
  { key: 'site', title: 'Сайт', width: 220, minWidth: 180, visible: false, render: (row) => row.site || EMPTY_VALUE },
  { key: 'address', title: 'Адрес', width: 320, minWidth: 240, visible: false, render: (row) => row.address || EMPTY_VALUE },
  { key: 'icq', title: 'ICQ', width: 150, minWidth: 120, visible: false, render: (row) => row.icq || EMPTY_VALUE },
  { key: 'skype', title: 'Skype', width: 180, minWidth: 140, visible: false, render: (row) => row.skype || EMPTY_VALUE },
  { key: 's1cCode', title: 'Код 1С', width: 140, minWidth: 120, visible: false, render: (row) => row.s1cCode || EMPTY_VALUE },
  { key: 'birthDay', title: 'Дата рождения', width: 160, minWidth: 140, visible: false, render: (row) => formatDate(row.birthDay) || EMPTY_VALUE },
  { key: 'isMale', title: 'Пол', width: 140, minWidth: 120, visible: false, render: (row) => formatGender(row.isMale) },
  { key: 'isRoot', title: 'Администратор', width: 150, minWidth: 130, visible: false, render: (row) => formatBoolean(row.isRoot) },
  { key: 'isDismissed', title: 'Уволен', width: 120, minWidth: 100, visible: false, render: (row) => formatBoolean(row.isDismissed) },
  { key: 'comment', title: 'Комментарий', width: 320, minWidth: 240, visible: false, render: (row) => row.comment || EMPTY_VALUE }
];

export function EmployeesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = String(user?.id ?? 'guest');
  const tableSettingsKey = `puls-table-settings:${EMPLOYEES_TABLE_STORAGE_ID}:${currentUserId}`;
  const pageSizeStorageKey = `puls-page-size:${EMPLOYEES_TABLE_STORAGE_ID}:${currentUserId}`;

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [rows, setRows] = useState<EmployeeListItemDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => loadStoredPageSize(pageSizeStorageKey));
  const [totalCount, setTotalCount] = useState(0);
  const [selectedRowId, setSelectedRowId] = useState<number | undefined>();
  const [contextMenu, setContextMenu] = useState<RowContextMenuState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmployeeListItemDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getEmployees(appliedSearch, (page - 1) * pageSize, pageSize);
      setRows(result.items);
      setTotalCount(result.totalCount);

      if (result.items.every((item) => item.id !== selectedRowId)) {
        setSelectedRowId(result.items[0]?.id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load().catch((error) => {
      showToast(getApiErrorMessage(error), 'error');
    });
  }, [appliedSearch, page, pageSize]);

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

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const close = () => setContextMenu(null);

    window.addEventListener('click', close);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('keydown', close);

    return () => {
      window.removeEventListener('click', close);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('keydown', close);
    };
  }, [contextMenu]);

  const applySearchValue = (value: string) => {
    const nextSearch = value.trim();
    setAppliedSearch((current) => (current === nextSearch ? current : nextSearch));
    setPage((current) => (current === 1 ? current : 1));
  };

  const applySearch = () => {
    applySearchValue(search);
  };

  const clearSearch = () => {
    setSearch('');
    applySearchValue('');
  };

  const refreshEmployees = async () => {
    await load();
    showToast('Список сотрудников обновлен.', 'success');
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteBusy(true);

    try {
      await deleteEmployee(deleteTarget.id);
      showToast('Сотрудник удален.', 'delete');

      if (selectedRowId === deleteTarget.id) {
        setSelectedRowId(undefined);
      }

      setDeleteTarget(null);
      await load();
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="page">
      <PageHeader title="Сотрудники" />

      <SearchPanel
        value={search}
        placeholder="Поиск по логину, ФИО, email или телефону"
        inputAriaLabel="Поиск сотрудников по логину, ФИО, email или телефону"
        onChange={setSearch}
        onSearch={applySearch}
        onClear={clearSearch}
        onDebouncedChange={applySearchValue}
        onRefresh={load}
        refreshSuccessMessage="Список сотрудников обновлен."
        refreshErrorMessage="Не удалось обновить список сотрудников."
      />

      <div className="panel">
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          loading={loading}
          emptyText="Нет данных"
          settingsKey={tableSettingsKey}
          title="Список сотрудников"
          selectedRowKey={selectedRowId}
          actions={(
            <button
              type="button"
              className="primary-button button-inline"
              onClick={() => navigate('/employees/new')}
            >
              Добавить сотрудника
            </button>
          )}
          mobileActions={(row) => (
            <RowActionsMenu
              actions={[
                { key: 'edit', label: 'Редактировать', primary: true, onClick: () => navigate(`/employees/${row.id}/edit`) },
                {
                  key: 'refresh',
                  label: 'Обновить',
                  onClick: async () => {
                    try {
                      await refreshEmployees();
                    } catch (error) {
                      showToast(getApiErrorMessage(error), 'error');
                    }
                  }
                },
                { key: 'delete', label: 'Удалить', danger: true, onClick: () => setDeleteTarget(row) }
              ]}
            />
          )}
          onRowClick={(row) => setSelectedRowId(row.id)}
          onRowDoubleClick={(row) => navigate(`/employees/${row.id}/edit`)}
          onRowContextMenu={(row, event) => {
            setSelectedRowId(row.id);
            setContextMenu({
              row,
              x: Math.min(event.clientX, window.innerWidth - 240),
              y: Math.min(event.clientY, window.innerHeight - 220)
            });
          }}
          columns={employeeColumns}
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

      {contextMenu ? (
        <div
          className="row-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
          aria-label={`Действия сотрудника ${contextMenu.row.fullName || contextMenu.row.login || `#${contextMenu.row.id}`}`}
        >
          <button
            type="button"
            className="row-context-menu-item"
            aria-label="Создать нового сотрудника"
            onClick={() => {
              setContextMenu(null);
              navigate('/employees/new');
            }}
          >
            Добавить
          </button>
          <button
            type="button"
            className="row-context-menu-item"
            aria-label={`Редактировать сотрудника ${contextMenu.row.fullName || contextMenu.row.login || `#${contextMenu.row.id}`}`}
            onClick={() => {
              setContextMenu(null);
              setSelectedRowId(contextMenu.row.id);
              navigate(`/employees/${contextMenu.row.id}/edit`);
            }}
          >
            Редактировать
          </button>
          <div className="row-context-menu-divider" aria-hidden="true" />
          <button
            type="button"
            className="row-context-menu-item"
            aria-label={`Обновить список после проверки сотрудника ${contextMenu.row.fullName || contextMenu.row.login || `#${contextMenu.row.id}`}`}
            onClick={() => {
              setContextMenu(null);
              void refreshEmployees().catch((error) => {
                showToast(getApiErrorMessage(error), 'error');
              });
            }}
          >
            Обновить
          </button>
          <div className="row-context-menu-divider" aria-hidden="true" />
          <button
            type="button"
            className="row-context-menu-item danger"
            aria-label={`Удалить сотрудника ${contextMenu.row.fullName || contextMenu.row.login || `#${contextMenu.row.id}`}`}
            onClick={() => {
              setContextMenu(null);
              setSelectedRowId(contextMenu.row.id);
              setDeleteTarget(contextMenu.row);
            }}
          >
            Удалить
          </button>
        </div>
      ) : null}

      <Modal
        open={!!deleteTarget}
        title="Подтверждение удаления"
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        actions={(
          <>
            <button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Отмена
            </button>
            <button type="button" className="primary-button action-button danger-button" onClick={() => void handleDelete()} disabled={deleteBusy}>
              {deleteBusy ? 'Удаление...' : 'Удалить'}
            </button>
          </>
        )}
      >
        <div className="empty-state">
          {deleteTarget
            ? `Удалить сотрудника «${deleteTarget.fullName || deleteTarget.login}»?`
            : 'Сотрудник не выбран.'}
        </div>
      </Modal>
    </div>
  );
}

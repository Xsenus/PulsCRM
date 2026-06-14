import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  deleteOrganization,
  getOrganizationRaions,
  getOrganizations
} from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { useAuth } from '../app/AuthContext';
import { buildRaionSelectionSummary, getRaionSelectionId } from '../app/organizationFilters';
import { DEFAULT_PAGE_SIZE, loadStoredPageSize, PAGE_SIZE_OPTIONS } from '../app/table';
import { showToast } from '../app/toast';
import type {
  OrganizationListItemDto,
  OrganizationRaionDto
} from '../app/types';
import { ActionIcon } from '../components/ActionIcon';
import { Modal } from '../components/Modal';
import { OrganizationsTable } from '../components/OrganizationsTable';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { SearchPanel } from '../components/SearchPanel';

const DEFAULT_SIDEBAR_WIDTH = 360;
const MIN_SIDEBAR_WIDTH = 320;
const MAX_SIDEBAR_WIDTH = 520;
const ORGANIZATIONS_TABLE_STORAGE_ID = 'organizations-list';

interface RowContextMenuState {
  row: OrganizationListItemDto;
  x: number;
  y: number;
}

function clampSidebarWidth(value: number) {
  return Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, Math.round(value)));
}

function loadStoredSidebarWidth(storageKey: string) {
  if (typeof window === 'undefined') {
    return DEFAULT_SIDEBAR_WIDTH;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  const parsedValue = rawValue ? Number(rawValue) : NaN;

  return Number.isFinite(parsedValue) ? clampSidebarWidth(parsedValue) : DEFAULT_SIDEBAR_WIDTH;
}

export function OrganizationsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const currentUserId = String(user?.id ?? 'guest');
  const tableSettingsKey = `puls-organizations-table:${currentUserId}`;
  const pageSizeStorageKey = `puls-organizations-page-size:${ORGANIZATIONS_TABLE_STORAGE_ID}:${currentUserId}`;
  const legacyPageSizeStorageKey = `puls-organizations-page-size:${currentUserId}`;
  const sidebarWidthStorageKey = `puls-organizations-sidebar-width:${currentUserId}`;

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedRaionIds, setSelectedRaionIds] = useState<number[]>([]);
  const [raionSearch, setRaionSearch] = useState('');
  const [rows, setRows] = useState<OrganizationListItemDto[]>([]);
  const [raions, setRaions] = useState<OrganizationRaionDto[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => loadStoredPageSize(pageSizeStorageKey, DEFAULT_PAGE_SIZE, legacyPageSizeStorageKey));
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<RowContextMenuState | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationListItemDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const selectedRaionIdsKey = useMemo(
    () => [...selectedRaionIds].sort((left, right) => left - right).join(','),
    [selectedRaionIds]
  );

  const filteredRaions = useMemo(() => {
    const term = raionSearch.trim().toLowerCase();
    if (!term) {
      return raions;
    }

    return raions.filter((raion) => raion.name.toLowerCase().includes(term));
  }, [raionSearch, raions]);

  const selectedRaionSummary = useMemo(() => {
    return buildRaionSelectionSummary(raions, selectedRaionIds);
  }, [raions, selectedRaionIds]);

  const activeFilterCount = useMemo(
    () => (appliedSearch ? 1 : 0) + selectedRaionIds.length,
    [appliedSearch, selectedRaionIds.length]
  );

  const loadData = async () => {
    setLoading(true);

    try {
      const [organizationsResponse, raionsResponse] = await Promise.all([
        getOrganizations({
          search: appliedSearch,
          raionIds: selectedRaionIds,
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        getOrganizationRaions(appliedSearch)
      ]);

      setRows(organizationsResponse.items);
      setTotalCount(organizationsResponse.totalCount);
      setRaions(raionsResponse);

      if (organizationsResponse.items.every((item) => item.id !== selectedRowId)) {
        setSelectedRowId(organizationsResponse.items[0]?.id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData().catch((error) => {
      showToast(getApiErrorMessage(error), 'error');
    });
  }, [appliedSearch, page, pageSize, selectedRaionIdsKey]);

  useEffect(() => {
    setPageSize(loadStoredPageSize(pageSizeStorageKey, DEFAULT_PAGE_SIZE, legacyPageSizeStorageKey));
    setPage(1);
  }, [legacyPageSizeStorageKey, pageSizeStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(pageSizeStorageKey, String(pageSize));
    window.localStorage.removeItem(legacyPageSizeStorageKey);
  }, [legacyPageSizeStorageKey, pageSize, pageSizeStorageKey]);

  useEffect(() => {
    setSidebarWidth(loadStoredSidebarWidth(sidebarWidthStorageKey));
  }, [sidebarWidthStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(sidebarWidthStorageKey, String(sidebarWidth));
  }, [sidebarWidth, sidebarWidthStorageKey]);

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

  const clearOrganizationFilters = () => {
    setSearch('');
    setAppliedSearch('');
    setRaionSearch('');
    setSelectedRaionIds([]);
    setPage(1);
  };

  const toggleRaion = (raionId: number) => {
    setSelectedRaionIds((current) => current.includes(raionId)
      ? current.filter((item) => item !== raionId)
      : [...current, raionId]);
    setPage(1);
  };

  const openCreateEditor = async () => {
    setContextMenu(null);
    navigate('/organizations/new');
  };

  const openEditEditor = async (row: OrganizationListItemDto) => {
    setContextMenu(null);
    setSelectedRowId(row.id);
    navigate(`/organizations/${row.id}/edit`);
  };

  const handleDelete = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteBusy(true);

    try {
      await deleteOrganization(deleteTarget.id);
      showToast('Организация удалена.', 'delete');

      if (selectedRowId === deleteTarget.id) {
        setSelectedRowId(undefined);
      }

      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    } finally {
      setDeleteBusy(false);
    }
  };

  const startSidebarResize = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    const startX = event.clientX;
    const initialWidth = sidebarWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      setSidebarWidth(clampSidebarWidth(initialWidth + delta));
    };

    const handleMouseUp = () => {
      document.body.classList.remove('is-resizing-layout');
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    document.body.classList.add('is-resizing-layout');
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const refreshOrganizations = async () => {
    await loadData();
    showToast('Список организаций обновлен.', 'success');
  };

  return (
    <div className="page">
      <PageHeader title="Организации" />

      <SearchPanel
        value={search}
        placeholder="Поиск по названию, ИНН, району или типу"
        onChange={setSearch}
        onSearch={applySearch}
        onClear={clearSearch}
        onDebouncedChange={applySearchValue}
        onRefresh={loadData}
        refreshSuccessMessage="Список организаций обновлен."
        refreshErrorMessage="Не удалось обновить список организаций."
        panelClassName="organization-search-panel"
        inputClassName="organization-search-input"
      />

      <div
        className="organizations-layout"
        style={{ ['--organizations-sidebar-width' as string]: `${sidebarWidth}px` }}
      >
        <aside className="panel organizations-sidebar">
          <div className="organizations-sidebar-head">
            <div>
              <div className="organizations-sidebar-title">Районы</div>
              <div className="field-hint">{selectedRaionSummary}</div>
            </div>

            <button
              type="button"
              className="secondary-button button-inline icon-button organizations-sidebar-clear-button"
              onClick={clearOrganizationFilters}
              aria-label="Очистить фильтры"
              title="Очистить фильтры"
            >
              <ActionIcon kind="clear" />
            </button>
          </div>

          <input
            className="form-input"
            value={raionSearch}
            placeholder="Поиск района"
            onChange={(event) => setRaionSearch(event.target.value)}
          />

          <div className="raion-list raion-checkbox-list">
            {filteredRaions.map((raion) => {
              const selectionId = getRaionSelectionId(raion);
              const checked = selectedRaionIds.includes(selectionId);

              return (
                <label
                  key={selectionId}
                  className={`raion-checkbox-card${checked ? ' checked' : ''}`}
                >
                  <div className="raion-checkbox-main">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleRaion(selectionId)}
                    />
                    <span>{raion.name}</span>
                  </div>
                  <strong>{raion.count}</strong>
                </label>
              );
            })}

            {filteredRaions.length === 0 ? (
              <div className="empty-state">Подходящих районов не найдено.</div>
            ) : null}
          </div>
        </aside>

        <div className="organizations-layout-resizer-shell">
          <button
            type="button"
            className="organizations-layout-resizer"
            onMouseDown={startSidebarResize}
            aria-label="Изменить ширину панели районов"
            title="Изменить ширину панели районов"
          >
            <span className="organizations-layout-resizer-grip" />
          </button>
        </div>

        <section className="panel organizations-main">
          <div className="organization-list-filter-summary">
            <div>
              <div className="organization-list-filter-title">Фильтры организаций</div>
              <div className="field-hint">
                {activeFilterCount > 0
                  ? `${selectedRaionSummary}${appliedSearch ? `; поиск: "${appliedSearch}"` : ''}`
                  : 'Показаны все организации'}
              </div>
            </div>

            <div className="organization-list-filter-actions">
              <span className="status-badge status-badge-info">Найдено: {totalCount}</span>
              <button
                type="button"
                className="secondary-button button-inline"
                onClick={clearOrganizationFilters}
                disabled={activeFilterCount === 0 && !search && !raionSearch}
              >
                Сбросить фильтры
              </button>
            </div>
          </div>

          <OrganizationsTable
            rows={rows}
            loading={loading}
            emptyText="Нет данных"
            selectedRowId={selectedRowId}
            settingsKey={tableSettingsKey}
            actions={(
              <button type="button" className="primary-button button-inline" onClick={() => void openCreateEditor()}>
                Новая организация
              </button>
            )}
            mobileActions={(row) => (
              <RowActionsMenu
                actions={[
                  { key: 'edit', label: 'Редактировать', onClick: () => void openEditEditor(row) },
                  { key: 'refresh', label: 'Обновить', onClick: () => refreshOrganizations() },
                  { key: 'delete', label: 'Удалить', danger: true, onClick: () => setDeleteTarget(row) }
                ]}
              />
            )}
            onRowClick={(row) => setSelectedRowId(row.id)}
            onRowDoubleClick={(row) => void openEditEditor(row)}
            onRowContextMenu={(row, event) => {
              setSelectedRowId(row.id);
              setContextMenu({
                row,
                x: Math.min(event.clientX, window.innerWidth - 240),
                y: Math.min(event.clientY, window.innerHeight - 180)
              });
            }}
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
        </section>
      </div>

      {contextMenu ? (
        <div
          className="row-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          role="menu"
        >
          <button type="button" className="row-context-menu-item" onClick={() => void openCreateEditor()}>
            Создать
          </button>
          <button type="button" className="row-context-menu-item" onClick={() => void openEditEditor(contextMenu.row)}>
            Редактировать
          </button>
          <div className="row-context-menu-divider" aria-hidden="true" />
          <button
            type="button"
            className="row-context-menu-item"
            onClick={() => {
              setContextMenu(null);
              void refreshOrganizations().catch((error) => {
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
            onClick={() => {
              setDeleteTarget(contextMenu.row);
              setContextMenu(null);
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
            ? `Удалить организацию «${deleteTarget.name || `#${deleteTarget.id}`}»?`
            : 'Организация не выбрана.'}
        </div>
      </Modal>

    </div>
  );
}

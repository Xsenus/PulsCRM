import React, { useEffect, useMemo, useState } from 'react';
import {
  deleteOrganization,
  getOrganization,
  getOrganizationLookups,
  getOrganizationRaions,
  getOrganizations,
  saveOrganization
} from '../app/api';
import { useAuth } from '../app/AuthContext';
import { formatDateTime } from '../app/format';
import { showToast } from '../app/toast';
import type {
  OrganizationDetailsDto,
  OrganizationEditorLookupsDto,
  OrganizationListItemDto,
  OrganizationRaionDto,
  OrganizationUpsertRequest
} from '../app/types';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { OrganizationEditorModal } from '../components/OrganizationEditorModal';
import { OrganizationsTable } from '../components/OrganizationsTable';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100];
const EMPTY_VALUE = '—';
const WITHOUT_RAION_ID = -1;
const DEFAULT_SIDEBAR_WIDTH = 360;
const MIN_SIDEBAR_WIDTH = 320;
const MAX_SIDEBAR_WIDTH = 520;

interface RowContextMenuState {
  row: OrganizationListItemDto;
  x: number;
  y: number;
}

function createEmptyOrganizationRequest(): OrganizationUpsertRequest {
  return {
    name: '',
    visible: true,
    isManager: false,
    salaryEnabled: false,
    oneCAccountingEnabled: false,
    oneCSalaryEnabled: false,
    oneCHousingEnabled: false
  };
}

function mapDetailsToRequest(details: OrganizationDetailsDto): OrganizationUpsertRequest {
  return {
    name: details.name,
    smallName: details.smallName,
    fullName: details.fullName,
    inn: details.inn,
    raionId: details.raionId,
    orgTypeId: details.orgTypeId,
    visible: details.visible,
    isManager: details.isManager,
    ogrn: details.ogrn,
    kpp: details.kpp,
    addressLegal: details.addressLegal,
    addressActual: details.addressActual,
    phone: details.phone,
    site: details.site,
    primaryEmail: details.primaryEmail,
    directorEmail: details.directorEmail,
    salaryEmail: details.salaryEmail,
    oneCEmail: details.oneCEmail,
    siteEmail: details.siteEmail,
    comment: details.comment,
    otherInfo: details.otherInfo,
    salaryEnabled: details.salaryEnabled,
    oneCAccountingEnabled: details.oneCAccountingEnabled,
    oneCSalaryEnabled: details.oneCSalaryEnabled,
    oneCHousingEnabled: details.oneCHousingEnabled,
    salaryContactName: details.salaryContactName,
    salaryContactPhone: details.salaryContactPhone,
    oneCContactName: details.oneCContactName,
    oneCContactPhone: details.oneCContactPhone,
    siteContactName: details.siteContactName,
    siteContactPhone: details.siteContactPhone
  };
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Неизвестная ошибка';
}

function raionSelectionId(raion: OrganizationRaionDto) {
  return raion.id ?? WITHOUT_RAION_ID;
}

function loadStoredPageSize(storageKey: string) {
  if (typeof window === 'undefined') {
    return DEFAULT_PAGE_SIZE;
  }

  const rawValue = window.localStorage.getItem(storageKey);
  const parsedValue = rawValue ? Number(rawValue) : NaN;

  return PAGE_SIZE_OPTIONS.includes(parsedValue) ? parsedValue : DEFAULT_PAGE_SIZE;
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

function SearchActionIcon({ kind }: { kind: 'clear' | 'refresh' | 'search' }) {
  if (kind === 'clear') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 7l10 10M17 7L7 17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }

  if (kind === 'refresh') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M19 7v5h-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M18.4 12a6.4 6.4 0 10-1.88 4.53L19 14.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M16 16l4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function OrganizationsPage() {
  const { user } = useAuth();

  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedRaionIds, setSelectedRaionIds] = useState<number[]>([]);
  const [raionSearch, setRaionSearch] = useState('');
  const [rows, setRows] = useState<OrganizationListItemDto[]>([]);
  const [raions, setRaions] = useState<OrganizationRaionDto[]>([]);
  const [lookups, setLookups] = useState<OrganizationEditorLookupsDto | null>(null);
  const [selectedRowId, setSelectedRowId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<OrganizationDetailsDto | null>(null);
  const [contextMenu, setContextMenu] = useState<RowContextMenuState | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<'create' | 'edit'>('create');
  const [editorTargetId, setEditorTargetId] = useState<number | undefined>();
  const [editorDraft, setEditorDraft] = useState<OrganizationUpsertRequest>(createEmptyOrganizationRequest());
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<OrganizationListItemDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  const selectedRaionIdsKey = useMemo(
    () => [...selectedRaionIds].sort((left, right) => left - right).join(','),
    [selectedRaionIds]
  );

  const tableSettingsKey = useMemo(
    () => `puls-organizations-table:${user?.id ?? 'guest'}`,
    [user?.id]
  );
  const pageSizeStorageKey = useMemo(
    () => `puls-organizations-page-size:${user?.id ?? 'guest'}`,
    [user?.id]
  );
  const sidebarWidthStorageKey = useMemo(
    () => `puls-organizations-sidebar-width:${user?.id ?? 'guest'}`,
    [user?.id]
  );

  const filteredRaions = useMemo(() => {
    const term = raionSearch.trim().toLowerCase();
    if (!term) {
      return raions;
    }

    return raions.filter((raion) => raion.name.toLowerCase().includes(term));
  }, [raionSearch, raions]);

  const selectedRaionSummary = useMemo(() => {
    if (selectedRaionIds.length === 0) {
      return 'Все районы';
    }

    const source = raions;
    const names = source
      .filter((raion) => selectedRaionIds.includes(raionSelectionId(raion)))
      .map((raion) => raion.name);

    if (names.length === 0) {
      return `Выбрано районов: ${selectedRaionIds.length}`;
    }

    if (names.length <= 2) {
      return names.join(', ');
    }

    return `${names.slice(0, 2).join(', ')} и еще ${names.length - 2}`;
  }, [raions, selectedRaionIds]);

  const ensureLookups = async () => {
    if (lookups) {
      return lookups;
    }

    const data = await getOrganizationLookups();
    setLookups(data);
    return data;
  };

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
    } catch (error) {
      showToast(toErrorMessage(error), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [appliedSearch, page, pageSize, selectedRaionIdsKey]);

  useEffect(() => {
    void ensureLookups().catch(() => {
      // Lookup loading is retried lazily when the editor opens.
    });
  }, []);

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

  const applySearch = () => {
    setAppliedSearch(search.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setSearch('');
    setAppliedSearch('');
    setPage(1);
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

  const openDetails = async (id: number) => {
    setDetailsOpen(true);
    setDetailsLoading(true);

    try {
      const data = await getOrganization(id);
      setDetails(data);
    } catch (error) {
      showToast(toErrorMessage(error), 'error');
      setDetailsOpen(false);
    } finally {
      setDetailsLoading(false);
    }
  };

  const openCreateEditor = async () => {
    setContextMenu(null);
    setEditorMode('create');
    setEditorTargetId(undefined);
    setEditorDraft(createEmptyOrganizationRequest());
    setEditorLoading(true);
    setEditorOpen(true);

    try {
      await ensureLookups();
    } catch (error) {
      showToast(toErrorMessage(error), 'error');
      setEditorOpen(false);
    } finally {
      setEditorLoading(false);
    }
  };

  const openEditEditor = async (row: OrganizationListItemDto) => {
    setContextMenu(null);
    setSelectedRowId(row.id);
    setEditorMode('edit');
    setEditorTargetId(row.id);
    setEditorLoading(true);
    setEditorOpen(true);

    try {
      await ensureLookups();
      const data = await getOrganization(row.id);
      setEditorDraft(mapDetailsToRequest(data));
    } catch (error) {
      showToast(toErrorMessage(error), 'error');
      setEditorOpen(false);
    } finally {
      setEditorLoading(false);
    }
  };

  const handleSaveEditor = async () => {
    setEditorSaving(true);

    try {
      const saved = await saveOrganization(editorDraft, editorTargetId);
      setEditorOpen(false);
      setSelectedRowId(saved.id);

      if (detailsOpen && details?.id === saved.id) {
        setDetails(saved);
      }

      showToast(
        editorMode === 'create' ? 'Организация создана.' : 'Изменения сохранены.',
        editorMode === 'create' ? 'create' : 'update'
      );

      await loadData();
    } catch (error) {
      showToast(toErrorMessage(error), 'error');
    } finally {
      setEditorSaving(false);
    }
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

      if (details?.id === deleteTarget.id) {
        setDetails(null);
        setDetailsOpen(false);
      }

      setDeleteTarget(null);
      await loadData();
    } catch (error) {
      showToast(toErrorMessage(error), 'error');
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

  return (
    <div className="page">
      <PageHeader title="Организации" />

      <div className="panel organization-search-panel">
        <div className="organization-search-shell">
          <input
            className="form-input organization-search-input"
            value={search}
            placeholder="Поиск по названию, ИНН, району или типу"
            onChange={(event) => setSearch(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applySearch();
              }
            }}
          />

          <div className="organization-search-actions">
            <button
              type="button"
              className="secondary-button button-inline icon-button organization-search-button"
              onClick={clearSearch}
              aria-label="Очистить поиск"
              title="Очистить"
            >
              <SearchActionIcon kind="clear" />
            </button>

            <button
              type="button"
              className="secondary-button button-inline icon-button organization-search-button"
              onClick={() => void loadData()}
              aria-label="Обновить список"
              title="Обновить"
            >
              <SearchActionIcon kind="refresh" />
            </button>

            <button
              type="button"
              className="primary-button button-inline icon-button organization-search-button"
              onClick={applySearch}
              aria-label="Найти"
              title="Найти"
            >
              <SearchActionIcon kind="search" />
            </button>
          </div>
        </div>
      </div>

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
              <SearchActionIcon kind="clear" />
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
              const selectionId = raionSelectionId(raion);
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
            onRowClick={(row) => setSelectedRowId(row.id)}
            onRowDoubleClick={(row) => void openDetails(row.id)}
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

      <OrganizationEditorModal
        open={editorOpen}
        mode={editorMode}
        value={editorDraft}
        lookups={lookups}
        loading={editorLoading}
        saving={editorSaving}
        onClose={() => setEditorOpen(false)}
        onChange={setEditorDraft}
        onSubmit={() => void handleSaveEditor()}
      />

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

      <Modal
        open={detailsOpen}
        title={details?.name || 'Карточка организации'}
        onClose={() => setDetailsOpen(false)}
        maxWidth={1120}
      >
        {detailsLoading ? <div className="empty-state">Загрузка карточки...</div> : null}

        {!detailsLoading && details ? (
          <div className="organization-details">
            <div className="detail-grid">
              <div className="detail-card"><strong>Полное название</strong><span>{details.fullName || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Краткое название</strong><span>{details.smallName || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>ИНН / КПП</strong><span>{details.inn || EMPTY_VALUE} / {details.kpp || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>ОГРН</strong><span>{details.ogrn || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Район</strong><span>{details.raion || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Тип</strong><span>{details.orgType || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Телефон</strong><span>{details.phone || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Сайт</strong><span>{details.site || EMPTY_VALUE}</span></div>
              <div className="detail-card detail-card-wide"><strong>Юридический адрес</strong><span>{details.addressLegal || EMPTY_VALUE}</span></div>
              <div className="detail-card detail-card-wide"><strong>Фактический адрес</strong><span>{details.addressActual || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Основной адрес</strong><span>{details.primaryEmail || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Адрес руководителя</strong><span>{details.directorEmail || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Адрес зарплаты</strong><span>{details.salaryEmail || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Адрес 1C</strong><span>{details.oneCEmail || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Адрес сайта</strong><span>{details.siteEmail || EMPTY_VALUE}</span></div>
              <div className="detail-card">
                <strong>Статус записи</strong>
                <span>{[details.visible ? 'Видима' : 'Скрыта', details.isManager ? 'Управленческая' : null].filter(Boolean).join(' • ') || EMPTY_VALUE}</span>
              </div>
              <div className="detail-card">
                <strong>Контакт по зарплате</strong>
                <span>{[details.salaryContactName, details.salaryContactPhone].filter(Boolean).join(' • ') || EMPTY_VALUE}</span>
              </div>
              <div className="detail-card">
                <strong>Контакт по 1C</strong>
                <span>{[details.oneCContactName, details.oneCContactPhone].filter(Boolean).join(' • ') || EMPTY_VALUE}</span>
              </div>
              <div className="detail-card">
                <strong>Контакт по сайту</strong>
                <span>{[details.siteContactName, details.siteContactPhone].filter(Boolean).join(' • ') || EMPTY_VALUE}</span>
              </div>
              <div className="detail-card">
                <strong>Интеграции</strong>
                <span>{[
                  details.salaryEnabled ? 'Зарплата' : null,
                  details.oneCAccountingEnabled ? '1C бухгалтерия' : null,
                  details.oneCSalaryEnabled ? '1C зарплата' : null,
                  details.oneCHousingEnabled ? '1C ЖКХ' : null
                ].filter(Boolean).join(' • ') || EMPTY_VALUE}</span>
              </div>
              <div className="detail-card detail-card-wide"><strong>Комментарий</strong><span>{details.comment || EMPTY_VALUE}</span></div>
              <div className="detail-card detail-card-wide"><strong>Дополнительно</strong><span>{details.otherInfo || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Создано</strong><span>{[formatDateTime(details.createdAtUtc), details.createdByName].filter(Boolean).join(' • ') || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Обновлено</strong><span>{[formatDateTime(details.updatedAtUtc), details.updatedByName].filter(Boolean).join(' • ') || EMPTY_VALUE}</span></div>
              <div className="detail-card"><strong>Адм. обновление</strong><span>{[formatDateTime(details.updatedAdminAtUtc), details.updatedAdminByName].filter(Boolean).join(' • ') || EMPTY_VALUE}</span></div>
            </div>

            <div className="panel-subsection">
              <h4>Контакты</h4>
              <DataTable
                rows={details.contacts}
                getRowKey={(row) => row.id}
                emptyText="Нет контактов"
                columns={[
                  { key: 'fio', title: 'ФИО', render: (row) => row.fio || EMPTY_VALUE },
                  { key: 'position', title: 'Должность', render: (row) => row.position || EMPTY_VALUE },
                  { key: 'group', title: 'Группа', render: (row) => row.group || EMPTY_VALUE },
                  { key: 'status', title: 'Статус', render: (row) => row.status || EMPTY_VALUE },
                  { key: 'phone', title: 'Телефон', render: (row) => row.phone || EMPTY_VALUE },
                  { key: 'email', title: 'Почта', render: (row) => row.email || EMPTY_VALUE }
                ]}
              />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

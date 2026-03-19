import React, { useEffect, useMemo, useState } from 'react';
import { getOrganizationRaions, getOrganizations } from '../app/api';
import { useAuth } from '../app/AuthContext';
import type { OrganizationListItemDto, OrganizationRaionDto } from '../app/types';
import { DataTable } from './DataTable';
import { Modal } from './Modal';
import { Pagination } from './Pagination';
import { SearchPanel } from './SearchPanel';

const DEFAULT_PAGE_SIZE = 25;
const PAGE_SIZE_OPTIONS = [10, 25, 50, 75, 100];
const EMPTY_VALUE = '—';

interface OrganizationPickerProps {
  value: OrganizationListItemDto[];
  onChange: (value: OrganizationListItemDto[]) => void;
}

export function OrganizationPicker({ value, onChange }: OrganizationPickerProps) {
  const { user } = useAuth();
  const currentUserId = String(user?.id ?? 'guest');
  const tableSettingsKey = `puls-table-settings:organization-picker:${currentUserId}`;

  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedRaionId, setSelectedRaionId] = useState<number | undefined>();
  const [rows, setRows] = useState<OrganizationListItemDto[]>([]);
  const [raions, setRaions] = useState<OrganizationRaionDto[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [draftSelection, setDraftSelection] = useState<Record<number, OrganizationListItemDto>>({});

  const selectedItems = useMemo(
    () => Object.values(draftSelection).sort((left, right) => left.name.localeCompare(right.name, 'ru')),
    [draftSelection]
  );

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    setDraftSelection(Object.fromEntries(value.map((item) => [item.id, item])));
  }, [modalOpen, value]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [organizationsResponse, raionsResponse] = await Promise.all([
        getOrganizations({
          search: appliedSearch,
          raionIds: selectedRaionId ? [selectedRaionId] : [],
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        getOrganizationRaions(appliedSearch)
      ]);

      setRows(organizationsResponse.items);
      setTotalCount(organizationsResponse.totalCount);
      setRaions(raionsResponse);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    void loadData();
  }, [appliedSearch, modalOpen, page, pageSize, selectedRaionId]);

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

  const clearSearch = () => {
    setSearch('');
    applySearchValue('');
  };

  const toggleDraftItem = (item: OrganizationListItemDto) => {
    setDraftSelection((current) => {
      if (current[item.id]) {
        const next = { ...current };
        delete next[item.id];
        return next;
      }

      return { ...current, [item.id]: item };
    });
  };

  const allCount = useMemo(() => raions.reduce((sum, item) => sum + item.count, 0), [raions]);

  return (
    <section className="panel">
      <div className="section-header-inline">
        <h3>Получатели по организациям</h3>
        <button type="button" className="primary-button button-inline" onClick={() => setModalOpen(true)}>
          Открыть справочник
        </button>
      </div>

      <div className="picker-summary">
        Выбрано организаций: <strong>{value.length}</strong>
      </div>

      <div className="selected-org-list">
        {value.length === 0 ? <div className="empty-state">Организации пока не выбраны.</div> : null}

        {value.map((organization) => (
          <div key={organization.id} className="selected-org-card">
            <div>
              <div className="selected-org-name">{organization.name}</div>
              <div className="selected-org-meta">
                {organization.inn ? `ИНН ${organization.inn}` : 'Без ИНН'}
                {organization.raion ? ` • ${organization.raion}` : ''}
                {organization.orgType ? ` • ${organization.orgType}` : ''}
              </div>
            </div>

            <button
              type="button"
              className="secondary-button button-inline danger-button"
              onClick={() => onChange(value.filter((item) => item.id !== organization.id))}
            >
              Убрать
            </button>
          </div>
        ))}
      </div>

      <div className="field-hint">Выбранные организации будут использоваться для подбора адресов получателей.</div>

      <Modal
        open={modalOpen}
        title="Справочник организаций"
        onClose={() => setModalOpen(false)}
        maxWidth={1160}
        actions={(
          <>
            <div className="modal-actions-note">Выбрано: {selectedItems.length}</div>
            <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Отмена</button>
            <button
              type="button"
              className="primary-button action-button"
              onClick={() => {
                onChange(selectedItems);
                setModalOpen(false);
              }}
            >
              Перенести в получателей
            </button>
          </>
        )}
      >
        <div className="organizations-layout organizations-layout-compact">
          <aside className="organizations-sidebar organizations-sidebar-modal">
            <div className="organizations-sidebar-title">Районы</div>

            <button
              type="button"
              className={`raion-link${selectedRaionId === undefined ? ' active' : ''}`}
              onClick={() => {
                setSelectedRaionId(undefined);
                setPage(1);
              }}
            >
              <span>Все</span>
              <strong>{allCount}</strong>
            </button>

            <div className="raion-list">
              {raions.map((raion) => (
                <button
                  key={raion.id ?? `none-${raion.name}`}
                  type="button"
                  className={`raion-link${selectedRaionId === raion.id ? ' active' : ''}`}
                  onClick={() => {
                    setSelectedRaionId(raion.id);
                    setPage(1);
                  }}
                >
                  <span>{raion.name}</span>
                  <strong>{raion.count}</strong>
                </button>
              ))}
            </div>
          </aside>

          <div className="organizations-main">
            <SearchPanel
              value={search}
              placeholder="Поиск по названию, ИНН, району или типу"
              onChange={setSearch}
              onSearch={applySearch}
              onClear={clearSearch}
              onDebouncedChange={applySearchValue}
              onRefresh={loadData}
              refreshSuccessMessage="Справочник организаций обновлен."
            />

            <DataTable
              rows={rows}
              getRowKey={(row) => row.id}
              loading={loading}
              emptyText="Нет данных"
              settingsKey={tableSettingsKey}
              onRowClick={(row) => toggleDraftItem(row)}
              columns={[
                {
                  key: 'selected',
                  title: '',
                  width: 70,
                  minWidth: 70,
                  canHide: false,
                  render: (row) => (
                    <input
                      type="checkbox"
                      checked={!!draftSelection[row.id]}
                      onChange={() => toggleDraftItem(row)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  )
                },
                { key: 'name', title: 'Название', width: 280, minWidth: 220, render: (row) => row.name || EMPTY_VALUE },
                { key: 'inn', title: 'ИНН', width: 150, minWidth: 130, render: (row) => row.inn || EMPTY_VALUE },
                { key: 'raion', title: 'Район', width: 220, minWidth: 180, render: (row) => row.raion || EMPTY_VALUE },
                { key: 'orgType', title: 'Тип', width: 220, minWidth: 180, render: (row) => row.orgType || EMPTY_VALUE }
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
      </Modal>
    </section>
  );
}

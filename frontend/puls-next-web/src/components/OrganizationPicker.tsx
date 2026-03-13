import React, { useEffect, useMemo, useState } from 'react';
import { getOrganizationRaions, getOrganizations } from '../app/api';
import type { OrganizationListItemDto, OrganizationRaionDto } from '../app/types';
import { DataTable } from './DataTable';
import { Modal } from './Modal';
import { Pagination } from './Pagination';

const DEFAULT_PAGE_SIZE = 30;
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const EMPTY_VALUE = '—';

interface OrganizationPickerProps {
  value: OrganizationListItemDto[];
  onChange: (value: OrganizationListItemDto[]) => void;
}

export function OrganizationPicker({ value, onChange }: OrganizationPickerProps) {
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

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [organizationsResponse, raionsResponse] = await Promise.all([
          getOrganizations(appliedSearch, selectedRaionId, (page - 1) * pageSize, pageSize),
          getOrganizationRaions(appliedSearch)
        ]);

        setRows(organizationsResponse.items);
        setTotalCount(organizationsResponse.totalCount);
        setRaions(raionsResponse);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, [appliedSearch, modalOpen, page, pageSize, selectedRaionId]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, pageSize, totalCount]);

  const applySearch = () => {
    setAppliedSearch(search.trim());
    setPage(1);
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
            <div className="toolbar-panel">
              <input
                className="form-input"
                value={search}
                placeholder="Поиск по названию, ИНН, району или типу"
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    applySearch();
                  }
                }}
              />
              <button type="button" className="primary-button toolbar-button" onClick={applySearch}>Найти</button>
            </div>

            <DataTable
              rows={rows}
              getRowKey={(row) => row.id}
              emptyText={loading ? 'Загрузка...' : 'Нет данных'}
              onRowClick={(row) => toggleDraftItem(row)}
              columns={[
                {
                  key: 'selected',
                  title: '',
                  render: (row) => (
                    <input
                      type="checkbox"
                      checked={!!draftSelection[row.id]}
                      onChange={() => toggleDraftItem(row)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  )
                },
                { key: 'name', title: 'Название', render: (row) => row.name || EMPTY_VALUE },
                { key: 'inn', title: 'ИНН', render: (row) => row.inn || EMPTY_VALUE },
                { key: 'raion', title: 'Район', render: (row) => row.raion || EMPTY_VALUE },
                { key: 'orgType', title: 'Тип', render: (row) => row.orgType || EMPTY_VALUE }
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

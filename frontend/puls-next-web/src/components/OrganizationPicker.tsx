import React, { useEffect, useMemo, useState } from 'react';
import { getOrganizationRaions, getOrganizations } from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { useAuth } from '../app/AuthContext';
import { buildOrganizationSelectionSummary, getOrganizationKnownEmailCount } from '../app/campaignRecipients';
import { buildOrganizationPickerFilterSummary } from '../app/organizationFilters';
import { DEFAULT_PAGE_SIZE, PAGE_SIZE_OPTIONS } from '../app/table';
import { showToast } from '../app/toast';
import type { OrganizationListItemDto, OrganizationRaionDto } from '../app/types';
import { DataTable } from './DataTable';
import { Modal } from './Modal';
import { Pagination } from './Pagination';
import { SearchPanel } from './SearchPanel';
import { StatusBadge } from './StatusBadge';

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
  const [onlyWithEmail, setOnlyWithEmail] = useState(true);
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
  const selectionSummary = useMemo(() => buildOrganizationSelectionSummary(value), [value]);

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
          hasEmail: onlyWithEmail,
          skip: (page - 1) * pageSize,
          take: pageSize
        }),
        getOrganizationRaions(appliedSearch, onlyWithEmail)
      ]);

      setRows(organizationsResponse.items);
      setTotalCount(organizationsResponse.totalCount);
      setRaions(raionsResponse);
    } catch (error) {
      setRows([]);
      setTotalCount(0);
      setRaions([]);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!modalOpen) {
      return;
    }

    void loadData().catch((error) => {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить справочник организаций.'), 'error', 4000);
    });
  }, [appliedSearch, modalOpen, onlyWithEmail, page, pageSize, selectedRaionId]);

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

  const toggleOnlyWithEmail = (checked: boolean) => {
    setOnlyWithEmail(checked);
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

      <div className="organization-recipient-summary" role="list" aria-label="Сводка выбранных организаций">
        <div className="organization-recipient-summary-item" role="listitem">
          <span>Организаций</span>
          <strong>{selectionSummary.organizationCount}</strong>
        </div>
        <div className="organization-recipient-summary-item" role="listitem">
          <span>Известных email</span>
          <strong>{selectionSummary.knownEmailCount}</strong>
        </div>
        <div className="organization-recipient-summary-item" role="listitem">
          <span>С email</span>
          <strong>{selectionSummary.organizationsWithEmail}</strong>
        </div>
        <div className="organization-recipient-summary-item" role="listitem">
          <span>Без email</span>
          <strong>{selectionSummary.organizationsWithoutEmail}</strong>
        </div>
        <div className="organization-recipient-summary-item" role="listitem">
          <span>Контактов</span>
          <strong>{selectionSummary.contactCount}</strong>
        </div>
      </div>
      {selectionSummary.organizationsWithoutEmail > 0 ? (
        <div className="field-hint field-hint-error" role="status">
          Без email: {selectionSummary.organizationsWithoutEmail}. Эти организации не попадут в отправку, пока у них не появится адрес.
        </div>
      ) : null}

      {value.length === 0 ? (
        <div className="empty-state">Организации пока не выбраны.</div>
      ) : (
        <div className="selected-org-list" role="list" aria-label="Выбранные организации для рассылки">
          {value.map((organization) => {
            const knownEmailCount = getOrganizationKnownEmailCount(organization);

            return (
              <div key={organization.id} className="selected-org-card" role="listitem">
                <div>
                  <div className="status-badge-stack">
                    <div className="selected-org-name">{organization.name}</div>
                    {knownEmailCount === 0 ? <StatusBadge tone="warning">Нет email</StatusBadge> : null}
                  </div>
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
                  aria-label={`Убрать организацию ${organization.name} из получателей`}
                >
                  Убрать
                </button>
              </div>
            );
          })}
        </div>
      )}

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
              refreshErrorMessage="Не удалось обновить справочник организаций."
            />

            <div className="picker-filter-strip">
              <label className="checkbox-option">
                <input
                  type="checkbox"
                  checked={onlyWithEmail}
                  onChange={(event) => toggleOnlyWithEmail(event.target.checked)}
                />
                <span>Только организации с email</span>
              </label>

              <span className="field-hint">{buildOrganizationPickerFilterSummary(totalCount, onlyWithEmail)}</span>
            </div>

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
                  mobileVisible: false,
                  render: (row) => (
                    <input
                      type="checkbox"
                      checked={!!draftSelection[row.id]}
                      aria-label={draftSelection[row.id]
                        ? `Убрать организацию ${row.name} из черновика получателей`
                        : `Добавить организацию ${row.name} в черновик получателей`}
                      onChange={() => toggleDraftItem(row)}
                      onClick={(event) => event.stopPropagation()}
                    />
                  )
                },
                { key: 'name', title: 'Название', width: 280, minWidth: 220, isPrimary: true, priority: 1, render: (row) => row.name || EMPTY_VALUE },
                { key: 'inn', title: 'ИНН', width: 150, minWidth: 130, priority: 2, render: (row) => row.inn || EMPTY_VALUE },
                { key: 'raion', title: 'Район', width: 220, minWidth: 180, priority: 3, render: (row) => row.raion || EMPTY_VALUE },
                { key: 'orgType', title: 'Тип', width: 220, minWidth: 180, priority: 4, render: (row) => row.orgType || EMPTY_VALUE },
                { key: 'emailCount', title: 'Email', width: 100, minWidth: 90, priority: 5, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.emailCount }
              ]}
              mobileActions={(row) => (
                <button
                  type="button"
                  className={`secondary-button button-inline${draftSelection[row.id] ? ' active' : ''}`}
                  onClick={() => toggleDraftItem(row)}
                >
                  {draftSelection[row.id] ? 'Выбрано' : 'Выбрать'}
                </button>
              )}
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

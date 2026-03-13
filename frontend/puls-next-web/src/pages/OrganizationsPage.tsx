import React, { useEffect, useMemo, useState } from 'react';
import { getOrganization, getOrganizationRaions, getOrganizations } from '../app/api';
import { formatDateTime } from '../app/format';
import type { OrganizationDetailsDto, OrganizationListItemDto, OrganizationRaionDto } from '../app/types';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';

const DEFAULT_PAGE_SIZE = 50;
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const EMPTY_VALUE = '—';

export function OrganizationsPage() {
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [selectedRaionId, setSelectedRaionId] = useState<number | undefined>();
  const [rows, setRows] = useState<OrganizationListItemDto[]>([]);
  const [raions, setRaions] = useState<OrganizationRaionDto[]>([]);
  const [selectedRowId, setSelectedRowId] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [details, setDetails] = useState<OrganizationDetailsDto | null>(null);

  const allCount = useMemo(() => raions.reduce((sum, item) => sum + item.count, 0), [raions]);

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

      if (organizationsResponse.items.every((item) => item.id !== selectedRowId)) {
        setSelectedRowId(organizationsResponse.items[0]?.id);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [appliedSearch, page, pageSize, selectedRaionId]);

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

  const openDetails = async (id: number) => {
    setDetailsOpen(true);
    setDetailsLoading(true);

    try {
      setDetails(await getOrganization(id));
    } finally {
      setDetailsLoading(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Организации"
        subtitle="Справочник организаций с фильтрацией по районам, постраничной загрузкой и подробной карточкой."
        actions={<button type="button" className="secondary-button" onClick={() => void load()}>Обновить</button>}
      />

      <div className="panel toolbar-panel">
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

      <div className="organizations-layout">
        <aside className="panel organizations-sidebar">
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

        <section className="panel organizations-main">
          <div className="section-header-inline">
            <h3>Список организаций</h3>
            <div className="field-hint">Двойной клик по строке открывает карточку организации.</div>
          </div>

          <DataTable
            rows={rows}
            getRowKey={(row) => row.id}
            emptyText={loading ? 'Загрузка...' : 'Нет данных'}
            onRowClick={(row) => setSelectedRowId(row.id)}
            onRowDoubleClick={(row) => void openDetails(row.id)}
            selectedRowKey={selectedRowId}
            columns={[
              { key: 'name', title: 'Название', render: (row) => row.name || EMPTY_VALUE },
              { key: 'inn', title: 'ИНН', render: (row) => row.inn || EMPTY_VALUE },
              { key: 'raion', title: 'Район', render: (row) => row.raion || EMPTY_VALUE },
              { key: 'orgType', title: 'Тип', render: (row) => row.orgType || EMPTY_VALUE },
              { key: 'emailCount', title: 'Адресов', render: (row) => row.emailCount },
              { key: 'contacts', title: 'Контактов', render: (row) => row.contactCount }
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
        </section>
      </div>

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

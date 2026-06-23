import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { getParusLicenseAnalytics } from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { formatDate } from '../app/format';
import { showToast } from '../app/toast';
import type {
  ParusLicenseAnalyticsDto,
  ParusLicenseAnalyticsLicensePeriodDto,
  ParusLicenseAnalyticsOrganizationGroupDto
} from '../app/types';
import { ActionIcon } from '../components/ActionIcon';
import { AppLoader } from '../components/AppLoader';
import { Pagination } from '../components/Pagination';
import { StatsCards } from '../components/StatsCards';

const GROUP_PAGE_SIZE_OPTIONS = [10, 25, 50];

function startOfCurrentYear() {
  return dayjs().startOf('year').format('YYYY-MM-DD');
}

function endOfCurrentYear() {
  return dayjs().endOf('year').format('YYYY-MM-DD');
}

function toApiDate(value: string) {
  return `${value}T00:00:00.000Z`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function InfoHeader({ label, title }: { label: string; title: string }) {
  return (
    <span className="analytics-info-header">
      <span>{label}</span>
      <span className="analytics-info-icon" title={title} aria-label={title}>i</span>
    </span>
  );
}

function TextHeader({ label }: { label: string }) {
  return <span className="analytics-info-header">{label}</span>;
}

function renderState({
  activeAtPeriodEnd,
  withoutRenewal,
  expiredAtPeriodEnd
}: {
  activeAtPeriodEnd: boolean;
  withoutRenewal?: boolean;
  expiredAtPeriodEnd: boolean;
}) {
  if (activeAtPeriodEnd) {
    return <span className="analytics-status analytics-status-active">Действует</span>;
  }

  if (withoutRenewal) {
    return <span className="analytics-status analytics-status-danger">Без продления</span>;
  }

  if (expiredAtPeriodEnd) {
    return <span className="analytics-status analytics-status-muted">Просрочена</span>;
  }

  return <span className="analytics-status analytics-status-muted">История</span>;
}

export function AnalyticsPage() {
  const [dateFrom, setDateFrom] = useState(startOfCurrentYear);
  const [dateTo, setDateTo] = useState(endOfCurrentYear);
  const [analytics, setAnalytics] = useState<ParusLicenseAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupPage, setGroupPage] = useState(1);
  const [groupPageSize, setGroupPageSize] = useState(10);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(() => new Set());

  const normalizedRange = useMemo(() => {
    const from = dayjs(dateFrom);
    const to = dayjs(dateTo);
    return to.isBefore(from, 'day')
      ? { from: dateTo, to: dateFrom }
      : { from: dateFrom, to: dateTo };
  }, [dateFrom, dateTo]);

  const load = async (range = normalizedRange) => {
    setLoading(true);
    try {
      setAnalytics(await getParusLicenseAnalytics(toApiDate(range.from), toApiDate(range.to)));
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить аналитику лицензий.'), 'error', 4000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const applyPeriod = () => {
    void load();
  };

  const clearToCurrentYear = () => {
    const from = startOfCurrentYear();
    const to = endOfCurrentYear();
    setDateFrom(from);
    setDateTo(to);
    void load({ from, to });
  };

  const summary = analytics?.summary;
  const filteredGroups = useMemo(() => {
    const source = analytics?.organizationGroups ?? [];
    const term = groupSearch.trim().toLowerCase();

    if (!term) {
      return source;
    }

    return source.filter((group) => {
      const haystack = [
        group.clientName,
        group.inn,
        group.mnemoOrg,
        group.licenseNumber,
        ...group.periods.flatMap((period) => period.components.flatMap((component) => [
          component.number,
          component.regNumberAbonement,
          component.regNumberClient,
          component.nomenclature,
          component.modification
        ]))
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(term);
    });
  }, [analytics?.organizationGroups, groupSearch]);
  const pagedGroups = useMemo(
    () => filteredGroups.slice((groupPage - 1) * groupPageSize, groupPage * groupPageSize),
    [filteredGroups, groupPage, groupPageSize]
  );

  useEffect(() => {
    setGroupPage(1);
  }, [groupSearch]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredGroups.length / groupPageSize));
    if (groupPage > totalPages) {
      setGroupPage(totalPages);
    }
  }, [filteredGroups.length, groupPage, groupPageSize]);

  const toggleGroup = (key: string) => {
    setExpandedGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const togglePeriod = (key: string) => {
    setExpandedPeriods((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <div className="page analytics-page">
      <section className="panel toolbar-panel analytics-filter-panel">
        <div className="analytics-filter-main">
          <div className="field analytics-date-field">
            <label htmlFor="analytics-date-from">Период с</label>
            <input
              id="analytics-date-from"
              className="form-input"
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </div>
          <div className="field analytics-date-field">
            <label htmlFor="analytics-date-to">Период по</label>
            <input
              id="analytics-date-to"
              className="form-input"
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </div>
          <div className="grid-actions analytics-filter-actions">
            <button type="button" className="primary-button button-inline" onClick={applyPeriod} disabled={loading}>
              Сформировать
            </button>
            <button type="button" className="secondary-button button-inline" onClick={clearToCurrentYear} disabled={loading}>
              Текущий год
            </button>
            <button
              type="button"
              className="secondary-button button-inline icon-button search-button analytics-refresh-button"
              onClick={() => void load()}
              disabled={loading}
              aria-label="Обновить аналитику"
              title="Обновить аналитику"
            >
              <ActionIcon kind="refresh" />
            </button>
          </div>
        </div>
      </section>

      {loading && !analytics ? (
        <section className="panel">
          <AppLoader variant="panel" label="Собираем аналитику" description="Группируем лицензии Парус и считаем продления." />
        </section>
      ) : null}

      {analytics && summary ? (
        <>
          <div className="analytics-stats">
            <StatsCards
              items={[
                { label: 'Лицензии', value: formatCount(summary.licenseGroups), hint: `${formatCount(summary.licenseRecords)} записей в периоде` },
                { label: 'Клиенты', value: formatCount(summary.clients), hint: 'Уникальные организации' },
                { label: 'Действуют', value: formatCount(summary.activeAtPeriodEnd), hint: `На ${formatDate(analytics.dateToUtc)}` },
                { label: 'Просрочены', value: formatCount(summary.expiredAtPeriodEnd), hint: 'Нет активной записи на конец периода' },
                { label: 'Продлены', value: formatCount(summary.renewed), hint: 'Новая запись внутри периода' },
                { label: 'Без продления', value: formatCount(summary.withoutRenewal), hint: 'Последний срок закончился в периоде' },
                { label: 'Заканчиваются', value: formatCount(summary.expiringInPeriod), hint: 'Дата окончания попала в период' },
                { label: 'Новые', value: formatCount(summary.newLicenses), hint: 'Первая запись в периоде' }
              ]}
            />
          </div>

          <section className="panel">
            <div className="section-header-inline">
              <h3>По годам</h3>
              <span className="field-hint">{formatDate(analytics.dateFromUtc)} - {formatDate(analytics.dateToUtc)}</span>
            </div>
            <div className="table-shell">
              <table className="data-table analytics-table analytics-year-table">
                <thead>
                  <tr>
                    <th><TextHeader label="Год" /></th>
                    <th><TextHeader label="Лицензии" /></th>
                    <th><TextHeader label="Клиенты" /></th>
                    <th><InfoHeader label="Действуют" title="Лицензии, активные на последний день года или выбранного поддиапазона." /></th>
                    <th><InfoHeader label="Просрочены" title="Лицензии, у которых нет активной записи на конец года или выбранного поддиапазона." /></th>
                    <th><InfoHeader label="Продлены" title="Лицензии, у которых новая запись начинается внутри этого года." /></th>
                    <th><InfoHeader label="Без продления" title="Лицензии, у которых последний известный период заканчивается внутри этого года." /></th>
                    <th><TextHeader label="Новые" /></th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.periods.map((period) => (
                    <tr key={period.year}>
                      <td><strong>{period.year}</strong></td>
                      <td>{formatCount(period.licenseGroups)}</td>
                      <td>{formatCount(period.clients)}</td>
                      <td>{formatCount(period.activeAtPeriodEnd)}</td>
                      <td>{formatCount(period.expiredAtPeriodEnd)}</td>
                      <td>{formatCount(period.renewed)}</td>
                      <td>{formatCount(period.withoutRenewal)}</td>
                      <td>{formatCount(period.newLicenses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel">
            <div className="section-header-inline">
              <h3>Группы лицензий</h3>
              <span className="field-hint">{formatCount(filteredGroups.length)} групп</span>
            </div>

            <div className="analytics-groups-toolbar">
              <input
                className="form-input analytics-groups-search"
                type="search"
                value={groupSearch}
                placeholder="Поиск по организации, ИНН, номеру или составу"
                aria-label="Поиск по группам лицензий"
                onChange={(event) => setGroupSearch(event.target.value)}
              />
              <button
                type="button"
                className="secondary-button button-inline"
                onClick={() => setGroupSearch('')}
                disabled={!groupSearch}
              >
                Сбросить
              </button>
            </div>

            <div className="table-shell">
              <table className="data-table analytics-table analytics-groups-table">
                <thead>
                  <tr>
                    <th><TextHeader label="Организация" /></th>
                    <th><TextHeader label="Лицензия" /></th>
                    <th><TextHeader label="Периоды" /></th>
                    <th><TextHeader label="Состав" /></th>
                    <th><TextHeader label="Статус" /></th>
                  </tr>
                </thead>
                <tbody>
                  {pagedGroups.map((row) => (
                    <React.Fragment key={row.key}>
                      <tr className="analytics-group-row">
                        <td>
                          <button type="button" className="analytics-expand-button" onClick={() => toggleGroup(row.key)}>
                            <span className={`analytics-expand-chevron${expandedGroups.has(row.key) ? ' expanded' : ''}`}>›</span>
                            <span className="analytics-cell-stack">
                              <span className="analytics-cell-top">{row.clientName}</span>
                              <span className="analytics-cell-middle">{row.inn ? `ИНН ${row.inn}` : 'ИНН не указан'}</span>
                              <span className="analytics-cell-bottom">{row.mnemoOrg || 'Мнемоника не указана'}</span>
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className="analytics-cell-stack">
                            <span className="analytics-cell-top">{row.licenseNumber}</span>
                          </span>
                        </td>
                        <td>{formatCount(row.periodsCount)}</td>
                        <td>{formatCount(row.componentsCount)}</td>
                        <td>{renderState(row)}</td>
                      </tr>
                      {expandedGroups.has(row.key) ? (
                        <tr className="analytics-periods-row">
                          <td colSpan={5}>
                            <div className="analytics-period-list">
                              {row.periods.map((period) => (
                                <div key={period.key} className="analytics-period-block">
                                  <button type="button" className="analytics-period-header" onClick={() => togglePeriod(period.key)}>
                                    <span className={`analytics-expand-chevron${expandedPeriods.has(period.key) ? ' expanded' : ''}`}>›</span>
                                    <span className="analytics-cell-stack">
                                      <span className="analytics-cell-top">{formatDate(period.dateSinceUtc)} - {formatDate(period.dateToUtc)}</span>
                                      <span className="analytics-cell-middle">{formatCount(period.componentsCount)} строк состава</span>
                                      <span className="analytics-cell-bottom">{period.activeAtPeriodEnd ? 'Активен на конец периода' : 'Не активен на конец периода'}</span>
                                    </span>
                                    {renderState(period)}
                                  </button>
                                  {expandedPeriods.has(period.key) ? (
                                    <div className="analytics-components">
                                      <div className="analytics-components-head">
                                        <TextHeader label="Спецификация" />
                                        <TextHeader label="Состав лицензии" />
                                      </div>
                                      {period.components.map((component) => (
                                        <div key={component.id} className="analytics-component-row">
                                          <span className="analytics-cell-stack">
                                            <span className="analytics-cell-top">{component.regNumberAbonement || component.number || 'Без номера'}</span>
                                          </span>
                                          <span className="analytics-cell-stack">
                                            <span className="analytics-cell-top">{component.modification || component.product || 'Парус'}</span>
                                            <span className="analytics-cell-middle">{component.nomenclature || 'Номенклатура не указана'}</span>
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </React.Fragment>
                  ))}
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <div className="table-empty">За выбранный период лицензии Парус 10 и Парус Торнадо не найдены.</div>
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
            <Pagination
              page={groupPage}
              pageSize={groupPageSize}
              totalCount={filteredGroups.length}
              pageSizeOptions={GROUP_PAGE_SIZE_OPTIONS}
              onPageChange={setGroupPage}
              onPageSizeChange={(nextPageSize) => {
                setGroupPageSize(nextPageSize);
                setGroupPage(1);
              }}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}

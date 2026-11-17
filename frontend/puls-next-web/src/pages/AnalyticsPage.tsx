import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { downloadParusLicenseFile, getParusLicenseAnalytics } from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { useAuth } from '../app/AuthContext';
import { formatDate } from '../app/format';
import { showToast } from '../app/toast';
import type { ParusLicenseAnalyticsDto, ParusLicenseAnalyticsOrganizationGroupDto } from '../app/types';
import { ActionIcon } from '../components/ActionIcon';
import { AppLoader } from '../components/AppLoader';
import { Pagination } from '../components/Pagination';
import { StatsCards } from '../components/StatsCards';
import { GROUP_STATUS_OPTIONS, toApiDate, formatCount, saveBlob, formatQuantity, buildLicenseMeta } from './analytics/analyticsFormat';
import type { AnalyticsPeriodRange } from './analytics/analyticsFormat';
import { buildLicenseGroupsWorkbook } from './analytics/licenseWorkbook';
import { InfoHeader, TextHeader, AnalyticsDatePicker, StatusCombobox } from './analytics/AnalyticsControls';
import type { InfoDetails } from './analytics/AnalyticsControls';

const GROUP_PAGE_SIZE_OPTIONS = [10, 25, 50];
const GROUP_EXPORT_PAGE_SIZE = 100;
const ANNUAL_ANALYTICS_STORAGE_ID = 'parus-annual-analytics';
const ANALYTICS_PERIOD_STORAGE_ID = 'parus-period';
const STATUS_FILTER_INFO: InfoDetails = {
  label: 'Статус',
  title: 'Как работает фильтр статуса',
  description: 'Фильтр отбирает группы лицензий по расчетному состоянию на выбранный период. Например, "Заканчиваются" показывает лицензии, у которых последний известный период завершился внутри диапазона и нет более позднего продления; "Без продления" смотрит на последний период без привязки к дате окончания внутри диапазона.'
};

const SALARY_FILTER_INFO: InfoDetails = {
  label: 'Только ЗП',
  title: 'Организации на зарплатном сопровождении',
  description: 'Галочка доступна только для статуса "Заканчиваются" и оставляет организации, с которыми мы работаем по заработной плате.'
};

function startOfCurrentYear() {
  return dayjs().startOf('year').format('YYYY-MM-DD');
}

function endOfCurrentYear() {
  return dayjs().endOf('year').format('YYYY-MM-DD');
}

function buildAnnualAnalyticsStorageKey(userId: string) {
  return `puls-analytics:${ANNUAL_ANALYTICS_STORAGE_ID}:${userId}`;
}

function buildAnalyticsPeriodStorageKey(userId: string) {
  return `puls-analytics:${ANALYTICS_PERIOD_STORAGE_ID}:${userId}`;
}

function getDefaultPeriodRange(): AnalyticsPeriodRange {
  return { from: startOfCurrentYear(), to: endOfCurrentYear() };
}

function loadAnnualAnalyticsPreference(storageKey: string) {
  if (typeof window === 'undefined') {
    return false;
  }

  return window.localStorage.getItem(storageKey) === '1';
}

function loadAnalyticsPeriodPreference(storageKey: string): AnalyticsPeriodRange {
  const fallback = getDefaultPeriodRange();
  if (typeof window === 'undefined') {
    return fallback;
  }

  try {
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      return fallback;
    }

    const value = JSON.parse(rawValue) as Partial<AnalyticsPeriodRange>;
    const from = typeof value.from === 'string' && dayjs(value.from).isValid() ? value.from : null;
    const to = typeof value.to === 'string' && dayjs(value.to).isValid() ? value.to : null;

    return from && to ? { from, to } : fallback;
  } catch {
    return fallback;
  }
}

function saveAnalyticsPeriodPreference(storageKey: string, range: AnalyticsPeriodRange) {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(range));
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
  const { user } = useAuth();
  const currentUserId = String(user?.id ?? 'guest');
  const annualAnalyticsStorageKey = buildAnnualAnalyticsStorageKey(currentUserId);
  const analyticsPeriodStorageKey = buildAnalyticsPeriodStorageKey(currentUserId);
  const [initialPeriod] = useState(() => loadAnalyticsPeriodPreference(analyticsPeriodStorageKey));
  const [dateFrom, setDateFrom] = useState(() => initialPeriod.from);
  const [dateTo, setDateTo] = useState(() => initialPeriod.to);
  const [analytics, setAnalytics] = useState<ParusLicenseAnalyticsDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportingGroups, setExportingGroups] = useState(false);
  const [annualAnalytics, setAnnualAnalytics] = useState(() => loadAnnualAnalyticsPreference(annualAnalyticsStorageKey));
  const [infoModal, setInfoModal] = useState<InfoDetails | null>(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupStatus, setGroupStatus] = useState('all');
  const [salaryOnly, setSalaryOnly] = useState(false);
  const [groupPage, setGroupPage] = useState(1);
  const [groupPageSize, setGroupPageSize] = useState(10);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => new Set());
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(() => new Set());
  const [appliedRange, setAppliedRange] = useState<AnalyticsPeriodRange>(() => initialPeriod);

  const normalizedRange = useMemo(() => {
    const from = dayjs(dateFrom);
    const to = dayjs(dateTo);
    return to.isBefore(from, 'day')
      ? { from: dateTo, to: dateFrom }
      : { from: dateFrom, to: dateTo };
  }, [dateFrom, dateTo]);

  const showSalaryOnlyFilter = groupStatus === 'expiring';
  const activeSalaryOnly = showSalaryOnlyFilter && salaryOnly;

  const load = useCallback(async (
    range: typeof appliedRange,
    page: number,
    search: string,
    status: typeof groupStatus,
    pageSize: number,
    onlySalary: boolean
  ) => {
    setLoading(true);
    try {
      setAnalytics(await getParusLicenseAnalytics({
        dateFromUtc: toApiDate(range.from),
        dateToUtc: toApiDate(range.to),
        search: search.trim() || undefined,
        status,
        salaryOnly: onlySalary || undefined,
        skip: (page - 1) * pageSize,
        take: pageSize
      }));
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить аналитику лицензий.'), 'error', 4000);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load(appliedRange, groupPage, groupSearch, groupStatus, groupPageSize, activeSalaryOnly);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [activeSalaryOnly, appliedRange, groupPage, groupPageSize, groupSearch, groupStatus, load]);

  useEffect(() => {
    if (groupStatus !== 'expiring' && salaryOnly) {
      setSalaryOnly(false);
    }
  }, [groupStatus, salaryOnly]);

  useEffect(() => {
    setAnnualAnalytics(loadAnnualAnalyticsPreference(annualAnalyticsStorageKey));
  }, [annualAnalyticsStorageKey]);

  useEffect(() => {
    const storedRange = loadAnalyticsPeriodPreference(analyticsPeriodStorageKey);
    setDateFrom(storedRange.from);
    setDateTo(storedRange.to);
    setAppliedRange(storedRange);
    setGroupPage(1);
  }, [analyticsPeriodStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(annualAnalyticsStorageKey, annualAnalytics ? '1' : '0');
  }, [annualAnalytics, annualAnalyticsStorageKey]);

  const applyPeriod = () => {
    setAppliedRange(normalizedRange);
    saveAnalyticsPeriodPreference(analyticsPeriodStorageKey, normalizedRange);
    setGroupPage(1);
  };

  const exportLicenseGroups = async () => {
    setExportingGroups(true);
    try {
      const loadedGroups: ParusLicenseAnalyticsOrganizationGroupDto[] = [];
      let totalCount = groupsTotalCount;
      let skip = 0;

      while (skip < totalCount) {
        const page = await getParusLicenseAnalytics({
          dateFromUtc: toApiDate(appliedRange.from),
          dateToUtc: toApiDate(appliedRange.to),
          search: groupSearch.trim() || undefined,
          status: groupStatus,
          salaryOnly: activeSalaryOnly || undefined,
          skip,
          take: GROUP_EXPORT_PAGE_SIZE
        });

        loadedGroups.push(...page.organizationGroups);
        totalCount = page.organizationGroupsTotalCount;
        skip += GROUP_EXPORT_PAGE_SIZE;

        if (page.organizationGroups.length === 0) {
          break;
        }
      }

      const workbook = buildLicenseGroupsWorkbook(loadedGroups, appliedRange, groupStatus, activeSalaryOnly);
      saveBlob(
        new Blob([workbook], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
        `parus-license-groups-${appliedRange.from}-${appliedRange.to}.xlsx`
      );
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось подготовить выгрузку групп лицензий.'), 'error', 4000);
    } finally {
      setExportingGroups(false);
    }
  };

  const downloadLicenseFile = async (clientId: number, fileName?: string) => {
    try {
      const blob = await downloadParusLicenseFile(clientId);
      saveBlob(blob, fileName || 'parus-license.dat');
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось скачать файл лицензии.'), 'error', 4000);
    }
  };

  const columnInfo = {
    active: {
      label: 'Действуют',
      title: 'Действуют',
      description: 'Считаются базовые лицензии, например НА2360, у которых есть хотя бы один период действия, покрывающий последний день выбранного диапазона или конкретного года.'
    },
    expired: {
      label: 'Просрочены',
      title: 'Просрочены',
      description: 'Считаются базовые лицензии, которые попадали в диапазон, но не имеют активного периода на последний день диапазона.'
    },
    renewed: {
      label: 'Продлены',
      title: 'Продлены',
      description: 'Считаются базовые лицензии, у которых внутри диапазона начинается новый период и при этом у этой лицензии уже был более ранний период. Строки состава внутри одного периода не увеличивают счетчик.'
    },
    withoutRenewal: {
      label: 'Без продления',
      title: 'Без продления',
      description: 'Считаются базовые лицензии, у которых последний известный период закончился внутри диапазона и более позднего периода в базе нет.'
    },
    lost: {
      label: 'Ушли',
      title: 'Ушли',
      description: 'Считаются базовые лицензии, которые были в выбранном году или периоде, но завершились на последнем известном периоде и дальше не продлевались.'
    }
  } satisfies Record<string, InfoDetails>;

  const summary = analytics?.summary;
  const groups = analytics?.organizationGroups ?? [];
  const groupsTotalCount = analytics?.organizationGroupsTotalCount ?? 0;

  useEffect(() => {
    setGroupPage(1);
  }, [activeSalaryOnly, groupSearch, groupStatus]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(groupsTotalCount / groupPageSize));
    if (groupPage > totalPages) {
      setGroupPage(totalPages);
    }
  }, [groupsTotalCount, groupPage, groupPageSize]);

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
          <AnalyticsDatePicker id="analytics-date-from" label="Период с" value={dateFrom} onChange={setDateFrom} />
          <AnalyticsDatePicker id="analytics-date-to" label="Период по" value={dateTo} onChange={setDateTo} />
          <label className="analytics-annual-toggle">
            <input
              type="checkbox"
              checked={annualAnalytics}
              onChange={(event) => setAnnualAnalytics(event.target.checked)}
            />
            <span className="analytics-checkbox" aria-hidden="true" />
            <span>Годовая аналитика</span>
          </label>
          <div className="grid-actions analytics-filter-actions">
            <button type="button" className="primary-button button-inline" onClick={applyPeriod} disabled={loading}>
              Сформировать
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
                { label: 'Продлены', value: formatCount(summary.renewed), hint: 'Новый период у существующей лицензии' },
                { label: 'Без продления', value: formatCount(summary.withoutRenewal), hint: 'Последний период закончился' },
                { label: 'Ушли', value: formatCount(summary.lost), hint: 'Нет продлений после окончания' },
                { label: 'Заканчиваются', value: formatCount(summary.expiringInPeriod), hint: 'Последний период закончился в диапазоне' },
                { label: 'Новые', value: formatCount(summary.newLicenses), hint: 'Первое появление лицензии' }
              ]}
            />
          </div>

          {annualAnalytics ? (
          <section className="panel">
            <div className="section-header-inline">
              <h3>Годовая аналитика</h3>
              <span className="field-hint">{formatDate(analytics.dateFromUtc)} - {formatDate(analytics.dateToUtc)}</span>
            </div>
            <div className="table-shell analytics-year-table-shell">
              <table className="data-table analytics-table analytics-year-table">
                <thead>
                  <tr>
                    <th><TextHeader label="Год" /></th>
                    <th><TextHeader label="Лицензии" /></th>
                    <th><TextHeader label="Клиенты" /></th>
                    <th><InfoHeader label="Действуют" info={columnInfo.active} onOpen={setInfoModal} /></th>
                    <th><InfoHeader label="Просрочены" info={columnInfo.expired} onOpen={setInfoModal} /></th>
                    <th><InfoHeader label="Продлены" info={columnInfo.renewed} onOpen={setInfoModal} /></th>
                    <th><InfoHeader label="Без продления" info={columnInfo.withoutRenewal} onOpen={setInfoModal} /></th>
                    <th><InfoHeader label="Ушли" info={columnInfo.lost} onOpen={setInfoModal} /></th>
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
                      <td>{formatCount(period.lost)}</td>
                      <td>{formatCount(period.newLicenses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          ) : null}

          <section className="panel">
            <div className="section-header-inline">
              <h3>Группы лицензий</h3>
              <div className="analytics-groups-header-actions">
                <span className="field-hint">{formatCount(groupsTotalCount)} групп</span>
              </div>
            </div>

            <div className="analytics-groups-toolbar">
              <div className="analytics-groups-toolbar-main">
                <input
                  className="form-input analytics-groups-search"
                  type="search"
                  value={groupSearch}
                  placeholder="Поиск по организации, ИНН, номеру или составу"
                  aria-label="Поиск по группам лицензий"
                  onChange={(event) => setGroupSearch(event.target.value)}
                />
                <div className="analytics-status-filter">
                  <StatusCombobox value={groupStatus} options={GROUP_STATUS_OPTIONS} onChange={setGroupStatus} />
                  <button type="button" className="analytics-info-icon analytics-status-info-icon" aria-label="Подробнее о фильтре статуса" onClick={() => setInfoModal(STATUS_FILTER_INFO)}>
                    i
                    <span className="analytics-info-tooltip analytics-status-info-tooltip" role="tooltip">
                      <strong>{STATUS_FILTER_INFO.title}</strong>
                      <span>{STATUS_FILTER_INFO.description}</span>
                    </span>
                  </button>
                </div>
                {showSalaryOnlyFilter ? (
                  <div className="analytics-salary-filter">
                    <label className="analytics-annual-toggle analytics-salary-toggle">
                      <input
                        type="checkbox"
                        checked={salaryOnly}
                        onChange={(event) => setSalaryOnly(event.target.checked)}
                      />
                      <span className="analytics-checkbox" aria-hidden="true" />
                      <span>Только ЗП</span>
                    </label>
                    <button type="button" className="analytics-info-icon analytics-status-info-icon" aria-label="Подробнее о фильтре зарплаты" onClick={() => setInfoModal(SALARY_FILTER_INFO)}>
                      i
                      <span className="analytics-info-tooltip analytics-status-info-tooltip" role="tooltip">
                        <strong>{SALARY_FILTER_INFO.title}</strong>
                        <span>{SALARY_FILTER_INFO.description}</span>
                      </span>
                    </button>
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                className="secondary-button button-inline icon-button analytics-groups-export-button"
                onClick={() => void exportLicenseGroups()}
                disabled={exportingGroups || loading || groupsTotalCount === 0}
                aria-label="Выгрузить отчет по группам лицензий в Excel"
                title="Выгрузить отчет по группам лицензий в Excel"
              >
                <ActionIcon kind="excel" />
              </button>
            </div>

            <div className="table-shell">
              <table className="data-table analytics-table analytics-groups-table">
                <thead>
                  <tr>
                    <th><TextHeader label="Организация" /></th>
                    <th><TextHeader label="Окончание" /></th>
                    <th><TextHeader label="Лицензия" /></th>
                    <th><TextHeader label="Периоды" /></th>
                    <th><TextHeader label="Состав" /></th>
                    <th><TextHeader label="Статус" /></th>
                  </tr>
                </thead>
                <tbody>
                  {groups.map((row) => {
                    const licenseMeta = buildLicenseMeta(row);

                    return (
                    <React.Fragment key={row.key}>
                      <tr className="analytics-group-row">
                        <td>
                          <button type="button" className="analytics-expand-button" onClick={() => toggleGroup(row.key)}>
                            <span className={`analytics-expand-chevron${expandedGroups.has(row.key) ? ' expanded' : ''}`}>›</span>
                            <span className="analytics-cell-stack">
                              <span className="analytics-cell-top">{row.clientName}</span>
                              <span className="analytics-cell-middle">
                                {row.inn ? `ИНН ${row.inn}${row.raion ? ` (${row.raion})` : ''}` : row.raion ? `Район: ${row.raion}` : 'ИНН не указан'}
                              </span>
                              <span className="analytics-cell-bottom">{row.mnemoOrg || 'Мнемоника не указана'}</span>
                            </span>
                          </button>
                        </td>
                        <td>{row.lastDateToUtc ? formatDate(row.lastDateToUtc) : '—'}</td>
                        <td>
                          <span className="analytics-cell-stack">
                            <span className="analytics-cell-top">{row.licenseNumber}</span>
                            {licenseMeta ? <span className="analytics-cell-bottom">{licenseMeta}</span> : null}
                          </span>
                        </td>
                        <td>{formatCount(row.periodsCount)}</td>
                        <td>{formatCount(row.componentsCount)}</td>
                        <td>{renderState(row)}</td>
                      </tr>
                      {expandedGroups.has(row.key) ? (
                        <tr className="analytics-periods-row">
                          <td colSpan={6}>
                            <div className="analytics-period-list">
                              {row.periods.map((period) => (
                                <div key={period.key} className="analytics-period-block">
                                  <div className="analytics-period-header">
                                    <button type="button" className="analytics-period-toggle" onClick={() => togglePeriod(period.key)}>
                                      <span className={`analytics-expand-chevron${expandedPeriods.has(period.key) ? ' expanded' : ''}`}>›</span>
                                      <span className="analytics-cell-stack">
                                        <span className="analytics-cell-top">{formatDate(period.dateSinceUtc)} - {formatDate(period.dateToUtc)}</span>
                                        <span className="analytics-cell-middle">{period.licenseNumber}</span>
                                        <span className="analytics-cell-bottom">{formatCount(period.componentsCount)} строк состава · {period.activeAtPeriodEnd ? 'Активен на конец периода' : 'Не активен на конец периода'}</span>
                                      </span>
                                    </button>
                                    {renderState(period)}
                                    <button
                                      type="button"
                                      className="secondary-button button-inline icon-button analytics-download-button"
                                      onClick={() => void downloadLicenseFile(row.clientId, period.licenseFileName || `${row.licenseNumber}.lic`)}
                                      disabled={!period.hasLicenseFile}
                                      aria-label="Скачать файл лицензии"
                                      title={period.hasLicenseFile ? `Скачать ${period.licenseFileName || 'файл лицензии'}` : 'Файл лицензии не найден'}
                                    >
                                      <ActionIcon kind="download" />
                                    </button>
                                  </div>
                                  {expandedPeriods.has(period.key) ? (
                                    <div className="analytics-components">
                                      <div className="analytics-components-head">
                                        <TextHeader label="Состав лицензии" />
                                      </div>
                                      {period.components.map((component) => (
                                        <div key={component.id} className="analytics-component-row">
                                          <span className="analytics-cell-stack">
                                            <span className="analytics-cell-top">{component.modification || component.product || 'Парус'}</span>
                                            <span className="analytics-cell-middle">{component.nomenclature || 'Номенклатура не указана'}</span>
                                          </span>
                                          {component.quantity ? (
                                            <span className="analytics-component-quantity">{formatQuantity(component.quantity)}</span>
                                          ) : null}
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
                    );
                  })}
                  {groups.length === 0 ? (
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
              totalCount={groupsTotalCount}
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

      {infoModal ? (
        <div className="modal-overlay" role="presentation" onMouseDown={() => setInfoModal(null)}>
          <div className="modal-window analytics-info-modal" role="dialog" aria-modal="true" aria-labelledby="analytics-info-title" onMouseDown={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div className="field-hint">Расчет показателя</div>
                <h3 id="analytics-info-title" className="modal-title">{infoModal.title}</h3>
              </div>
              <button type="button" className="modal-close" onClick={() => setInfoModal(null)} aria-label="Закрыть">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="analytics-info-modal-text">{infoModal.description}</p>
            </div>
            <div className="modal-actions">
              <button type="button" className="primary-button button-inline" onClick={() => setInfoModal(null)}>
                Понятно
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { downloadParusLicenseFile, getParusLicenseAnalytics } from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { useAuth } from '../app/AuthContext';
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
const GROUP_EXPORT_PAGE_SIZE = 100;
const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const ANNUAL_ANALYTICS_STORAGE_ID = 'parus-annual-analytics';
const ANALYTICS_PERIOD_STORAGE_ID = 'parus-period';
const GROUP_STATUS_OPTIONS = [
  { value: 'all', label: 'Все статусы' },
  { value: 'active', label: 'Действуют' },
  { value: 'expired', label: 'Просрочены' },
  { value: 'renewed', label: 'Продлены' },
  { value: 'without-renewal', label: 'Без продления' },
  { value: 'expiring', label: 'Заканчиваются' },
  { value: 'new', label: 'Новые' },
  { value: 'lost', label: 'Ушли' }
];

interface InfoDetails {
  label: string;
  title: string;
  description: string;
}

const STATUS_FILTER_INFO: InfoDetails = {
  label: 'Статус',
  title: 'Как работает фильтр статуса',
  description: 'Фильтр отбирает группы лицензий по расчетному состоянию на выбранный период. Например, "Заканчиваются" показывает лицензии, у которых последний известный период завершился внутри диапазона и нет более позднего продления; "Без продления" смотрит на последний период без привязки к дате окончания внутри диапазона.'
};

interface AnalyticsPeriodRange {
  from: string;
  to: string;
}

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

function toApiDate(value: string) {
  return `${value}T00:00:00.000Z`;
}

function formatCount(value: number) {
  return new Intl.NumberFormat('ru-RU').format(value);
}

function formatInputDate(value: string) {
  return dayjs(value).format('DD.MM.YYYY');
}

function parseInputDate(value: string) {
  const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  const parsed = dayjs(`${year}-${month}-${day}`);
  return parsed.isValid() && parsed.format('DD.MM.YYYY') === value
    ? parsed.format('YYYY-MM-DD')
    : null;
}

function formatTypedDate(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean);
  return parts.join('.');
}

function saveBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function formatQuantity(value?: string) {
  if (!value) {
    return '';
  }

  const number = Number(value.replace(',', '.'));
  return Number.isFinite(number) ? formatCount(number) : value;
}

function getGroupStatusLabel(value: string) {
  return GROUP_STATUS_OPTIONS.find((option) => option.value === value)?.label ?? GROUP_STATUS_OPTIONS[0].label;
}

function escapeXmlValue(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type SpreadsheetCellValue = string | number | null | undefined;

interface SpreadsheetCellConfig {
  value: SpreadsheetCellValue;
  styleId?: string;
  mergeAcross?: number;
}

type SpreadsheetCell = SpreadsheetCellValue | SpreadsheetCellConfig;

function isSpreadsheetCellConfig(value: SpreadsheetCell): value is SpreadsheetCellConfig {
  return typeof value === 'object' && value !== null && 'value' in value;
}

function toSpreadsheetCell(value: SpreadsheetCell): SpreadsheetCellConfig {
  return isSpreadsheetCellConfig(value)
    ? value
    : { value };
}

function buildSpreadsheetCell(cellValue: SpreadsheetCell, defaultStyleId?: string) {
  const cell = toSpreadsheetCell(cellValue);
  const isNumber = typeof cell.value === 'number' && Number.isFinite(cell.value);
  const styleId = cell.styleId ?? defaultStyleId;
  const style = styleId ? ` ss:StyleID="${styleId}"` : '';
  const merge = cell.mergeAcross ? ` ss:MergeAcross="${cell.mergeAcross}"` : '';
  return `<Cell${style}${merge}><Data ss:Type="${isNumber ? 'Number' : 'String'}">${escapeXmlValue(cell.value)}</Data></Cell>`;
}

function buildSpreadsheetRow(cells: SpreadsheetCell[], defaultStyleId?: string, height?: number) {
  const rowHeight = height ? ` ss:Height="${height}"` : '';
  return `<Row${rowHeight}>${cells.map((cell) => buildSpreadsheetCell(cell, defaultStyleId)).join('')}</Row>`;
}

function buildSpreadsheetWorksheet(name: string, rows: string[], columnWidths: number[], frozenHeaderRow?: number) {
  const columns = columnWidths.map((width) => `<Column ss:Width="${width}" />`).join('');
  const worksheetOptions = frozenHeaderRow
    ? `<WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel"><FreezePanes/><FrozenNoSplit/><SplitHorizontal>${frozenHeaderRow}</SplitHorizontal><TopRowBottomPane>${frozenHeaderRow}</TopRowBottomPane><ActivePane>2</ActivePane></WorksheetOptions>`
    : '';
  return `<Worksheet ss:Name="${escapeXmlValue(name)}"><Table>${columns}${rows.join('')}</Table>${worksheetOptions}</Worksheet>`;
}

function buildCell(value: string | number | null | undefined, styleId?: string, mergeAcross?: number): SpreadsheetCell {
  return { value, styleId, mergeAcross };
}

function parseQuantityNumber(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

function getWorkbookStatusStyle(row: {
  activeAtPeriodEnd: boolean;
  withoutRenewal?: boolean;
  expiredAtPeriodEnd: boolean;
}) {
  if (row.activeAtPeriodEnd) {
    return 'StatusActive';
  }

  if (row.withoutRenewal) {
    return 'StatusDanger';
  }

  return row.expiredAtPeriodEnd ? 'StatusMuted' : 'Cell';
}

function getRowStyle(index: number) {
  return index % 2 === 0 ? 'Cell' : 'CellAlt';
}

function getNumberStyle(index: number) {
  return index % 2 === 0 ? 'Number' : 'NumberAlt';
}

function buildLicenseGroupsWorkbook(
  groups: ParusLicenseAnalyticsOrganizationGroupDto[],
  range: AnalyticsPeriodRange,
  status: string
) {
  const title = `Отчет по группам лицензий Парус за период ${formatInputDate(range.from)} - ${formatInputDate(range.to)}`;
  const statusLabel = getGroupStatusLabel(status);
  const generatedAt = dayjs().format('DD.MM.YYYY HH:mm');
  const totals = groups.reduce(
    (accumulator, row) => ({
      databaseCount: accumulator.databaseCount + row.databaseCount,
      organizationCount: accumulator.organizationCount + row.organizationCount,
      extraWorkplaces: accumulator.extraWorkplaces + row.extraWorkplaces,
      periodsCount: accumulator.periodsCount + row.periodsCount,
      componentsCount: accumulator.componentsCount + row.componentsCount
    }),
    { databaseCount: 0, organizationCount: 0, extraWorkplaces: 0, periodsCount: 0, componentsCount: 0 }
  );
  const organizationRows = [
    buildSpreadsheetRow([buildCell(title, 'Title', 9)], undefined, 28),
    buildSpreadsheetRow([buildCell(`Период: ${formatInputDate(range.from)} - ${formatInputDate(range.to)}   |   Статус: ${statusLabel}   |   Сформировано: ${generatedAt}`, 'Subtitle', 9)], undefined, 22),
    buildSpreadsheetRow([buildCell('', 'Spacer', 9)], undefined, 8),
    buildSpreadsheetRow(['Организация', 'ИНН', 'Мнемоника', 'Лицензия', 'Баз', 'Организаций в базах', 'Доп. мест', 'Периодов', 'Строк состава', 'Статус'], 'Header', 24),
    ...groups.map((row, index) => {
      const rowStyle = getRowStyle(index);
      const numberStyle = getNumberStyle(index);
      return buildSpreadsheetRow([
        buildCell(row.clientName, rowStyle),
        buildCell(row.inn || '', rowStyle),
        buildCell(row.mnemoOrg || '', rowStyle),
        buildCell(row.licenseNumber, rowStyle),
        buildCell(row.databaseCount, numberStyle),
        buildCell(row.organizationCount, numberStyle),
        buildCell(row.extraWorkplaces, numberStyle),
        buildCell(row.periodsCount, numberStyle),
        buildCell(row.componentsCount, numberStyle),
        buildCell(getGroupExportStatus(row), getWorkbookStatusStyle(row))
      ], undefined, 22);
    }),
    buildSpreadsheetRow([
      buildCell('Итого', 'Total', 3),
      buildCell(totals.databaseCount, 'TotalNumber'),
      buildCell(totals.organizationCount, 'TotalNumber'),
      buildCell(totals.extraWorkplaces, 'TotalNumber'),
      buildCell(totals.periodsCount, 'TotalNumber'),
      buildCell(totals.componentsCount, 'TotalNumber'),
      buildCell('', 'Total')
    ], undefined, 23)
  ];

  const componentDataRows = groups.flatMap((row) => {
    const periodRows = row.periods.flatMap((period) => {
      if (period.components.length === 0) {
        return [{
          row,
          period,
          product: '',
          modification: '',
          nomenclature: '',
          quantity: null,
          number: '',
          note: 'Состав не указан'
        }];
      }

      return period.components.map((component) => ({
        row,
        period,
        product: component.product || '',
        modification: component.modification || '',
        nomenclature: component.nomenclature || '',
        quantity: parseQuantityNumber(component.quantity) ?? formatQuantity(component.quantity),
        number: component.number || '',
        note: ''
      }));
    });

    return periodRows.length > 0
      ? periodRows
      : [{
          row,
          period: null,
          product: '',
          modification: '',
          nomenclature: '',
          quantity: null,
          number: '',
          note: 'Периоды не найдены'
        }];
  });
  const totalPlaces = componentDataRows.reduce(
    (sum, item) => sum + (typeof item.quantity === 'number' ? item.quantity : 0),
    0
  );
  const componentRows = [
    buildSpreadsheetRow([buildCell('Состав лицензий и количество мест', 'Title', 10)], undefined, 28),
    buildSpreadsheetRow([buildCell(`Период: ${formatInputDate(range.from)} - ${formatInputDate(range.to)}   |   Статус: ${statusLabel}   |   Строк состава: ${componentDataRows.length}`, 'Subtitle', 10)], undefined, 22),
    buildSpreadsheetRow([buildCell('', 'Spacer', 10)], undefined, 8),
    buildSpreadsheetRow(['Организация', 'ИНН', 'Мнемоника', 'Лицензия', 'Период действия', 'Продукт', 'Модификация', 'Номенклатура', 'Кол-во мест', 'Номер строки', 'Примечание'], 'Header', 24),
    ...componentDataRows.map((item, index) => {
      const rowStyle = getRowStyle(index);
      const numberStyle = getNumberStyle(index);
      return buildSpreadsheetRow([
        buildCell(item.row.clientName, rowStyle),
        buildCell(item.row.inn || '', rowStyle),
        buildCell(item.row.mnemoOrg || '', rowStyle),
        buildCell(item.period?.licenseNumber || item.row.licenseNumber, rowStyle),
        buildCell(item.period ? `${formatDate(item.period.dateSinceUtc)} - ${formatDate(item.period.dateToUtc)}` : '', rowStyle),
        buildCell(item.product, rowStyle),
        buildCell(item.modification, rowStyle),
        buildCell(item.nomenclature, rowStyle),
        buildCell(item.quantity, typeof item.quantity === 'number' ? numberStyle : rowStyle),
        buildCell(item.number, rowStyle),
        buildCell(item.note, item.note ? 'Note' : rowStyle)
      ], undefined, 22);
    }),
    buildSpreadsheetRow([
      buildCell('Итого мест', 'Total', 7),
      buildCell(totalPlaces, 'TotalNumber'),
      buildCell('', 'Total', 1)
    ], undefined, 23)
  ];

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>${escapeXmlValue(title)}</Title>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="Default" ss:Name="Normal"><Alignment ss:Vertical="Center" ss:WrapText="1" /><Font ss:FontName="Calibri" ss:Size="11" /><Interior ss:Color="#FFFFFF" ss:Pattern="Solid" /></Style>
    <Style ss:ID="Title"><Alignment ss:Vertical="Center" /><Font ss:FontName="Calibri" ss:Size="16" ss:Bold="1" ss:Color="#0F172A" /><Interior ss:Color="#DDEBFF" ss:Pattern="Solid" /></Style>
    <Style ss:ID="Subtitle"><Alignment ss:Vertical="Center" /><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#475569" /><Interior ss:Color="#F8FBFF" ss:Pattern="Solid" /></Style>
    <Style ss:ID="Spacer"><Interior ss:Color="#FFFFFF" ss:Pattern="Solid" /></Style>
    <Style ss:ID="Header"><Alignment ss:Horizontal="Center" ss:Vertical="Center" ss:WrapText="1" /><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF" /><Interior ss:Color="#2563EB" ss:Pattern="Solid" /><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1D4ED8" /><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#93C5FD" /><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#93C5FD" /><Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#1D4ED8" /></Borders></Style>
    <Style ss:ID="Cell"><Alignment ss:Vertical="Center" ss:WrapText="1" /><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2F1" /><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0" /><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0" /></Borders></Style>
    <Style ss:ID="CellAlt"><Alignment ss:Vertical="Center" ss:WrapText="1" /><Interior ss:Color="#F8FAFC" ss:Pattern="Solid" /><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2F1" /><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0" /><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0" /></Borders></Style>
    <Style ss:ID="Number"><Alignment ss:Horizontal="Right" ss:Vertical="Center" /><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2F1" /><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0" /><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0" /></Borders></Style>
    <Style ss:ID="NumberAlt"><Alignment ss:Horizontal="Right" ss:Vertical="Center" /><Interior ss:Color="#F8FAFC" ss:Pattern="Solid" /><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#D8E2F1" /><Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0" /><Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E2E8F0" /></Borders></Style>
    <Style ss:ID="StatusActive"><Alignment ss:Horizontal="Center" ss:Vertical="Center" /><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#047857" /><Interior ss:Color="#D1FAE5" ss:Pattern="Solid" /></Style>
    <Style ss:ID="StatusDanger"><Alignment ss:Horizontal="Center" ss:Vertical="Center" /><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#B91C1C" /><Interior ss:Color="#FEE2E2" ss:Pattern="Solid" /></Style>
    <Style ss:ID="StatusMuted"><Alignment ss:Horizontal="Center" ss:Vertical="Center" /><Font ss:FontName="Calibri" ss:Size="10" ss:Bold="1" ss:Color="#64748B" /><Interior ss:Color="#E2E8F0" ss:Pattern="Solid" /></Style>
    <Style ss:ID="Note"><Alignment ss:Vertical="Center" ss:WrapText="1" /><Font ss:FontName="Calibri" ss:Size="10" ss:Color="#92400E" /><Interior ss:Color="#FEF3C7" ss:Pattern="Solid" /><Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#FDE68A" /></Borders></Style>
    <Style ss:ID="Total"><Alignment ss:Vertical="Center" /><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A" /><Interior ss:Color="#EAF1FF" ss:Pattern="Solid" /></Style>
    <Style ss:ID="TotalNumber"><Alignment ss:Horizontal="Right" ss:Vertical="Center" /><Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#0F172A" /><Interior ss:Color="#EAF1FF" ss:Pattern="Solid" /></Style>
  </Styles>
  ${buildSpreadsheetWorksheet('Организации', organizationRows, [260, 105, 160, 95, 60, 130, 90, 85, 100, 125], 4)}
  ${buildSpreadsheetWorksheet('Состав лицензий', componentRows, [260, 105, 155, 95, 155, 140, 220, 290, 85, 95, 150], 4)}
</Workbook>`;
}

function InfoHeader({ label, info, onOpen }: { label: string; info: InfoDetails; onOpen: (info: InfoDetails) => void }) {
  return (
    <span className="analytics-info-header">
      <span>{label}</span>
      <button type="button" className="analytics-info-icon" aria-label={`Подробнее: ${label}`} onClick={() => onOpen(info)}>
        i
        <span className="analytics-info-tooltip" role="tooltip">
          <strong>{info.title}</strong>
          <span>{info.description}</span>
        </span>
      </button>
    </span>
  );
}

function TextHeader({ label }: { label: string }) {
  return <span className="analytics-info-header">{label}</span>;
}

function AnalyticsDatePicker({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(() => formatInputDate(value));
  const [visibleMonth, setVisibleMonth] = useState(() => dayjs(value).startOf('month'));
  const monthStart = visibleMonth.startOf('month');
  const firstDayOffset = (monthStart.day() + 6) % 7;
  const daysInMonth = visibleMonth.daysInMonth();
  const cells = [
    ...Array.from({ length: firstDayOffset }, () => null as number | null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];

  useEffect(() => {
    setInputValue(formatInputDate(value));
    setVisibleMonth(dayjs(value).startOf('month'));
  }, [value]);

  const commitInput = (nextValue: string) => {
    const parsed = parseInputDate(nextValue);
    if (parsed) {
      onChange(parsed);
    }
  };

  return (
    <div className="field analytics-date-field">
      <label id={`${id}-label`}>{label}</label>
      <div
        className="analytics-date-picker"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      >
        <div className={`analytics-date-control${open ? ' open' : ''}`}>
          <input
            id={id}
            className="analytics-date-input"
            inputMode="numeric"
            aria-labelledby={`${id}-label`}
            value={inputValue}
            onChange={(event) => {
              const nextValue = formatTypedDate(event.target.value);
              setInputValue(nextValue);
              commitInput(nextValue);
            }}
            onBlur={() => {
              if (!parseInputDate(inputValue)) {
                setInputValue(formatInputDate(value));
              }
            }}
          />
          <button
            type="button"
            className="analytics-date-trigger"
            aria-label={`Открыть календарь: ${label}`}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="analytics-date-icon" aria-hidden="true">▦</span>
          </button>
        </div>
        {open ? (
          <div className="analytics-calendar-popover">
            <div className="analytics-calendar-header">
              <button type="button" className="analytics-calendar-nav" onClick={() => setVisibleMonth((current) => current.subtract(1, 'month'))}>‹</button>
              <strong>{visibleMonth.format('MM.YYYY')}</strong>
              <button type="button" className="analytics-calendar-nav" onClick={() => setVisibleMonth((current) => current.add(1, 'month'))}>›</button>
            </div>
            <div className="analytics-calendar-grid analytics-calendar-weekdays">
              {WEEK_DAYS.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="analytics-calendar-grid">
              {cells.map((day, index) => {
                if (day === null) {
                  return <span key={`empty-${index}`} className="analytics-calendar-empty" />;
                }

                const current = visibleMonth.date(day);
                const currentValue = current.format('YYYY-MM-DD');
                return (
                  <button
                    type="button"
                    key={currentValue}
                    className={`analytics-calendar-day${currentValue === value ? ' selected' : ''}${current.isSame(dayjs(), 'day') ? ' today' : ''}`}
                    onClick={() => {
                      onChange(currentValue);
                      setOpen(false);
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
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

function getGroupExportStatus(row: {
  activeAtPeriodEnd: boolean;
  withoutRenewal?: boolean;
  expiredAtPeriodEnd: boolean;
}) {
  if (row.activeAtPeriodEnd) {
    return 'Действует';
  }

  if (row.withoutRenewal) {
    return 'Без продления';
  }

  if (row.expiredAtPeriodEnd) {
    return 'Просрочена';
  }

  return 'История';
}

function buildLicenseMeta(row: ParusLicenseAnalyticsOrganizationGroupDto) {
  return [
    row.databaseCount > 0 ? `Баз: ${formatCount(row.databaseCount)}` : null,
    row.organizationCount > 0 ? `Организаций в базах: ${formatCount(row.organizationCount)}` : null,
    row.extraWorkplaces > 0 ? `Доп. мест: ${formatCount(row.extraWorkplaces)}` : null,
    row.licenseComposition || null
  ].filter(Boolean).join(' · ');
}

function StatusCombobox({
  value,
  options,
  onChange
}: {
  value: string;
  options: typeof GROUP_STATUS_OPTIONS;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = getGroupStatusLabel(value);

  return (
    <div
      className="analytics-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="analytics-combobox-button analytics-groups-status"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Фильтр по статусу"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedLabel}</span>
        <ActionIcon kind="chevronDown" />
      </button>
      {open ? (
        <div className="analytics-combobox-menu" role="listbox" aria-label="Фильтр по статусу">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              data-value={option.value}
              aria-selected={option.value === value}
              className={`analytics-combobox-option${option.value === value ? ' selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
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

  const load = async (range = appliedRange, page = groupPage, search = groupSearch, status = groupStatus, pageSize = groupPageSize) => {
    setLoading(true);
    try {
      setAnalytics(await getParusLicenseAnalytics({
        dateFromUtc: toApiDate(range.from),
        dateToUtc: toApiDate(range.to),
        search: search.trim() || undefined,
        status,
        skip: (page - 1) * pageSize,
        take: pageSize
      }));
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить аналитику лицензий.'), 'error', 4000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load(appliedRange, groupPage, groupSearch, groupStatus, groupPageSize);
    }, 250);

    return () => window.clearTimeout(handle);
  }, [appliedRange, groupPage, groupPageSize, groupSearch, groupStatus]);

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

      const workbook = buildLicenseGroupsWorkbook(loadedGroups, appliedRange, groupStatus);
      saveBlob(
        new Blob([workbook], { type: 'application/vnd.ms-excel;charset=utf-8' }),
        `parus-license-groups-${appliedRange.from}-${appliedRange.to}.xls`
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
  }, [groupSearch, groupStatus]);

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
                <button
                  type="button"
                  className="secondary-button button-inline"
                  onClick={() => {
                    setGroupSearch('');
                    setGroupStatus('all');
                  }}
                  disabled={!groupSearch && groupStatus === 'all'}
                >
                  Сбросить
                </button>
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
                              <span className="analytics-cell-middle">{row.inn ? `ИНН ${row.inn}` : 'ИНН не указан'}</span>
                              <span className="analytics-cell-bottom">{row.mnemoOrg || 'Мнемоника не указана'}</span>
                            </span>
                          </button>
                        </td>
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
                          <td colSpan={5}>
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

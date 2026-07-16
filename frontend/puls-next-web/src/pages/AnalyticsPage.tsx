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

type XlsxCellValue = string | number | null | undefined;

interface XlsxCell {
  value?: XlsxCellValue;
  style?: number;
  mergeAcross?: number;
}

interface XlsxRow {
  cells: XlsxCell[];
  height?: number;
}

interface XlsxWorksheet {
  name: string;
  columns: number[];
  rows: XlsxRow[];
  showGridLines?: boolean;
  freezeRow?: number;
  printArea?: string;
  landscape?: boolean;
}

interface ZipFileEntry {
  path: string;
  content: string | Uint8Array;
}

const XLSX_STYLES = {
  default: 0,
  title: 1,
  subtitle: 2,
  spacer: 3,
  header: 4,
  cell: 5,
  cellAlt: 6,
  number: 7,
  numberAlt: 8,
  statusActive: 9,
  statusDanger: 10,
  statusMuted: 11,
  note: 12,
  total: 13,
  totalNumber: 14,
  printTitle: 15,
  printLabel: 16,
  printValue: 17,
  printHeader: 18,
  printCell: 19,
  printNumber: 20,
  printCheck: 21,
  printChecked: 22,
  printFooterLabel: 23,
  printFooterValue: 24
} as const;

function buildCell(value: XlsxCellValue, style?: number, mergeAcross?: number): XlsxCell {
  return { value, style, mergeAcross };
}

function buildRow(cells: XlsxCell[], height?: number): XlsxRow {
  return { cells, height };
}

function getColumnName(index: number) {
  let column = '';
  let current = index;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }

  return column;
}

function buildXlsxCellXml(cell: XlsxCell, rowIndex: number, columnIndex: number) {
  const reference = `${getColumnName(columnIndex)}${rowIndex}`;
  const style = cell.style === undefined ? '' : ` s="${cell.style}"`;

  if (cell.value === null || cell.value === undefined || cell.value === '') {
    return `<c r="${reference}"${style}/>`;
  }

  if (typeof cell.value === 'number' && Number.isFinite(cell.value)) {
    return `<c r="${reference}"${style}><v>${cell.value}</v></c>`;
  }

  return `<c r="${reference}"${style} t="inlineStr"><is><t>${escapeXmlValue(cell.value)}</t></is></c>`;
}

function buildXlsxWorksheetXml(sheet: XlsxWorksheet) {
  const merges: string[] = [];
  const columns = sheet.columns
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const rows = sheet.rows.map((row, rowIndex) => {
    const excelRowIndex = rowIndex + 1;
    let columnIndex = 1;
    const cells = row.cells.map((cell) => {
      const cellXml = buildXlsxCellXml(cell, excelRowIndex, columnIndex);
      if (cell.mergeAcross && cell.mergeAcross > 0) {
        merges.push(`${getColumnName(columnIndex)}${excelRowIndex}:${getColumnName(columnIndex + cell.mergeAcross)}${excelRowIndex}`);
        columnIndex += cell.mergeAcross + 1;
      } else {
        columnIndex += 1;
      }
      return cellXml;
    }).join('');
    const height = row.height ? ` ht="${row.height}" customHeight="1"` : '';
    return `<row r="${excelRowIndex}"${height}>${cells}</row>`;
  }).join('');
  const pane = sheet.freezeRow
    ? `<pane ySplit="${sheet.freezeRow}" topLeftCell="A${sheet.freezeRow + 1}" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft"/>`
    : '<selection activeCell="A1" sqref="A1"/>';
  const mergeXml = merges.length > 0
    ? `<mergeCells count="${merges.length}">${merges.map((ref) => `<mergeCell ref="${ref}"/>`).join('')}</mergeCells>`
    : '';
  const pageSetup = sheet.landscape
    ? '<pageMargins left="0.25" right="0.25" top="0.35" bottom="0.35" header="0.1" footer="0.1"/><pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>'
    : '<pageMargins left="0.35" right="0.35" top="0.45" bottom="0.45" header="0.1" footer="0.1"/><pageSetup fitToWidth="1" fitToHeight="0"/>';

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>
  <sheetViews><sheetView showGridLines="${sheet.showGridLines === false ? '0' : '1'}" workbookViewId="0">${pane}</sheetView></sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>${columns}</cols>
  <sheetData>${rows}</sheetData>
  ${mergeXml}
  ${pageSetup}
</worksheet>`;
}

function buildXlsxStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="8">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><sz val="10"/><color rgb="FF475569"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF047857"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFB91C1C"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
  </fonts>
  <fills count="12">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFFFFFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFDDEBFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FBFF"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF2563EB"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFF8FAFC"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFD1FAE5"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>
    <fill><patternFill patternType="solid"><fgColor rgb="FF595959"/><bgColor indexed="64"/></patternFill></fill>
  </fills>
  <borders count="4">
    <border><left/><right/><top/><bottom/><diagonal/></border>
    <border><left style="thin"><color rgb="FFE2E8F0"/></left><right style="thin"><color rgb="FFE2E8F0"/></right><top/><bottom style="thin"><color rgb="FFD8E2F1"/></bottom><diagonal/></border>
    <border><left style="thin"><color rgb="FF93C5FD"/></left><right style="thin"><color rgb="FF93C5FD"/></right><top style="thin"><color rgb="FF1D4ED8"/></top><bottom style="thin"><color rgb="FF1D4ED8"/></bottom><diagonal/></border>
    <border><left style="thin"><color rgb="FF7F7F7F"/></left><right style="thin"><color rgb="FF7F7F7F"/></right><top style="thin"><color rgb="FF7F7F7F"/></top><bottom style="thin"><color rgb="FF7F7F7F"/></bottom><diagonal/></border>
  </borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="25">
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="2" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="4" fillId="7" borderId="1" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="5" fillId="8" borderId="1" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="6" fillId="9" borderId="1" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="10" borderId="1" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="7" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="7" fillId="3" borderId="1" xfId="0" applyFill="1" applyFont="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="3" fillId="11" borderId="3" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="3" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="3" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="3" fillId="11" borderId="3" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="3" xfId="0" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="3" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="3" xfId="0" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="10" borderId="3" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="7" fillId="2" borderId="3" xfId="0" applyFont="1" applyBorder="1"><alignment horizontal="right" vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="3" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
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
    return XLSX_STYLES.statusActive;
  }

  if (row.withoutRenewal) {
    return XLSX_STYLES.statusDanger;
  }

  return row.expiredAtPeriodEnd ? XLSX_STYLES.statusMuted : XLSX_STYLES.cell;
}

function getRowStyle(index: number) {
  return index % 2 === 0 ? XLSX_STYLES.cell : XLSX_STYLES.cellAlt;
}

function getNumberStyle(index: number) {
  return index % 2 === 0 ? XLSX_STYLES.number : XLSX_STYLES.numberAlt;
}

function getCrc32Table() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
}

const CRC32_TABLE = getCrc32Table();

function getCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeUint16(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

function writeUint32(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

function createZip(files: ZipFileEntry[]) {
  const encoder = new TextEncoder();
  const preparedFiles = files.map((file) => ({
    pathBytes: encoder.encode(file.path),
    data: typeof file.content === 'string' ? encoder.encode(file.content) : file.content
  }));
  const localRecords: Uint8Array[] = [];
  const centralRecords: Uint8Array[] = [];
  let offset = 0;

  for (const file of preparedFiles) {
    const crc = getCrc32(file.data);
    const localHeader = new Uint8Array(30 + file.pathBytes.length);
    writeUint32(localHeader, 0, 0x04034b50);
    writeUint16(localHeader, 4, 20);
    writeUint16(localHeader, 6, 0);
    writeUint16(localHeader, 8, 0);
    writeUint16(localHeader, 10, 0);
    writeUint16(localHeader, 12, 0);
    writeUint32(localHeader, 14, crc);
    writeUint32(localHeader, 18, file.data.length);
    writeUint32(localHeader, 22, file.data.length);
    writeUint16(localHeader, 26, file.pathBytes.length);
    writeUint16(localHeader, 28, 0);
    localHeader.set(file.pathBytes, 30);
    localRecords.push(localHeader, file.data);

    const centralHeader = new Uint8Array(46 + file.pathBytes.length);
    writeUint32(centralHeader, 0, 0x02014b50);
    writeUint16(centralHeader, 4, 20);
    writeUint16(centralHeader, 6, 20);
    writeUint16(centralHeader, 8, 0);
    writeUint16(centralHeader, 10, 0);
    writeUint16(centralHeader, 12, 0);
    writeUint16(centralHeader, 14, 0);
    writeUint32(centralHeader, 16, crc);
    writeUint32(centralHeader, 20, file.data.length);
    writeUint32(centralHeader, 24, file.data.length);
    writeUint16(centralHeader, 28, file.pathBytes.length);
    writeUint16(centralHeader, 30, 0);
    writeUint16(centralHeader, 32, 0);
    writeUint16(centralHeader, 34, 0);
    writeUint16(centralHeader, 36, 0);
    writeUint32(centralHeader, 38, 0);
    writeUint32(centralHeader, 42, offset);
    centralHeader.set(file.pathBytes, 46);
    centralRecords.push(centralHeader);
    offset += localHeader.length + file.data.length;
  }

  const centralSize = centralRecords.reduce((sum, record) => sum + record.length, 0);
  const endRecord = new Uint8Array(22);
  writeUint32(endRecord, 0, 0x06054b50);
  writeUint16(endRecord, 4, 0);
  writeUint16(endRecord, 6, 0);
  writeUint16(endRecord, 8, preparedFiles.length);
  writeUint16(endRecord, 10, preparedFiles.length);
  writeUint32(endRecord, 12, centralSize);
  writeUint32(endRecord, 16, offset);
  writeUint16(endRecord, 20, 0);

  const output = new Uint8Array(offset + centralSize + endRecord.length);
  let cursor = 0;
  for (const record of [...localRecords, ...centralRecords, endRecord]) {
    output.set(record, cursor);
    cursor += record.length;
  }
  return output;
}

function buildXlsxWorkbookXml(sheets: XlsxWorksheet[]) {
  const sheetXml = sheets.map((sheet, index) => (
    `<sheet name="${escapeXmlValue(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  )).join('');
  const printAreas = sheets
    .map((sheet, index) => sheet.printArea
      ? `<definedName name="_xlnm.Print_Area" localSheetId="${index}">'${escapeXmlValue(sheet.name)}'!${sheet.printArea}</definedName>`
      : '')
    .join('');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetXml}</sheets>
  ${printAreas ? `<definedNames>${printAreas}</definedNames>` : ''}
</workbook>`;
}

function buildXlsxWorkbookRelsXml(sheets: XlsxWorksheet[]) {
  const sheetRels = sheets.map((_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildXlsxContentTypesXml(sheets: XlsxWorksheet[]) {
  const sheetOverrides = sheets.map((_, index) => (
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  )).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`;
}

function buildXlsxPackage(sheets: XlsxWorksheet[]) {
  return createZip([
    { path: '[Content_Types].xml', content: buildXlsxContentTypesXml(sheets) },
    {
      path: '_rels/.rels',
      content: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
    },
    { path: 'xl/workbook.xml', content: buildXlsxWorkbookXml(sheets) },
    { path: 'xl/_rels/workbook.xml.rels', content: buildXlsxWorkbookRelsXml(sheets) },
    { path: 'xl/styles.xml', content: buildXlsxStylesXml() },
    ...sheets.map((sheet, index) => ({
      path: `xl/worksheets/sheet${index + 1}.xml`,
      content: buildXlsxWorksheetXml(sheet)
    }))
  ]);
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
    buildRow([buildCell(title, XLSX_STYLES.title, 9)], 28),
    buildRow([buildCell(`Период: ${formatInputDate(range.from)} - ${formatInputDate(range.to)}   |   Статус: ${statusLabel}   |   Сформировано: ${generatedAt}`, XLSX_STYLES.subtitle, 9)], 22),
    buildRow([buildCell('', XLSX_STYLES.spacer, 9)], 8),
    buildRow(
      ['Организация', 'ИНН', 'Мнемоника', 'Лицензия', 'Баз', 'Организаций в базах', 'Доп. мест', 'Периодов', 'Строк состава', 'Статус']
        .map((label) => buildCell(label, XLSX_STYLES.header)),
      24
    ),
    ...groups.map((row, index) => {
      const rowStyle = getRowStyle(index);
      const numberStyle = getNumberStyle(index);
      return buildRow([
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
      ], 22);
    }),
    buildRow([
      buildCell('Итого', XLSX_STYLES.total, 3),
      buildCell(totals.databaseCount, XLSX_STYLES.totalNumber),
      buildCell(totals.organizationCount, XLSX_STYLES.totalNumber),
      buildCell(totals.extraWorkplaces, XLSX_STYLES.totalNumber),
      buildCell(totals.periodsCount, XLSX_STYLES.totalNumber),
      buildCell(totals.componentsCount, XLSX_STYLES.totalNumber),
      buildCell('', XLSX_STYLES.total)
    ], 23)
  ];

  const printRows = groups.flatMap((row, groupIndex) => {
    const componentRows = row.periods.flatMap((period) => {
      const periodComponents = period.components.length > 0
        ? period.components
        : [{
            product: 'Парус',
            modification: 'Состав не указан',
            nomenclature: '',
            quantity: '',
            number: '',
            regNumberAbonement: '',
            regNumberClient: ''
          }];

      return periodComponents.map((component) => ({
        period,
        product: component.nomenclature || component.product || 'Парус',
        code: component.number || component.regNumberClient || component.regNumberAbonement || '',
        module: component.modification || 'Состав лицензии',
        quantity: parseQuantityNumber(component.quantity) ?? (formatQuantity(component.quantity) || '')
      }));
    });

    const printableComponents = componentRows.length > 0
      ? componentRows
      : [{
          period: null,
          product: 'Парус',
          code: '',
          module: 'Периоды не найдены',
          quantity: ''
        }];

    const latestPeriod = row.periods[0] ?? null;
    const totalPlaces = printableComponents.reduce(
      (sum, item) => sum + (typeof item.quantity === 'number' ? item.quantity : 0),
      0
    );
    const blockRows = [
      buildRow([buildCell(row.clientName, XLSX_STYLES.printTitle, 11)], 24),
      buildRow([
        buildCell('№ заказа', XLSX_STYLES.printLabel, 1),
        buildCell('Дата', XLSX_STYLES.printLabel, 1),
        buildCell('Статус', XLSX_STYLES.printLabel, 1),
        buildCell('Провайдер', XLSX_STYLES.printLabel, 1),
        buildCell('ИНН', XLSX_STYLES.printLabel, 1),
        buildCell('Рег. номер', XLSX_STYLES.printLabel, 1)
      ], 20),
      buildRow([
        buildCell(row.clientId, XLSX_STYLES.printValue, 1),
        buildCell(formatInputDate(range.to), XLSX_STYLES.printValue, 1),
        buildCell(getGroupExportStatus(row), XLSX_STYLES.printValue, 1),
        buildCell('ПУЛЬС ГРУП', XLSX_STYLES.printValue, 1),
        buildCell(row.inn || '', XLSX_STYLES.printValue, 1),
        buildCell(row.licenseNumber, XLSX_STYLES.printValue, 1)
      ], 22),
      buildRow([
        buildCell('№', XLSX_STYLES.printHeader),
        buildCell('Номенклатура', XLSX_STYLES.printHeader, 1),
        buildCell('Мнемокод', XLSX_STYLES.printHeader, 1),
        buildCell('Модуль / блок', XLSX_STYLES.printHeader, 2),
        buildCell('Кол-во мест', XLSX_STYLES.printHeader),
        buildCell('Нужен', XLSX_STYLES.printHeader),
        buildCell('Проверено, шт.', XLSX_STYLES.printHeader, 1)
      ], 30),
      ...printableComponents.map((component, index) => buildRow([
        buildCell(index + 1, XLSX_STYLES.printNumber),
        buildCell(component.product, XLSX_STYLES.printCell, 1),
        buildCell(component.code, XLSX_STYLES.printCell, 1),
        buildCell(component.module, XLSX_STYLES.printCell, 2),
        buildCell(component.quantity, typeof component.quantity === 'number' ? XLSX_STYLES.printNumber : XLSX_STYLES.printCell),
        buildCell('□', XLSX_STYLES.printCheck),
        buildCell('', XLSX_STYLES.printChecked, 1)
      ], component.module.length > 64 ? 44 : 28)),
      buildRow([
        buildCell('Итого мест', XLSX_STYLES.printFooterLabel, 7),
        buildCell(totalPlaces, XLSX_STYLES.printFooterLabel),
        buildCell('', XLSX_STYLES.printFooterValue, 2)
      ], 22),
      buildRow([
        buildCell('Лицензия', XLSX_STYLES.printLabel, 1),
        buildCell(row.licenseNumber, XLSX_STYLES.printFooterValue, 2),
        buildCell('ЛО до', XLSX_STYLES.printLabel, 1),
        buildCell(latestPeriod ? formatDate(latestPeriod.dateToUtc) : '', XLSX_STYLES.printFooterValue, 1),
        buildCell('', XLSX_STYLES.printFooterValue, 2)
      ], 22)
    ];

    if (groupIndex < groups.length - 1) {
      blockRows.push(buildRow([], 8));
    }

    return blockRows;
  });

  return buildXlsxPackage([
    {
      name: 'Организации',
      columns: [32, 14, 20, 13, 8, 18, 12, 12, 14, 16],
      rows: organizationRows,
      freezeRow: 4,
      printArea: `$A$1:$J$${organizationRows.length}`,
      showGridLines: false,
      landscape: true
    },
    {
      name: 'Печать по заказам',
      columns: [5, 18.5, 16, 17.5, 14, 12.5, 9, 10, 10, 8, 12.5, 16],
      rows: printRows.length > 0
        ? printRows
        : [buildRow([buildCell('Нет данных для печати', XLSX_STYLES.printTitle, 11)], 24)],
      printArea: `$A$1:$L$${Math.max(printRows.length, 1)}`,
      showGridLines: false,
      landscape: true
    }
  ]);
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

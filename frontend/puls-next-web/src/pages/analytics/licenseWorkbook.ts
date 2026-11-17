import dayjs from 'dayjs';
import { formatDate } from '../../app/format';
import type { ParusLicenseAnalyticsLicensePeriodDto, ParusLicenseAnalyticsOrganizationGroupDto } from '../../app/types';
import { formatInputDate, formatQuantity, getGroupStatusLabel, getGroupExportStatus } from './analyticsFormat';
import type { AnalyticsPeriodRange } from './analyticsFormat';

export function escapeXmlValue(value: string | number | null | undefined) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export type XlsxCellValue = string | number | null | undefined;

export interface XlsxCell {
  value?: XlsxCellValue;
  style?: number;
  mergeAcross?: number;
}

export interface XlsxRow {
  cells: XlsxCell[];
  height?: number;
}

export interface XlsxWorksheet {
  name: string;
  columns: number[];
  rows: XlsxRow[];
  showGridLines?: boolean;
  freezeRow?: number;
  printArea?: string;
  landscape?: boolean;
}

export interface ZipFileEntry {
  path: string;
  content: string | Uint8Array;
}

export const XLSX_STYLES = {
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
  printFooterValue: 24,
  registryCell: 25,
  registryCellAlt: 26
} as const;

export function buildCell(value: XlsxCellValue, style?: number, mergeAcross?: number): XlsxCell {
  return { value, style, mergeAcross };
}

export function buildRow(cells: XlsxCell[], height?: number): XlsxRow {
  return { cells, height };
}

export function getColumnName(index: number) {
  let column = '';
  let current = index;

  while (current > 0) {
    const remainder = (current - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    current = Math.floor((current - 1) / 26);
  }

  return column;
}

export function buildXlsxCellXml(cell: XlsxCell, rowIndex: number, columnIndex: number) {
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

export function buildXlsxWorksheetXml(sheet: XlsxWorksheet) {
  const merges: string[] = [];
  const columns = sheet.columns
    .map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join('');
  const rows = sheet.rows.map((row, rowIndex) => {
    const excelRowIndex = rowIndex + 1;
    let columnIndex = 1;
    const cells = row.cells.map((cell) => {
      let cellXml = buildXlsxCellXml(cell, excelRowIndex, columnIndex);
      if (cell.mergeAcross && cell.mergeAcross > 0) {
        merges.push(`${getColumnName(columnIndex)}${excelRowIndex}:${getColumnName(columnIndex + cell.mergeAcross)}${excelRowIndex}`);
        for (let offset = 1; offset <= cell.mergeAcross; offset += 1) {
          cellXml += buildXlsxCellXml({ style: cell.style }, excelRowIndex, columnIndex + offset);
        }
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

export function buildXlsxStylesXml() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="9">
    <font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>
    <font><b/><sz val="16"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><sz val="10"/><color rgb="FF475569"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF047857"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FFB91C1C"/><name val="Calibri"/></font>
    <font><b/><sz val="10"/><color rgb="FF64748B"/><name val="Calibri"/></font>
    <font><b/><sz val="11"/><color rgb="FF0F172A"/><name val="Calibri"/></font>
    <font><sz val="10"/><color theme="1"/><name val="Calibri"/></font>
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
  <cellXfs count="27">
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0"><alignment vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="1" fillId="3" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="2" fillId="4" borderId="0" xfId="0" applyFill="1" applyFont="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="3" fillId="5" borderId="2" xfId="0" applyFill="1" applyFont="1" applyBorder="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
    <xf numFmtId="0" fontId="0" fillId="2" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="0" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
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
    <xf numFmtId="0" fontId="8" fillId="2" borderId="1" xfId="0" applyBorder="1"><alignment vertical="center"/></xf>
    <xf numFmtId="0" fontId="8" fillId="6" borderId="1" xfId="0" applyFill="1" applyBorder="1"><alignment vertical="center"/></xf>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`;
}

export function parseQuantityNumber(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = Number(value.replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function getWorkbookStatusStyle(row: {
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

export function getRowStyle(index: number) {
  return index % 2 === 0 ? XLSX_STYLES.registryCell : XLSX_STYLES.registryCellAlt;
}

export function getNumberStyle(index: number) {
  return index % 2 === 0 ? XLSX_STYLES.number : XLSX_STYLES.numberAlt;
}

export function buildPrintOrganizationName(row: ParusLicenseAnalyticsOrganizationGroupDto) {
  return row.raion ? `${row.clientName} (${row.raion})` : row.clientName;
}

export function buildPrintActionPeriod(periods: ParusLicenseAnalyticsLicensePeriodDto[]) {
  if (periods.length === 0) {
    return '';
  }

  const datesSince = periods.map((period) => dayjs(period.dateSinceUtc));
  const datesTo = periods.map((period) => dayjs(period.dateToUtc));
  const firstDate = datesSince.reduce((current, date) => (date.isBefore(current) ? date : current), datesSince[0]);
  const lastDate = datesTo.reduce((current, date) => (date.isAfter(current) ? date : current), datesTo[0]);

  return `${firstDate.format('DD.MM.YYYY')} - ${lastDate.format('DD.MM.YYYY')}`;
}

export function getCrc32Table() {
  return Array.from({ length: 256 }, (_, index) => {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    return value >>> 0;
  });
}

export const CRC32_TABLE = getCrc32Table();

export function getCrc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

export function writeUint16(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
}

export function writeUint32(buffer: Uint8Array, offset: number, value: number) {
  buffer[offset] = value & 0xff;
  buffer[offset + 1] = (value >>> 8) & 0xff;
  buffer[offset + 2] = (value >>> 16) & 0xff;
  buffer[offset + 3] = (value >>> 24) & 0xff;
}

export function createZip(files: ZipFileEntry[]) {
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

export function buildXlsxWorkbookXml(sheets: XlsxWorksheet[]) {
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

export function buildXlsxWorkbookRelsXml(sheets: XlsxWorksheet[]) {
  const sheetRels = sheets.map((_, index) => (
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  )).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

export function buildXlsxContentTypesXml(sheets: XlsxWorksheet[]) {
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

export function buildXlsxPackage(sheets: XlsxWorksheet[]) {
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

export function buildLicenseGroupsWorkbook(
  groups: ParusLicenseAnalyticsOrganizationGroupDto[],
  range: AnalyticsPeriodRange,
  status: string,
  salaryOnly = false
) {
  const title = `Отчет по группам лицензий Парус за период ${formatInputDate(range.from)} - ${formatInputDate(range.to)}`;
  const statusLabel = getGroupStatusLabel(status);
  const filterDetails = salaryOnly ? `${statusLabel}, только ЗП` : statusLabel;
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
    buildRow([buildCell(title, XLSX_STYLES.title, 11)], 30),
    buildRow([buildCell(`Период: ${formatInputDate(range.from)} - ${formatInputDate(range.to)}   |   Статус: ${filterDetails}   |   Сформировано: ${generatedAt}`, XLSX_STYLES.subtitle, 11)], 24),
    buildRow([buildCell('', XLSX_STYLES.spacer, 11)], 8),
    buildRow(
      ['Организация', 'ИНН', 'Район', 'Мнемоника', 'Окончание', 'Лицензия', 'Баз', 'Организаций в базах', 'Доп. мест', 'Периодов', 'Строк состава', 'Статус']
        .map((label) => buildCell(label, XLSX_STYLES.header)),
      24
    ),
    ...groups.map((row, index) => {
      const rowStyle = getRowStyle(index);
      const numberStyle = getNumberStyle(index);
      return buildRow([
        buildCell(row.clientName, rowStyle),
        buildCell(row.inn || '', rowStyle),
        buildCell(row.raion || '', rowStyle),
        buildCell(row.mnemoOrg || '', rowStyle),
        buildCell(row.lastDateToUtc ? formatDate(row.lastDateToUtc) : '', rowStyle),
        buildCell(row.licenseNumber, rowStyle),
        buildCell(row.databaseCount, numberStyle),
        buildCell(row.organizationCount, numberStyle),
        buildCell(row.extraWorkplaces, numberStyle),
        buildCell(row.periodsCount, numberStyle),
        buildCell(row.componentsCount, numberStyle),
        buildCell(getGroupExportStatus(row), getWorkbookStatusStyle(row))
      ], 24);
    }),
    buildRow([
      buildCell('Итого', XLSX_STYLES.total, 5),
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
        nomenclature: component.nomenclature || 'Не указана',
        module: component.modification || component.product || 'Состав лицензии',
        quantity: parseQuantityNumber(component.quantity) ?? (formatQuantity(component.quantity) || '')
      }));
    });

    const printableComponents = componentRows.length > 0
      ? componentRows
      : [{
          period: null,
          nomenclature: 'Не указана',
          module: 'Периоды не найдены',
          quantity: ''
        }];

    const blockRows = [
      buildRow([buildCell(buildPrintOrganizationName(row), XLSX_STYLES.printTitle, 11)], 28),
      buildRow([
        buildCell('Дата действия', XLSX_STYLES.printLabel, 3),
        buildCell('Статус', XLSX_STYLES.printLabel, 1),
        buildCell('ИНН', XLSX_STYLES.printLabel, 2),
        buildCell('Рег. номер', XLSX_STYLES.printLabel, 2)
      ], 22),
      buildRow([
        buildCell(buildPrintActionPeriod(row.periods), XLSX_STYLES.printValue, 3),
        buildCell(getGroupExportStatus(row), XLSX_STYLES.printValue, 1),
        buildCell(row.inn || '', XLSX_STYLES.printValue, 2),
        buildCell(row.licenseNumber, XLSX_STYLES.printValue, 2)
      ], 24),
      buildRow([
        buildCell('№', XLSX_STYLES.printHeader),
        buildCell('Номенклатура', XLSX_STYLES.printHeader, 2),
        buildCell('Модуль / блок', XLSX_STYLES.printHeader, 3),
        buildCell('Кол-во мест', XLSX_STYLES.printHeader),
        buildCell('Нужен', XLSX_STYLES.printHeader),
        buildCell('Проверено, шт.', XLSX_STYLES.printHeader, 1)
      ], 28),
      ...printableComponents.map((component, index) => buildRow([
        buildCell(index + 1, XLSX_STYLES.printNumber),
        buildCell(component.nomenclature, XLSX_STYLES.printCell, 2),
        buildCell(component.module, XLSX_STYLES.printCell, 3),
        buildCell(component.quantity, typeof component.quantity === 'number' ? XLSX_STYLES.printNumber : XLSX_STYLES.printCell),
        buildCell('□', XLSX_STYLES.printCheck),
        buildCell('', XLSX_STYLES.printChecked, 1)
      ], component.module.length > 72 ? 54 : 38))
    ];

    if (groupIndex < groups.length - 1) {
      blockRows.push(buildRow([], 14));
    }

    return blockRows;
  });

  return buildXlsxPackage([
    {
      name: 'Организации',
      columns: [50, 16, 24, 24, 14, 15, 8, 18, 11, 11, 13, 18],
      rows: organizationRows,
      freezeRow: 4,
      printArea: `$A$1:$L$${organizationRows.length}`,
      showGridLines: false,
      landscape: true
    },
    {
      name: 'Печать по заказам',
      columns: [5, 12, 9, 9, 30, 40, 12, 9, 10, 8, 14, 16],
      rows: printRows.length > 0
        ? printRows
        : [buildRow([buildCell('Нет данных для печати', XLSX_STYLES.printTitle, 11)], 24)],
      printArea: `$A$1:$L$${Math.max(printRows.length, 1)}`,
      showGridLines: false,
      landscape: true
    }
  ]);
}

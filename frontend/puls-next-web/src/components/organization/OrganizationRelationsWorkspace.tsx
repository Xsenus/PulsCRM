import React from 'react';
import { formatDateTime } from '../../app/format';
import type {
  OrganizationAttachmentDto,
  OrganizationContactDto,
  OrganizationContractDto,
  OrganizationDetailsDto,
  OrganizationParusLicenseDto,
  OrganizationParusOrderDto,
  OrganizationRealizationDto
} from '../../app/types';
import { DataTable } from '../DataTable';
import type { OrganizationRelationTab } from './OrganizationRelationsOverview';

const EMPTY_VALUE = '-';

export interface OrganizationRelationsTableSettings {
  contacts: string;
  documents: string;
  contracts: string;
  realizations: string;
  licenses: string;
  orders: string;
}

function formatMoney(value?: number | null) {
  return new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value ?? 0);
}

function formatDateOnly(value?: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return new Intl.DateTimeFormat('ru-RU').format(date);
}

function renderDateTime(value?: string | null) {
  const formatted = formatDateTime(value);
  return formatted ? <time dateTime={value ?? undefined}>{formatted}</time> : EMPTY_VALUE;
}

function renderDateOnly(value?: string | null) {
  const formatted = formatDateOnly(value);
  return formatted ? <time dateTime={value ?? undefined}>{formatted}</time> : EMPTY_VALUE;
}

function formatContractOneCState(value: number) {
  switch (value) {
    case 1:
      return 'К отправке в 1С';
    case 2:
      return 'Обработано';
    case 3:
      return 'Игнорировать';
    default:
      return EMPTY_VALUE;
  }
}

export function OrganizationRelationsWorkspace({
  activeTab,
  details,
  tableSettings
}: {
  activeTab: OrganizationRelationTab;
  details: OrganizationDetailsDto | null;
  tableSettings: OrganizationRelationsTableSettings;
}) {
  switch (activeTab) {
    case 'contacts':
      return (
        <DataTable<OrganizationContactDto>
          rows={details?.contacts ?? []}
          getRowKey={(row) => row.id}
          settingsKey={tableSettings.contacts}
          emptyText="Контактов пока нет"
          columns={[
            { key: 'fio', title: 'ФИО', width: 220, minWidth: 180, render: (row) => row.fio || EMPTY_VALUE },
            { key: 'position', title: 'Должность', width: 200, minWidth: 160, render: (row) => row.position || EMPTY_VALUE },
            { key: 'group', title: 'Группа', width: 160, minWidth: 130, render: (row) => row.group || EMPTY_VALUE },
            { key: 'status', title: 'Статус', width: 160, minWidth: 130, render: (row) => row.status || EMPTY_VALUE },
            { key: 'phone', title: 'Телефон', width: 170, minWidth: 140, render: (row) => row.phone || EMPTY_VALUE },
            { key: 'email', title: 'Email', width: 210, minWidth: 180, render: (row) => row.email || EMPTY_VALUE },
            { key: 'comment', title: 'Комментарий', width: 280, minWidth: 220, visible: false, render: (row) => row.comment || EMPTY_VALUE }
          ]}
        />
      );
    case 'documents':
      return (
        <DataTable<OrganizationAttachmentDto>
          rows={details?.attachments ?? []}
          getRowKey={(row) => row.id}
          settingsKey={tableSettings.documents}
          emptyText="Документов пока нет"
          columns={[
            { key: 'privacyGroupName', title: '!', width: 120, minWidth: 90, visible: false, render: (row) => row.privacyGroupName || EMPTY_VALUE },
            { key: 'executorName', title: 'Исполнитель', width: 170, minWidth: 140, render: (row) => row.executorName || EMPTY_VALUE },
            { key: 'fileTypeName', title: 'Тип файла', width: 110, minWidth: 90, render: (row) => row.fileTypeName || EMPTY_VALUE },
            { key: 'attachDocumentTypeName', title: 'Тип документа', width: 170, minWidth: 140, render: (row) => row.attachDocumentTypeName || EMPTY_VALUE },
            { key: 'dateUtc', title: 'Дата', width: 120, minWidth: 110, render: (row) => renderDateOnly(row.dateUtc) },
            { key: 'number', title: 'Номер', width: 150, minWidth: 130, render: (row) => row.number || EMPTY_VALUE },
            { key: 'fileName', title: 'Файл', width: 220, minWidth: 180, render: (row) => row.fileName || EMPTY_VALUE },
            { key: 'name', title: 'Наименование', width: 260, minWidth: 220, render: (row) => row.name || EMPTY_VALUE },
            { key: 'documentTransport', title: 'Транспорт', width: 170, minWidth: 140, render: (row) => row.documentTransport || EMPTY_VALUE },
            { key: 'documentState', title: 'Состояние', width: 170, minWidth: 140, render: (row) => row.documentState || EMPTY_VALUE },
            { key: 'summa', title: 'Сумма', width: 140, minWidth: 120, visible: false, render: (row) => row.summa === undefined || row.summa === null ? EMPTY_VALUE : formatMoney(row.summa) },
            { key: 'isCompleted', title: 'Готов', width: 90, minWidth: 80, render: (row) => (row.isCompleted ? 'Да' : 'Нет') }
          ]}
        />
      );
    case 'contracts':
      return (
        <DataTable<OrganizationContractDto>
          rows={details?.contracts ?? []}
          getRowKey={(row) => row.id}
          settingsKey={tableSettings.contracts}
          emptyText="Договоров пока нет"
          columns={[
            { key: 'executorName', title: 'Исполнитель', width: 170, minWidth: 150, render: (row) => row.executorName || EMPTY_VALUE },
            { key: 'fileTypeName', title: 'Тип', width: 110, minWidth: 90, render: (row) => row.fileTypeName || EMPTY_VALUE },
            { key: 'dateUtc', title: 'Дата', width: 120, minWidth: 110, render: (row) => renderDateOnly(row.dateUtc) },
            { key: 'dateFromUtc', title: 'С', width: 120, minWidth: 110, render: (row) => renderDateOnly(row.dateFromUtc) },
            { key: 'dateToUtc', title: 'По', width: 120, minWidth: 110, render: (row) => renderDateOnly(row.dateToUtc) },
            { key: 'number', title: 'Номер', width: 150, minWidth: 130, render: (row) => row.number || EMPTY_VALUE },
            { key: 'fileName', title: 'Файл', width: 220, minWidth: 180, render: (row) => row.fileName || EMPTY_VALUE },
            { key: 'name', title: 'Наименование', width: 260, minWidth: 220, render: (row) => row.name || EMPTY_VALUE },
            { key: 'documentTransport', title: 'Транспорт', width: 170, minWidth: 140, render: (row) => row.documentTransport || EMPTY_VALUE },
            { key: 'documentState', title: 'Состояние', width: 170, minWidth: 140, render: (row) => row.documentState || EMPTY_VALUE },
            { key: 'summa', title: 'Сумма', width: 140, minWidth: 120, render: (row) => row.summa === undefined || row.summa === null ? EMPTY_VALUE : formatMoney(row.summa) },
            { key: 'oneCTransferState', title: '1С', width: 150, minWidth: 120, render: (row) => formatContractOneCState(row.oneCTransferState) }
          ]}
        />
      );
    case 'realizations':
      return (
        <DataTable<OrganizationRealizationDto>
          rows={details?.realizations ?? []}
          getRowKey={(row) => row.id}
          settingsKey={tableSettings.realizations}
          emptyText="Реализаций пока нет"
          columns={[
            { key: 'dateUtc', title: 'Дата', width: 120, minWidth: 110, render: (row) => renderDateOnly(row.dateUtc) },
            { key: 'number', title: 'Номер', width: 150, minWidth: 130, render: (row) => row.number || EMPTY_VALUE },
            { key: 'contractCode', title: 'Код', width: 90, minWidth: 70, render: (row) => row.contractCode || EMPTY_VALUE },
            { key: 'contractName', title: 'Договор', width: 220, minWidth: 180, render: (row) => row.contractName || EMPTY_VALUE },
            { key: 'statusName', title: 'Статус', width: 170, minWidth: 140, render: (row) => row.statusName || EMPTY_VALUE },
            { key: 'edoStatus', title: 'ЭДО', width: 170, minWidth: 140, render: (row) => row.edoStatus || EMPTY_VALUE },
            { key: 'summa', title: 'Сумма', width: 140, minWidth: 120, render: (row) => row.summa === undefined || row.summa === null ? EMPTY_VALUE : formatMoney(row.summa) },
            { key: 'isDone', title: 'Готово', width: 90, minWidth: 80, render: (row) => (row.isDone ? 'Да' : 'Нет') }
          ]}
        />
      );
    case 'licenses':
      return (
        <DataTable<OrganizationParusLicenseDto>
          rows={details?.parusLicenses ?? []}
          getRowKey={(row) => row.id}
          settingsKey={tableSettings.licenses}
          emptyText="Лицензий Парус пока нет"
          columns={[
            { key: 'dateSinceUtc', title: 'Дата выдачи', width: 160, minWidth: 140, render: (row) => renderDateTime(row.dateSinceUtc) },
            { key: 'dateToUtc', title: 'Дата окончания', width: 160, minWidth: 140, render: (row) => renderDateTime(row.dateToUtc) },
            { key: 'nomenclature', title: 'Версия', width: 200, minWidth: 170, render: (row) => row.nomenclature || EMPTY_VALUE },
            { key: 'mnemoOrg', title: 'Мнемокод', width: 150, minWidth: 130, render: (row) => row.mnemoOrg || EMPTY_VALUE },
            { key: 'regNumberClient', title: 'Номер ЛО', width: 160, minWidth: 140, render: (row) => row.regNumberClient || EMPTY_VALUE },
            { key: 'modification', title: 'Модификация', width: 260, minWidth: 220, render: (row) => row.modification || EMPTY_VALUE },
            { key: 'number', title: 'Кол-во', width: 100, minWidth: 90, render: (row) => row.number || EMPTY_VALUE }
          ]}
        />
      );
    case 'orders':
      return (
        <DataTable<OrganizationParusOrderDto>
          rows={details?.parusOrders ?? []}
          getRowKey={(row) => row.id}
          settingsKey={tableSettings.orders}
          emptyText="Заказов Парус пока нет"
          columns={[
            { key: 'payer', title: 'Провайдер', width: 200, minWidth: 170, render: (row) => row.payer || EMPTY_VALUE },
            { key: 'typeOf', title: 'Тип', width: 170, minWidth: 140, render: (row) => row.typeOf || EMPTY_VALUE },
            { key: 'dateUtc', title: 'Дата', width: 150, minWidth: 130, render: (row) => renderDateTime(row.dateUtc) },
            { key: 'mnemoOrg', title: 'Клиент', width: 170, minWidth: 140, render: (row) => row.mnemoOrg || EMPTY_VALUE },
            { key: 'discount', title: 'Скидка', width: 120, minWidth: 110, render: (row) => formatMoney(row.discount) },
            { key: 'summa', title: 'Сумма с налогами', width: 170, minWidth: 150, render: (row) => formatMoney(row.summa) },
            { key: 'invoiceNumber', title: 'Номер накладной', width: 170, minWidth: 150, render: (row) => row.invoiceNumber || EMPTY_VALUE },
            { key: 'customerAmount', title: 'Цена клиента', width: 160, minWidth: 140, render: (row) => formatMoney(row.customerAmount) },
            { key: 'state', title: 'Состояние', width: 160, minWidth: 130, render: (row) => row.state || EMPTY_VALUE }
          ]}
        />
      );
    default:
      return null;
  }
}

import React from 'react';
import type { OrganizationListItemDto } from '../app/types';
import { DataTable, type DataTableColumn } from './DataTable';

interface OrganizationsTableProps {
  rows: OrganizationListItemDto[];
  loading?: boolean;
  emptyText?: string;
  selectedRowId?: number;
  settingsKey: string;
  actions?: React.ReactNode;
  onRowClick?: (row: OrganizationListItemDto) => void;
  onRowDoubleClick?: (row: OrganizationListItemDto) => void;
  onRowContextMenu?: (row: OrganizationListItemDto, event: React.MouseEvent<HTMLTableRowElement>) => void;
}

const EMPTY_VALUE = '—';

const columns: Array<DataTableColumn<OrganizationListItemDto>> = [
  {
    key: 'name',
    title: 'Название',
    width: 320,
    minWidth: 220,
    render: (row) => row.name || EMPTY_VALUE
  },
  {
    key: 'inn',
    title: 'ИНН',
    width: 150,
    minWidth: 130,
    render: (row) => row.inn || EMPTY_VALUE
  },
  {
    key: 'raion',
    title: 'Район',
    width: 220,
    minWidth: 180,
    render: (row) => row.raion || EMPTY_VALUE
  },
  {
    key: 'orgType',
    title: 'Тип',
    width: 220,
    minWidth: 180,
    render: (row) => row.orgType || EMPTY_VALUE
  },
  {
    key: 'openWorkItems',
    title: 'Открытых задач',
    width: 150,
    minWidth: 130,
    headerClassName: 'organization-cell-right',
    className: 'organization-cell-right',
    render: (row) => row.openWorkItems
  },
  {
    key: 'emailCount',
    title: 'Адресов',
    width: 110,
    minWidth: 96,
    headerClassName: 'organization-cell-right',
    className: 'organization-cell-right',
    render: (row) => row.emailCount
  },
  {
    key: 'contactCount',
    title: 'Контактов',
    width: 120,
    minWidth: 100,
    headerClassName: 'organization-cell-right',
    className: 'organization-cell-right',
    render: (row) => row.contactCount
  },
  {
    key: 'fullName',
    title: 'Полное название',
    width: 420,
    minWidth: 260,
    visible: false,
    render: (row) => row.fullName || EMPTY_VALUE
  },
  {
    key: 'visible',
    title: 'Видимость',
    width: 130,
    minWidth: 110,
    visible: false,
    render: (row) => row.visible ? 'Видима' : 'Скрыта'
  },
  {
    key: 'isManager',
    title: 'Управленческая',
    width: 150,
    minWidth: 130,
    visible: false,
    render: (row) => row.isManager ? 'Да' : 'Нет'
  }
];

export function OrganizationsTable({
  rows,
  loading = false,
  emptyText = 'Нет данных',
  selectedRowId,
  settingsKey,
  actions,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu
}: OrganizationsTableProps) {
  return (
    <DataTable
      rows={rows}
      columns={columns}
      getRowKey={(row) => row.id}
      loading={loading}
      emptyText={emptyText}
      selectedRowKey={selectedRowId}
      settingsKey={settingsKey}
      actions={actions}
      title="Список организаций"
      className="organization-table-shell"
      tableClassName="organization-data-table"
      onRowClick={onRowClick}
      onRowDoubleClick={onRowDoubleClick}
      onRowContextMenu={onRowContextMenu}
    />
  );
}

import React from 'react';
import type { OrganizationListItemDto } from '../app/types';
import { DataTable, type DataTableColumn } from './DataTable';
import { StatusBadge } from './StatusBadge';

interface OrganizationsTableProps {
  rows: OrganizationListItemDto[];
  loading?: boolean;
  emptyText?: string;
  selectedRowId?: number;
  settingsKey: string;
  actions?: React.ReactNode;
  mobileActions?: (row: OrganizationListItemDto) => React.ReactNode;
  onRowClick?: (row: OrganizationListItemDto) => void;
  onRowDoubleClick?: (row: OrganizationListItemDto) => void;
  onRowContextMenu?: (row: OrganizationListItemDto, event: React.MouseEvent<HTMLTableRowElement>) => void;
}

const EMPTY_VALUE = '—';

function renderVisibilityBadge(row: OrganizationListItemDto) {
  return (
    <StatusBadge tone={row.visible ? 'success' : 'neutral'}>
      {row.visible ? 'Видима' : 'Скрыта'}
    </StatusBadge>
  );
}

function renderManagerBadge(row: OrganizationListItemDto) {
  return (
    <StatusBadge tone={row.isManager ? 'info' : 'neutral'}>
      {row.isManager ? 'Да' : 'Нет'}
    </StatusBadge>
  );
}

const columns: Array<DataTableColumn<OrganizationListItemDto>> = [
  {
    key: 'name',
    title: 'Название',
    width: 320,
    minWidth: 220,
    isPrimary: true,
    priority: 1,
    render: (row) => row.name || EMPTY_VALUE
  },
  {
    key: 'inn',
    title: 'ИНН',
    width: 150,
    minWidth: 130,
    mobileLabel: 'ИНН',
    priority: 2,
    render: (row) => row.inn || EMPTY_VALUE
  },
  {
    key: 'raion',
    title: 'Район',
    width: 220,
    minWidth: 180,
    mobileLabel: 'Район',
    priority: 3,
    render: (row) => row.raion || EMPTY_VALUE
  },
  {
    key: 'orgType',
    title: 'Тип',
    width: 220,
    minWidth: 180,
    mobileLabel: 'Тип',
    priority: 4,
    render: (row) => row.orgType || EMPTY_VALUE
  },
  {
    key: 'openWorkItems',
    title: 'Открытых задач',
    width: 150,
    minWidth: 130,
    headerClassName: 'organization-cell-right',
    className: 'organization-cell-right',
    mobileLabel: 'Открытых задач',
    priority: 5,
    render: (row) => row.openWorkItems
  },
  {
    key: 'emailCount',
    title: 'Адресов',
    width: 110,
    minWidth: 96,
    headerClassName: 'organization-cell-right',
    className: 'organization-cell-right',
    mobileLabel: 'Email',
    priority: 6,
    render: (row) => row.emailCount
  },
  {
    key: 'contactCount',
    title: 'Контактов',
    width: 120,
    minWidth: 100,
    headerClassName: 'organization-cell-right',
    className: 'organization-cell-right',
    mobileLabel: 'Контакты',
    priority: 7,
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
    mobileLabel: 'Видимость',
    priority: 8,
    render: renderVisibilityBadge
  },
  {
    key: 'isManager',
    title: 'Управленческая',
    width: 150,
    minWidth: 130,
    visible: false,
    mobileVisible: false,
    render: renderManagerBadge
  }
];

export function OrganizationsTable({
  rows,
  loading = false,
  emptyText = 'Нет данных',
  selectedRowId,
  settingsKey,
  actions,
  mobileActions,
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
      mobileActions={mobileActions}
      title="Список организаций"
      className="organization-table-shell"
      tableClassName="organization-data-table"
      onRowClick={onRowClick}
      onRowDoubleClick={onRowDoubleClick}
      onRowContextMenu={onRowContextMenu}
    />
  );
}

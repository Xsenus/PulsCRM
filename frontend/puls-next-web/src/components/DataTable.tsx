import React from 'react';

export interface DataTableColumn<T> {
  key: string;
  title: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Array<DataTableColumn<T>>;
  getRowKey: (row: T) => string | number;
  emptyText?: string;
  onRowClick?: (row: T) => void;
  onRowDoubleClick?: (row: T) => void;
  selectedRowKey?: string | number;
}

export function DataTable<T>({
  rows,
  columns,
  getRowKey,
  emptyText = 'Нет данных',
  onRowClick,
  onRowDoubleClick,
  selectedRowKey
}: DataTableProps<T>) {
  return (
    <div className="table-shell">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} className={column.className}>{column.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length}>
                <div className="table-empty">{emptyText}</div>
              </td>
            </tr>
          ) : rows.map((row) => {
            const rowKey = getRowKey(row);
            const isSelected = selectedRowKey !== undefined && String(selectedRowKey) === String(rowKey);

            return (
              <tr
                key={String(rowKey)}
                className={`${onRowClick || onRowDoubleClick ? 'table-row-clickable' : ''}${isSelected ? ' table-row-selected' : ''}`}
                onClick={() => onRowClick?.(row)}
                onDoubleClick={() => onRowDoubleClick?.(row)}
              >
                {columns.map((column) => (
                  <td key={column.key} className={column.className}>{column.render(row)}</td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

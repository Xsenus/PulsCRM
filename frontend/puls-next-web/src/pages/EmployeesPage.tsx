import React, { useEffect, useState } from 'react';
import { getEmployees } from '../app/api';
import type { EmployeeListItemDto } from '../app/types';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';

export function EmployeesPage() {
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<EmployeeListItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getEmployees(search, 0, 500);
      setRows(result.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <div className="page">
      <PageHeader
        title="Сотрудники"
        subtitle="Список пользователей с логинами, контактами и группами"
        actions={<button type="button" className="secondary-button" onClick={() => void load()}>Обновить</button>}
      />

      <div className="panel toolbar-panel">
        <input
          className="form-input"
          value={search}
          placeholder="Поиск по логину, ФИО, email или телефону"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void load();
            }
          }}
        />
        <button type="button" className="primary-button toolbar-button" onClick={() => void load()}>Найти</button>
      </div>

      <div className="panel">
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          emptyText={loading ? 'Загрузка...' : 'Нет данных'}
          columns={[
            { key: 'login', title: 'Логин', render: (row) => row.login },
            { key: 'fullName', title: 'ФИО', render: (row) => row.fullName || '—' },
            { key: 'userGroup', title: 'Группа', render: (row) => row.userGroup || '—' },
            { key: 'email', title: 'Почта', render: (row) => row.email || '—' },
            { key: 'phone', title: 'Телефон', render: (row) => row.phone || '—' }
          ]}
        />
      </div>
    </div>
  );
}

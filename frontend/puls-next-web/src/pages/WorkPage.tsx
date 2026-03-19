import React, { useEffect, useState } from 'react';
import { getEmployees, getOrganizations, getWork } from '../app/api';
import { formatDateTime } from '../app/format';
import type { EmployeeListItemDto, OrganizationListItemDto, WorkItemDto } from '../app/types';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';

export function WorkPage() {
  const [search, setSearch] = useState('');
  const [orgId, setOrgId] = useState<number | undefined>();
  const [employeeId, setEmployeeId] = useState<number | undefined>();
  const [onlyOpen, setOnlyOpen] = useState(true);
  const [rows, setRows] = useState<WorkItemDto[]>([]);
  const [employees, setEmployees] = useState<EmployeeListItemDto[]>([]);
  const [organizations, setOrganizations] = useState<OrganizationListItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  const loadLookups = async () => {
    const [employeeResponse, organizationResponse] = await Promise.all([
      getEmployees('', 0, 500),
      getOrganizations({ take: 500 })
    ]);

    setEmployees(employeeResponse.items);
    setOrganizations(organizationResponse.items);
  };

  const load = async () => {
    setLoading(true);
    try {
      const result = await getWork(search, orgId, employeeId, onlyOpen, 0, 1000);
      setRows(result.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLookups();
    void load();
  }, []);

  return (
    <div className="page">
      <PageHeader
        title="Работа"
        subtitle="Данные по сущности set_Job: задачи, комментарии, сроки и ответственные"
        actions={<button type="button" className="secondary-button" onClick={() => void load()}>Обновить</button>}
      />

      <div className="panel toolbar-panel toolbar-panel-grid">
        <input
          className="form-input"
          value={search}
          placeholder="Поиск по сообщению, задаче, сотруднику, организации"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void load();
            }
          }}
        />

        <select className="form-select" value={orgId ?? ''} onChange={(event) => setOrgId(event.target.value ? Number(event.target.value) : undefined)}>
          <option value="">Организация</option>
          {organizations.map((organization) => (
            <option key={organization.id} value={organization.id}>{organization.name}</option>
          ))}
        </select>

        <select className="form-select" value={employeeId ?? ''} onChange={(event) => setEmployeeId(event.target.value ? Number(event.target.value) : undefined)}>
          <option value="">Сотрудник</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.fullName || employee.login}</option>
          ))}
        </select>

        <label className="checkbox-option">
          <input type="checkbox" checked={onlyOpen} onChange={(event) => setOnlyOpen(event.target.checked)} />
          <span>Только открытые</span>
        </label>

        <button type="button" className="primary-button toolbar-button" onClick={() => void load()}>Применить</button>
      </div>

      <div className="panel">
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          emptyText={loading ? 'Загрузка...' : 'Нет данных'}
          columns={[
            { key: 'orgName', title: 'Организация', render: (row) => row.orgName || '—' },
            { key: 'userFromName', title: 'От кого', render: (row) => row.userFromName || '—' },
            { key: 'userToName', title: 'Кому', render: (row) => row.userToName || '—' },
            { key: 'category', title: 'Категория', render: (row) => row.category || '—' },
            { key: 'task', title: 'Задача', render: (row) => row.task || '—' },
            { key: 'message', title: 'Сообщение', render: (row) => row.message || '—' },
            { key: 'comment', title: 'Комментарий', render: (row) => row.comment || '—' },
            { key: 'createdAtUtc', title: 'Создано', render: (row) => formatDateTime(row.createdAtUtc) || '—' },
            { key: 'dateToUtc', title: 'Срок', render: (row) => formatDateTime(row.dateToUtc) || '—' },
            { key: 'dateCompletedUtc', title: 'Завершено', render: (row) => formatDateTime(row.dateCompletedUtc) || '—' },
            { key: 'isCompleted', title: 'Готово', render: (row) => (row.isCompleted ? 'Да' : 'Нет') }
          ]}
        />
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeCampaignStatus, deleteCampaign, getCampaigns, runCampaign } from '../app/api';
import { formatDateTime } from '../app/format';
import { campaignStatusOptions, labelOf, scheduleKindOptions } from '../app/lookups';
import { showToast } from '../app/toast';
import type { CampaignListItemDto } from '../app/types';
import { DataTable } from '../components/DataTable';
import { PageHeader } from '../components/PageHeader';

export function CampaignsPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<number | undefined>();
  const [rows, setRows] = useState<CampaignListItemDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const result = await getCampaigns(search, status, 0, 200);
      setRows(result.items);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleRun = async (id: number) => {
    await runCampaign(id, {});
    showToast('Кампания поставлена в очередь', 'success');
    await load();
  };

  const handlePauseResume = async (row: CampaignListItemDto) => {
    const nextStatus = row.status === 1 ? 2 : 1;
    await changeCampaignStatus(row.id, { status: nextStatus });
    showToast(nextStatus === 1 ? 'Кампания активирована' : 'Кампания поставлена на паузу', 'success');
    await load();
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Удалить кампанию вместе с очередью и историей?')) {
      return;
    }

    await deleteCampaign(id);
    showToast('Кампания удалена', 'delete');
    await load();
  };

  return (
    <div className="page">
      <PageHeader
        title="Рассылки"
        subtitle="Кампании, статусы, расписания, ручной запуск и переход к статистике"
        actions={<button type="button" className="primary-button" onClick={() => navigate('/campaigns/new')}>Новая кампания</button>}
      />

      <div className="panel toolbar-panel toolbar-panel-grid">
        <input
          className="form-input"
          value={search}
          placeholder="Поиск по названию, теме или SMTP профилю"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void load();
            }
          }}
        />

        <select className="form-select" value={status ?? ''} onChange={(event) => setStatus(event.target.value ? Number(event.target.value) : undefined)}>
          <option value="">Статус</option>
          {campaignStatusOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>

        <button type="button" className="primary-button toolbar-button" onClick={() => void load()}>Применить</button>
        <button type="button" className="secondary-button" onClick={() => void load()}>Обновить</button>
      </div>

      <div className="panel">
        <DataTable
          rows={rows}
          getRowKey={(row) => row.id}
          emptyText={loading ? 'Загрузка...' : 'Нет кампаний'}
          columns={[
            { key: 'name', title: 'Название', render: (row) => row.name },
            { key: 'subject', title: 'Тема', render: (row) => row.subject || '—' },
            { key: 'status', title: 'Статус', render: (row) => labelOf(campaignStatusOptions, row.status) },
            { key: 'scheduleKind', title: 'Расписание', render: (row) => labelOf(scheduleKindOptions, row.scheduleKind) },
            { key: 'transportProfileName', title: 'SMTP профиль', render: (row) => row.transportProfileName || '—' },
            { key: 'targets', title: 'Орг.', render: (row) => row.targetOrganizationsCount },
            { key: 'attachments', title: 'Вложений', render: (row) => row.attachmentsCount },
            { key: 'nextRunAtUtc', title: 'Следующий запуск', render: (row) => formatDateTime(row.nextRunAtUtc) || '—' },
            { key: 'lastRunAtUtc', title: 'Последний запуск', render: (row) => formatDateTime(row.lastRunAtUtc) || '—' },
            {
              key: 'actions',
              title: 'Действия',
              render: (row) => (
                <div className="button-group">
                  <button type="button" className="secondary-button button-inline" onClick={(event) => { event.stopPropagation(); navigate(`/campaigns/${row.id}`); }}>Открыть</button>
                  <button type="button" className="secondary-button button-inline" onClick={(event) => { event.stopPropagation(); void handleRun(row.id); }}>Запустить</button>
                  <button type="button" className="secondary-button button-inline" onClick={(event) => { event.stopPropagation(); void handlePauseResume(row); }}>
                    {row.status === 1 ? 'Пауза' : 'Активировать'}
                  </button>
                  <button type="button" className="secondary-button button-inline danger-button" onClick={(event) => { event.stopPropagation(); void handleDelete(row.id); }}>Удалить</button>
                </div>
              )
            }
          ]}
        />
      </div>
    </div>
  );
}

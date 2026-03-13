import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getDashboard } from '../app/api';
import type { DashboardDto } from '../app/types';
import { PageHeader } from '../components/PageHeader';
import { StatsCards } from '../components/StatsCards';

export function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setDashboard(await getDashboard());
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
        title="Дашборд"
        subtitle="Ключевые показатели системы и состояния рассылок"
        actions={<button type="button" className="secondary-button" onClick={() => void load()}>Обновить</button>}
      />

      {loading && !dashboard ? <div className="panel">Загрузка...</div> : null}

      {dashboard ? (
        <>
          <StatsCards
            items={[
              { label: 'Сотрудники', value: dashboard.employees, hint: 'Пользователи системы' },
              { label: 'Организации', value: dashboard.organizations, hint: 'Карточки организаций' },
              { label: 'Активные кампании', value: dashboard.activeCampaigns, hint: 'Готовы к отправке' },
              { label: 'Очередь', value: dashboard.queueDepth, hint: 'В очереди / в обработке / отложено' },
              { label: 'Отправлено за 24ч', value: dashboard.sentLast24Hours },
              { label: 'Ошибок за 24ч', value: dashboard.failedLast24Hours }
            ]}
          />

          <div className="panel action-grid">
            <Link to="/campaigns/new" className="action-card">
              <h3>Новая рассылка</h3>
              <p>Создать кампанию, выбрать организации, письмо, изображения и вложения.</p>
            </Link>
            <Link to="/campaigns" className="action-card">
              <h3>Список кампаний</h3>
              <p>Управление статусами, ручной запуск, просмотр статистики и истории отправок.</p>
            </Link>
            <Link to="/transport-profiles" className="action-card">
              <h3>SMTP профили</h3>
              <p>Настройка отправителей, лимитов, SSL, логина и пароля.</p>
            </Link>
          </div>
        </>
      ) : null}
    </div>
  );
}

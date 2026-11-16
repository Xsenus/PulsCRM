import React, { useState } from 'react';
import { useAuth } from '../app/AuthContext';
import { isAdmin } from '../app/access';
import { PageHeader } from '../components/PageHeader';
import { ColleaguesView } from './ColleaguesView';
import { EmployeesPage } from './EmployeesPage';

type EmployeesView = 'table' | 'cards';
const VIEW_STORAGE_KEY = 'puls-employees-view';

function loadView(): EmployeesView {
  try {
    return localStorage.getItem(VIEW_STORAGE_KEY) === 'cards' ? 'cards' : 'table';
  } catch {
    return 'table';
  }
}

/**
 * Раздел «Сотрудники»: сотрудники видят коллег карточками (только рабочие контакты),
 * администраторы — таблицу с редактированием и могут переключиться на карточки.
 */
export function EmployeesSection() {
  const { user } = useAuth();
  const [view, setView] = useState<EmployeesView>(loadView);

  if (!isAdmin(user)) {
    return (
      <div className="page">
        <PageHeader title="Сотрудники" subtitle="Контакты коллег" />
        <ColleaguesView />
      </div>
    );
  }

  const changeView = (next: EmployeesView) => {
    setView(next);
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, next);
    } catch {
      // Без localStorage выбор просто не запомнится.
    }
  };

  const switcher = (
    <div className="view-switch" role="tablist" aria-label="Вид списка сотрудников">
      <button type="button" role="tab" aria-selected={view === 'table'} className={view === 'table' ? 'active' : ''} onClick={() => changeView('table')}>
        Таблица
      </button>
      <button type="button" role="tab" aria-selected={view === 'cards'} className={view === 'cards' ? 'active' : ''} onClick={() => changeView('cards')}>
        Карточки
      </button>
    </div>
  );

  if (view === 'table') {
    return <EmployeesPage headerActions={switcher} />;
  }

  return (
    <div className="page">
      <PageHeader title="Сотрудники" subtitle="Так раздел видят сотрудники без прав администратора" actions={switcher} />
      <ColleaguesView />
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { getApiErrorMessage } from '../app/apiErrors';
import { openColleagueCard } from '../app/colleagueCard';
import { describeDue, describeWorkTitle, getMyWork, type MyWorkDto } from '../app/myWork';
import type { WorkItemDto } from '../app/types';

const SHOWN = 5;

function shortName(fullName?: string) {
  const [last, first] = (fullName ?? '').trim().split(/\s+/);
  return first ? `${last} ${first.charAt(0)}.` : last ?? '';
}

function WorkRow({ item, person, personId, prefix }: { item: WorkItemDto; person?: string; personId?: number; prefix: string }) {
  const due = describeDue(item.dateToUtc);
  const extra = [item.orgName, item.task && item.message ? item.task : null].filter(Boolean) as string[];
  return (
    <li className={`home-task due-${due.tone}`}>
      <span className="home-task-text">
        <span className="home-task-title" title={describeWorkTitle(item)}>{describeWorkTitle(item)}</span>
        <span className="home-task-meta">
          {extra.map((value) => <span key={value} className="home-task-meta-item" title={value}>{value}</span>)}
          {person ? (
            <span className="home-task-meta-person">
              {prefix}{' '}
              {personId ? (
                <button type="button" className="home-task-person" onClick={() => openColleagueCard(personId)} title="Карточка сотрудника">{shortName(person)}</button>
              ) : shortName(person)}
            </span>
          ) : null}
        </span>
      </span>
      <span className={`home-task-due ${due.tone}`}>{due.label}</span>
    </li>
  );
}

/** «Мои задачи» на дашборде: открытые поручения мне (с ближайшим сроком сверху) и от меня. */
export function MyTasksCard() {
  const [work, setWork] = useState<MyWorkDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    getMyWork(SHOWN)
      .then((value) => active && setWork(value))
      .catch((reason) => active && setError(getApiErrorMessage(reason, 'Не удалось загрузить задачи.')));
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="home-card home-tasks" aria-labelledby="home-tasks-title">
      <header className="home-card-head">
        <h2 id="home-tasks-title">Мои задачи</h2>
        {work ? (
          <span className={`home-card-badge${work.overdue > 0 ? ' danger' : work.assignedTotal > 0 ? ' accent' : ''}`}>
            {work.overdue > 0 ? `Просрочено: ${work.overdue}` : work.assignedTotal > 0 ? `Открытых: ${work.assignedTotal}` : 'Все выполнено'}
          </span>
        ) : null}
      </header>
      {error ? <div className="home-card-empty">{error}</div> : null}
      {!work && !error ? <div className="home-card-empty">Загрузка…</div> : null}
      {work && work.assignedTotal === 0 ? <div className="home-card-empty">Открытых поручений вам нет.</div> : null}
      {work && work.assigned.length > 0 ? (
        <ul className="home-tasks-list" aria-label="Поручено мне">
          {work.assigned.map((item) => <WorkRow key={item.id} item={item} person={item.userFromName} personId={item.userFromId} prefix="от" />)}
        </ul>
      ) : null}
      {work && work.assignedTotal > work.assigned.length ? (
        <div className="home-card-empty">И еще {work.assignedTotal - work.assigned.length} — в Пульсе.</div>
      ) : null}
      {work && work.delegatedTotal > 0 ? (
        <details className="home-tasks-delegated">
          <summary>Я поручил: {work.delegatedTotal}</summary>
          <ul className="home-tasks-list" aria-label="Поручено мной">
            {work.delegated.map((item) => <WorkRow key={item.id} item={item} person={item.userToName} personId={item.userToId} prefix="→" />)}
          </ul>
        </details>
      ) : null}
    </section>
  );
}

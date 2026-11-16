import React, { useEffect, useMemo, useState } from 'react';
import { useOptionalChat } from '../app/ChatContext';
import { formatBirthday, getColleagues, type ColleagueDto } from '../app/colleagues';
import { getApiErrorMessage } from '../app/apiErrors';
import { AppLoader } from '../components/AppLoader';
import { ColleagueAvatar } from '../components/ColleagueAvatar';
import { WriteInChatButton } from '../components/chat/WriteInChat';

function normalize(value: string | null | undefined) {
  return (value ?? '').toLowerCase().replace(/ё/g, 'е');
}

function matches(colleague: ColleagueDto, term: string) {
  if (!term) {
    return true;
  }

  return [colleague.fullName, colleague.position, colleague.department, colleague.email, colleague.phone, colleague.internalPhone]
    .some((value) => normalize(value).includes(term));
}

/** Карточка коллеги: фото, должность, отдел, контакты, день рождения и «Написать». */
export function ColleagueCard({ colleague, online }: { colleague: ColleagueDto; online: boolean }) {
  return (
    <article className="colleague-card" aria-label={colleague.fullName}>
      <div className="colleague-card-head">
        <ColleagueAvatar colleague={colleague} size={56} online={online} />
        <div className="colleague-card-title">
          <h3>{colleague.fullName}</h3>
          {colleague.position ? <div className="colleague-card-position">{colleague.position}</div> : null}
          {colleague.department ? <div className="colleague-card-department">{colleague.department}</div> : null}
        </div>
      </div>

      <dl className="colleague-card-contacts">
        {colleague.phone ? (
          <div><dt>Телефон</dt><dd><a href={`tel:${colleague.phone.replace(/[^\d+]/g, '')}`}>{colleague.phone}</a></dd></div>
        ) : null}
        {colleague.internalPhone ? <div><dt>Внутренний</dt><dd>{colleague.internalPhone}</dd></div> : null}
        {colleague.email ? <div><dt>E-mail</dt><dd><a href={`mailto:${colleague.email}`}>{colleague.email}</a></dd></div> : null}
        {colleague.birthdayMonth && colleague.birthdayDay ? (
          <div><dt>День рождения</dt><dd>🎂 {formatBirthday(colleague.birthdayMonth, colleague.birthdayDay)}</dd></div>
        ) : null}
      </dl>

      <div className="colleague-card-actions">
        <span className={`colleague-card-status${online ? ' online' : ''}`}>{online ? 'В сети' : 'Не в сети'}</span>
        <WriteInChatButton userId={colleague.id} />
      </div>
    </article>
  );
}

/** Справочник коллег карточками: поиск по имени, должности, отделу и контактам, фильтр по отделу. */
export function ColleaguesView() {
  const chat = useOptionalChat();
  const [colleagues, setColleagues] = useState<ColleagueDto[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');

  useEffect(() => {
    let active = true;
    getColleagues()
      .then((items) => active && setColleagues(items))
      .catch((loadError) => active && setError(getApiErrorMessage(loadError, 'Не удалось загрузить сотрудников.')));
    return () => {
      active = false;
    };
  }, []);

  const departments = useMemo(
    () => Array.from(new Set((colleagues ?? []).map((item) => item.department).filter((item): item is string => !!item)))
      .sort((a, b) => a.localeCompare(b, 'ru')),
    [colleagues]
  );

  const visible = useMemo(() => {
    const term = normalize(search.trim());
    return (colleagues ?? []).filter((item) => (!department || item.department === department) && matches(item, term));
  }, [colleagues, department, search]);

  if (error) {
    return <div className="panel empty-state">{error}</div>;
  }

  if (!colleagues) {
    return (
      <section className="panel">
        <AppLoader variant="panel" label="Загружаем сотрудников" description="Собираем контакты коллег." />
      </section>
    );
  }

  return (
    <div className="colleagues">
      <div className="panel colleagues-toolbar">
        <input
          className="colleagues-search"
          type="search"
          placeholder="Поиск по имени, должности, отделу, телефону или e-mail"
          aria-label="Поиск сотрудников"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {departments.length > 1 ? (
          <select className="colleagues-department" aria-label="Отдел" value={department} onChange={(event) => setDepartment(event.target.value)}>
            <option value="">Все отделы</option>
            {departments.map((item) => <option key={item} value={item}>{item}</option>)}
          </select>
        ) : null}
        <span className="colleagues-count">{visible.length} из {colleagues.length}</span>
      </div>

      {visible.length === 0 ? (
        <div className="panel empty-state">Никого не нашли. Попробуйте изменить запрос.</div>
      ) : (
        <div className="colleagues-grid">
          {visible.map((item) => (
            <ColleagueCard key={item.id} colleague={item} online={!!chat?.onlineUserIds.has(item.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

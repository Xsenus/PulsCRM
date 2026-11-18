import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import { useOptionalChat } from '../app/ChatContext';
import { formatBirthday, getColleague, type ColleagueDto } from '../app/colleagues';
import { OPEN_COLLEAGUE_CARD_EVENT } from '../app/colleagueCard';
import { getApiErrorMessage } from '../app/apiErrors';
import { formatStatus, getStatusNote, isStatusActive } from '../app/profile';
import { AppLoader } from './AppLoader';
import { ColleagueAvatar } from './ColleagueAvatar';
import { Modal } from './Modal';
import { useWriteInChat } from './chat/WriteInChat';

function phoneHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

/** Содержимое карточки: фото, должность, статус, контакты, день рождения и действия. */
export function ColleagueCardView({ colleague, online, onClose, showWrite = true }: { colleague: ColleagueDto; online: boolean; onClose: () => void; showWrite?: boolean }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { canWrite, write, busyUserId } = useWriteInChat();
  const status = isStatusActive(colleague.status) ? colleague.status : null;
  const note = status ? getStatusNote(status) : null;
  const isMe = user?.id === colleague.id;

  return (
    <div className="colleague-dialog">
      <div className="colleague-dialog-head">
        <ColleagueAvatar colleague={colleague} size={96} online={online} />
        <div className="colleague-dialog-title">
          <h2>{colleague.fullName}{isMe ? ' (вы)' : ''}</h2>
          {colleague.position ? <div className="colleague-dialog-position">{colleague.position}</div> : null}
          {colleague.department ? <div className="colleague-dialog-department">{colleague.department}</div> : null}
          <div className={`colleague-dialog-presence${online ? ' online' : ''}`}>{online ? 'В сети' : 'Не в сети'}</div>
        </div>
      </div>

      {status ? (
        <div className={`colleague-card-user-status status-${status.kind}`} role="status">
          <span>{formatStatus(status)}</span>
          {note ? <span className="colleague-card-user-status-note">{note}</span> : null}
        </div>
      ) : null}

      <dl className="colleague-dialog-contacts">
        {colleague.phone ? <div><dt>Телефон</dt><dd><a href={phoneHref(colleague.phone)}>{colleague.phone}</a></dd></div> : null}
        {colleague.internalPhone ? <div><dt>Внутренний</dt><dd>{colleague.internalPhone}</dd></div> : null}
        {colleague.email ? <div><dt>E-mail</dt><dd><a href={`mailto:${colleague.email}`}>{colleague.email}</a></dd></div> : null}
        {colleague.birthdayMonth && colleague.birthdayDay ? (
          <div><dt>День рождения</dt><dd>🎂 {formatBirthday(colleague.birthdayMonth, colleague.birthdayDay)}</dd></div>
        ) : null}
        {!colleague.phone && !colleague.internalPhone && !colleague.email ? (
          <div className="colleague-dialog-empty">Контакты не указаны.</div>
        ) : null}
      </dl>

      <div className="colleague-dialog-actions">
        {isMe ? (
          <button type="button" className="secondary-button button-inline" onClick={() => { onClose(); navigate('/profile'); }}>Мой профиль</button>
        ) : null}
        {user?.isRoot ? (
          <button type="button" className="secondary-button button-inline" onClick={() => { onClose(); navigate(`/employees/${colleague.id}/edit`); }}>
            Редактировать
          </button>
        ) : null}
        {showWrite && canWrite(colleague.id) ? (
          <button
            type="button"
            className="primary-button button-inline"
            disabled={busyUserId === colleague.id}
            onClick={() => {
              void write(colleague.id);
              onClose();
            }}
          >
            💬 Написать
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Карточка коллеги поверх любой страницы: открывается openColleagueCard(id) из чата, дашборда и ссылок.
 * Данные — из общего справочника (/api/colleagues/{id}): рабочие контакты и статус.
 */
export function ColleagueCardHost() {
  const chat = useOptionalChat();
  const [openId, setOpenId] = useState<number | null>(null);
  const [colleague, setColleague] = useState<ColleagueDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onOpen = (event: Event) => {
      const id = (event as CustomEvent<{ id: number }>).detail?.id;
      if (id) {
        setOpenId(id);
      }
    };

    window.addEventListener(OPEN_COLLEAGUE_CARD_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_COLLEAGUE_CARD_EVENT, onOpen);
  }, []);

  useEffect(() => {
    let active = true;
    setColleague(null);
    setError(null);
    if (openId) {
      getColleague(openId)
        .then((value) => active && setColleague(value))
        .catch((reason) => active && setError(getApiErrorMessage(reason, 'Сотрудник не найден или уволен.')));
    }

    return () => {
      active = false;
    };
  }, [openId]);

  const close = useCallback(() => setOpenId(null), []);

  return (
    <Modal open={openId !== null} title="Карточка сотрудника" onClose={close} maxWidth={520}>
      {error ? <div className="colleague-dialog-empty">{error}</div> : null}
      {!error && !colleague ? <AppLoader variant="panel" label="Загружаем карточку" /> : null}
      {colleague ? <ColleagueCardView colleague={colleague} online={!!chat?.onlineUserIds.has(colleague.id)} onClose={close} /> : null}
    </Modal>
  );
}

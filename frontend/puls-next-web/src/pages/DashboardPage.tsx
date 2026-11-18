import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getDashboard } from '../app/api';
import { useAuth } from '../app/AuthContext';
import { useOptionalChat } from '../app/ChatContext';
import { isAdmin } from '../app/access';
import { getApiErrorMessage } from '../app/apiErrors';
import { describeLastMessage } from '../app/chatFormat';
import { isGroupConversation } from '../app/chatTypes';
import {
  describeBirthdayDistance,
  formatBirthday,
  getColleagues,
  getUpcomingBirthdays,
  type ColleagueDto
} from '../app/colleagues';
import { showToast } from '../app/toast';
import { openColleagueCard } from '../app/colleagueCard';
import type { DashboardDto } from '../app/types';
import { ActionIcon } from '../components/ActionIcon';
import { AppLoader } from '../components/AppLoader';
import { ColleagueAvatar } from '../components/ColleagueAvatar';
import { MyTasksCard } from '../components/MyTasksCard';
import { PageHeader } from '../components/PageHeader';
import { StatsCards } from '../components/StatsCards';
import { ChatAvatar } from '../components/chat/ChatAvatar';
import { useWriteInChat } from '../components/chat/WriteInChat';

const RECENT_CHATS = 5;
const BIRTHDAYS_DAYS = 14;
const ONLINE_SHOWN = 12;

function greeting(now: Date) {
  const hour = now.getHours();
  if (hour < 5) {
    return 'Доброй ночи';
  }

  if (hour < 12) {
    return 'Доброе утро';
  }

  return hour < 18 ? 'Добрый день' : 'Добрый вечер';
}

/** «Фамилия Имя Отчество» → «Имя»; одно слово — как есть. */
function firstName(fullName: string | undefined) {
  const parts = (fullName ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.length >= 2 ? parts[1] : parts[0] ?? '';
}

function ChatCard() {
  const chat = useOptionalChat();
  const navigate = useNavigate();
  if (!chat?.enabled) {
    return null;
  }

  // Сначала непрочитанные, затем последние по времени (список диалогов уже отсортирован по последнему сообщению).
  const recent = [...chat.conversations]
    .sort((a, b) => Number(b.unreadCount > 0) - Number(a.unreadCount > 0))
    .slice(0, RECENT_CHATS);

  return (
    <section className="home-card" aria-labelledby="home-chat-title">
      <header className="home-card-head">
        <h2 id="home-chat-title">Чат</h2>
        <span className={`home-card-badge${chat.totalUnread > 0 ? ' accent' : ''}`}>
          {chat.totalUnread > 0 ? `Непрочитанных: ${chat.totalUnread > 99 ? '99+' : chat.totalUnread}` : 'Все прочитано'}
        </span>
      </header>
      {!chat.conversationsLoaded ? <div className="home-card-empty">Загрузка…</div> : null}
      {chat.conversationsLoaded && recent.length === 0 ? <div className="home-card-empty">Диалогов пока нет — напишите коллеге.</div> : null}
      <ul className="home-list">
        {recent.map((conversation) => (
          <li key={conversation.id}>
            <button type="button" className="home-list-row" onClick={() => navigate(`/chat/${conversation.id}`)}>
              <ChatAvatar
                name={conversation.title}
                seed={conversation.peerUserId ?? `g${conversation.id}`}
                userId={isGroupConversation(conversation) ? null : conversation.peerUserId}
                icon={conversation.icon}
                group={isGroupConversation(conversation)}
                online={!!conversation.peerUserId && chat.onlineUserIds.has(conversation.peerUserId)}
                size={38}
              />
              <span className="home-list-text">
                <span className="home-list-title">{conversation.title}</span>
                <span className="home-list-subtitle">{describeLastMessage(conversation, chat.currentUserId)}</span>
              </span>
              {conversation.unreadCount > 0 ? <span className="home-count">{conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}</span> : null}
            </button>
          </li>
        ))}
      </ul>
      <Link to="/chat" className="home-card-link">Открыть чат →</Link>
    </section>
  );
}

function BirthdaysCard({ colleagues }: { colleagues: ColleagueDto[] | null }) {
  const { canWrite, write, busyUserId } = useWriteInChat();
  const upcoming = useMemo(() => (colleagues ? getUpcomingBirthdays(colleagues, new Date(), BIRTHDAYS_DAYS) : []), [colleagues]);

  return (
    <section className="home-card home-birthdays" aria-labelledby="home-birthdays-title">
      <header className="home-card-head">
        <h2 id="home-birthdays-title">Дни рождения</h2>
        <span className="home-card-badge">Ближайшие 2 недели</span>
      </header>
      {!colleagues ? <div className="home-card-empty">Загрузка…</div> : null}
      {colleagues && upcoming.length === 0 ? <div className="home-card-empty">В ближайшие две недели дней рождения нет.</div> : null}
      <ul className="home-list">
        {upcoming.map(({ colleague, inDays }) => (
          <li key={colleague.id} className={`home-list-row static${inDays === 0 ? ' today' : ''}`}>
            <ColleagueAvatar colleague={colleague} size={38} />
            <span className="home-list-text">
              <button type="button" className="home-list-title home-list-title-link" onClick={() => openColleagueCard(colleague.id)} title="Карточка сотрудника">
                {inDays === 0 ? '🎉 ' : ''}{colleague.fullName}
              </button>
              <span className="home-list-subtitle">
                {describeBirthdayDistance(inDays)} · {formatBirthday(colleague.birthdayMonth!, colleague.birthdayDay!)}
              </span>
            </span>
            {canWrite(colleague.id) ? (
              <button type="button" className="secondary-button button-inline home-row-action" disabled={busyUserId === colleague.id} onClick={() => void write(colleague.id)}>
                Поздравить
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function OnlineCard({ colleagues }: { colleagues: ColleagueDto[] | null }) {
  const chat = useOptionalChat();
  const { write } = useWriteInChat();
  if (!chat?.enabled) {
    return null;
  }

  const online = (colleagues ?? []).filter((item) => item.id !== chat.currentUserId && chat.onlineUserIds.has(item.id));
  const shown = online.slice(0, ONLINE_SHOWN);

  return (
    <section className="home-card" aria-labelledby="home-online-title">
      <header className="home-card-head">
        <h2 id="home-online-title">Сейчас в сети</h2>
        <span className="home-card-badge">{online.length}</span>
      </header>
      {!colleagues ? <div className="home-card-empty">Загрузка…</div> : null}
      {colleagues && online.length === 0 ? <div className="home-card-empty">Сейчас никого нет в сети.</div> : null}
      <ul className="home-online">
        {shown.map((colleague) => (
          <li key={colleague.id}>
            <button type="button" className="home-online-person" onClick={() => void write(colleague.id)} title={`Написать: ${colleague.fullName}`}>
              <ColleagueAvatar colleague={colleague} size={44} online />
              <span className="home-online-name">{firstName(colleague.fullName) || colleague.fullName}</span>
            </button>
          </li>
        ))}
        {online.length > shown.length ? <li className="home-online-more">+{online.length - shown.length}</li> : null}
      </ul>
      <Link to="/employees" className="home-card-link">Все сотрудники →</Link>
    </section>
  );
}

function QuickLinks({ admin }: { admin: boolean }) {
  const chat = useOptionalChat();
  const links = [
    chat?.enabled ? { to: '/chat', title: 'Чат', text: 'Личные и групповые переписки с коллегами.' } : null,
    { to: '/employees', title: 'Сотрудники', text: 'Контакты коллег: телефоны, e-mail, должности.' },
    admin ? null : { to: '/directory/organizations', title: 'Организации', text: 'Справочник клиентов: реквизиты, телефоны и контакты.' },
    admin ? { to: '/campaigns/new', title: 'Новая рассылка', text: 'Создать кампанию, выбрать организации и письмо.' } : null,
    admin ? { to: '/campaigns', title: 'Рассылки', text: 'Статусы кампаний, запуск и статистика.' } : null,
    admin ? { to: '/organizations', title: 'Организации', text: 'Карточки организаций и контакты.' } : null,
    admin ? { to: '/settings', title: 'Настройки', text: 'SMTP-профили отправителей и лимиты.' } : null
  ].filter((item): item is { to: string; title: string; text: string } => !!item);

  return (
    <section className="home-section" aria-labelledby="home-links-title">
      <h2 id="home-links-title" className="home-section-title">Быстрые ссылки</h2>
      <div className="home-links">
        {links.map((link) => (
          <Link key={link.to} to={link.to} className="action-card">
            <h3>{link.title}</h3>
            <p>{link.text}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

/** Показатели рассылок — только администраторам (API /api/dashboard закрыт политикой Admin). */
function AdminOverview() {
  const [dashboard, setDashboard] = useState<DashboardDto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      setDashboard(await getDashboard());
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить показатели рассылок.'), 'error', 4000);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  return (
    <section className="home-section" aria-labelledby="home-admin-title">
      <div className="home-section-head">
        <h2 id="home-admin-title" className="home-section-title">Рассылки</h2>
        <button
          type="button"
          className="secondary-button button-inline icon-button search-button"
          onClick={() => void load()}
          aria-label="Обновить показатели рассылок"
          title="Обновить показатели рассылок"
        >
          <ActionIcon kind="refresh" />
        </button>
      </div>
      {loading && !dashboard ? <AppLoader variant="panel" label="Собираем сводку" description="Показатели по организациям и очереди." /> : null}
      {dashboard ? (
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
      ) : null}
    </section>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const [colleagues, setColleagues] = useState<ColleagueDto[] | null>(null);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    let active = true;
    getColleagues()
      .then((items) => active && setColleagues(items))
      .catch(() => active && setColleagues([]));
    return () => {
      active = false;
    };
  }, []);

  const name = firstName(user?.fullName) || user?.login || '';
  const dateLabel = today.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page home">
      <PageHeader title={`${greeting(today)}${name ? `, ${name}` : ''}!`} subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} />

      <div className="home-grid">
        <MyTasksCard />
        <ChatCard />
        <BirthdaysCard colleagues={colleagues} />
        <OnlineCard colleagues={colleagues} />
      </div>

      <QuickLinks admin={admin} />

      {admin ? <AdminOverview /> : null}
    </div>
  );
}

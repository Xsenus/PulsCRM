import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { getDatabaseInfo } from '../app/api';
import { useAuth } from '../app/AuthContext';

type MenuIconKey = 'dashboard' | 'analytics' | 'employees' | 'organizations' | 'campaigns' | 'dispatch' | 'settings';

const SIDEBAR_STATE_KEY = 'puls-next-sidebar-collapsed';

const menu: Array<{ to?: string; label: string; icon: MenuIconKey; children?: Array<{ to: string; label: string }> }> = [
  { to: '/', label: 'Дашборд', icon: 'dashboard' },
  { label: 'Аналитика', icon: 'analytics', children: [{ to: '/analytics/parus-tornado', label: 'Парус Торнадо' }] },
  { to: '/employees', label: 'Сотрудники', icon: 'employees' },
  { to: '/organizations', label: 'Организации', icon: 'organizations' },
  { to: '/campaigns', label: 'Рассылки', icon: 'campaigns' },
  { to: '/dispatch', label: 'Очередь', icon: 'dispatch' },
  { to: '/settings', label: 'Настройки', icon: 'settings' }
];

function MenuIcon({ icon }: { icon: MenuIconKey }) {
  switch (icon) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" fill="currentColor" />
        </svg>
      );
    case 'analytics':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 19h14v2H5zm1-2h3V9H6zm5 0h3V4h-3zm5 0h3v-6h-3z" fill="currentColor" />
        </svg>
      );
    case 'employees':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-7 8a7 7 0 0 1 14 0H5Zm13.5-8.5a3 3 0 1 0-2.72-4.27 5.94 5.94 0 0 1 0 4.54A3 3 0 0 0 18.5 11.5Zm1.84 8.5a5.98 5.98 0 0 0-3.52-5.45A8.94 8.94 0 0 1 20 20Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'organizations':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 20V6.5A1.5 1.5 0 0 1 5.5 5H11v15Zm9 0V3.5A1.5 1.5 0 0 1 14.5 2h4A1.5 1.5 0 0 1 20 3.5V20Zm-6-3h2v-2H7Zm0-4h2v-2H7Zm0-4h2V7H7Zm8 8h2v-2h-2Zm0-4h2v-2h-2Zm0-4h2V7h-2Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'campaigns':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5v11a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5Zm2 0v11h11v-11Zm2.5 2h6v2h-6Zm0 4h7v2h-7Zm0 4h4v2h-4Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'dispatch':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 5.5A1.5 1.5 0 0 1 6.5 4h11A1.5 1.5 0 0 1 19 5.5v2A1.5 1.5 0 0 1 17.5 9h-11A1.5 1.5 0 0 1 5 7.5Zm0 6A1.5 1.5 0 0 1 6.5 10h11a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 13.5Zm0 6A1.5 1.5 0 0 1 6.5 16h11a1.5 1.5 0 0 1 1.5 1.5v1A1.5 1.5 0 0 1 17.5 20h-11A1.5 1.5 0 0 1 5 18.5ZM8 6v1h8V6Zm0 6v1h8v-1Zm0 6v1h8v-1Z"
            fill="currentColor"
          />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="m19.14 12.94.04-.94-.04-.94 2.03-1.58a.63.63 0 0 0 .15-.8l-1.92-3.32a.64.64 0 0 0-.77-.28l-2.39.96a7.57 7.57 0 0 0-1.63-.94L14.2 2.5a.63.63 0 0 0-.62-.5h-3.16a.63.63 0 0 0-.62.5l-.41 2.6a7.57 7.57 0 0 0-1.63.94l-2.39-.96a.64.64 0 0 0-.77.28L2.68 8.68a.63.63 0 0 0 .15.8l2.03 1.58-.04.94.04.94-2.03 1.58a.63.63 0 0 0-.15.8l1.92 3.32a.64.64 0 0 0 .77.28l2.39-.96c.5.39 1.05.71 1.63.94l.41 2.6a.63.63 0 0 0 .62.5h3.16a.63.63 0 0 0 .62-.5l.41-2.6c.58-.23 1.13-.55 1.63-.94l2.39.96a.64.64 0 0 0 .77-.28l1.92-3.32a.63.63 0 0 0-.15-.8ZM12 15.5A3.5 3.5 0 1 1 15.5 12 3.5 3.5 0 0 1 12 15.5Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={collapsed ? 'm9 6 6 6-6 6' : 'm15 6-6 6 6 6'} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-4.42 0-8 2.24-8 5v1h16v-1c0-2.76-3.58-5-8-5Z"
        fill="currentColor"
      />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4v-2H6V6h4Zm6.59 3.59L15.17 9 17.59 11H9v2h8.59l-2.42 2 1.42 1.41L21.41 12Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getInitials(fullName?: string, login?: string) {
  const source = (fullName || login || 'Пользователь').trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getShortProfileName(fullName?: string, login?: string) {
  const source = (fullName || login || 'Пользователь').trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length <= 1) {
    return source;
  }

  const [lastName, firstName = '', middleName = ''] = parts;
  const initials = [firstName, middleName]
    .filter(Boolean)
    .map((part) => `${part[0]}.`)
    .join('');

  return initials ? `${lastName} ${initials}` : lastName;
}

function buildImageSource(base64?: string, contentType?: string) {
  if (!base64) {
    return undefined;
  }

  return `data:${contentType || 'image/jpeg'};base64,${base64}`;
}

function getCurrentSection(pathname: string) {
  if (pathname.startsWith('/campaigns/')) {
    return 'Рассылки';
  }

  if (pathname.startsWith('/analytics')) {
    return 'Парус Торнадо';
  }

  if (pathname.startsWith('/dispatch')) {
    return 'Очередь рассылок';
  }

  return menu.find((item) => item.to && (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)))?.label || 'Раздел';
}

function getApplicationVersionNumber(version: string | null) {
  if (!version) {
    return null;
  }

  const trimmed = version.trim().replace(/^v/i, '');
  return trimmed.split('+')[0];
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_STATE_KEY) === '1');
  const [profileOpen, setProfileOpen] = useState(false);
  const [databaseInfo, setDatabaseInfo] = useState<{ databaseName: string; applicationVersion: string | null } | null>(null);

  const currentSection = useMemo(() => getCurrentSection(location.pathname), [location.pathname]);
  const initials = useMemo(() => getInitials(user?.fullName, user?.login), [user?.fullName, user?.login]);
  const shortProfileName = useMemo(() => getShortProfileName(user?.fullName, user?.login), [user?.fullName, user?.login]);
  const avatarSource = useMemo(
    () => buildImageSource(user?.avatarBase64, user?.avatarContentType),
    [user?.avatarBase64, user?.avatarContentType]
  );
  const applicationVersion = useMemo(
    () => getApplicationVersionNumber(databaseInfo?.applicationVersion ?? null),
    [databaseInfo?.applicationVersion]
  );
  const profileRole = user?.userGroup?.trim() || 'Разработчик';
  const profileContact = user?.phone?.trim() || user?.email?.trim() || user?.login || 'Контакт не указан';
  const profileTitle = user?.fullName || user?.login || 'Пользователь';

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;

    async function loadDatabaseInfo() {
      if (!user?.isRoot) {
        setDatabaseInfo(null);
        return;
      }

      try {
        const info = await getDatabaseInfo();
        if (mounted) {
          const databaseName = info?.databaseName?.trim() || null;
          setDatabaseInfo(databaseName
            ? {
                databaseName,
                applicationVersion: info?.applicationVersion?.trim() || null
              }
            : null);
        }
      } catch {
        if (mounted) {
          setDatabaseInfo(null);
        }
      }
    }

    loadDatabaseInfo();
    return () => {
      mounted = false;
    };
  }, [user?.isRoot]);

  useEffect(() => {
    if (!profileOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [profileOpen]);

  const handleOpenProfile = () => {
    if (!user?.id) {
      return;
    }

    setProfileOpen(false);
    navigate(`/employees/${user.id}/edit`);
  };

  return (
    <div className={`app-shell${collapsed ? ' app-shell-collapsed' : ''}`}>
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-logo">PN</div>
            <div className="brand-copy">
              <div className="brand-title">Puls Next</div>
              <div className="brand-subtitle">Панель рассылок</div>
            </div>
          </div>

          <button
            type="button"
            className="sidebar-toggle"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? 'Развернуть меню' : 'Свернуть меню'}
          >
            <span className="sidebar-toggle-icon">
              <CollapseIcon collapsed={collapsed} />
            </span>
            <span className="sidebar-toggle-label">{collapsed ? 'Развернуть' : 'Свернуть'}</span>
          </button>
        </div>

        <nav className="menu">
          {menu.map((item) => {
            if (item.children?.length) {
              const active = item.children.some((child) => location.pathname.startsWith(child.to));

              return (
                <div key={item.label} className={`menu-group ${active ? 'active' : ''}`}>
                  <div className={`menu-link menu-link-parent ${active ? 'active' : ''}`} title={collapsed ? item.label : undefined}>
                    <span className="menu-link-icon">
                      <MenuIcon icon={item.icon} />
                    </span>
                    <span className="menu-link-label">{item.label}</span>
                  </div>
                  <div className="menu-submenu">
                    {item.children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        className={({ isActive }) => `menu-submenu-link ${isActive ? 'active' : ''}`}
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to ?? '/'}
                end={item.to === '/'}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
              >
                <span className="menu-link-icon">
                  <MenuIcon icon={item.icon} />
                </span>
                <span className="menu-link-label">{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        {databaseInfo ? (
          <div
            className="sidebar-database"
            title={`База данных: ${databaseInfo.databaseName}${databaseInfo.applicationVersion ? `, версия: ${databaseInfo.applicationVersion}` : ''}`}
          >
            <span className="sidebar-database-label">БД</span>
            <span className="sidebar-database-main">
              <span className="sidebar-database-name">{databaseInfo.databaseName}</span>
              {applicationVersion ? (
                <span className="sidebar-database-version" title={databaseInfo.applicationVersion ?? undefined}>
                  <span className="sidebar-database-version-label">Версия</span>
                  <span className="sidebar-database-version-number">{applicationVersion}</span>
                </span>
              ) : null}
            </span>
          </div>
        ) : null}
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div className="topbar-title">{currentSection}</div>

          <div className="topbar-actions">
            <div className="profile-menu-shell" ref={profileMenuRef}>
              <button
                type="button"
                className={`profile-button${profileOpen ? ' active' : ''}`}
                onClick={() => setProfileOpen((current) => !current)}
                aria-label="Открыть меню пользователя"
                aria-expanded={profileOpen}
                title={profileTitle}
              >
                <span className="profile-avatar">
                  {avatarSource ? <img src={avatarSource} alt="" /> : initials}
                </span>
              </button>

              {profileOpen ? (
                <div className="profile-menu">
                  <div className="profile-menu-head">
                    <div className="profile-menu-identity">
                      <span className="profile-menu-avatar">
                        {avatarSource ? <img src={avatarSource} alt="" /> : initials}
                      </span>

                      <div className="profile-menu-copy">
                        <div className="profile-menu-caption">Пользователь системы</div>
                        <div className="profile-menu-name" title={profileTitle}>
                          {shortProfileName}
                        </div>
                      </div>
                    </div>

                    <div className="profile-menu-details">
                      <div className="profile-menu-meta">{profileRole}</div>
                      <div className="profile-menu-login">{profileContact}</div>
                    </div>
                  </div>

                  <div className="profile-menu-actions">
                    <button
                      type="button"
                      className="profile-menu-action profile-menu-action-secondary"
                      onClick={handleOpenProfile}
                      disabled={!user?.id}
                      title={user?.id ? 'Открыть карточку сотрудника' : 'Карточка сотрудника недоступна'}
                    >
                      <span className="profile-menu-action-icon">
                        <ProfileIcon />
                      </span>
                      <span>Профиль</span>
                    </button>

                    <button type="button" className="profile-menu-action profile-menu-action-danger" onClick={logout}>
                      <span className="profile-menu-action-icon">
                        <LogoutIcon />
                      </span>
                      <span>Выйти</span>
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <main className="content">{children}</main>
      </div>
    </div>
  );
}

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';

type MenuIconKey = 'dashboard' | 'employees' | 'organizations' | 'campaigns' | 'settings';

const SIDEBAR_STATE_KEY = 'puls-next-sidebar-collapsed';

const menu: Array<{ to: string; label: string; icon: MenuIconKey }> = [
  { to: '/', label: 'Дашборд', icon: 'dashboard' },
  { to: '/employees', label: 'Сотрудники', icon: 'employees' },
  { to: '/organizations', label: 'Организации', icon: 'organizations' },
  { to: '/campaigns', label: 'Рассылки', icon: 'campaigns' },
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

function getCurrentSection(pathname: string) {
  if (pathname.startsWith('/campaigns/')) {
    return 'Рассылки';
  }

  return menu.find((item) => (item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)))?.label || 'Раздел';
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(SIDEBAR_STATE_KEY) === '1');
  const [profileOpen, setProfileOpen] = useState(false);

  const currentSection = useMemo(() => getCurrentSection(location.pathname), [location.pathname]);
  const initials = useMemo(() => getInitials(user?.fullName, user?.login), [user?.fullName, user?.login]);
  const profileSecondaryText = user?.phone || user?.email || user?.login || 'Пользователь';

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STATE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    setProfileOpen(false);
  }, [location.pathname]);

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
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) => `menu-link ${isActive ? 'active' : ''}`}
            >
              <span className="menu-link-icon">
                <MenuIcon icon={item.icon} />
              </span>
              <span className="menu-link-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="content-shell">
        <header className="topbar">
          <div className="topbar-title">{currentSection}</div>

          <div className="topbar-actions">
            <div className="profile-menu-shell" ref={profileMenuRef}>
              <button
                type="button"
                className="profile-button"
                onClick={() => setProfileOpen((current) => !current)}
                aria-label="Открыть меню пользователя"
                aria-expanded={profileOpen}
              >
                <span className="profile-avatar">{initials}</span>
              </button>

              {profileOpen ? (
                <div className="profile-menu">
                  <div className="profile-menu-head">
                    <div className="profile-menu-name">{user?.fullName || user?.login}</div>
                    <div className="profile-menu-meta">{user?.userGroup || 'Пользователь'}</div>
                    <div className="profile-menu-login">{profileSecondaryText}</div>
                  </div>

                  <button type="button" className="profile-menu-action" onClick={logout}>
                    <span className="profile-menu-action-icon">
                      <LogoutIcon />
                    </span>
                    <span>Выйти</span>
                  </button>
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

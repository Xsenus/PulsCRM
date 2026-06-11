import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import { getLoginUsers } from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { formatDateTime } from '../app/format';
import { loadLastLoginProfile } from '../app/lastLoginProfile';
import type { LoginUserOptionDto } from '../app/types';
import { AppLoader, LoadingButtonLabel } from '../components/AppLoader';

const LOGIN_USERS_TAKE = 50;
const LOGIN_USERS_VISIBLE_LIMIT = 8;
const LOGIN_USERS_REFRESH_MS = 60_000;
const LOGIN_USERS_SEARCH_DEBOUNCE_MS = 220;

function normalizeLogin(value: string) {
  return value.trim().toLowerCase();
}

function compareLoginUsers(left: LoginUserOptionDto, right: LoginUserOptionDto) {
  const leftTitle = (left.fullName || left.login || '').trim().toLowerCase();
  const rightTitle = (right.fullName || right.login || '').trim().toLowerCase();

  if (leftTitle !== rightTitle) {
    return leftTitle.localeCompare(rightTitle, 'ru');
  }

  return left.login.trim().toLowerCase().localeCompare(right.login.trim().toLowerCase(), 'ru');
}

function mergeLoginUsers(current: LoginUserOptionDto[], incoming: LoginUserOptionDto[]) {
  if (incoming.length === 0) {
    return current;
  }

  const known = new Map(current.map((item) => [normalizeLogin(item.login), item]));
  let changed = false;

  for (const item of incoming) {
    const key = normalizeLogin(item.login);
    if (!key) {
      continue;
    }

    const existing = known.get(key);
    if (
      existing
      && existing.id === item.id
      && existing.login === item.login
      && existing.fullName === item.fullName
      && existing.userGroup === item.userGroup
    ) {
      continue;
    }

    known.set(key, item);
    changed = true;
  }

  if (!changed) {
    return current;
  }

  return Array.from(known.values()).sort(compareLoginUsers);
}

function filterLoginUsers(users: LoginUserOptionDto[], term: string) {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) {
    return users.slice(0, LOGIN_USERS_VISIBLE_LIMIT);
  }

  return users
    .filter((item) => {
      const login = item.login.trim().toLowerCase();
      const fullName = item.fullName?.trim().toLowerCase() || '';
      const userGroup = item.userGroup?.trim().toLowerCase() || '';

      return login.includes(normalizedTerm) || fullName.includes(normalizedTerm) || userGroup.includes(normalizedTerm);
    })
    .slice(0, LOGIN_USERS_VISIBLE_LIMIT);
}

function getUserInitials(fullName?: string, login?: string) {
  const source = (fullName || login || 'User').trim();
  const parts = source.split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getUserTitle(user: { fullName?: string; login: string }) {
  return user.fullName?.trim() || user.login;
}

function getUserMeta(user: { login: string; userGroup?: string }) {
  return [user.login, user.userGroup].filter(Boolean).join(' / ');
}

function LoginChevronIcon({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d={open ? 'M7 14l5-5 5 5' : 'M7 10l5 5 5-5'}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const loginFieldRef = useRef<HTMLDivElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const lastRequestedSearchRef = useRef('');
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<LoginUserOptionDto[]>([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [usersSearchLoading, setUsersSearchLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lastLoginProfile] = useState(() => loadLastLoginProfile());

  const visibleUsers = filterLoginUsers(users, loginValue);

  useEffect(() => {
    let cancelled = false;

    const loadUsers = async () => {
      setUsersLoading(true);

      try {
        const items = await getLoginUsers('', LOGIN_USERS_TAKE);
        if (cancelled) {
          return;
        }

        setUsers(items.sort(compareLoginUsers));
        setUsersError('');
      } catch (error) {
        if (cancelled) {
          return;
        }

        setUsersError(getApiErrorMessage(error, 'Не удалось загрузить список пользователей.'));
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    };

    void loadUsers();

    const intervalId = window.setInterval(async () => {
      try {
        const items = await getLoginUsers('', LOGIN_USERS_TAKE);
        if (cancelled) {
          return;
        }

        setUsers((current) => mergeLoginUsers(current, items));
      } catch {
        // Keep the cached list if background refresh fails.
      }
    }, LOGIN_USERS_REFRESH_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!isUserDropdownOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!loginFieldRef.current?.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
        setHighlightedIndex(-1);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isUserDropdownOpen]);

  useEffect(() => {
    if (!isUserDropdownOpen) {
      setUsersSearchLoading(false);
      lastRequestedSearchRef.current = '';
      return;
    }

    const normalizedSearch = loginValue.trim();
    if (!normalizedSearch) {
      setUsersSearchLoading(false);
      lastRequestedSearchRef.current = '';
      return;
    }

    if (visibleUsers.length >= LOGIN_USERS_VISIBLE_LIMIT || lastRequestedSearchRef.current === normalizeLogin(normalizedSearch)) {
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setUsersSearchLoading(true);
      lastRequestedSearchRef.current = normalizeLogin(normalizedSearch);

      try {
        const items = await getLoginUsers(normalizedSearch, LOGIN_USERS_TAKE);
        if (cancelled) {
          return;
        }

        setUsers((current) => mergeLoginUsers(current, items));
        setUsersError('');
      } catch {
        // Keep the cached list if targeted search fails.
      } finally {
        if (!cancelled) {
          setUsersSearchLoading(false);
        }
      }
    }, LOGIN_USERS_SEARCH_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isUserDropdownOpen, loginValue, visibleUsers.length]);

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async () => {
    const normalizedLogin = loginValue.trim();
    if (!normalizedLogin || !password) {
      return;
    }

    setLoading(true);
    setErrorMessage('');

    try {
      await login(normalizedLogin, password);
      const destination = (location.state as any)?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Не удалось войти.'));
    } finally {
      setLoading(false);
    }
  };

  const selectUser = (user: LoginUserOptionDto) => {
    setLoginValue(user.login);
    setErrorMessage('');
    setIsUserDropdownOpen(false);
    setHighlightedIndex(-1);
    passwordInputRef.current?.focus();
  };

  const selectLastLoginProfile = () => {
    if (!lastLoginProfile) {
      return;
    }

    setLoginValue(lastLoginProfile.login);
    setPassword('');
    setErrorMessage('');
    setIsUserDropdownOpen(false);
    setHighlightedIndex(-1);
    passwordInputRef.current?.focus();
  };

  const toggleUserDropdown = () => {
    setIsUserDropdownOpen((current) => !current);
    setHighlightedIndex(-1);
  };

  const handleLoginKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();

      if (!isUserDropdownOpen) {
        setIsUserDropdownOpen(true);
        return;
      }

      if (visibleUsers.length === 0) {
        return;
      }

      setHighlightedIndex((current) => (current < visibleUsers.length - 1 ? current + 1 : 0));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (!isUserDropdownOpen) {
        setIsUserDropdownOpen(true);
        return;
      }

      if (visibleUsers.length === 0) {
        return;
      }

      setHighlightedIndex((current) => (current > 0 ? current - 1 : visibleUsers.length - 1));
      return;
    }

    if (event.key === 'Enter' && isUserDropdownOpen && highlightedIndex >= 0 && visibleUsers[highlightedIndex]) {
      event.preventDefault();
      selectUser(visibleUsers[highlightedIndex]);
      return;
    }

    if (event.key === 'Escape') {
      setIsUserDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  const lastLoginSelected = !!lastLoginProfile && normalizeLogin(loginValue) === normalizeLogin(lastLoginProfile.login);

  return (
    <div className="login-page">
      <div className="login-layout">
        <section className="login-card">
          <div className="login-header">
            <div className="login-brand">Puls Next Mailing</div>
            <h1>Вход в систему</h1>
          </div>

          {errorMessage ? <div className="login-alert">{errorMessage}</div> : null}

          <form
            className="login-form"
            autoComplete="off"
            onSubmit={(event) => {
              event.preventDefault();
              void onSubmit();
            }}
          >
            <div className="form-autocomplete-trap" aria-hidden="true">
              <input type="text" tabIndex={-1} autoComplete="username" />
              <input type="password" tabIndex={-1} autoComplete="current-password" />
            </div>

            <div className="field">
              <label htmlFor="login-value">Логин</label>
              <div className="login-input-stack" ref={loginFieldRef}>
                <div className={`login-combobox${isUserDropdownOpen ? ' open' : ''}`}>
                  <input
                    id="login-value"
                    name="puls-login-manual"
                    className="form-input login-combobox-input"
                    value={loginValue}
                    onChange={(event) => {
                      setLoginValue(event.target.value);
                      setErrorMessage('');
                      setIsUserDropdownOpen(true);
                    }}
                    onFocus={() => setIsUserDropdownOpen(true)}
                    onKeyDown={handleLoginKeyDown}
                    placeholder="Начните вводить логин"
                    autoComplete="off"
                    autoCapitalize="none"
                    spellCheck={false}
                    data-lpignore="true"
                    aria-autocomplete="list"
                    aria-expanded={isUserDropdownOpen}
                    aria-controls="login-user-listbox"
                  />
                  <button
                    type="button"
                    className="login-combobox-toggle"
                    onClick={toggleUserDropdown}
                    aria-label={isUserDropdownOpen ? 'Скрыть список пользователей' : 'Показать список пользователей'}
                  >
                    <LoginChevronIcon open={isUserDropdownOpen} />
                  </button>
                </div>

                {isUserDropdownOpen ? (
                  <div className="login-dropdown" id="login-user-listbox" role="listbox">
                    {usersLoading && users.length === 0 ? (
                      <div className="login-dropdown-state">
                        <AppLoader variant="inline" label="Собираем список пользователей" />
                      </div>
                    ) : null}
                    {!usersLoading && usersError && users.length === 0 ? <div className="login-dropdown-state login-dropdown-state-error">{usersError}</div> : null}
                    {!usersLoading && !usersError && usersSearchLoading && visibleUsers.length === 0 ? (
                      <div className="login-dropdown-state">
                        <AppLoader variant="inline" label="Ищем пользователей" />
                      </div>
                    ) : null}
                    {!usersLoading && !usersError && !usersSearchLoading && visibleUsers.length === 0 ? <div className="login-dropdown-state">Ничего не найдено.</div> : null}
                    {visibleUsers.length > 0 ? (
                      <div className="login-user-list">
                        {visibleUsers.map((user, index) => {
                          const selected = normalizeLogin(loginValue) === normalizeLogin(user.login);
                          const highlighted = index === highlightedIndex;

                          return (
                            <button
                              key={user.id}
                              type="button"
                              className={`login-user-option${selected ? ' selected' : ''}${highlighted ? ' highlighted' : ''}`}
                              onMouseDown={(event) => event.preventDefault()}
                              onMouseEnter={() => setHighlightedIndex(index)}
                              onClick={() => selectUser(user)}
                              role="option"
                              aria-selected={selected}
                            >
                              <span className="login-user-name">{getUserTitle(user)}</span>
                              <span className="login-user-meta">{getUserMeta(user)}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="field">
              <label htmlFor="password-value">Пароль</label>
              <input
                id="password-value"
                ref={passwordInputRef}
                name="puls-password-manual"
                className="form-input"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                onFocus={() => setIsUserDropdownOpen(false)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    void onSubmit();
                  }
                }}
                autoComplete="new-password"
                data-lpignore="true"
              />
            </div>

            <button type="submit" className="primary-button" disabled={loading}>
              {loading ? <LoadingButtonLabel label="Входим" /> : 'Войти'}
            </button>

            {lastLoginProfile ? (
              <button
                type="button"
                className={`login-last-user-card${lastLoginSelected ? ' selected' : ''}`}
                onClick={selectLastLoginProfile}
              >
                <span className="login-last-user-avatar" aria-hidden="true">
                  {getUserInitials(lastLoginProfile.fullName, lastLoginProfile.login)}
                </span>

                <span className="login-last-user-copy">
                  <span className="login-last-user-label">Последний успешный вход</span>
                  <span className="login-last-user-name">{getUserTitle(lastLoginProfile)}</span>
                  <span className="login-last-user-meta">
                    {getUserMeta(lastLoginProfile)}
                    {lastLoginProfile.lastUsedAt ? ` / ${formatDateTime(lastLoginProfile.lastUsedAt)}` : ''}
                  </span>
                </span>
              </button>
            ) : null}
          </form>
        </section>
      </div>
    </div>
  );
}

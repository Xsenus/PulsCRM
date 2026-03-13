import React, { useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import { getLoginUsers } from '../app/api';
import type { LoginUserOptionDto } from '../app/types';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const loginFieldRef = useRef<HTMLDivElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const [loginValue, setLoginValue] = useState('');
  const [password, setPassword] = useState('');
  const [users, setUsers] = useState<LoginUserOptionDto[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (!isUserDropdownOpen) {
      setUsersLoading(false);
      setUsersError('');
      setHighlightedIndex(-1);
      return;
    }

    let cancelled = false;
    const timeoutId = window.setTimeout(async () => {
      setUsersLoading(true);
      try {
        const items = await getLoginUsers(loginValue.trim(), 8);
        if (cancelled) {
          return;
        }

        setUsers(items);
        setUsersError('');
        setHighlightedIndex(-1);
      } catch (error: any) {
        if (cancelled) {
          return;
        }

        setUsers([]);
        setUsersError(error.message || 'Не удалось загрузить список пользователей.');
        setHighlightedIndex(-1);
      } finally {
        if (!cancelled) {
          setUsersLoading(false);
        }
      }
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [isUserDropdownOpen, loginValue]);

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

  if (isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = async () => {
    setLoading(true);
    setErrorMessage('');
    try {
      await login(loginValue, password);
      const destination = (location.state as any)?.from?.pathname || '/';
      navigate(destination, { replace: true });
    } catch (error: any) {
      setErrorMessage(error.message || 'Не удалось войти.');
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

      if (users.length === 0) {
        return;
      }

      setHighlightedIndex((current) => (current < users.length - 1 ? current + 1 : 0));
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();

      if (!isUserDropdownOpen) {
        setIsUserDropdownOpen(true);
        return;
      }

      if (users.length === 0) {
        return;
      }

      setHighlightedIndex((current) => (current > 0 ? current - 1 : users.length - 1));
      return;
    }

    if (event.key === 'Enter' && isUserDropdownOpen && highlightedIndex >= 0 && users[highlightedIndex]) {
      event.preventDefault();
      selectUser(users[highlightedIndex]);
      return;
    }

    if (event.key === 'Escape') {
      setIsUserDropdownOpen(false);
      setHighlightedIndex(-1);
    }
  };

  return (
    <div className="login-page">
      <div className="login-layout">
        <section className="login-card">
          <div className="login-header">
            <div className="login-brand">Puls Next Mailing</div>
            <h1>Вход в систему</h1>
          </div>

          {errorMessage ? <div className="login-alert">{errorMessage}</div> : null}

          <div className="login-form">
            <div className="field">
              <label htmlFor="login-value">Логин</label>
              <div className="login-input-stack" ref={loginFieldRef}>
                <div className={`login-combobox${isUserDropdownOpen ? ' open' : ''}`}>
                  <input
                    id="login-value"
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
                    autoComplete="username"
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
                    <span aria-hidden="true">{isUserDropdownOpen ? '^' : 'v'}</span>
                  </button>
                </div>

                {isUserDropdownOpen ? (
                  <div className="login-dropdown" id="login-user-listbox" role="listbox">
                    {usersLoading ? <div className="login-dropdown-state">Загрузка пользователей...</div> : null}
                    {!usersLoading && usersError ? <div className="login-dropdown-state login-dropdown-state-error">{usersError}</div> : null}
                    {!usersLoading && !usersError && users.length === 0 ? <div className="login-dropdown-state">Ничего не найдено.</div> : null}
                    {!usersLoading && !usersError && users.length > 0 ? (
                      <div className="login-user-list">
                        {users.map((user, index) => {
                          const selected = loginValue.trim().toLowerCase() === user.login.trim().toLowerCase();
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
                              <span className="login-user-name">{user.fullName || user.login}</span>
                              <span className="login-user-meta">
                                <strong>{user.login}</strong>
                                {user.userGroup ? ` • ${user.userGroup}` : ''}
                              </span>
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
                autoComplete="current-password"
              />
            </div>

            <button type="button" className="primary-button" disabled={loading} onClick={() => void onSubmit()}>
              {loading ? 'Входим...' : 'Войти'}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

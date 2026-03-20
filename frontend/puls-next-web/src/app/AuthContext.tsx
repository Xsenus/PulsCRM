import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { getCurrentUser, getToken, login as loginRequest, setToken } from './api';
import { rememberLastLoginProfile } from './lastLoginProfile';
import type { CurrentUserDto } from './types';

interface AuthContextValue {
  user: CurrentUserDto | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (login: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUserDto | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        if (!getToken()) {
          return;
        }

        const current = await getCurrentUser();
        if (mounted) {
          setUser(current);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    const onExpired = () => {
      setToken(null);
      setUser(null);
    };

    window.addEventListener('puls-auth-expired', onExpired as EventListener);
    return () => {
      mounted = false;
      window.removeEventListener('puls-auth-expired', onExpired as EventListener);
    };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    isAuthenticated: !!user,
    login: async (loginValue: string, password: string) => {
      const response = await loginRequest(loginValue, password);
      setToken(response.accessToken);
      rememberLastLoginProfile(response.user);
      setUser(response.user);
    },
    logout: () => {
      setToken(null);
      setUser(null);
    }
  }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}

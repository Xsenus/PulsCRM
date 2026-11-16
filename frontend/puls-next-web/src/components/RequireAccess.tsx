import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import { canAccess, type AccessLevel } from '../app/access';

/** Маршруты раздела с ограниченным доступом: без прав — на дашборд (прямая ссылка или закладка). */
export function RequireAccess({ level }: { level: AccessLevel }) {
  const { user } = useAuth();
  return canAccess(user, level) ? <Outlet /> : <Navigate to="/" replace />;
}

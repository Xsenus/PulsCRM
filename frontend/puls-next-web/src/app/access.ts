/**
 * Доступ к разделам приложения.
 *
 * - everyone — все сотрудники (дашборд, чат, справочник «Сотрудники» карточками);
 * - admin — администраторы: сотрудники с флагом «Администратор системы» (isRoot);
 * - employee — только в меню сотрудников без прав администратора: у администратора есть полный раздел
 *   (например, справочник организаций только для чтения вместо раздела «Организации»). Сам маршрут открыт всем.
 *
 * Новый раздел добавляется строкой в меню (AppShell) с нужным уровнем и маршрутом внутри <RequireAccess>
 * в App.tsx. Сервер проверяет то же самое сам (политика Admin в API), здесь — только скрытие в интерфейсе.
 */
export type AccessLevel = 'everyone' | 'admin' | 'employee';

export function isAdmin(user: { isRoot?: boolean } | null | undefined) {
  return !!user?.isRoot;
}

export function canAccess(user: { isRoot?: boolean } | null | undefined, level: AccessLevel) {
  if (level === 'employee') {
    return !isAdmin(user);
  }

  return level === 'everyone' || isAdmin(user);
}

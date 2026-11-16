/**
 * Доступ к разделам приложения.
 *
 * - everyone — все сотрудники (дашборд, чат, справочник «Сотрудники» карточками);
 * - admin — администраторы: сотрудники с флагом «Администратор системы» (isRoot).
 *
 * Новый раздел добавляется строкой в меню (AppShell) с нужным уровнем и маршрутом внутри <RequireAccess>
 * в App.tsx. Сервер проверяет то же самое сам (политика Admin в API), здесь — только скрытие в интерфейсе.
 */
export type AccessLevel = 'everyone' | 'admin';

export function isAdmin(user: { isRoot?: boolean } | null | undefined) {
  return !!user?.isRoot;
}

export function canAccess(user: { isRoot?: boolean } | null | undefined, level: AccessLevel) {
  return level === 'everyone' || isAdmin(user);
}

/** Событие «открыть карточку коллеги»: его слушает ColleagueCardHost в оболочке приложения. */
export const OPEN_COLLEAGUE_CARD_EVENT = 'puls-open-colleague-card';

/** Открыть карточку коллеги поверх текущей страницы (из чата, дашборда, ссылок). */
export function openColleagueCard(id: number) {
  window.dispatchEvent(new CustomEvent<{ id: number }>(OPEN_COLLEAGUE_CARD_EVENT, { detail: { id } }));
}

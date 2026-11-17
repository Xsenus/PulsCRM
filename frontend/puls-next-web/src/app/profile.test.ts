import { describe, expect, it } from 'vitest';
import { formatStatus, formatStatusUntil, getStatusNote, isStatusActive } from './profile';
import { resolveStatusUntil } from '../pages/ProfilePage';

const now = new Date(2026, 10, 17, 10, 30);

describe('статус сотрудника', () => {
  it('описывает срок относительно текущего момента', () => {
    expect(formatStatusUntil(new Date(2026, 10, 17, 15, 0).toISOString(), now)).toBe('до 15:00');
    expect(formatStatusUntil(new Date(2026, 10, 17, 23, 59).toISOString(), now)).toBe('до конца дня');
    expect(formatStatusUntil(new Date(2026, 10, 18, 9, 0).toISOString(), now)).toBe('до завтра, 09:00');
    expect(formatStatusUntil(new Date(2026, 10, 25, 23, 59).toISOString(), now)).toBe('до 25 ноября включительно');
    expect(formatStatusUntil(new Date(2027, 0, 10, 23, 59).toISOString(), now)).toBe('до 10 января 2027 включительно');
  });

  it('собирает текст статуса с эмодзи, сроком и пояснением', () => {
    const vacation = { kind: 'vacation', text: 'По срочным — Петров', untilUtc: new Date(2026, 10, 25, 23, 59).toISOString() };
    expect(formatStatus(vacation, now)).toBe('🌴 В отпуске до 25 ноября включительно');
    expect(getStatusNote(vacation)).toBe('По срочным — Петров');
    expect(formatStatus({ kind: 'meeting' }, now)).toBe('📅 На совещании');
    // Свой статус: текст — это и есть заголовок, отдельного пояснения нет.
    expect(formatStatus({ kind: 'custom', text: 'Обучение' }, now)).toBe('💬 Обучение');
    expect(getStatusNote({ kind: 'custom', text: 'Обучение' })).toBeNull();
  });

  it('истекший статус не считается действующим', () => {
    expect(isStatusActive({ kind: 'meeting', untilUtc: new Date(2026, 10, 17, 10, 0).toISOString() }, now)).toBe(false);
    expect(isStatusActive({ kind: 'meeting', untilUtc: new Date(2026, 10, 17, 11, 0).toISOString() }, now)).toBe(true);
    expect(isStatusActive({ kind: 'meeting' }, now)).toBe(true);
    expect(isStatusActive(null, now)).toBe(false);
  });

  it('срок из выбора в профиле: конец дня включительно', () => {
    expect(resolveStatusUntil('none', '', now)).toBeNull();
    expect(resolveStatusUntil('hour', '', now)).toBe(new Date(2026, 10, 17, 11, 30).toISOString());
    expect(resolveStatusUntil('today', '', now)).toBe(new Date(2026, 10, 17, 23, 59).toISOString());
    expect(resolveStatusUntil('tomorrow', '', now)).toBe(new Date(2026, 10, 18, 23, 59).toISOString());
    expect(resolveStatusUntil('date', '2026-11-25', now)).toBe(new Date(2026, 10, 25, 23, 59).toISOString());
    expect(resolveStatusUntil('date', '', now)).toBeNull();
  });
});

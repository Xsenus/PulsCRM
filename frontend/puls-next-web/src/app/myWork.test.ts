import { describe, expect, it } from 'vitest';
import { describeDue, describeWorkTitle } from './myWork';

const now = new Date(2026, 10, 17, 15, 0);

describe('сроки поручений', () => {
  it('подписывает срок относительно сегодняшней даты', () => {
    expect(describeDue(null, now)).toEqual({ tone: 'none', label: 'Без срока' });
    expect(describeDue('2026-11-15T00:00:00Z', now)).toEqual({ tone: 'overdue', label: 'Просрочено на 2 дня' });
    expect(describeDue('2026-11-16T00:00:00Z', now)).toEqual({ tone: 'overdue', label: 'Просрочено на 1 день' });
    expect(describeDue('2026-11-12T00:00:00Z', now).label).toBe('Просрочено на 5 дней');
    expect(describeDue('2026-11-17T00:00:00Z', now)).toEqual({ tone: 'today', label: 'Сегодня' });
    expect(describeDue('2026-11-18T00:00:00Z', now)).toEqual({ tone: 'soon', label: 'Завтра' });
    expect(describeDue('2026-11-20T00:00:00Z', now)).toEqual({ tone: 'soon', label: 'до 20 ноя' });
    expect(describeDue('2026-11-25T00:00:00Z', now)).toEqual({ tone: 'later', label: 'до 25 ноя' });
    expect(describeDue('2027-01-10T00:00:00Z', now).label).toBe('до 10 янв 2027');
  });

  it('берет заголовок из текста, задачи или категории', () => {
    expect(describeWorkTitle({ id: 1, message: ' Позвонить ', task: 'Звонок', isCompleted: false })).toBe('Позвонить');
    expect(describeWorkTitle({ id: 2, task: 'Звонок', category: 'Продажи', isCompleted: false })).toBe('Звонок');
    expect(describeWorkTitle({ id: 3, isCompleted: false })).toBe('Задача №3');
  });
});

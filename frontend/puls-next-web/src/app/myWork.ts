import { api } from './api';
import { throwApiError } from './apiErrors';
import type { WorkItemDto } from './types';

/** «Мои задачи»: открытые поручения сотруднику и от него (из Пульса, только чтение). */
export interface MyWorkDto {
  assigned: WorkItemDto[];
  assignedTotal: number;
  overdue: number;
  delegated: WorkItemDto[];
  delegatedTotal: number;
}

export async function getMyWork(take = 5): Promise<MyWorkDto> {
  try {
    const { data } = await api.get<MyWorkDto>('/api/my-work', { params: { take } });
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none';

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  return mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? few : many;
}

/**
 * Срок поручения для плашки: «Просрочено на 2 дня», «Сегодня», «Завтра», «до 25 ноя».
 * Сроки в Пульсе — дата без часового пояса (сервер отдает ее как есть), поэтому сравниваются только даты.
 */
export function describeDue(dateTo: string | undefined | null, now = new Date()): { tone: DueTone; label: string } {
  if (!dateTo) {
    return { tone: 'none', label: 'Без срока' };
  }

  const [year, month, day] = dateTo.slice(0, 10).split('-').map(Number);
  const due = new Date(year, month - 1, day).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const days = Math.round((due - today) / 86_400_000);
  if (days < 0) {
    const late = -days;
    return { tone: 'overdue', label: `Просрочено на ${late} ${plural(late, 'день', 'дня', 'дней')}` };
  }

  if (days === 0) {
    return { tone: 'today', label: 'Сегодня' };
  }

  if (days === 1) {
    return { tone: 'soon', label: 'Завтра' };
  }

  const label = `до ${day} ${MONTHS_SHORT[month - 1]}${year !== now.getFullYear() ? ` ${year}` : ''}`;
  return { tone: days <= 3 ? 'soon' : 'later', label };
}

/** Заголовок поручения: текст, иначе задача или категория. */
export function describeWorkTitle(item: WorkItemDto) {
  return item.message?.trim() || item.task || item.category || `Задача №${item.id}`;
}

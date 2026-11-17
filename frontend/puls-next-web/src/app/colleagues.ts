import { api } from './api';
import { throwApiError } from './apiErrors';
import type { UserStatusDto } from './profile';

/** Коллега из общего справочника (/api/colleagues): только рабочие контакты. */
export interface ColleagueDto {
  id: number;
  fullName: string;
  position?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  /** Внутренний (добавочный) номер. */
  internalPhone?: string | null;
  birthdayMonth?: number | null;
  birthdayDay?: number | null;
  hasPhoto: boolean;
  isMale: boolean;
  /** Статус из «Моего профиля» («В отпуске до …»); null — нет. */
  status?: UserStatusDto | null;
}

export async function getColleagues(): Promise<ColleagueDto[]> {
  try {
    const { data } = await api.get<ColleagueDto[]>('/api/colleagues');
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export async function getColleague(id: number): Promise<ColleagueDto> {
  try {
    const { data } = await api.get<ColleagueDto>(`/api/colleagues/${id}`);
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

let colleaguesCache: { at: number; promise: Promise<ColleagueDto[]> } | null = null;

/** Справочник коллег с кэшем на maxAgeMs (для статусов в чате: не запрашивать на каждый диалог). */
export function getColleaguesCached(maxAgeMs = 60_000): Promise<ColleagueDto[]> {
  if (!colleaguesCache || Date.now() - colleaguesCache.at > maxAgeMs) {
    const promise = getColleagues().catch((error) => {
      colleaguesCache = null;
      throw error;
    });
    colleaguesCache = { at: Date.now(), promise };
  }

  return colleaguesCache.promise;
}

/** Сбросить кэш справочника (например, после смены своего статуса). */
export function forgetColleaguesCache() {
  colleaguesCache = null;
}

const photoCache = new Map<number, Promise<string | null>>();

/** Забыть фото коллеги (после смены своего фото в профиле). */
export function forgetColleaguePhoto(id: number) {
  const cached = photoCache.get(id);
  photoCache.delete(id);
  void cached?.then((url) => url && URL.revokeObjectURL(url));
}

/** Фото коллеги как object URL (запрос с токеном), один раз на вкладку; null — фото нет. */
export function loadColleaguePhoto(id: number): Promise<string | null> {
  let cached = photoCache.get(id);
  if (!cached) {
    cached = api.get<Blob>(`/api/colleagues/${id}/photo`, { responseType: 'blob' })
      .then(({ data }) => URL.createObjectURL(data))
      .catch(() => null);
    photoCache.set(id, cached);
  }

  return cached;
}

const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function formatBirthday(month: number, day: number) {
  return `${day} ${MONTHS_GENITIVE[month - 1] ?? ''}`.trim();
}

export interface UpcomingBirthday {
  colleague: ColleagueDto;
  /** Через сколько дней: 0 — сегодня. */
  inDays: number;
}

/** Дни рождения в ближайшие days дней (включая сегодня), по порядку. 29 февраля в невисокосный год — 28-го. */
export function getUpcomingBirthdays(colleagues: ColleagueDto[], today: Date, days = 14): UpcomingBirthday[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const result: UpcomingBirthday[] = [];
  for (const colleague of colleagues) {
    const { birthdayMonth: month, birthdayDay: day } = colleague;
    if (!month || !day) {
      continue;
    }

    let next = birthdayInYear(start.getFullYear(), month, day);
    if (next < start) {
      next = birthdayInYear(start.getFullYear() + 1, month, day);
    }

    const inDays = Math.round((next.getTime() - start.getTime()) / 86_400_000);
    if (inDays < days) {
      result.push({ colleague, inDays });
    }
  }

  return result.sort((a, b) => a.inDays - b.inDays || a.colleague.fullName.localeCompare(b.colleague.fullName, 'ru'));
}

function birthdayInYear(year: number, month: number, day: number) {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return month === 2 && day === 29 && !isLeap ? new Date(year, 1, 28) : new Date(year, month - 1, day);
}

export function describeBirthdayDistance(inDays: number) {
  if (inDays === 0) {
    return 'Сегодня';
  }

  if (inDays === 1) {
    return 'Завтра';
  }

  return `Через ${inDays} ${pluralDays(inDays)}`;
}

function pluralDays(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return 'день';
  }

  return mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? 'дня' : 'дней';
}

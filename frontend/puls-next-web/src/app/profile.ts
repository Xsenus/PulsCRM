import { api } from './api';
import { throwApiError } from './apiErrors';

/** Статус сотрудника: вид, пояснение и срок (UTC; null — пока не снимет сам). */
export interface UserStatusDto {
  kind: string;
  text?: string | null;
  untilUtc?: string | null;
}

export interface MyProfileDto {
  id: number;
  login: string;
  fullName: string;
  position?: string | null;
  department?: string | null;
  email?: string | null;
  phone?: string | null;
  internalPhone?: string | null;
  hasPhoto: boolean;
  status?: UserStatusDto | null;
}

export interface StatusOption {
  kind: string;
  label: string;
  emoji: string;
}

/** Виды статусов (как на сервере); custom — свой текст. */
export const STATUS_OPTIONS: StatusOption[] = [
  { kind: 'meeting', label: 'На совещании', emoji: '📅' },
  { kind: 'away', label: 'Нет на месте', emoji: '🚶' },
  { kind: 'remote', label: 'Работаю удаленно', emoji: '🏠' },
  { kind: 'business-trip', label: 'В командировке', emoji: '✈️' },
  { kind: 'vacation', label: 'В отпуске', emoji: '🌴' },
  { kind: 'sick', label: 'На больничном', emoji: '🤒' },
  { kind: 'custom', label: 'Свой статус', emoji: '💬' }
];

export const STATUS_TEXT_MAX_LENGTH = 200;

export function getStatusOption(kind: string) {
  return STATUS_OPTIONS.find((item) => item.kind === kind);
}

const MONTHS_GENITIVE = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

/** «до 15:00», «до завтра, 18:00», «до 25 ноября» — срок статуса относительно now. */
export function formatStatusUntil(untilUtc: string, now = new Date()) {
  const until = new Date(untilUtc);
  const time = until.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  const dayStart = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((dayStart(until) - dayStart(now)) / 86_400_000);
  // Конец дня (23:59) — показываем только дату.
  const endOfDay = until.getHours() === 23 && until.getMinutes() === 59;
  if (days === 0) {
    return endOfDay ? 'до конца дня' : `до ${time}`;
  }

  if (days === 1 && !endOfDay) {
    return `до завтра, ${time}`;
  }

  const date = `${until.getDate()} ${MONTHS_GENITIVE[until.getMonth()]}${until.getFullYear() !== now.getFullYear() ? ` ${until.getFullYear()}` : ''}`;
  return endOfDay ? `до ${date} включительно` : `до ${date}, ${time}`;
}

/** Текст статуса для карточек и чата: «🌴 В отпуске до 25 ноября включительно». */
export function formatStatus(status: UserStatusDto, now = new Date()) {
  const option = getStatusOption(status.kind);
  const title = status.kind === 'custom' ? (status.text ?? '') : (option?.label ?? status.kind);
  const until = status.untilUtc ? ` ${formatStatusUntil(status.untilUtc, now)}` : '';
  return `${option?.emoji ?? '💬'} ${title}${until}`.trim();
}

/** Пояснение к статусу (для custom текст уже в заголовке). */
export function getStatusNote(status: UserStatusDto) {
  return status.kind === 'custom' ? null : (status.text?.trim() || null);
}

/** Действует ли статус сейчас (сервер отдает только действующие, но страница может быть открыта долго). */
export function isStatusActive(status: UserStatusDto | null | undefined, now = new Date()): status is UserStatusDto {
  return !!status && (!status.untilUtc || new Date(status.untilUtc).getTime() > now.getTime());
}

export async function getMyProfile(): Promise<MyProfileDto> {
  try {
    const { data } = await api.get<MyProfileDto>('/api/profile');
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export async function updateMyContacts(phone: string, internalPhone: string): Promise<MyProfileDto> {
  try {
    const { data } = await api.put<MyProfileDto>('/api/profile/contacts', { phone, internalPhone });
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export async function updateMyPhoto(imageBase64: string): Promise<MyProfileDto> {
  try {
    const { data } = await api.put<MyProfileDto>('/api/profile/photo', { imageBase64 });
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export async function deleteMyPhoto(): Promise<MyProfileDto> {
  try {
    const { data } = await api.delete<MyProfileDto>('/api/profile/photo');
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  try {
    await api.post('/api/profile/password', { currentPassword, newPassword });
  } catch (error) {
    throwApiError(error);
  }
}

export async function setMyStatus(kind: string, text: string, untilUtc: string | null): Promise<UserStatusDto> {
  try {
    const { data } = await api.put<UserStatusDto>('/api/profile/status', { kind, text, untilUtc });
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export async function clearMyStatus(): Promise<void> {
  try {
    await api.delete('/api/profile/status');
  } catch (error) {
    throwApiError(error);
  }
}

/** Самая длинная сторона фото профиля: хватает для карточек и аватаров на экранах с двойной плотностью. */
export const PROFILE_PHOTO_SIDE = 512;

/**
 * Готовит фото профиля: квадрат по центру, не больше PROFILE_PHOTO_SIDE, JPEG. Возвращает base64 без префикса.
 * Большие снимки с телефона так весят десятки килобайт, а не мегабайты.
 */
export async function prepareProfilePhoto(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Выберите изображение (JPEG, PNG, WebP).');
  }

  const url = URL.createObjectURL(file);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Не удалось открыть изображение.'));
      element.src = url;
    });
    const side = Math.min(image.naturalWidth, image.naturalHeight);
    const target = Math.min(PROFILE_PHOTO_SIDE, side);
    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Браузер не смог подготовить фото.');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, target, target);
    context.drawImage(image, (image.naturalWidth - side) / 2, (image.naturalHeight - side) / 2, side, side, 0, 0, target, target);
    return canvas.toDataURL('image/jpeg', 0.9).split(',')[1] ?? '';
  } finally {
    URL.revokeObjectURL(url);
  }
}

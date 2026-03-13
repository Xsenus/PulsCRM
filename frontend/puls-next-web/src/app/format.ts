import dayjs from 'dayjs';

export function formatDateTime(value?: string | null) {
  return value ? dayjs(value).format('DD.MM.YYYY HH:mm') : '';
}

export function formatDate(value?: string | null) {
  return value ? dayjs(value).format('DD.MM.YYYY') : '';
}

export function formatFileSize(bytes?: number | null) {
  if (!bytes) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let index = 0;
  while (size >= 1024 && index < units.length - 1) {
    size /= 1024;
    index += 1;
  }

  return `${size.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

export function toDateTimeLocalValue(value?: string | null) {
  return value ? dayjs(value).format('YYYY-MM-DDTHH:mm') : '';
}

export function fromDateTimeLocalValue(value?: string | null) {
  return value ? dayjs(value).toISOString() : undefined;
}

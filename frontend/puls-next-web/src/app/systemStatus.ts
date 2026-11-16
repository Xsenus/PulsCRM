import { api } from './api';
import { throwApiError } from './apiErrors';

export type CheckStatus = 'ok' | 'warn' | 'error';

export interface SystemCheckDto {
  name: string;
  status: CheckStatus;
  detail: string;
  durationMs: number;
}

export interface StorageUsageDto {
  name: string;
  path: string;
  bytes: number;
  files: number;
}

export interface LogEntryDto {
  timestampUtc: string;
  level: string;
  category: string;
  message: string;
  exception?: string | null;
}

export interface SystemStatusDto {
  version: string;
  startedAtUtc: string;
  checkedAtUtc: string;
  machineName: string;
  overall: CheckStatus;
  checks: SystemCheckDto[];
  storage: StorageUsageDto[];
  diskFreeBytes?: number | null;
  diskTotalBytes?: number | null;
  queueDepth: number;
  failedLast24Hours: number;
  sentLast24Hours: number;
  pushSubscriptions?: number | null;
  logDirectory: string;
  logFiles: string[];
  recentProblems: LogEntryDto[];
}

export async function getSystemStatus(): Promise<SystemStatusDto> {
  try {
    const { data } = await api.get<SystemStatusDto>('/api/diagnostics/status');
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

/** Скачивает файл журнала (запрос с токеном, затем сохранение файла). */
export async function downloadLogFile(fileName: string) {
  try {
    const { data } = await api.get<Blob>(`/api/diagnostics/logs/${encodeURIComponent(fileName)}`, { responseType: 'blob' });
    const url = URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    throwApiError(error);
  }
}

export function formatBytes(bytes: number) {
  const units = ['Б', 'КБ', 'МБ', 'ГБ', 'ТБ'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }

  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1).replace('.', ',')} ${units[unit]}`;
}

export function formatUptime(startedAtUtc: string, now = new Date()) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(startedAtUtc).getTime()) / 60_000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days > 0) {
    return `${days} д ${hours} ч`;
  }

  return hours > 0 ? `${hours} ч ${minutes % 60} мин` : `${minutes} мин`;
}

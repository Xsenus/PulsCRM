import type { DispatchBatchListQuery, DispatchItemDto, DispatchItemListQuery } from './types';

export type DispatchStatusTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export const dispatchStatusOptions: Array<{ value: number; label: string; tone: DispatchStatusTone }> = [
  { value: 0, label: 'В очереди', tone: 'info' },
  { value: 1, label: 'В работе', tone: 'warning' },
  { value: 2, label: 'Отправлено', tone: 'success' },
  { value: 3, label: 'Ошибка', tone: 'danger' },
  { value: 4, label: 'Отменено', tone: 'neutral' },
  { value: 5, label: 'Отложено', tone: 'warning' }
];

export function getDispatchStatusLabel(status: number) {
  return dispatchStatusOptions.find((option) => option.value === status)?.label ?? `Статус ${status}`;
}

export function getDispatchStatusTone(status: number): DispatchStatusTone {
  return dispatchStatusOptions.find((option) => option.value === status)?.tone ?? 'neutral';
}

export function canRetryDispatchItem(item: Pick<DispatchItemDto, 'status'>) {
  return item.status === 3 || item.status === 5;
}

export function canCancelDispatchItem(item: Pick<DispatchItemDto, 'status'>) {
  return item.status !== 2 && item.status !== 4;
}

export function buildDispatchItemQuery(filters: {
  status?: number;
  campaignId?: number;
  batchId?: number;
  search?: string;
}, skip: number, take: number): DispatchItemListQuery {
  return {
    status: filters.status,
    campaignId: filters.campaignId,
    batchId: filters.batchId,
    search: filters.search?.trim() || undefined,
    skip: Math.max(0, skip),
    take
  };
}

export function buildDispatchBatchQuery(filters: {
  campaignId?: number;
}, skip: number, take: number): DispatchBatchListQuery {
  return {
    campaignId: filters.campaignId,
    skip: Math.max(0, skip),
    take
  };
}

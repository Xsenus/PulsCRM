import type { CampaignReadinessDto, CampaignReadinessItemDto } from './types';

export function campaignReadinessTone(status: CampaignReadinessItemDto['status']) {
  if (status === 'ok') {
    return 'success';
  }

  if (status === 'warning') {
    return 'warning';
  }

  if (status === 'error') {
    return 'danger';
  }

  return 'neutral';
}

export function campaignReadinessSummary(readiness: CampaignReadinessDto | null) {
  if (!readiness) {
    return 'Проверка готовности еще не выполнялась.';
  }

  if (readiness.isReady) {
    return `Кампания готова к запуску. Получателей: ${readiness.recipientCount}.`;
  }

  const blockingCount = readiness.items.filter((item) => item.isBlocking).length;
  return `Кампания не готова. Блокирующих пунктов: ${blockingCount}.`;
}

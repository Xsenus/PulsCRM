import { describe, expect, it } from 'vitest';
import { campaignReadinessSummary, campaignReadinessTone } from './campaignReadiness';
import type { CampaignReadinessDto } from './types';

describe('campaign readiness helpers', () => {
  it('maps readiness item statuses to badge tones', () => {
    expect(campaignReadinessTone('ok')).toBe('success');
    expect(campaignReadinessTone('warning')).toBe('warning');
    expect(campaignReadinessTone('error')).toBe('danger');
    expect(campaignReadinessTone('unknown')).toBe('neutral');
  });

  it('formats empty, ready and blocked summaries', () => {
    expect(campaignReadinessSummary(null)).toBe('Проверка готовности еще не выполнялась.');

    const ready: CampaignReadinessDto = {
      isReady: true,
      organizationCount: 2,
      recipientCount: 5,
      items: []
    };
    expect(campaignReadinessSummary(ready)).toBe('Кампания готова к запуску. Получателей: 5.');

    const blocked: CampaignReadinessDto = {
      isReady: false,
      organizationCount: 0,
      recipientCount: 0,
      items: [
        { key: 'subject', label: 'Тема', status: 'error', message: 'Нет темы', isBlocking: true },
        { key: 'transport', label: 'SMTP', status: 'warning', message: 'Профиль по умолчанию', isBlocking: false }
      ]
    };
    expect(campaignReadinessSummary(blocked)).toBe('Кампания не готова. Блокирующих пунктов: 1.');
  });
});

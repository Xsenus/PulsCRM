import { describe, expect, it } from 'vitest';
import { canApplyDefaultCampaignMessageTemplate, createDefaultCampaignMessageTemplate } from './campaignMessageTemplate';

describe('campaign message template', () => {
  it('creates matching html and plain text starter content', () => {
    const template = createDefaultCampaignMessageTemplate();

    expect(template.htmlBody).toContain('<p>Здравствуйте!</p>');
    expect(template.htmlBody).toContain('Подготовили для вас важную информацию.');
    expect(template.plainTextBody).toContain('Здравствуйте!');
    expect(template.plainTextBody).toContain('Подготовили для вас важную информацию.');
    expect(template.plainTextBody).not.toContain('<p>');
  });

  it('can be applied only to an empty message', () => {
    expect(canApplyDefaultCampaignMessageTemplate('', '')).toBe(true);
    expect(canApplyDefaultCampaignMessageTemplate('   ', '\n')).toBe(true);
    expect(canApplyDefaultCampaignMessageTemplate('<p>Есть текст</p>', '')).toBe(false);
    expect(canApplyDefaultCampaignMessageTemplate('', 'Есть текст')).toBe(false);
  });
});

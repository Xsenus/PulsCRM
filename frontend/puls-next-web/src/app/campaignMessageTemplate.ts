export interface CampaignMessageTemplate {
  htmlBody: string;
  plainTextBody: string;
}

export function createDefaultCampaignMessageTemplate(): CampaignMessageTemplate {
  return {
    htmlBody: [
      '<p>Здравствуйте!</p>',
      '',
      '<p>Подготовили для вас важную информацию.</p>',
      '',
      '<p>',
      '  С уважением,<br>',
      '  команда компании',
      '</p>'
    ].join('\n'),
    plainTextBody: [
      'Здравствуйте!',
      '',
      'Подготовили для вас важную информацию.',
      '',
      'С уважением,',
      'команда компании'
    ].join('\n')
  };
}

export function canApplyDefaultCampaignMessageTemplate(htmlBody?: string | null, plainTextBody?: string | null): boolean {
  return !(htmlBody || '').trim() && !(plainTextBody || '').trim();
}

import { describe, expect, it } from 'vitest';
import { buildOrganizationSelectionSummary, buildRecipientSourceSummary, getOrganizationKnownEmailCount } from './campaignRecipients';
import type { CampaignRecipientPreviewItemDto, OrganizationListItemDto } from './types';

function organization(overrides: Partial<OrganizationListItemDto>): OrganizationListItemDto {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'Организация',
    visible: true,
    isManager: false,
    emails: overrides.emails ?? [],
    emailCount: overrides.emailCount ?? 0,
    contactCount: overrides.contactCount ?? 0,
    openWorkItems: 0,
    ...overrides
  };
}

function recipient(overrides: Partial<CampaignRecipientPreviewItemDto>): CampaignRecipientPreviewItemDto {
  return {
    legacyOrgId: overrides.legacyOrgId ?? 0,
    legacyOrgName: overrides.legacyOrgName,
    email: overrides.email ?? 'recipient@example.test',
    displayName: overrides.displayName,
    sourceKind: overrides.sourceKind ?? 0
  };
}

describe('buildOrganizationSelectionSummary', () => {
  it('counts selected organizations, known emails and contacts', () => {
    const summary = buildOrganizationSelectionSummary([
      organization({ id: 1, emailCount: 2, contactCount: 3 }),
      organization({ id: 2, emails: ['director@example.test'], contactCount: 1 }),
      organization({ id: 3, emailCount: 0, contactCount: 0 })
    ]);

    expect(summary).toEqual({
      organizationCount: 3,
      knownEmailCount: 3,
      organizationsWithEmail: 2,
      organizationsWithoutEmail: 1,
      contactCount: 4
    });
  });

  it('returns zero summary for an empty selection', () => {
    expect(buildOrganizationSelectionSummary([])).toEqual({
      organizationCount: 0,
      knownEmailCount: 0,
      organizationsWithEmail: 0,
      organizationsWithoutEmail: 0,
      contactCount: 0
    });
  });
});

describe('getOrganizationKnownEmailCount', () => {
  it('uses explicit email count before email chips', () => {
    expect(getOrganizationKnownEmailCount(organization({ emailCount: 2, emails: ['fallback@example.test'] }))).toBe(2);
    expect(getOrganizationKnownEmailCount(organization({ emailCount: 0, emails: ['fallback@example.test'] }))).toBe(1);
    expect(getOrganizationKnownEmailCount(organization({ emailCount: -1, emails: [] }))).toBe(0);
  });
});

describe('buildRecipientSourceSummary', () => {
  const sourceOptions = [
    { value: 0, label: 'Вручную' },
    { value: 1, label: 'Основной адрес организации' },
    { value: 2, label: 'Контактное лицо' }
  ];

  it('groups preview recipients by source and keeps lookup order', () => {
    const summary = buildRecipientSourceSummary(
      [
        recipient({ email: 'contact-1@example.test', sourceKind: 2 }),
        recipient({ email: 'manual@example.test', sourceKind: 0 }),
        recipient({ email: 'contact-2@example.test', sourceKind: 2 }),
        recipient({ email: 'primary@example.test', sourceKind: 1 })
      ],
      sourceOptions
    );

    expect(summary).toEqual([
      { sourceKind: 0, label: 'Вручную', count: 1 },
      { sourceKind: 1, label: 'Основной адрес организации', count: 1 },
      { sourceKind: 2, label: 'Контактное лицо', count: 2 }
    ]);
  });

  it('renders unknown recipient sources after known options', () => {
    expect(buildRecipientSourceSummary([recipient({ sourceKind: 9 })], sourceOptions)).toEqual([
      { sourceKind: 9, label: 'Источник 9', count: 1 }
    ]);
  });
});

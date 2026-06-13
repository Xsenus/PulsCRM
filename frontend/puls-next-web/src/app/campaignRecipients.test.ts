import { describe, expect, it } from 'vitest';
import { buildOrganizationSelectionSummary } from './campaignRecipients';
import type { OrganizationListItemDto } from './types';

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

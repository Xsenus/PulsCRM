import type { OrganizationListItemDto } from './types';

export interface OrganizationSelectionSummary {
  organizationCount: number;
  knownEmailCount: number;
  organizationsWithEmail: number;
  organizationsWithoutEmail: number;
  contactCount: number;
}

export function buildOrganizationSelectionSummary(items: OrganizationListItemDto[]): OrganizationSelectionSummary {
  return items.reduce<OrganizationSelectionSummary>(
    (summary, item) => {
      const explicitEmailCount = Math.max(item.emailCount ?? 0, 0);
      const emailCount = explicitEmailCount > 0 ? explicitEmailCount : Math.max(item.emails?.length ?? 0, 0);

      summary.organizationCount += 1;
      summary.knownEmailCount += emailCount;
      summary.contactCount += Math.max(item.contactCount ?? 0, 0);

      if (emailCount > 0) {
        summary.organizationsWithEmail += 1;
      } else {
        summary.organizationsWithoutEmail += 1;
      }

      return summary;
    },
    {
      organizationCount: 0,
      knownEmailCount: 0,
      organizationsWithEmail: 0,
      organizationsWithoutEmail: 0,
      contactCount: 0
    }
  );
}

import type { CampaignRecipientPreviewItemDto, OrganizationListItemDto } from './types';

export interface OrganizationSelectionSummary {
  organizationCount: number;
  knownEmailCount: number;
  organizationsWithEmail: number;
  organizationsWithoutEmail: number;
  contactCount: number;
}

export interface RecipientSourceSummaryItem {
  sourceKind: number;
  label: string;
  count: number;
}

export function getOrganizationKnownEmailCount(item: OrganizationListItemDto): number {
  const explicitEmailCount = Math.max(item.emailCount ?? 0, 0);
  return explicitEmailCount > 0 ? explicitEmailCount : Math.max(item.emails?.length ?? 0, 0);
}

export function buildOrganizationSelectionSummary(items: OrganizationListItemDto[]): OrganizationSelectionSummary {
  return items.reduce<OrganizationSelectionSummary>(
    (summary, item) => {
      const emailCount = getOrganizationKnownEmailCount(item);

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

export function buildRecipientSourceSummary(
  items: CampaignRecipientPreviewItemDto[],
  sourceOptions: Array<{ value: number; label: string }>
): RecipientSourceSummaryItem[] {
  const sourceOrder = new Map(sourceOptions.map((option, index) => [option.value, index]));
  const sourceLabels = new Map(sourceOptions.map((option) => [option.value, option.label]));
  const counts = items.reduce<Map<number, number>>((summary, item) => {
    summary.set(item.sourceKind, (summary.get(item.sourceKind) ?? 0) + 1);
    return summary;
  }, new Map<number, number>());

  return Array.from(counts.entries())
    .map(([sourceKind, count]) => ({
      sourceKind,
      count,
      label: sourceLabels.get(sourceKind) ?? `Источник ${sourceKind}`
    }))
    .sort((left, right) => {
      const leftOrder = sourceOrder.get(left.sourceKind) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = sourceOrder.get(right.sourceKind) ?? Number.MAX_SAFE_INTEGER;

      if (leftOrder !== rightOrder) {
        return leftOrder - rightOrder;
      }

      return left.label.localeCompare(right.label, 'ru');
    });
}

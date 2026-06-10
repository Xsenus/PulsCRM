import type { CampaignUpsertRequest } from './types';

export function createCampaignDraftSnapshot(request: CampaignUpsertRequest): string {
  return JSON.stringify({
    ...request,
    targetOrganizationIds: Array.from(new Set(request.targetOrganizationIds.filter((id) => id > 0))).sort((left, right) => left - right),
    attachments: request.attachments.map((item, index) => ({
      storedFileId: item.storedFileId,
      attachmentKind: item.attachmentKind,
      displayName: item.displayName || '',
      contentId: item.contentId || '',
      sortOrder: index
    }))
  });
}

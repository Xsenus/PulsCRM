import { describe, expect, it } from 'vitest';
import { createCampaignDraftSnapshot } from './campaignDraft';
import type { CampaignUpsertRequest } from './types';

function createRequest(patch: Partial<CampaignUpsertRequest> = {}): CampaignUpsertRequest {
  return {
    name: 'Test',
    subject: 'Subject',
    htmlBody: '<p>Hello</p>',
    plainTextBody: 'Hello',
    status: 0,
    transportProfileId: 1,
    scheduleKind: 0,
    cronExpression: '',
    timeZoneId: 'Asia/Novosibirsk',
    startAtUtc: '2026-06-10T00:00:00.000Z',
    endAtUtc: undefined,
    intervalMinutes: 10,
    randomIntervalMinMinutes: 1,
    randomIntervalMaxMinutes: 5,
    maxRecipientsPerRun: 0,
    maxAttempts: 3,
    useOrgPrimaryEmail: true,
    useContactEmails: false,
    useSalaryEmail: false,
    useOneCEmail: false,
    useSiteEmail: false,
    useDirectorEmail: false,
    manualRecipientsCsv: '',
    targetOrganizationIds: [3, 1, 3],
    attachments: [],
    ...patch
  };
}

describe('campaign draft snapshot', () => {
  it('ignores duplicate and reordered organizations', () => {
    const first = createCampaignDraftSnapshot(createRequest({ targetOrganizationIds: [3, 1, 3] }));
    const second = createCampaignDraftSnapshot(createRequest({ targetOrganizationIds: [1, 3] }));

    expect(first).toBe(second);
  });

  it('keeps attachment order significant', () => {
    const first = createCampaignDraftSnapshot(createRequest({
      attachments: [
        { storedFileId: 10, attachmentKind: 0, displayName: 'a.pdf', sortOrder: 0 },
        { storedFileId: 11, attachmentKind: 0, displayName: 'b.pdf', sortOrder: 1 }
      ]
    }));
    const second = createCampaignDraftSnapshot(createRequest({
      attachments: [
        { storedFileId: 11, attachmentKind: 0, displayName: 'b.pdf', sortOrder: 0 },
        { storedFileId: 10, attachmentKind: 0, displayName: 'a.pdf', sortOrder: 1 }
      ]
    }));

    expect(first).not.toBe(second);
  });
});

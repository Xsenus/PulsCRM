import React, { useEffect, useMemo, useState } from 'react';
import type {
  OrganizationDetailsDto,
  OrganizationEditorLookupsDto,
  OrganizationLookupItemDto,
  OrganizationUpsertRequest
} from '../app/types';
import type { OrganizationHistoryTab } from './organization/OrganizationHistoryTabs';
import type { OrganizationRelationTab } from './organization/OrganizationRelationsOverview';
import type { OrganizationRelationsTableSettings } from './organization/OrganizationRelationsWorkspace';
import { OrganizationRecordMain } from './organization/OrganizationRecordMain';
import { OrganizationSidebar } from './organization/OrganizationSidebar';
import { OrganizationStatusBar } from './organization/OrganizationStatusBar';
import { OrganizationViewTabs, type OrganizationViewTab } from './organization/OrganizationViewTabs';

interface OrganizationRecordWorkspaceProps {
  details: OrganizationDetailsDto | null;
  draft: OrganizationUpsertRequest;
  lookups: OrganizationEditorLookupsDto | null;
  disabled: boolean;
  isDirty: boolean;
  raionName?: string;
  orgTypeName?: string;
  onDraftChange: (next: OrganizationUpsertRequest) => void;
  tableSettings: {
    events: string;
  } & OrganizationRelationsTableSettings;
}

function getLookupName(items: OrganizationLookupItemDto[] | undefined, id?: number) {
  return id ? items?.find((item) => item.id === id)?.name : undefined;
}

function uniqueDefined(values: Array<string | undefined>) {
  return Array.from(new Set(values
    .map((value) => value?.trim())
    .filter((value): value is string => !!value)));
}

export function OrganizationRecordWorkspace({
  details,
  draft,
  lookups,
  disabled,
  isDirty,
  raionName,
  orgTypeName,
  onDraftChange,
  tableSettings
}: OrganizationRecordWorkspaceProps) {
  const [viewTab, setViewTab] = useState<OrganizationViewTab>('profile');
  const [relationTab, setRelationTab] = useState<OrganizationRelationTab>('contacts');
  const [historyTab, setHistoryTab] = useState<OrganizationHistoryTab>('events');

  useEffect(() => {
    setViewTab('profile');
    setRelationTab('contacts');
    setHistoryTab('events');
  }, [details?.id]);

  const resolvedRaionName = details?.raion ?? raionName ?? getLookupName(lookups?.raions, draft.raionId);
  const resolvedOrgTypeName = details?.orgType ?? orgTypeName ?? getLookupName(lookups?.orgTypes, draft.orgTypeId);
  const emailChips = useMemo(
    () => uniqueDefined([
      ...(details?.emails ?? []),
      draft.primaryEmail,
      draft.directorEmail,
      draft.salaryEmail,
      draft.oneCEmail,
      draft.siteEmail
    ]),
    [details?.emails, draft.directorEmail, draft.oneCEmail, draft.primaryEmail, draft.salaryEmail, draft.siteEmail]
  );
  const openRelations = (tab: OrganizationRelationTab) => {
    setViewTab('relations');
    setRelationTab(tab);
  };

  const openHistory = (tab: OrganizationHistoryTab) => {
    setViewTab('history');
    setHistoryTab(tab);
  };

  return (
    <div className="organization-record-shell">
      <OrganizationStatusBar
        visible={draft.visible}
        isManager={draft.isManager}
        isDirty={isDirty}
        raionName={resolvedRaionName}
        orgTypeName={resolvedOrgTypeName}
        statusName={details?.statusName}
        flagName={details?.flagName}
      />

      <div className="organization-record-layout">
        <div className="organization-record-content">
          <OrganizationViewTabs activeTab={viewTab} onChange={setViewTab} />

          <OrganizationRecordMain
            activeTab={viewTab}
            details={details}
            draft={draft}
            lookups={lookups}
            disabled={disabled}
            relationTab={relationTab}
            historyTab={historyTab}
            emailCount={emailChips.length}
            tableSettings={tableSettings}
            onDraftChange={onDraftChange}
            onRelationTabChange={setRelationTab}
            onHistoryTabChange={setHistoryTab}
          />
        </div>

        <OrganizationSidebar
          details={details}
          draft={draft}
          emailChips={emailChips}
          onOpenRelations={openRelations}
          onOpenHistory={openHistory}
        />
      </div>
    </div>
  );
}

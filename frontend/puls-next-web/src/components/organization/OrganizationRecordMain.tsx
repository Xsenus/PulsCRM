import React from 'react';
import type {
  OrganizationDetailsDto,
  OrganizationEditorLookupsDto,
  OrganizationUpsertRequest
} from '../../app/types';
import { OrganizationHistoryWorkspace } from './OrganizationHistoryWorkspace';
import { OrganizationHistoryTabs, type OrganizationHistoryTab } from './OrganizationHistoryTabs';
import { OrganizationProfileSection } from './OrganizationProfileSection';
import type { OrganizationRelationTab } from './OrganizationRelationsOverview';
import { OrganizationRelationsSection } from './OrganizationRelationsSection';
import type { OrganizationRelationsTableSettings } from './OrganizationRelationsWorkspace';
import { OrganizationSupportSection } from './OrganizationSupportSection';
import type { OrganizationViewTab } from './OrganizationViewTabs';

interface OrganizationRecordMainProps {
  activeTab: OrganizationViewTab;
  details: OrganizationDetailsDto | null;
  draft: OrganizationUpsertRequest;
  lookups: OrganizationEditorLookupsDto | null;
  disabled: boolean;
  relationTab: OrganizationRelationTab;
  historyTab: OrganizationHistoryTab;
  emailCount: number;
  tableSettings: {
    events: string;
  } & OrganizationRelationsTableSettings;
  onDraftChange: (next: OrganizationUpsertRequest) => void;
  onRelationTabChange: (next: OrganizationRelationTab) => void;
  onHistoryTabChange: (next: OrganizationHistoryTab) => void;
}

function renderPanel(children: React.ReactNode) {
  return (
    <section className="panel organization-card-panel">
      {children}
    </section>
  );
}

export function OrganizationRecordMain({
  activeTab,
  details,
  draft,
  lookups,
  disabled,
  relationTab,
  historyTab,
  emailCount,
  tableSettings,
  onDraftChange,
  onRelationTabChange,
  onHistoryTabChange
}: OrganizationRecordMainProps) {
  return (
    <div className="organization-record-main">
      {activeTab === 'profile'
        ? renderPanel(
          <div className="organization-tab-stack">
            <OrganizationProfileSection
              details={details}
              draft={draft}
              lookups={lookups}
              disabled={disabled}
              onDraftChange={onDraftChange}
            />
          </div>
        )
        : null}

      {activeTab === 'support'
        ? renderPanel(
          <div className="organization-tab-stack">
            <OrganizationSupportSection
              details={details}
              draft={draft}
              lookups={lookups}
              disabled={disabled}
              onDraftChange={onDraftChange}
            />
          </div>
        )
        : null}

      {activeTab === 'relations'
        ? renderPanel(details ? (
          <div className="organization-tab-stack">
            <OrganizationRelationsSection
              activeTab={relationTab}
              details={details}
              onChange={onRelationTabChange}
              tableSettings={tableSettings}
            />
          </div>
        ) : (
          <div className="empty-state organization-record-inline-empty">Связанные данные появятся после сохранения организации.</div>
        ))
        : null}

      {activeTab === 'history'
        ? renderPanel(details ? (
          <div className="organization-tab-stack">
            <OrganizationHistoryTabs activeTab={historyTab} onChange={onHistoryTabChange} />
            <OrganizationHistoryWorkspace
              activeTab={historyTab}
              details={details}
              emailCount={emailCount}
              eventsSettingsKey={tableSettings.events}
            />
          </div>
        ) : (
          <div className="empty-state organization-record-inline-empty">История станет доступна после первого сохранения карточки.</div>
        ))
        : null}
    </div>
  );
}

import React from 'react';

export type OrganizationHistoryTab = 'events' | 'snapshots' | 'audit';

const HISTORY_TABS: Array<{ key: OrganizationHistoryTab; label: string }> = [
  { key: 'events', label: 'События' },
  { key: 'snapshots', label: 'Снимки 1С' },
  { key: 'audit', label: 'Аудит' }
];

function buildHistoryTabAriaLabel(label: string, active: boolean) {
  return `${label}: ${active ? 'текущий раздел' : 'открыть раздел'}`;
}

export function OrganizationHistoryTabs({
  activeTab,
  onChange
}: {
  activeTab: OrganizationHistoryTab;
  onChange: (tab: OrganizationHistoryTab) => void;
}) {
  return (
    <div
      className="settings-tabs organization-card-tabs organization-card-tabs-inline"
      role="tablist"
      aria-label="История организации"
    >
      {HISTORY_TABS.map((tab) => {
        const active = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={buildHistoryTabAriaLabel(tab.label, active)}
            className={`settings-tab${active ? ' active' : ''}`}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

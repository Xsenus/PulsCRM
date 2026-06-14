import React from 'react';

export type OrganizationHistoryTab = 'events' | 'snapshots' | 'audit';

const HISTORY_TABS: Array<{ key: OrganizationHistoryTab; label: string }> = [
  { key: 'events', label: 'События' },
  { key: 'snapshots', label: 'Снимки 1С' },
  { key: 'audit', label: 'Аудит' }
];

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
      {HISTORY_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={activeTab === tab.key}
          className={`settings-tab${activeTab === tab.key ? ' active' : ''}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

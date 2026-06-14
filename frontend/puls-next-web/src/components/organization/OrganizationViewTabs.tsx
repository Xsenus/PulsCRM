import React from 'react';

export type OrganizationViewTab = 'profile' | 'support' | 'relations' | 'history';

const VIEW_TABS: Array<{ key: OrganizationViewTab; label: string }> = [
  { key: 'profile', label: 'Карточка' },
  { key: 'support', label: 'Сопровождение' },
  { key: 'relations', label: 'Связи' },
  { key: 'history', label: 'История' }
];

export function OrganizationViewTabs({
  activeTab,
  onChange
}: {
  activeTab: OrganizationViewTab;
  onChange: (tab: OrganizationViewTab) => void;
}) {
  return (
    <div className="settings-tabs organization-card-tabs" role="tablist" aria-label="Разделы карточки организации">
      {VIEW_TABS.map((tab) => (
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

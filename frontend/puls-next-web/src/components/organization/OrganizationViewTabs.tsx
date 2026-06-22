import React from 'react';

export type OrganizationViewTab = 'profile' | 'support' | 'relations' | 'history';

const VIEW_TABS: Array<{ key: OrganizationViewTab; label: string }> = [
  { key: 'profile', label: 'Карточка' },
  { key: 'support', label: 'Сопровождение' },
  { key: 'relations', label: 'Связи' },
  { key: 'history', label: 'История' }
];

function buildViewTabAriaLabel(label: string, active: boolean) {
  return `${label}: ${active ? 'текущий раздел' : 'открыть раздел'}`;
}

export function OrganizationViewTabs({
  activeTab,
  onChange
}: {
  activeTab: OrganizationViewTab;
  onChange: (tab: OrganizationViewTab) => void;
}) {
  return (
    <div className="settings-tabs organization-card-tabs" role="tablist" aria-label="Разделы карточки организации">
      {VIEW_TABS.map((tab) => {
        const active = activeTab === tab.key;

        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={buildViewTabAriaLabel(tab.label, active)}
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

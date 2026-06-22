import React from 'react';

export interface OrganizationSnapshotTabItem {
  key: string;
  title: string;
}

function buildSnapshotTabAriaLabel(title: string, active: boolean) {
  return `${title}: ${active ? 'текущий снимок' : 'открыть снимок'}`;
}

export function OrganizationSnapshotTabs({
  snapshots,
  activeKey,
  onChange
}: {
  snapshots: OrganizationSnapshotTabItem[];
  activeKey?: string;
  onChange: (key: string) => void;
}) {
  return (
    <div
      className="settings-tabs organization-card-tabs organization-card-tabs-inline"
      role="tablist"
      aria-label="Снимки 1С организации"
    >
      {snapshots.map((item) => {
        const active = activeKey === item.key;

        return (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={buildSnapshotTabAriaLabel(item.title, active)}
            className={`settings-tab${active ? ' active' : ''}`}
            onClick={() => onChange(item.key)}
          >
            {item.title}
          </button>
        );
      })}
    </div>
  );
}

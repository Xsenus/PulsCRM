import React from 'react';

export interface OrganizationSnapshotTabItem {
  key: string;
  title: string;
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
    <div className="settings-tabs organization-card-tabs organization-card-tabs-inline">
      {snapshots.map((item) => (
        <button
          key={item.key}
          type="button"
          className={`settings-tab${activeKey === item.key ? ' active' : ''}`}
          onClick={() => onChange(item.key)}
        >
          {item.title}
        </button>
      ))}
    </div>
  );
}

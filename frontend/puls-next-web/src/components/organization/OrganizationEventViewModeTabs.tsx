import React from 'react';

export type OrganizationEventViewMode = 'timeline' | 'table';

const EVENT_VIEW_MODES: Array<{ key: OrganizationEventViewMode; label: string }> = [
  { key: 'timeline', label: 'Лента' },
  { key: 'table', label: 'Таблица' }
];

export function OrganizationEventViewModeTabs({
  activeMode,
  onChange
}: {
  activeMode: OrganizationEventViewMode;
  onChange: (mode: OrganizationEventViewMode) => void;
}) {
  return (
    <div
      className="settings-tabs organization-card-tabs organization-card-tabs-inline"
      role="tablist"
      aria-label="Режим просмотра событий организации"
    >
      {EVENT_VIEW_MODES.map((mode) => (
        <button
          key={mode.key}
          type="button"
          role="tab"
          aria-selected={activeMode === mode.key}
          className={`settings-tab${activeMode === mode.key ? ' active' : ''}`}
          onClick={() => onChange(mode.key)}
        >
          {mode.label}
        </button>
      ))}
    </div>
  );
}

import React from 'react';

export type OrganizationEventViewMode = 'timeline' | 'table';

const EVENT_VIEW_MODES: Array<{ key: OrganizationEventViewMode; label: string }> = [
  { key: 'timeline', label: 'Лента' },
  { key: 'table', label: 'Таблица' }
];

function buildEventViewModeAriaLabel(label: string, active: boolean) {
  return `${label}: ${active ? 'текущий режим' : 'переключить режим'}`;
}

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
      {EVENT_VIEW_MODES.map((mode) => {
        const active = activeMode === mode.key;

        return (
          <button
            key={mode.key}
            type="button"
            role="tab"
            aria-selected={active}
            aria-label={buildEventViewModeAriaLabel(mode.label, active)}
            className={`settings-tab${active ? ' active' : ''}`}
            onClick={() => onChange(mode.key)}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}

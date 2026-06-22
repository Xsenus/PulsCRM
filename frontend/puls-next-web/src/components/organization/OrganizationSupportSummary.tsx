import React from 'react';

export type OrganizationSupportTone = 'ok' | 'warn' | 'danger' | 'muted';

export interface OrganizationSupportSummaryItem {
  key: string;
  title: string;
  tone: OrganizationSupportTone;
  value: string;
  hint: React.ReactNode;
}

export function OrganizationSupportSummary({
  items
}: {
  items: OrganizationSupportSummaryItem[];
}) {
  return (
    <div className="organization-support-summary-grid" role="list" aria-label="Сводка сопровождения организации">
      {items.map((item) => (
        <div key={item.key} className="detail-card organization-support-summary-card" role="listitem">
          <strong>{item.title}</strong>
          <span className={`organization-status-pill organization-status-pill--${item.tone}`} role="status">{item.value}</span>
          <span className="field-hint">{item.hint}</span>
        </div>
      ))}
    </div>
  );
}

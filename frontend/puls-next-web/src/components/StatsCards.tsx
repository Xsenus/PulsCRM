import React from 'react';

export interface StatsCardItem {
  label: string;
  value: string | number;
  hint?: string;
}

export function StatsCards({ items }: { items: StatsCardItem[] }) {
  return (
    <div className="stats-grid">
      {items.map((item) => (
        <div key={item.label} className="stat-card">
          <div className="stat-card-label">{item.label}</div>
          <div className="stat-card-value">{item.value}</div>
          {item.hint ? <div className="stat-card-hint">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

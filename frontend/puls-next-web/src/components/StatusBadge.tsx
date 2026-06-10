import React from 'react';

export type StatusBadgeTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

export function StatusBadge({
  children,
  tone = 'neutral'
}: {
  children: React.ReactNode;
  tone?: StatusBadgeTone;
}) {
  return <span className={`status-badge status-badge-${tone}`}>{children}</span>;
}

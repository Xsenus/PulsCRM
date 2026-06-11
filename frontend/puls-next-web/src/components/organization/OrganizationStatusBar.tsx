import React from 'react';

export interface OrganizationStatusBarProps {
  visible: boolean;
  isManager: boolean;
  isDirty: boolean;
  raionName?: string;
  orgTypeName?: string;
  statusName?: string;
  flagName?: string;
}

export function OrganizationStatusBar({
  visible,
  isManager,
  isDirty,
  raionName,
  orgTypeName,
  statusName,
  flagName
}: OrganizationStatusBarProps) {
  return (
    <section className="panel organization-record-status-bar">
      <div className="organization-card-chip-row">
        <span className={`organization-chip${visible ? ' accent' : ''}`}>{visible ? 'Видима' : 'Скрыта'}</span>
        {isManager ? <span className="organization-chip accent">Для менеджера</span> : null}
        {raionName ? <span className="organization-chip">{raionName}</span> : null}
        {orgTypeName ? <span className="organization-chip">{orgTypeName}</span> : null}
        {statusName ? <span className="organization-chip">{statusName}</span> : null}
        {flagName ? <span className="organization-chip">{flagName}</span> : null}
      </div>
      <span className={`organization-status-pill organization-status-pill--${isDirty ? 'warn' : 'ok'}`}>
        {isDirty ? 'Черновик изменен' : 'Все изменения сохранены'}
      </span>
    </section>
  );
}

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
      <div className="organization-card-chip-row" role="list" aria-label="Статусы организации">
        <span className={`organization-chip${visible ? ' accent' : ''}`} role="listitem">
          {visible ? 'Видима' : 'Скрыта'}
        </span>
        {isManager ? <span className="organization-chip accent" role="listitem">Для менеджера</span> : null}
        {raionName ? <span className="organization-chip" role="listitem">{raionName}</span> : null}
        {orgTypeName ? <span className="organization-chip" role="listitem">{orgTypeName}</span> : null}
        {statusName ? <span className="organization-chip" role="listitem">{statusName}</span> : null}
        {flagName ? <span className="organization-chip" role="listitem">{flagName}</span> : null}
      </div>
      <span className={`organization-status-pill organization-status-pill--${isDirty ? 'warn' : 'ok'}`} role="status">
        {isDirty ? 'Черновик изменен' : 'Все изменения сохранены'}
      </span>
    </section>
  );
}

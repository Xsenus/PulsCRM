import React from 'react';

export function PageHeader({
  title,
  subtitle,
  actions,
  leading
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  leading?: React.ReactNode;
}) {
  return (
    <div className="page-header">
      <div className="page-header-main">
        {leading ? <div className="page-header-leading">{leading}</div> : null}

        <div className="page-header-copy">
          <h1>{title}</h1>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </div>
  );
}

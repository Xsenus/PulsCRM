import React from 'react';

type AppLoaderVariant = 'page' | 'panel' | 'inline' | 'compact';

interface AppLoaderProps {
  variant?: AppLoaderVariant;
  label?: string;
  description?: string;
  className?: string;
}

export function AppLoader({
  variant = 'panel',
  label = 'Загрузка',
  description,
  className
}: AppLoaderProps) {
  return (
    <div className={`app-loader app-loader--${variant}${className ? ` ${className}` : ''}`} role="status" aria-live="polite">
      <div className="app-loader-visual" aria-hidden="true">
        <span className="app-loader-aura" />
        <span className="app-loader-orbit app-loader-orbit--one" />
        <span className="app-loader-orbit app-loader-orbit--two" />
        <span className="app-loader-card app-loader-card--one" />
        <span className="app-loader-card app-loader-card--two" />
        <span className="app-loader-card app-loader-card--three" />
        <span className="app-loader-core">
          <span />
          <span />
          <span />
        </span>
      </div>
      {variant !== 'compact' ? (
        <div className="app-loader-copy">
          <strong>{label}</strong>
          {description ? <span>{description}</span> : null}
        </div>
      ) : null}
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function LoadingButtonLabel({
  label
}: {
  label: string;
}) {
  return (
    <span className="loading-button-label">
      <AppLoader variant="compact" label={label} />
      <span>{label}</span>
    </span>
  );
}

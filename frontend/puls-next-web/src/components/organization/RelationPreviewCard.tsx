import React from 'react';

export interface PreviewCardItem {
  key: string;
  title: string;
  caption?: string;
}

function formatCount(value?: number | null) {
  return new Intl.NumberFormat('ru-RU').format(value ?? 0);
}

export function RelationPreviewCard({
  title,
  count,
  description,
  items,
  active,
  onClick
}: {
  title: string;
  count: number;
  description: string;
  items: PreviewCardItem[];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={`organization-preview-card${active ? ' active' : ''}`}
      aria-pressed={active}
      onClick={onClick}
    >
      <div className="organization-preview-card-head">
        <div>
          <strong>{title}</strong>
          <div className="field-hint">{description}</div>
        </div>
        <span className="organization-preview-card-count">{formatCount(count)}</span>
      </div>
      {items.length ? (
        <div className="organization-preview-card-list" role="list" aria-label={`Примеры: ${title}`}>
          {items.map((item) => (
            <div key={item.key} className="organization-preview-card-item" role="listitem">
              <span>{item.title}</span>
              {item.caption ? <span className="field-hint">{item.caption}</span> : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="field-hint">Пока пусто.</div>
      )}
    </button>
  );
}

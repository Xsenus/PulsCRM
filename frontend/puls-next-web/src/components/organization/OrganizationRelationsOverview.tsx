import React from 'react';
import { RelationPreviewCard, type PreviewCardItem } from './RelationPreviewCard';

export type OrganizationRelationTab = 'contacts' | 'documents' | 'contracts' | 'realizations' | 'licenses' | 'orders';

export interface OrganizationRelationsOverviewItem {
  key: OrganizationRelationTab;
  title: string;
  count: number;
  description: string;
  items: PreviewCardItem[];
}

export function OrganizationRelationsOverview({
  cards,
  activeTab,
  onChange
}: {
  cards: OrganizationRelationsOverviewItem[];
  activeTab: OrganizationRelationTab;
  onChange: (tab: OrganizationRelationTab) => void;
}) {
  return (
    <>
      <div className="section-header-inline">
        <h4>Связанные записи</h4>
        <span className="field-hint">Быстрые карточки и полный список по каждому разделу</span>
      </div>

      <div className="organization-relations-grid">
        {cards.map((card) => (
          <RelationPreviewCard
            key={card.key}
            title={card.title}
            count={card.count}
            description={card.description}
            items={card.items}
            active={activeTab === card.key}
            onClick={() => onChange(card.key)}
          />
        ))}
      </div>

      <div className="settings-tabs organization-card-tabs organization-card-tabs-inline">
        {cards.map((card) => (
          <button
            key={card.key}
            type="button"
            className={`settings-tab${activeTab === card.key ? ' active' : ''}`}
            onClick={() => onChange(card.key)}
          >
            {card.title}
          </button>
        ))}
      </div>
    </>
  );
}

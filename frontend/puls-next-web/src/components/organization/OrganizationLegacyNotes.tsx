import React from 'react';

const EMPTY_VALUE = '-';

export interface OrganizationLegacyNotesData {
  additionalComment?: string;
  technicsComment?: string;
  procurementComment?: string;
}

function textValue(value?: string | number | null) {
  if (typeof value === 'number') {
    return String(value);
  }

  return value?.toString().trim() || EMPTY_VALUE;
}

export function OrganizationLegacyNotes({ details }: { details?: OrganizationLegacyNotesData | null }) {
  return (
    <div className="panel-subsection">
      <h4>Legacy-заметки</h4>
      <div className="detail-list" role="list" aria-label="Legacy-заметки организации">
        <div role="listitem">
          <strong>Дополнительный комментарий</strong>
          <div className="field-hint">{textValue(details?.additionalComment)}</div>
        </div>
        <div role="listitem">
          <strong>Техника</strong>
          <div className="field-hint">{textValue(details?.technicsComment)}</div>
        </div>
        <div role="listitem">
          <strong>Закупки</strong>
          <div className="field-hint">{textValue(details?.procurementComment)}</div>
        </div>
      </div>
    </div>
  );
}

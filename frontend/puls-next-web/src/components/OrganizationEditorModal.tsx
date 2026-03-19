import React from 'react';
import type { OrganizationEditorLookupsDto, OrganizationUpsertRequest } from '../app/types';
import { Modal } from './Modal';
import { OrganizationEditorForm } from './OrganizationEditorForm';

interface OrganizationEditorModalProps {
  open: boolean;
  mode: 'create' | 'edit';
  value: OrganizationUpsertRequest;
  lookups: OrganizationEditorLookupsDto | null;
  loading?: boolean;
  saving?: boolean;
  onChange: (next: OrganizationUpsertRequest) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export function OrganizationEditorModal({
  open,
  mode,
  value,
  lookups,
  loading = false,
  saving = false,
  onChange,
  onClose,
  onSubmit
}: OrganizationEditorModalProps) {
  const disabled = loading || saving;

  return (
    <Modal
      open={open}
      title={mode === 'create' ? 'Новая организация' : 'Редактирование организации'}
      onClose={onClose}
      maxWidth={1180}
      actions={(
        <>
          <button type="button" className="secondary-button" onClick={onClose} disabled={saving}>
            Отмена
          </button>
          <button type="button" className="primary-button action-button" onClick={onSubmit} disabled={disabled}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        </>
      )}
    >
      {loading ? <div className="empty-state">Загрузка формы...</div> : null}

      {!loading ? (
        <OrganizationEditorForm
          value={value}
          lookups={lookups}
          disabled={disabled}
          onChange={onChange}
        />
      ) : null}
    </Modal>
  );
}

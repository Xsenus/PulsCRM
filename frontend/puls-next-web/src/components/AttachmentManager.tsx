import React, { useRef, useState } from 'react';
import { formatFileSize } from '../app/format';
import { attachmentKindOptions } from '../app/lookups';
import type { StoredFileDto } from '../app/types';
import { LoadingButtonLabel } from './AppLoader';

export interface EditableAttachment {
  storedFile: StoredFileDto;
  attachmentKind: number;
  displayName?: string;
  contentId?: string;
  sortOrder: number;
}

interface AttachmentManagerProps {
  attachments: EditableAttachment[];
  onChange: (attachments: EditableAttachment[]) => void;
  onUploadFiles: (files: File[]) => Promise<void>;
}

export function AttachmentManager({ attachments, onChange, onUploadFiles }: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  const patchAttachment = (index: number, patch: Partial<EditableAttachment>) => {
    const next = [...attachments];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const startUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    setUploading(true);
    try {
      await onUploadFiles(Array.from(files));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <section className="panel">
      <div className="section-header-inline">
        <h3>Вложения и изображения</h3>
        <button
          type="button"
          className="secondary-button button-inline"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? <LoadingButtonLabel label="Загружаем" /> : 'Добавить файлы'}
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={(event) => void startUpload(event.target.files)}
      />

      <div className="attachments-list">
        {attachments.length === 0 ? <div className="empty-state">Файлы еще не добавлены.</div> : null}

        {attachments.map((attachment, index) => (
          <div key={`${attachment.storedFile.id}-${index}`} className="attachment-card">
            <div className="attachment-card-head">
              <div>
                <div className="attachment-title">{attachment.displayName || attachment.storedFile.originalFileName}</div>
                <div className="attachment-meta">{attachment.storedFile.originalFileName} • {formatFileSize(attachment.storedFile.length)}</div>
              </div>

              <button
                type="button"
                className="secondary-button button-inline danger-button"
                onClick={() => onChange(attachments.filter((_, currentIndex) => currentIndex !== index))}
              >
                Удалить
              </button>
            </div>

            <div className="form-grid">
              <div className="field">
                <label>Тип</label>
                <select
                  className="form-select"
                  value={attachment.attachmentKind}
                  onChange={(event) => patchAttachment(index, { attachmentKind: Number(event.target.value) || 0 })}
                >
                  {attachmentKindOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Отображаемое имя</label>
                <input
                  className="form-input"
                  value={attachment.displayName || ''}
                  onChange={(event) => patchAttachment(index, { displayName: event.target.value })}
                />
              </div>

              <div className="field">
                <label>Content-Id для встроенного изображения</label>
                <input
                  className="form-input"
                  value={attachment.contentId || ''}
                  onChange={(event) => patchAttachment(index, { contentId: event.target.value })}
                />
                <div className="field-hint">Для встроенного изображения используйте в письме формат `cid:идентификатор`.</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

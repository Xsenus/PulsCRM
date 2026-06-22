import React, { useEffect, useMemo, useRef, useState } from 'react';
import { getStoredFileDisplayExtension, isImageStoredFile } from '../app/campaignAttachments';
import { formatFileSize } from '../app/format';
import { attachmentKindOptions } from '../app/lookups';
import { extractCidReferences } from '../app/messageValidation';
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
  htmlBody?: string;
  onChange: (attachments: EditableAttachment[]) => void;
  onUploadFiles: (files: File[]) => Promise<void>;
  onLoadPreviewFile?: (file: StoredFileDto) => Promise<Blob>;
}

const MAX_UPLOAD_SIZE_BYTES = 26_214_400;
const INLINE_IMAGE_KIND = 1;

interface ImagePreviewState {
  loading?: boolean;
  url?: string;
  error?: string;
}

export function AttachmentManager({ attachments, htmlBody, onChange, onUploadFiles, onLoadPreviewFile }: AttachmentManagerProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [copiedContentId, setCopiedContentId] = useState('');
  const [imagePreviews, setImagePreviews] = useState<Record<number, ImagePreviewState>>({});
  const cidReferences = extractCidReferences(htmlBody);
  const imageAttachments = useMemo(
    () => attachments.filter((attachment) => isImageStoredFile(attachment.storedFile)),
    [attachments]
  );

  useEffect(() => {
    if (!onLoadPreviewFile || imageAttachments.length === 0 || typeof URL === 'undefined') {
      setImagePreviews({});
      return;
    }

    let cancelled = false;
    const objectUrls: string[] = [];

    setImagePreviews(Object.fromEntries(imageAttachments.map((attachment) => [attachment.storedFile.id, { loading: true }])));

    void Promise.all(
      imageAttachments.map(async (attachment) => {
        try {
          const blob = await onLoadPreviewFile(attachment.storedFile);
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);

          return [attachment.storedFile.id, { url }] as const;
        } catch {
          return [attachment.storedFile.id, { error: 'Не удалось загрузить предпросмотр изображения.' }] as const;
        }
      })
    ).then((entries) => {
      if (cancelled) {
        objectUrls.forEach((url) => URL.revokeObjectURL(url));
        return;
      }

      setImagePreviews(Object.fromEntries(entries));
    });

    return () => {
      cancelled = true;
      objectUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imageAttachments, onLoadPreviewFile]);

  const patchAttachment = (index: number, patch: Partial<EditableAttachment>) => {
    const next = [...attachments];
    next[index] = { ...next[index], ...patch };
    onChange(next);
  };

  const copyCid = async (contentId: string) => {
    const token = `cid:${contentId}`;
    try {
      await navigator.clipboard?.writeText(token);
    } catch {
      return;
    }

    setCopiedContentId(contentId);
    window.setTimeout(() => setCopiedContentId(''), 1600);
  };

  const startUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) {
      return;
    }

    const selectedFiles = Array.from(files);
    const oversizedFile = selectedFiles.find((file) => file.size > MAX_UPLOAD_SIZE_BYTES);
    if (oversizedFile) {
      setUploadError(`Файл "${oversizedFile.name}" больше лимита ${formatFileSize(MAX_UPLOAD_SIZE_BYTES)}.`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setUploadError('');
    setUploading(true);
    try {
      await onUploadFiles(selectedFiles);
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

      {uploadError ? (
        <div className="form-validation-list" role="alert">
          <div>{uploadError}</div>
        </div>
      ) : null}

      <div className="attachments-list">
        {attachments.length === 0 ? <div className="empty-state">Файлы еще не добавлены.</div> : null}

        {attachments.map((attachment, index) => {
          const isInlineImage = attachment.attachmentKind === INLINE_IMAGE_KIND;
          const isImage = isImageStoredFile(attachment.storedFile);
          const contentId = attachment.contentId?.trim() || '';
          const cidToken = contentId ? `cid:${contentId}` : '';
          const cidUsed = contentId ? cidReferences.includes(contentId) : false;
          const imagePreview = imagePreviews[attachment.storedFile.id];

          return (
            <div key={`${attachment.storedFile.id}-${index}`} className="attachment-card">
              <div className="attachment-card-head">
                <div>
                  <div className="attachment-title">{attachment.displayName || attachment.storedFile.originalFileName}</div>
                  <div className="attachment-meta">
                    {attachment.storedFile.originalFileName} • {formatFileSize(attachment.storedFile.length)}
                    {attachment.storedFile.contentType ? ` • ${attachment.storedFile.contentType}` : ''}
                  </div>
                </div>

                <button
                  type="button"
                  className="secondary-button button-inline danger-button"
                  onClick={() => onChange(attachments.filter((_, currentIndex) => currentIndex !== index))}
                >
                  Удалить
                </button>
              </div>

              {isImage ? (
                <div className="attachment-image-preview">
                  <div className="attachment-image-preview-media">
                    {imagePreview?.url ? (
                      <img src={imagePreview.url} alt={`Предпросмотр ${attachment.displayName || attachment.storedFile.originalFileName}`} />
                    ) : (
                      <span>{getStoredFileDisplayExtension(attachment.storedFile)}</span>
                    )}
                  </div>
                  <div className="attachment-image-preview-copy">
                    <strong>{imagePreview?.loading ? 'Загружаем предпросмотр' : 'Изображение'}</strong>
                    <span>
                      {imagePreview?.error || `${attachment.storedFile.contentType || 'image/*'} • ${formatFileSize(attachment.storedFile.length)}`}
                    </span>
                  </div>
                </div>
              ) : null}

              {isInlineImage && (!contentId || !cidUsed) ? (
                <div className="attachment-warning-list">
                  {!contentId ? <div>Для встроенного изображения нужно заполнить Content-ID.</div> : null}
                  {contentId && !cidUsed ? <div>Токен {cidToken} пока не найден в HTML письма.</div> : null}
                </div>
              ) : null}

              <div className="form-grid">
                <div className="field">
                  <label>Тип</label>
                  <select
                    className="form-select"
                    aria-label={`Тип вложения ${attachment.displayName || attachment.storedFile.originalFileName}`}
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
                  <label>Content-ID для встроенного изображения</label>
                  <input
                    className="form-input"
                    value={attachment.contentId || ''}
                    onChange={(event) => patchAttachment(index, { contentId: event.target.value })}
                  />
                  {cidToken ? (
                    <div className="attachment-cid-row">
                      <code>{cidToken}</code>
                      <button type="button" className="secondary-button button-inline" onClick={() => void copyCid(contentId)}>
                        {copiedContentId === contentId ? 'Скопировано' : 'Копировать'}
                      </button>
                    </div>
                  ) : (
                    <div className="field-hint">Для встроенного изображения используйте в письме формат `cid:идентификатор`.</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchChatAttachmentBlob } from '../../app/chatApi';
import { formatFileSize } from '../../app/chatFormat';
import type { ChatAttachmentDto } from '../../app/chatTypes';
import { showToast } from '../../app/toast';

/** Кэш object URL изображений на время сессии, чтобы при прокрутке ленты не качать повторно. */
const imageUrlCache = new Map<string, Promise<string>>();

function loadImageUrl(attachmentId: number, thumbnail: boolean) {
  const key = `${attachmentId}:${thumbnail ? 'thumb' : 'full'}`;
  let promise = imageUrlCache.get(key);
  if (!promise) {
    promise = fetchChatAttachmentBlob(attachmentId, true, thumbnail).then((blob) => URL.createObjectURL(blob));
    promise.catch(() => imageUrlCache.delete(key));
    imageUrlCache.set(key, promise);
  }

  return promise;
}

/** URL изображения; с thumbnail=true — уменьшенной копии (в ленте), иначе оригинала (в просмотре). */
export function useChatImageUrl(attachmentId: number | null, thumbnail = false) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!attachmentId) {
      return;
    }

    let active = true;
    setFailed(false);
    loadImageUrl(attachmentId, thumbnail)
      .then((value) => active && setUrl(value))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [attachmentId, thumbnail]);

  return { url, failed };
}

export async function downloadChatAttachment(attachment: ChatAttachmentDto) {
  try {
    const blob = await fetchChatAttachmentBlob(attachment.id, false);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10000);
  } catch {
    showToast('Не удалось скачать файл.', 'error');
  }
}

function FileIcon({ fileName }: { fileName: string }) {
  const extension = fileName.split('.').pop()?.toLowerCase() ?? '';
  const label = extension.slice(0, 4).toUpperCase() || 'FILE';
  const color = ['pdf'].includes(extension) ? '#dc2626'
    : ['doc', 'docx', 'rtf', 'odt'].includes(extension) ? '#2563eb'
      : ['xls', 'xlsx', 'csv', 'ods'].includes(extension) ? '#16a34a'
        : ['zip', 'rar', '7z'].includes(extension) ? '#a16207'
          : '#64748b';
  return (
    <span className="chat-file-icon" style={{ background: color }} aria-hidden="true">
      {label}
    </span>
  );
}

function ChatImageThumb({ attachment, single, onOpen }: { attachment: ChatAttachmentDto; single: boolean; onOpen: () => void }) {
  const { url, failed } = useChatImageUrl(attachment.id, Boolean(attachment.hasThumbnail));
  // Пока картинка грузится, держим место по ее пропорциям, чтобы лента не прыгала.
  const placeholderStyle = single && attachment.width && attachment.height
    ? { aspectRatio: `${attachment.width} / ${attachment.height}`, width: attachment.width >= attachment.height ? 280 : 180, height: 'auto' }
    : undefined;

  if (failed) {
    return (
      <button type="button" className="chat-file-card" onClick={() => void downloadChatAttachment(attachment)}>
        <FileIcon fileName={attachment.fileName} />
        <span className="chat-file-meta">
          <span className="chat-file-name">{attachment.fileName}</span>
          <span className="chat-file-size">Не удалось показать · {formatFileSize(attachment.length)}</span>
        </span>
      </button>
    );
  }

  return (
    <button type="button" className="chat-image-thumb" onClick={onOpen} title={attachment.fileName} aria-label={`Открыть изображение ${attachment.fileName}`}>
      {url
        ? <img src={url} alt={attachment.fileName} loading="lazy" width={attachment.width ?? undefined} height={attachment.height ?? undefined} />
        : <span className="chat-image-placeholder" style={placeholderStyle} />}
    </button>
  );
}

export function ChatAttachmentList({ attachments }: { attachments: ChatAttachmentDto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const images = attachments.filter((item) => item.isImage);
  const files = attachments.filter((item) => !item.isImage);

  return (
    <div className="chat-attachments">
      {images.length > 0 ? (
        <div className={`chat-image-grid chat-image-grid-${Math.min(images.length, 4)}`}>
          {images.map((attachment, index) => (
            <ChatImageThumb key={attachment.id} attachment={attachment} single={images.length === 1} onOpen={() => setOpenIndex(index)} />
          ))}
        </div>
      ) : null}
      {files.map((attachment) => (
        <button key={attachment.id} type="button" className="chat-file-card" onClick={() => void downloadChatAttachment(attachment)} title="Скачать">
          <FileIcon fileName={attachment.fileName} />
          <span className="chat-file-meta">
            <span className="chat-file-name">{attachment.fileName}</span>
            <span className="chat-file-size">{formatFileSize(attachment.length)}</span>
          </span>
        </button>
      ))}
      {openIndex !== null ? (
        <ChatImageLightbox images={images} index={openIndex} onIndexChange={setOpenIndex} onClose={() => setOpenIndex(null)} />
      ) : null}
    </div>
  );
}

function ChatImageLightbox({ images, index, onIndexChange, onClose }: {
  images: ChatAttachmentDto[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}) {
  const current = images[index];
  const { url } = useChatImageUrl(current?.id ?? null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      } else if (event.key === 'ArrowRight' && index < images.length - 1) {
        onIndexChange(index + 1);
      } else if (event.key === 'ArrowLeft' && index > 0) {
        onIndexChange(index - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, index, onClose, onIndexChange]);

  if (!current) {
    return null;
  }

  return createPortal(
    <div className="chat-lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label={current.fileName}>
      <div className="chat-lightbox-toolbar" onClick={(event) => event.stopPropagation()}>
        <span className="chat-lightbox-name">{current.fileName}{images.length > 1 ? ` · ${index + 1} из ${images.length}` : ''}</span>
        <button type="button" onClick={() => void downloadChatAttachment(current)}>Скачать</button>
        <button type="button" onClick={onClose} aria-label="Закрыть">×</button>
      </div>
      {index > 0 ? (
        <button type="button" className="chat-lightbox-nav chat-lightbox-prev" aria-label="Предыдущее" onClick={(event) => { event.stopPropagation(); onIndexChange(index - 1); }}>‹</button>
      ) : null}
      {url ? <img src={url} alt={current.fileName} onClick={(event) => event.stopPropagation()} /> : <span className="chat-lightbox-loading">Загрузка…</span>}
      {index < images.length - 1 ? (
        <button type="button" className="chat-lightbox-nav chat-lightbox-next" aria-label="Следующее" onClick={(event) => { event.stopPropagation(); onIndexChange(index + 1); }}>›</button>
      ) : null}
    </div>,
    document.body
  );
}

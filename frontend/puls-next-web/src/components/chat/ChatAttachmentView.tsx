import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { fetchChatAttachmentBlob } from '../../app/chatApi';
import { acquireChatImage } from '../../app/chatImageLoader';
import { albumRatio, computeAlbumLayout } from '../../app/chatAlbumLayout';

/** Картинки начинают грузиться за столько пикселей до появления на экране. */
const PRELOAD_MARGIN_PX = 600;
import { formatFileSize } from '../../app/chatFormat';
import type { ChatAttachmentDto } from '../../app/chatTypes';
import { showToast } from '../../app/toast';

/**
 * URL изображения; с thumbnail=true — уменьшенной копии (в ленте), иначе оригинала (в просмотре).
 * enabled=false — пока не грузить (картинка далеко за экраном).
 */
export function useChatImageUrl(attachmentId: number | null, thumbnail = false, enabled = true) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!attachmentId || !enabled) {
      return;
    }

    let active = true;
    setFailed(false);
    const { promise, release } = acquireChatImage(attachmentId, thumbnail);
    promise
      .then((value) => active && setUrl(value))
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
      release();
    };
  }, [attachmentId, thumbnail, enabled]);

  return { url, failed };
}

/** Становится true, когда элемент подходит к видимой области ленты (с запасом), и больше не сбрасывается. */
function useNearViewport<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [near, setNear] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const element = ref.current;
    if (near || !element || typeof IntersectionObserver === 'undefined') {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setNear(true);
        observer.disconnect();
      }
    }, { root: element.closest('.chat-messages'), rootMargin: `${PRELOAD_MARGIN_PX}px 0px` });
    observer.observe(element);
    return () => observer.disconnect();
  }, [near]);

  return { ref, near };
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

function ChatImageThumb({ attachment, single, tile, onOpen }: {
  attachment: ChatAttachmentDto;
  single: boolean;
  /** Положение плитки в альбоме (проценты). */
  tile?: React.CSSProperties;
  onOpen: () => void;
}) {
  const { ref, near } = useNearViewport<HTMLButtonElement>();
  const { url, failed } = useChatImageUrl(attachment.id, Boolean(attachment.hasThumbnail), near);
  const [loaded, setLoaded] = useState(false);
  const hasSize = !!(attachment.width && attachment.height);
  // Место по пропорциям картинки резервируется сразу, чтобы лента не прыгала, пока она грузится.
  const frameStyle: React.CSSProperties | undefined = tile ?? (single && hasSize
    ? { aspectRatio: `${attachment.width} / ${attachment.height}`, width: attachment.width! >= attachment.height! ? 280 : 180 }
    : undefined);

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
    <button
      ref={ref}
      type="button"
      className={`chat-image-thumb${frameStyle ? ' sized' : ''}${tile ? ' tile' : ''}${loaded ? ' loaded' : ''}`}
      style={frameStyle}
      onClick={onOpen}
      title={attachment.fileName}
      aria-label={`Открыть изображение ${attachment.fileName}`}
    >
      {/* Крошечное размытое превью приходит вместе с сообщением — фото видно сразу, четкое догружается. */}
      {attachment.previewDataUrl && !loaded ? <img className="chat-image-blur" src={attachment.previewDataUrl} alt="" aria-hidden="true" /> : null}
      {!attachment.previewDataUrl && !loaded ? <span className="chat-image-placeholder" /> : null}
      {url ? (
        <img
          className="chat-image-full"
          src={url}
          alt={attachment.fileName}
          decoding="async"
          width={attachment.width ?? undefined}
          height={attachment.height ?? undefined}
          onLoad={() => setLoaded(true)}
        />
      ) : null}
    </button>
  );
}

export function ChatAttachmentList({ attachments }: { attachments: ChatAttachmentDto[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const images = attachments.filter((item) => item.isImage);
  const files = attachments.filter((item) => !item.isImage);

  return (
    <div className="chat-attachments">
      {images.length === 1 ? (
        <div className="chat-image-grid">
          <ChatImageThumb attachment={images[0]} single onOpen={() => setOpenIndex(0)} />
        </div>
      ) : null}
      {images.length > 1 ? <ChatPhotoAlbum images={images} onOpen={setOpenIndex} /> : null}
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

/** Несколько фото одного сообщения — мозаикой по пропорциям, по порядку. */
function ChatPhotoAlbum({ images, onOpen }: { images: ChatAttachmentDto[]; onOpen: (index: number) => void }) {
  const layout = useMemo(() => computeAlbumLayout(images.map((item) => albumRatio(item.width, item.height))), [images]);
  const percent = (value: number) => `${(value * 100).toFixed(4)}%`;

  return (
    <div className="chat-album" style={{ aspectRatio: `1 / ${layout.height.toFixed(4)}` }} role="group" aria-label={`Альбом: ${images.length} фото`}>
      {layout.tiles.map((tile) => (
        <ChatImageThumb
          key={images[tile.index].id}
          attachment={images[tile.index]}
          single={false}
          tile={{
            left: percent(tile.x),
            top: percent(tile.y / layout.height),
            width: percent(tile.width),
            height: percent(tile.height / layout.height)
          }}
          onOpen={() => onOpen(tile.index)}
        />
      ))}
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
  // Пока грузится оригинал, показываем уже загруженную копию из ленты.
  const { url: previewUrl } = useChatImageUrl(current?.hasThumbnail ? current.id : null, true);

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
      {url || previewUrl || current.previewDataUrl
        ? <img src={url ?? previewUrl ?? current.previewDataUrl!} alt={current.fileName} className={url ? undefined : 'chat-lightbox-preview'} onClick={(event) => event.stopPropagation()} />
        : <span className="chat-lightbox-loading">Загрузка…</span>}
      {index < images.length - 1 ? (
        <button type="button" className="chat-lightbox-nav chat-lightbox-next" aria-label="Следующее" onClick={(event) => { event.stopPropagation(); onIndexChange(index + 1); }}>›</button>
      ) : null}
    </div>,
    document.body
  );
}

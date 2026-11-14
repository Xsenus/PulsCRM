/**
 * Уменьшенные копии изображений для ленты чата. Копию готовит браузер перед загрузкой:
 * так лента не качает многомегабайтные оригиналы, а сервер не декодирует картинки.
 */

/** Самая длинная сторона копии: с запасом для экранов с двойной плотностью пикселей. */
export const CHAT_THUMBNAIL_MAX_SIDE = 720;

/** Небольшие картинки показываются как есть — копия ничего не сэкономит. */
export const CHAT_THUMBNAIL_MIN_SOURCE_BYTES = 150 * 1024;

/** Сервер не примет копию больше этого размера. */
export const CHAT_THUMBNAIL_MAX_BYTES = 512 * 1024;

/** Размытое превью: крошечная картинка, которая приходит вместе с сообщением. */
export const CHAT_PREVIEW_MAX_SIDE = 24;
/** Сервер не примет превью длиннее этого (символов data:URL). */
export const CHAT_PREVIEW_MAX_LENGTH = 2500;

export interface ChatImageUploadExtras {
  thumbnail?: Blob;
  /** data:URL крошечного превью. */
  preview?: string;
  width?: number;
  height?: number;
}

/** Размер копии с сохранением пропорций; оригинал не увеличивается. */
export function getThumbnailSize(width: number, height: number, maxSide = CHAT_THUMBNAIL_MAX_SIDE) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  };
}

/** Нужна ли копия: GIF не трогаем (пропадет анимация), маленькие картинки — тоже. */
export function shouldCreateThumbnail(file: Pick<File, 'type' | 'size'>, width: number, height: number) {
  if (!file.type.startsWith('image/') || file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return false;
  }

  return Math.max(width, height) > CHAT_THUMBNAIL_MAX_SIDE || file.size > CHAT_THUMBNAIL_MIN_SOURCE_BYTES;
}

interface DecodedImage {
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}

async function decodeImage(file: File): Promise<DecodedImage> {
  if (typeof createImageBitmap === 'function') {
    // Поворот по EXIF браузер применяет сам (imageOrientation: from-image по умолчанию).
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    await image.decode();
    return { source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
}

/** Крошечное превью (до 24 px) как data:URL; undefined — не получилось или слишком длинное. */
function createPreviewDataUrl(source: CanvasImageSource, width: number, height: number): string | undefined {
  try {
    const size = getThumbnailSize(width, height, CHAT_PREVIEW_MAX_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return undefined;
    }

    context.drawImage(source, 0, 0, size.width, size.height);
    let url = canvas.toDataURL('image/webp', 0.6);
    if (!url.startsWith('data:image/webp')) {
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size.width, size.height);
      url = canvas.toDataURL('image/jpeg', 0.6);
    }

    return url.length <= CHAT_PREVIEW_MAX_LENGTH && /^data:image\/(webp|jpeg);base64,/.test(url) ? url : undefined;
  } catch {
    return undefined;
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));
}

/**
 * Готовит размеры и уменьшенную копию изображения. Любая ошибка (неизвестный формат, нет canvas)
 * не мешает загрузке: файл просто уйдет без копии и лента покажет оригинал.
 */
export async function prepareChatImageUpload(file: File): Promise<ChatImageUploadExtras> {
  if (!file.type.startsWith('image/') || typeof document === 'undefined') {
    return {};
  }

  let decoded: DecodedImage | null = null;
  try {
    decoded = await decodeImage(file);
    const { width, height } = decoded;
    if (!width || !height) {
      return {};
    }

    const preview = createPreviewDataUrl(decoded.source, width, height);
    if (!shouldCreateThumbnail(file, width, height)) {
      return { width, height, preview };
    }

    const size = getThumbnailSize(width, height);
    const canvas = document.createElement('canvas');
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext('2d');
    if (!context) {
      return { width, height, preview };
    }

    context.imageSmoothingQuality = 'high';
    context.drawImage(decoded.source, 0, 0, size.width, size.height);
    let thumbnail = await canvasToBlob(canvas, 'image/webp', 0.82);
    if (!thumbnail || thumbnail.type !== 'image/webp') {
      // Браузер без WebP: JPEG без прозрачности, поэтому подкладываем белый фон.
      context.globalCompositeOperation = 'destination-over';
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, size.width, size.height);
      thumbnail = await canvasToBlob(canvas, 'image/jpeg', 0.82);
    }

    if (!thumbnail || thumbnail.size >= file.size || thumbnail.size > CHAT_THUMBNAIL_MAX_BYTES) {
      return { width, height, preview };
    }

    return { thumbnail, width, height, preview };
  } catch {
    return {};
  } finally {
    decoded?.release();
  }
}

/** Имена, которые браузеры дают картинке из буфера обмена: у всех скриншотов они одинаковые. */
const GENERIC_NAMES = /^(image|изображение|unknown|blob)(\.\w+)?$/i;

const EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/bmp': 'bmp'
};

/** «Скриншот 2026-11-17 10-30-15.png» — понятное и разное имя для каждой вставки. */
export function buildScreenshotName(type: string, now = new Date(), index = 0) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `Скриншот ${stamp}${index > 0 ? ` (${index + 1})` : ''}.${EXTENSIONS[type] ?? 'png'}`;
}

/**
 * Файлы из буфера обмена. Часть браузеров кладет скриншот только в items (а files пуст) — берем оттуда.
 * Картинкам с безликим именем («image.png») дается имя «Скриншот <дата время>».
 */
export function extractClipboardFiles(data: Pick<DataTransfer, 'files' | 'items'> | null, now = new Date()): File[] {
  if (!data) {
    return [];
  }

  let files = Array.from(data.files ?? []);
  if (files.length === 0 && data.items) {
    files = Array.from(data.items)
      .filter((item) => item.kind === 'file')
      .map((item) => item.getAsFile())
      .filter((file): file is File => !!file);
  }

  let screenshotIndex = 0;
  return files.map((file) => {
    if (!file.type.startsWith('image/') || (file.name && !GENERIC_NAMES.test(file.name))) {
      return file;
    }

    const renamed = new File([file], buildScreenshotName(file.type, now, screenshotIndex), { type: file.type, lastModified: file.lastModified });
    screenshotIndex += 1;
    return renamed;
  });
}

/** Вставка в поле ввода или в другой элемент для текста — ее обрабатывает сам элемент. */
export function isTextInputTarget(element: Element | null) {
  if (!element) {
    return false;
  }

  const tag = element.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (element as HTMLElement).isContentEditable === true;
}

/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest';
import { buildScreenshotName, extractClipboardFiles, isTextInputTarget } from './clipboardFiles';

const now = new Date(2026, 10, 17, 10, 30, 5);

function transfer(files: File[], items: File[] = []) {
  return {
    files: files as unknown as FileList,
    items: items.map((file) => ({ kind: 'file', getAsFile: () => file })) as unknown as DataTransferItemList
  };
}

describe('файлы из буфера обмена', () => {
  it('скриншоты получают понятные разные имена', () => {
    expect(buildScreenshotName('image/png', now)).toBe('Скриншот 2026-11-17 10-30-05.png');
    expect(buildScreenshotName('image/jpeg', now, 1)).toBe('Скриншот 2026-11-17 10-30-05 (2).jpg');

    const files = extractClipboardFiles(transfer([new File(['a'], 'image.png', { type: 'image/png' }), new File(['b'], 'image.png', { type: 'image/png' })]), now);
    expect(files.map((file) => file.name)).toEqual(['Скриншот 2026-11-17 10-30-05.png', 'Скриншот 2026-11-17 10-30-05 (2).png']);
    expect(files[0].type).toBe('image/png');
  });

  it('файлы со своим именем не переименовываются', () => {
    const files = extractClipboardFiles(transfer([new File(['a'], 'отчет.png', { type: 'image/png' }), new File(['b'], 'image.txt', { type: 'text/plain' })]), now);
    expect(files.map((file) => file.name)).toEqual(['отчет.png', 'image.txt']);
  });

  it('берет файл из items, если files пуст (часть браузеров)', () => {
    const files = extractClipboardFiles(transfer([], [new File(['a'], '', { type: 'image/png' })]), now);
    expect(files.map((file) => file.name)).toEqual(['Скриншот 2026-11-17 10-30-05.png']);
    expect(extractClipboardFiles(null)).toEqual([]);
  });

  it('распознает поля ввода', () => {
    expect(isTextInputTarget(document.createElement('textarea'))).toBe(true);
    expect(isTextInputTarget(document.createElement('input'))).toBe(true);
    expect(isTextInputTarget(document.createElement('div'))).toBe(false);
    expect(isTextInputTarget(null)).toBe(false);
  });
});

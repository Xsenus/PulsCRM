import { describe, expect, it } from 'vitest';
import { getStoredFileDisplayExtension, isImageStoredFile } from './campaignAttachments';
import type { StoredFileDto } from './types';

function storedFile(overrides: Partial<StoredFileDto>): StoredFileDto {
  return {
    id: overrides.id ?? 1,
    originalFileName: overrides.originalFileName ?? 'file.png',
    storedFileName: overrides.storedFileName ?? 'stored.png',
    relativePath: overrides.relativePath ?? 'uploads/file.png',
    contentType: overrides.contentType,
    length: overrides.length ?? 1024,
    isPublic: false,
    uploadedAtUtc: '2026-06-13T00:00:00Z',
    uploadedByLegacyUserId: 1,
    ...overrides
  };
}

describe('campaign attachments', () => {
  it('detects previewable image files by content type', () => {
    expect(isImageStoredFile(storedFile({ contentType: 'image/png' }))).toBe(true);
    expect(isImageStoredFile(storedFile({ contentType: 'IMAGE/JPEG' }))).toBe(true);
    expect(isImageStoredFile(storedFile({ contentType: 'application/pdf' }))).toBe(false);
    expect(isImageStoredFile(storedFile({ contentType: undefined }))).toBe(false);
  });

  it('builds a compact display extension', () => {
    expect(getStoredFileDisplayExtension(storedFile({ originalFileName: 'logo.svg' }))).toBe('SVG');
    expect(getStoredFileDisplayExtension(storedFile({ originalFileName: '', storedFileName: 'banner.webp' }))).toBe('WEBP');
    expect(getStoredFileDisplayExtension(storedFile({ originalFileName: 'README', storedFileName: '' }))).toBe('IMG');
  });
});

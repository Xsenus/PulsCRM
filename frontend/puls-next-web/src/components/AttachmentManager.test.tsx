/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoredFileDto } from '../app/types';
import { AttachmentManager, type EditableAttachment } from './AttachmentManager';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function storedFile(overrides: Partial<StoredFileDto> = {}): StoredFileDto {
  return {
    id: overrides.id ?? 10,
    originalFileName: overrides.originalFileName ?? 'file.png',
    storedFileName: overrides.storedFileName ?? 'stored-file.png',
    relativePath: overrides.relativePath ?? 'uploads/stored-file.png',
    contentType: overrides.contentType ?? 'image/png',
    length: overrides.length ?? 512,
    sha256: overrides.sha256,
    isPublic: overrides.isPublic ?? false,
    uploadedAtUtc: overrides.uploadedAtUtc ?? '2026-06-13T00:00:00Z',
    uploadedByLegacyUserId: overrides.uploadedByLegacyUserId
  };
}

function attachment(file: StoredFileDto, overrides: Partial<EditableAttachment> = {}): EditableAttachment {
  return {
    storedFile: file,
    attachmentKind: overrides.attachmentKind ?? 1,
    displayName: overrides.displayName ?? file.originalFileName,
    contentId: overrides.contentId ?? 'logo',
    sortOrder: overrides.sortOrder ?? 0
  };
}

async function render(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);

  await act(async () => {
    root = createRoot(container!);
    root.render(ui);
  });

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

  return container;
}

beforeEach(() => {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: vi.fn(() => 'blob:preview-logo')
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: vi.fn()
  });
});

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
  }

  root = null;
  container?.remove();
  container = null;

  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: originalCreateObjectURL
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: originalRevokeObjectURL
  });
});

describe('AttachmentManager', () => {
  it('loads authenticated blob preview for image attachments', async () => {
    const imageFile = storedFile({ id: 42, originalFileName: 'logo.png', contentType: 'image/png' });
    const onLoadPreviewFile = vi.fn(async () => new Blob(['image'], { type: 'image/png' }));

    const view = await render(
      <AttachmentManager
        attachments={[attachment(imageFile)]}
        htmlBody='<img src="cid:logo">'
        onChange={vi.fn()}
        onUploadFiles={vi.fn()}
        onLoadPreviewFile={onLoadPreviewFile}
      />
    );

    const img = view.querySelector<HTMLImageElement>('.attachment-image-preview-media img');
    const kindSelect = view.querySelector<HTMLSelectElement>('[aria-label="Тип вложения logo.png"]');

    expect(onLoadPreviewFile).toHaveBeenCalledWith(imageFile);
    expect(kindSelect).toBeInstanceOf(HTMLSelectElement);
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(img?.src).toBe('blob:preview-logo');
    expect(img?.alt).toContain('logo.png');
    expect(view.textContent).toContain('image/png');
  });

  it('does not request previews for non-image attachments', async () => {
    const documentFile = storedFile({
      id: 43,
      originalFileName: 'contract.pdf',
      storedFileName: 'contract.pdf',
      contentType: 'application/pdf'
    });
    const onLoadPreviewFile = vi.fn(async () => new Blob(['pdf'], { type: 'application/pdf' }));

    const view = await render(
      <AttachmentManager
        attachments={[attachment(documentFile, { attachmentKind: 0, contentId: undefined })]}
        htmlBody=""
        onChange={vi.fn()}
        onUploadFiles={vi.fn()}
        onLoadPreviewFile={onLoadPreviewFile}
      />
    );

    expect(onLoadPreviewFile).not.toHaveBeenCalled();
    expect(view.querySelector('.attachment-image-preview')).toBeNull();
  });
});

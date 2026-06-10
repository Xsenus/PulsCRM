import { describe, expect, it } from 'vitest';
import { extractCidReferences, validateMessageContent } from './messageValidation';

describe('message validation', () => {
  it('extracts unique cid references from html', () => {
    expect(extractCidReferences('<img src="cid:logo"><img src="cid:logo"><img src="cid:banner">')).toEqual(['logo', 'banner']);
  });

  it('requires html or plain text body', () => {
    expect(validateMessageContent('', '', [])).toContainEqual({
      key: 'empty-message',
      tone: 'danger',
      message: 'Заполните HTML или текстовую версию письма.'
    });
  });

  it('warns when html has no plain text fallback', () => {
    expect(validateMessageContent('<p>Hello</p>', '', [])).toContainEqual({
      key: 'missing-plain-text',
      tone: 'warning',
      message: 'Добавьте текстовую версию письма для клиентов, которые не показывают HTML.'
    });
  });

  it('detects inline image without content id', () => {
    expect(validateMessageContent('<p>Hello</p>', 'Long enough plain text fallback', [
      { attachmentKind: 1, contentId: '' }
    ])).toContainEqual({
      key: 'inline-missing-cid-0',
      tone: 'danger',
      message: 'У встроенного изображения не заполнен Content-ID.'
    });
  });

  it('detects cid reference without matching inline attachment', () => {
    expect(validateMessageContent('<img src="cid:logo">', 'Long enough plain text fallback', [])).toContainEqual({
      key: 'missing-inline-file-logo',
      tone: 'danger',
      message: 'В HTML используется cid:logo, но такого встроенного изображения нет во вложениях.'
    });
  });

  it('accepts matching inline image cid', () => {
    expect(validateMessageContent('<img src="cid:logo">', 'Long enough plain text fallback', [
      { attachmentKind: 1, contentId: 'logo' }
    ])).toEqual([]);
  });
});

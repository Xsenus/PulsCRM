export interface MessageAttachmentLike {
  attachmentKind: number;
  contentId?: string;
}

export interface MessageValidationIssue {
  key: string;
  tone: 'danger' | 'warning';
  message: string;
}

const INLINE_IMAGE_KIND = 1;
const MIN_PLAIN_TEXT_LENGTH = 20;

export function extractCidReferences(htmlBody?: string | null): string[] {
  const html = htmlBody || '';
  const matches = html.matchAll(/cid:([^"'\s>)]+)/gi);
  return Array.from(new Set(Array.from(matches, (match) => match[1].trim()).filter(Boolean)));
}

export function validateMessageContent(
  htmlBody?: string | null,
  plainTextBody?: string | null,
  attachments: MessageAttachmentLike[] = []
): MessageValidationIssue[] {
  const issues: MessageValidationIssue[] = [];
  const trimmedHtml = (htmlBody || '').trim();
  const trimmedPlainText = (plainTextBody || '').trim();

  if (!trimmedHtml && !trimmedPlainText) {
    issues.push({
      key: 'empty-message',
      tone: 'danger',
      message: 'Заполните HTML или текстовую версию письма.'
    });
    return issues;
  }

  if (trimmedHtml && trimmedPlainText.length > 0 && trimmedPlainText.length < MIN_PLAIN_TEXT_LENGTH) {
    issues.push({
      key: 'short-plain-text',
      tone: 'warning',
      message: 'Текстовая версия выглядит слишком короткой для резервного отображения письма.'
    });
  }

  if (trimmedHtml && !trimmedPlainText) {
    issues.push({
      key: 'missing-plain-text',
      tone: 'warning',
      message: 'Добавьте текстовую версию письма для клиентов, которые не показывают HTML.'
    });
  }

  const inlineAttachments = attachments.filter((attachment) => attachment.attachmentKind === INLINE_IMAGE_KIND);
  const cidReferences = extractCidReferences(trimmedHtml);
  const inlineContentIds = inlineAttachments.map((attachment) => attachment.contentId?.trim()).filter(Boolean) as string[];

  inlineAttachments.forEach((attachment, index) => {
    const contentId = attachment.contentId?.trim();
    if (!contentId) {
      issues.push({
        key: `inline-missing-cid-${index}`,
        tone: 'danger',
        message: 'У встроенного изображения не заполнен Content-ID.'
      });
      return;
    }

    if (trimmedHtml && !cidReferences.includes(contentId)) {
      issues.push({
        key: `inline-unused-cid-${contentId}`,
        tone: 'warning',
        message: `Встроенное изображение cid:${contentId} не найдено в HTML письма.`
      });
    }
  });

  cidReferences
    .filter((cid) => !inlineContentIds.includes(cid))
    .forEach((cid) => {
      issues.push({
        key: `missing-inline-file-${cid}`,
        tone: 'danger',
        message: `В HTML используется cid:${cid}, но такого встроенного изображения нет во вложениях.`
      });
    });

  return issues;
}

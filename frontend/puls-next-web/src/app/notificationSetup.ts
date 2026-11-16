/**
 * Настройка браузера для системных уведомлений, пока CRM открыта по http:// (без сертификата).
 * Сайт не может сам поменять настройки браузера, поэтому даем файл .reg: он записывает политику
 * OverrideSecurityRestrictionsOnInsecureOrigin («считать адрес CRM безопасным») для текущего пользователя
 * Windows в Chrome, Edge и Яндекс.Браузере. Права администратора не нужны; после — перезапустить браузер.
 */
const POLICY_KEYS = [
  'HKEY_CURRENT_USER\\Software\\Policies\\Google\\Chrome\\OverrideSecurityRestrictionsOnInsecureOrigin',
  'HKEY_CURRENT_USER\\Software\\Policies\\Microsoft\\Edge\\OverrideSecurityRestrictionsOnInsecureOrigin',
  'HKEY_CURRENT_USER\\Software\\Policies\\YandexBrowser\\OverrideSecurityRestrictionsOnInsecureOrigin'
];

export type BrowserKind = 'chrome' | 'edge' | 'yandex' | 'other';

export function detectBrowser(userAgent: string): BrowserKind {
  if (/YaBrowser\//.test(userAgent)) {
    return 'yandex';
  }

  if (/Edg\//.test(userAgent)) {
    return 'edge';
  }

  return /Chrome\//.test(userAgent) ? 'chrome' : 'other';
}

/** Адрес страницы флагов браузера с нужной настройкой (открыть можно только вставкой в адресную строку). */
export function getInsecureOriginFlagUrl(browser: BrowserKind) {
  const scheme = browser === 'edge' ? 'edge' : browser === 'yandex' ? 'browser' : 'chrome';
  return `${scheme}://flags/#unsafely-treat-insecure-origin-as-secure`;
}

/** Текст файла .reg (формат редактора реестра Windows 5.00). */
export function buildInsecureOriginRegFile(origin: string) {
  const value = origin.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const sections = POLICY_KEYS.map((key) => `[${key}]\r\n"1"="${value}"\r\n`);
  return `Windows Registry Editor Version 5.00\r\n\r\n${sections.join('\r\n')}`;
}

/** Скачивает файл .reg (UTF-16 LE с BOM — как сохраняет сам редактор реестра). */
export function downloadInsecureOriginRegFile(origin: string) {
  const text = buildInsecureOriginRegFile(origin);
  const bytes = new Uint8Array(2 + text.length * 2);
  bytes[0] = 0xff;
  bytes[1] = 0xfe;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    bytes[2 + index * 2] = code & 0xff;
    bytes[3 + index * 2] = code >> 8;
  }

  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/octet-stream' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'puls-crm-uvedomleniya.reg';
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

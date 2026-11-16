import { describe, expect, it } from 'vitest';
import { buildInsecureOriginRegFile, detectBrowser, getInsecureOriginFlagUrl } from './notificationSetup';

describe('notificationSetup', () => {
  it('builds a registry file that allows the CRM origin in Chrome, Edge and Yandex', () => {
    const text = buildInsecureOriginRegFile('http://192.168.0.16:8080');
    expect(text.startsWith('Windows Registry Editor Version 5.00\r\n')).toBe(true);
    expect(text).toContain('[HKEY_CURRENT_USER\\Software\\Policies\\Google\\Chrome\\OverrideSecurityRestrictionsOnInsecureOrigin]\r\n"1"="http://192.168.0.16:8080"');
    expect(text).toContain('Microsoft\\Edge\\OverrideSecurityRestrictionsOnInsecureOrigin');
    expect(text).toContain('YandexBrowser\\OverrideSecurityRestrictionsOnInsecureOrigin');
    expect(text.split('"1"=').length - 1).toBe(3);
  });

  it('recognizes the browser for the flags page', () => {
    expect(detectBrowser('Mozilla/5.0 Chrome/120.0 Safari/537.36 Edg/120.0')).toBe('edge');
    expect(detectBrowser('Mozilla/5.0 Chrome/120.0 YaBrowser/24.1 Safari/537.36')).toBe('yandex');
    expect(detectBrowser('Mozilla/5.0 Chrome/120.0 Safari/537.36')).toBe('chrome');
    expect(getInsecureOriginFlagUrl('edge')).toBe('edge://flags/#unsafely-treat-insecure-origin-as-secure');
    expect(getInsecureOriginFlagUrl('yandex')).toBe('browser://flags/#unsafely-treat-insecure-origin-as-secure');
    expect(getInsecureOriginFlagUrl('chrome')).toBe('chrome://flags/#unsafely-treat-insecure-origin-as-secure');
  });
});

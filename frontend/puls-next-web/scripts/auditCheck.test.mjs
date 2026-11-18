import { describe, expect, it } from 'vitest';
import { advisoryId, evaluateAudit } from './auditCheck.mjs';

const advisory = (id, severity = 'high') => ({ source: 1, title: id, url: `https://github.com/advisories/${id}`, severity });

const report = {
  vulnerabilities: {
    picomatch: { severity: 'high', via: [advisory('GHSA-fc5q-39xc-vjpf')] },
    tinyglobby: { severity: 'high', via: ['picomatch', 'fdir'] },
    fdir: { severity: 'high', via: ['picomatch'] },
    axios: { severity: 'moderate', via: [advisory('GHSA-aaaa-bbbb-cccc', 'moderate')] },
    tiny: { severity: 'low', via: [advisory('GHSA-low0-low0-low0', 'low')] }
  }
};

describe('проверка npm audit с исключениями', () => {
  it('берет идентификатор предупреждения из ссылки', () => {
    expect(advisoryId({ url: 'https://github.com/advisories/GHSA-fc5q-39xc-vjpf' })).toBe('GHSA-fc5q-39xc-vjpf');
  });

  it('пропускает только перечисленные предупреждения и пакеты, зависящие только от них', () => {
    const result = evaluateAudit(report, [{ id: 'GHSA-fc5q-39xc-vjpf', until: '2026-12-31' }], '2026-11-18');
    expect(result.allowed.map((item) => item.name).sort()).toEqual(['fdir', 'picomatch', 'tinyglobby']);
    // Другая уязвимость по-прежнему останавливает проверку; low — ниже порога.
    expect(result.blocking.map((item) => item.name)).toEqual(['axios']);
    expect(result.ok).toBe(false);
  });

  it('без других уязвимостей проверка проходит', () => {
    const { axios: _axios, ...rest } = report.vulnerabilities;
    expect(evaluateAudit({ vulnerabilities: rest }, [{ id: 'GHSA-fc5q-39xc-vjpf', until: '2026-12-31' }], '2026-11-18').ok).toBe(true);
  });

  it('просроченное исключение не действует и останавливает проверку', () => {
    const { axios: _axios, ...rest } = report.vulnerabilities;
    const result = evaluateAudit({ vulnerabilities: rest }, [{ id: 'GHSA-fc5q-39xc-vjpf', until: '2026-11-01' }], '2026-11-18');
    expect(result.expired).toHaveLength(1);
    expect(result.blocking.map((item) => item.name).sort()).toEqual(['fdir', 'picomatch', 'tinyglobby']);
    expect(result.ok).toBe(false);
  });
});

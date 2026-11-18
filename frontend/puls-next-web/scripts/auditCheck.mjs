/**
 * Проверка зависимостей поверх `npm audit --json`: уязвимости уровня moderate и выше останавливают CI и деплой,
 * кроме предупреждений из списка исключений (audit-allowlist.json) — только до указанной в нем даты.
 *
 * Исключение — временная мера для предупреждений, у которых еще нет исправленной версии, и только для
 * пакетов, не попадающих в код для браузера (инструменты сборки и тестов).
 */

const LEVELS = { info: 0, low: 1, moderate: 2, high: 3, critical: 4 };

/** «https://github.com/advisories/GHSA-xxxx» → «GHSA-xxxx». */
export function advisoryId(advisory) {
  const match = /GHSA-[\w-]+/i.exec(advisory?.url ?? '');
  return match ? match[0] : String(advisory?.source ?? advisory?.title ?? 'unknown');
}

/** Исходные предупреждения уязвимого пакета: через цепочку зависимостей (`via` со строками) до самих advisory. */
export function rootAdvisories(name, vulnerabilities, seen = new Set()) {
  if (seen.has(name)) {
    return [];
  }

  seen.add(name);
  const entry = vulnerabilities[name];
  if (!entry) {
    return [];
  }

  return entry.via.flatMap((item) => (typeof item === 'string' ? rootAdvisories(item, vulnerabilities, seen) : [item]));
}

/**
 * Итог проверки: какие уязвимости останавливают проверку (blocking), какие пропущены по исключению (allowed),
 * и какие исключения просрочены (expired). today — 'YYYY-MM-DD'.
 */
export function evaluateAudit(report, allowlist, today, minLevel = 'moderate') {
  const vulnerabilities = report?.vulnerabilities ?? {};
  const active = new Map();
  const expired = [];
  for (const item of allowlist ?? []) {
    if (item.until && item.until < today) {
      expired.push(item);
    } else {
      active.set(item.id.toUpperCase(), item);
    }
  }

  const blocking = [];
  const allowed = [];
  for (const [name, entry] of Object.entries(vulnerabilities)) {
    if ((LEVELS[entry.severity] ?? 0) < LEVELS[minLevel]) {
      continue;
    }

    const roots = rootAdvisories(name, vulnerabilities);
    const ids = [...new Set(roots.map(advisoryId))];
    const covered = ids.length > 0 && ids.every((id) => active.has(id.toUpperCase()));
    (covered ? allowed : blocking).push({ name, severity: entry.severity, advisories: ids });
  }

  return { blocking, allowed, expired, ok: blocking.length === 0 && expired.length === 0 };
}

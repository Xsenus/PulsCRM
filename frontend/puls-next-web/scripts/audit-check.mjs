#!/usr/bin/env node
/**
 * `npm run audit:check` — npm audit с учетом audit-allowlist.json (см. scripts/auditCheck.mjs).
 * Код выхода 1, если есть уязвимости moderate+ вне списка исключений или исключение просрочено.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateAudit } from './auditCheck.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const allowlist = JSON.parse(readFileSync(join(root, 'audit-allowlist.json'), 'utf8')).advisories ?? [];

let output;
try {
  output = execFileSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['audit', '--json'], { cwd: root, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 64 * 1024 * 1024 });
} catch (error) {
  // npm audit возвращает код 1, когда уязвимости есть, — отчет все равно в stdout.
  output = error.stdout;
}

const report = JSON.parse(output);
if (report.error) {
  console.error(`npm audit не выполнен: ${report.error.summary ?? JSON.stringify(report.error)}`);
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);
const result = evaluateAudit(report, allowlist, today);

for (const item of result.allowed) {
  console.log(`Пропущено по исключению: ${item.name} (${item.severity}) — ${item.advisories.join(', ')}`);
}

for (const item of result.expired) {
  console.error(`Исключение ${item.id} просрочено (до ${item.until}): проверьте, вышло ли исправление, и обновите пакет или audit-allowlist.json.`);
}

for (const item of result.blocking) {
  console.error(`Уязвимость: ${item.name} (${item.severity}) — ${item.advisories.join(', ')}`);
}

if (!result.ok) {
  console.error('Проверка зависимостей не пройдена. Подробности: npm audit');
  process.exit(1);
}

console.log(result.allowed.length > 0 ? 'Других уязвимостей уровня moderate и выше нет.' : 'Уязвимостей уровня moderate и выше нет.');

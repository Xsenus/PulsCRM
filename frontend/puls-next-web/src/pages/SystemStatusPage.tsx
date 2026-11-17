import React, { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../app/apiErrors';
import { downloadLogFile, formatBytes, formatUptime, getSystemStatus, type CheckStatus, type SystemCheckDto, type SystemStatusDto } from '../app/systemStatus';
import { showToast } from '../app/toast';
import { ActionIcon } from '../components/ActionIcon';
import { AppLoader } from '../components/AppLoader';
import { PageHeader } from '../components/PageHeader';
import { StatsCards } from '../components/StatsCards';

const SUMMARY: Record<CheckStatus, { title: string; icon: string }> = {
  ok: { title: 'Все работает', icon: '✓' },
  warn: { title: 'Нужно внимание', icon: '!' },
  error: { title: 'Есть неисправности', icon: '✕' }
};

const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: 'В порядке',
  warn: 'Внимание',
  error: 'Ошибка'
};

function formatTime(utc: string) {
  return new Date(utc).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function plural(count: number, one: string, few: string, many: string) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return one;
  }

  return mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20) ? few : many;
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Команда скопирована.', 'success', 1500);
  } catch {
    showToast('Не удалось скопировать — выделите текст вручную.', 'error');
  }
}

/** Замечание: что не так, что сделать и готовая команда. */
function IssueCard({ check }: { check: SystemCheckDto }) {
  return (
    <li className={`sys-issue ${check.status}`}>
      <div className="sys-issue-head">
        <span className="sys-issue-icon" aria-hidden="true">{check.status === 'error' ? '✕' : '!'}</span>
        <span className="sys-issue-name">{check.name}</span>
        <span className={`sys-pill ${check.status}`}>{STATUS_TEXT[check.status]}</span>
      </div>
      <p className="sys-issue-detail">{check.detail}</p>
      {check.hint ? <p className="sys-issue-hint">{check.hint}</p> : null}
      {check.command ? (
        <div className="sys-command">
          <code>{check.command}</code>
          <button type="button" className="sys-command-copy" onClick={() => void copyText(check.command!)}>Копировать</button>
        </div>
      ) : null}
    </li>
  );
}

/** Страница администратора: сводка, замечания с действиями, проверки, очередь рассылок, файлы и журнал. */
export function SystemStatusPage() {
  const [status, setStatus] = useState<SystemStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openProblem, setOpenProblem] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getSystemStatus());
      setError(null);
    } catch (loadError) {
      setError(getApiErrorMessage(loadError, 'Не удалось получить состояние системы.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const download = async (fileName: string) => {
    try {
      await downloadLogFile(fileName);
    } catch (downloadError) {
      showToast(getApiErrorMessage(downloadError, 'Не удалось скачать журнал.'), 'error');
    }
  };

  const issues = status?.checks.filter((check) => check.status !== 'ok') ?? [];
  const passed = status?.checks.filter((check) => check.status === 'ok') ?? [];
  const summary = status ? SUMMARY[status.overall] : null;

  return (
    <div className="page system-status">
      <PageHeader
        title="Состояние системы"
        subtitle={status ? `Сервер ${status.machineName} · версия ${status.version} · работает ${formatUptime(status.startedAtUtc)}` : undefined}
        actions={(
          <button type="button" className="secondary-button button-inline sys-refresh" onClick={() => void load()} disabled={loading}>
            <ActionIcon kind="refresh" />
            <span>{loading && status ? 'Проверяем…' : 'Проверить снова'}</span>
          </button>
        )}
      />

      {loading && !status ? <section className="panel"><AppLoader variant="panel" label="Проверяем систему" description="Базы, диск, файлы и журнал." /></section> : null}
      {error ? <div className="panel empty-state">{error}</div> : null}

      {status && summary ? (
        <>
          <section className={`sys-summary ${status.overall}`} role="status" aria-label="Итог проверки">
            <span className="sys-summary-icon" aria-hidden="true">{summary.icon}</span>
            <div className="sys-summary-text">
              <strong>{summary.title}</strong>
              <span>
                {passed.length} {plural(passed.length, 'проверка', 'проверки', 'проверок')} в порядке
                {issues.length > 0 ? ` · ${issues.length} ${plural(issues.length, 'требует', 'требуют', 'требуют')} внимания` : ''}
              </span>
            </div>
            <span className="sys-summary-time">Проверено {formatTime(status.checkedAtUtc)}</span>
          </section>

          {issues.length > 0 ? (
            <section className="sys-section" aria-labelledby="sys-issues-title">
              <h2 className="sys-section-title" id="sys-issues-title">Требует внимания</h2>
              <ul className="sys-issues">
                {issues.map((check) => <IssueCard key={check.name} check={check} />)}
              </ul>
            </section>
          ) : null}

          <section className="sys-section" aria-labelledby="sys-checks-title">
            <h2 className="sys-section-title" id="sys-checks-title">В порядке <span className="sys-count">{passed.length}</span></h2>
            <ul className="sys-checks">
              {passed.map((check) => (
                <li key={check.name} className="sys-check">
                  <span className="sys-check-icon" aria-hidden="true">✓</span>
                  <span className="sys-check-text">
                    <span className="sys-check-name">{check.name}</span>
                    <span className="sys-check-detail" title={check.detail}>{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="sys-section" aria-labelledby="sys-metrics-title">
            <h2 className="sys-section-title" id="sys-metrics-title">Рассылки и уведомления</h2>
            <StatsCards
              items={[
                { label: 'Очередь рассылок', value: status.queueDepth, hint: 'В очереди, в обработке и отложено' },
                { label: 'Отправлено за 24 ч', value: status.sentLast24Hours },
                { label: 'Ошибок рассылки за 24 ч', value: status.failedLast24Hours },
                ...(status.pushSubscriptions !== null && status.pushSubscriptions !== undefined
                  ? [{ label: 'Подписок на уведомления', value: status.pushSubscriptions, hint: 'Браузеры с Web Push' }]
                  : [])
              ]}
            />
          </section>

          <section className="panel sys-panel" aria-labelledby="sys-storage-title">
            <div className="sys-panel-head">
              <h2 className="sys-section-title" id="sys-storage-title">Файлы на сервере</h2>
              {status.diskFreeBytes ? (
                <span className="sys-disk">
                  Свободно {formatBytes(status.diskFreeBytes)}{status.diskTotalBytes ? ` из ${formatBytes(status.diskTotalBytes)}` : ''}
                  {status.diskTotalBytes ? (
                    <span className="sys-disk-bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(100, Math.round((1 - status.diskFreeBytes / status.diskTotalBytes) * 100))}%` }} />
                    </span>
                  ) : null}
                </span>
              ) : null}
            </div>
            <ul className="sys-storage">
              {status.storage.map((item) => (
                <li key={item.name} className="sys-storage-row">
                  <span className="sys-storage-name">{item.name}</span>
                  <span className="sys-storage-size">{formatBytes(item.bytes)}</span>
                  <span className="sys-storage-files">{item.files.toLocaleString('ru-RU')} {plural(item.files, 'файл', 'файла', 'файлов')}</span>
                  <code className="sys-storage-path" title={item.path}>{item.path}</code>
                </li>
              ))}
            </ul>
          </section>

          <section className="panel sys-panel" aria-labelledby="sys-problems-title">
            <h2 className="sys-section-title" id="sys-problems-title">Последние предупреждения и ошибки</h2>
            {status.recentProblems.length === 0 ? <div className="sys-empty">С момента запуска API замечаний нет.</div> : null}
            <ul className="sys-problems">
              {status.recentProblems.map((entry, index) => {
                const tone = entry.level === 'Warning' ? 'warn' : 'error';
                const open = openProblem === index;
                return (
                  <li key={`${entry.timestampUtc}-${index}`} className={`sys-problem ${tone}${open ? ' open' : ''}`}>
                    <button type="button" className="sys-problem-head" onClick={() => setOpenProblem(open ? null : index)} aria-expanded={open}>
                      <span className={`sys-pill ${tone}`}>{tone === 'warn' ? 'Предупреждение' : 'Ошибка'}</span>
                      <span className="sys-problem-time">{formatTime(entry.timestampUtc)}</span>
                      <span className="sys-problem-message">{entry.message}</span>
                      <span className="sys-problem-chevron" aria-hidden="true">{open ? '▴' : '▾'}</span>
                    </button>
                    {open ? <pre className="sys-problem-details">{entry.category}{entry.exception ? `\n\n${entry.exception}` : ''}</pre> : null}
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="panel sys-panel" aria-labelledby="sys-logs-title">
            <h2 className="sys-section-title" id="sys-logs-title">Журнал API</h2>
            <p className="sys-muted">Файл на каждый день, хранятся 30 дней. Каталог: <code>{status.logDirectory}</code></p>
            {status.logFiles.length === 0 ? <div className="sys-empty">Файлов журнала пока нет.</div> : null}
            <div className="sys-log-files">
              {status.logFiles.map((file) => (
                <button key={file} type="button" className="sys-log-file" onClick={() => void download(file)} aria-label={`Скачать ${file}`}>
                  <span aria-hidden="true">⤓</span> {file}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

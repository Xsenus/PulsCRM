import React, { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage } from '../app/apiErrors';
import { downloadLogFile, formatBytes, formatUptime, getSystemStatus, type CheckStatus, type SystemStatusDto } from '../app/systemStatus';
import { showToast } from '../app/toast';
import { ActionIcon } from '../components/ActionIcon';
import { AppLoader } from '../components/AppLoader';
import { PageHeader } from '../components/PageHeader';
import { StatsCards } from '../components/StatsCards';

const OVERALL_TEXT: Record<CheckStatus, string> = {
  ok: 'Все работает',
  warn: 'Есть замечания',
  error: 'Есть неисправности'
};

const STATUS_TEXT: Record<CheckStatus, string> = {
  ok: 'В порядке',
  warn: 'Внимание',
  error: 'Ошибка'
};

function formatTime(utc: string) {
  return new Date(utc).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Страница администратора: состояние баз, диска, файлов, очереди рассылок и последние ошибки журнала. */
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

  return (
    <div className="page system-status">
      <PageHeader
        title="Состояние системы"
        subtitle={status ? `Версия ${status.version} · сервер ${status.machineName} · работает ${formatUptime(status.startedAtUtc)}` : undefined}
        actions={(
          <button type="button" className="secondary-button button-inline icon-button search-button" onClick={() => void load()} aria-label="Обновить состояние" title="Обновить состояние" disabled={loading}>
            <ActionIcon kind="refresh" />
          </button>
        )}
      />

      {loading && !status ? <section className="panel"><AppLoader variant="panel" label="Проверяем систему" description="Базы, диск, файлы и журнал." /></section> : null}
      {error ? <div className="panel empty-state">{error}</div> : null}

      {status ? (
        <>
          <div className={`status-overall ${status.overall}`} role="status">
            <span className="status-dot" aria-hidden="true" />
            <strong>{OVERALL_TEXT[status.overall]}</strong>
            <span className="status-overall-time">проверено {formatTime(status.checkedAtUtc)}</span>
          </div>

          <section className="panel" aria-labelledby="status-checks-title">
            <h3 id="status-checks-title">Проверки</h3>
            <ul className="status-checks">
              {status.checks.map((check) => (
                <li key={check.name} className={`status-check ${check.status}`}>
                  <span className="status-dot" aria-hidden="true" />
                  <div className="status-check-text">
                    <div className="status-check-name">{check.name}</div>
                    <div className="status-check-detail">{check.detail}</div>
                  </div>
                  <span className={`status-badge-pill ${check.status}`}>{STATUS_TEXT[check.status]}</span>
                </li>
              ))}
            </ul>
          </section>

          <StatsCards
            items={[
              { label: 'Очередь рассылок', value: status.queueDepth, hint: 'В очереди / в обработке / отложено' },
              { label: 'Отправлено за 24ч', value: status.sentLast24Hours },
              { label: 'Ошибок рассылки за 24ч', value: status.failedLast24Hours },
              ...(status.pushSubscriptions !== null && status.pushSubscriptions !== undefined
                ? [{ label: 'Подписок на уведомления', value: status.pushSubscriptions, hint: 'Браузеры с Web Push' }]
                : []),
              ...(status.diskFreeBytes ? [{ label: 'Свободно на диске', value: formatBytes(status.diskFreeBytes), hint: status.diskTotalBytes ? `из ${formatBytes(status.diskTotalBytes)}` : undefined }] : [])
            ]}
          />

          <section className="panel" aria-labelledby="status-storage-title">
            <h3 id="status-storage-title">Файлы на сервере</h3>
            <table className="status-table">
              <thead>
                <tr><th>Что</th><th>Размер</th><th>Файлов</th><th>Каталог</th></tr>
              </thead>
              <tbody>
                {status.storage.map((item) => (
                  <tr key={item.name}>
                    <td>{item.name}</td>
                    <td>{formatBytes(item.bytes)}</td>
                    <td>{item.files.toLocaleString('ru-RU')}</td>
                    <td className="status-path">{item.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="panel" aria-labelledby="status-problems-title">
            <h3 id="status-problems-title">Последние предупреждения и ошибки</h3>
            {status.recentProblems.length === 0 ? <div className="empty-state">С момента запуска API замечаний нет.</div> : null}
            <ul className="status-problems">
              {status.recentProblems.map((entry, index) => (
                <li key={`${entry.timestampUtc}-${index}`} className={`status-problem ${entry.level === 'Warning' ? 'warn' : 'error'}`}>
                  <button type="button" className="status-problem-head" onClick={() => setOpenProblem(openProblem === index ? null : index)} aria-expanded={openProblem === index}>
                    <span className="status-problem-time">{formatTime(entry.timestampUtc)}</span>
                    <span className={`status-badge-pill ${entry.level === 'Warning' ? 'warn' : 'error'}`}>{entry.level === 'Warning' ? 'Предупреждение' : 'Ошибка'}</span>
                    <span className="status-problem-message">{entry.message}</span>
                  </button>
                  {openProblem === index ? (
                    <pre className="status-problem-details">{entry.category}{entry.exception ? `\n\n${entry.exception}` : ''}</pre>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>

          <section className="panel" aria-labelledby="status-logs-title">
            <h3 id="status-logs-title">Журнал API</h3>
            <p className="status-muted">Файлы за 30 дней в каталоге <code>{status.logDirectory}</code>.</p>
            {status.logFiles.length === 0 ? <div className="empty-state">Файлов журнала пока нет.</div> : null}
            <div className="status-log-files">
              {status.logFiles.map((file) => (
                <button key={file} type="button" className="secondary-button button-inline" onClick={() => void download(file)}>
                  ⬇ {file}
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}

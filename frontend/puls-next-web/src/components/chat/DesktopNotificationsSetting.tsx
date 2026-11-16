import React, { useState } from 'react';
import { useAuth } from '../../app/AuthContext';
import { isAdmin } from '../../app/access';
import { getDesktopNotificationStatus, requestDesktopNotificationPermission, type DesktopNotificationStatus } from '../../app/desktopNotifications';
import { detectBrowser, downloadInsecureOriginRegFile, getInsecureOriginFlagUrl } from '../../app/notificationSetup';
import { showToast } from '../../app/toast';

const STATUS: Record<DesktopNotificationStatus, { label: string; tone: 'ok' | 'neutral' | 'warn' }> = {
  granted: { label: 'Разрешено', tone: 'ok' },
  default: { label: 'Нужно разрешение', tone: 'neutral' },
  denied: { label: 'Запрещено в браузере', tone: 'warn' },
  insecure: { label: 'Нужна настройка', tone: 'warn' },
  unsupported: { label: 'Не поддерживается', tone: 'warn' }
};

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Скопировано.', 'success', 1500);
  } catch {
    showToast('Не удалось скопировать — выделите текст вручную.', 'error');
  }
}

function CopyRow({ value }: { value: string }) {
  return (
    <div className="notify-copy-row">
      <code>{value}</code>
      <button type="button" className="notify-chip-button" onClick={() => void copyText(value)}>Копировать</button>
    </div>
  );
}

/**
 * Пока CRM открыта без HTTPS: сайт не может сам поменять настройки браузера. Главный путь — скачать файл
 * настройки и открыть его (два клика), запасной — две строки на странице флагов браузера.
 */
function InsecureOriginSetup() {
  const { user } = useAuth();
  const origin = window.location.origin;
  const browser = detectBrowser(navigator.userAgent);
  const [manual, setManual] = useState(false);

  return (
    <div className="notify-setup">
      <div className="notify-setup-title">Включите уведомления за минуту</div>
      <p className="notify-setup-text">CRM пока открыта без защищенного адреса (HTTPS), поэтому браузер ждет вашего разрешения на этом компьютере.</p>

      <ol className="notify-steps">
        <li>
          <span className="notify-step-number">1</span>
          <div>
            <button type="button" className="primary-button button-inline notify-download" onClick={() => downloadInsecureOriginRegFile(origin)}>
              Скачать настройку для Windows
            </button>
          </div>
        </li>
        <li>
          <span className="notify-step-number">2</span>
          <div>Откройте скачанный файл и нажмите «Да» — права администратора не нужны.</div>
        </li>
        <li>
          <span className="notify-step-number">3</span>
          <div>Закройте браузер полностью, откройте CRM снова и включите эту галочку.</div>
        </li>
      </ol>

      <button type="button" className="notify-link-button" aria-expanded={manual} onClick={() => setManual((value) => !value)}>
        {manual ? 'Скрыть' : 'Не получилось? Настроить вручную в браузере'}
      </button>
      {manual ? (
        <div className="notify-manual">
          <div className="notify-manual-step">Вставьте в адресную строку новой вкладки:</div>
          <CopyRow value={getInsecureOriginFlagUrl(browser)} />
          <div className="notify-manual-step">Впишите в поле адрес CRM, выберите <b>Enabled</b> и нажмите <b>Relaunch</b>:</div>
          <CopyRow value={origin} />
        </div>
      ) : null}

      {isAdmin(user) ? (
        <div className="notify-admin-note">
          Для администратора: эту же настройку можно включить сразу на всех компьютерах групповой политикой
          (OverrideSecurityRestrictionsOnInsecureOrigin) — см. docs/chat.md. С HTTPS-адресом настройка не нужна.
        </div>
      ) : null}
    </div>
  );
}

/** Переключатель «Системные уведомления Windows» с понятным статусом и помощью, если браузер их не дает. */
export function DesktopNotificationsSetting({ enabled, disabled, onChange }: { enabled: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  const [status, setStatus] = useState<DesktopNotificationStatus>(getDesktopNotificationStatus);
  const unavailable = status === 'insecure' || status === 'unsupported';
  const meta = STATUS[status];

  return (
    <div className={`notify-card${unavailable ? ' attention' : ''}`}>
      <label className="chat-toggle notify-card-head">
        <input
          type="checkbox"
          checked={enabled && !unavailable}
          disabled={disabled || unavailable}
          onChange={async (event) => {
            const value = event.target.checked;
            if (value && status !== 'granted') {
              const result = await requestDesktopNotificationPermission();
              setStatus(result);
              onChange(result === 'granted');
              return;
            }

            onChange(value);
          }}
        />
        <span className="notify-card-title">
          <span>Системные уведомления Windows</span>
          <span className="notify-card-hint">Приходят, даже когда вкладка CRM свернута или закрыта</span>
        </span>
        <span className={`notify-status ${meta.tone}`}>{meta.label}</span>
      </label>

      {status === 'insecure' ? <InsecureOriginSetup /> : null}
      {status === 'denied' ? (
        <p className="notify-setup-text">Нажмите на значок замка слева от адреса сайта → «Уведомления» → «Разрешить», затем обновите страницу.</p>
      ) : null}
      {status === 'unsupported' ? <p className="notify-setup-text">Этот браузер не поддерживает уведомления — используйте Chrome, Edge или Яндекс.Браузер.</p> : null}
    </div>
  );
}

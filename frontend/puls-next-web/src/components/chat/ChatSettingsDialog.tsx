import React, { useEffect, useId, useState } from 'react';
import { useAuth } from '../../app/AuthContext';
import { useChat } from '../../app/ChatContext';
import { isAdmin } from '../../app/access';
import { getApiErrorMessage } from '../../app/apiErrors';
import type { ChatSoundName, ChatUserSettingsDto } from '../../app/chatTypes';
import { CHAT_SOUNDS, playChatSound } from '../../app/chatSounds';
import { getDesktopNotificationStatus, requestDesktopNotificationPermission, type DesktopNotificationStatus } from '../../app/desktopNotifications';
import { detectBrowser, downloadInsecureOriginRegFile, getInsecureOriginFlagUrl } from '../../app/notificationSetup';
import { showToast } from '../../app/toast';
import { Modal } from '../Modal';

/** Переключатель (role="switch"): для настроек, которые включаются и выключаются. */
export function Switch({ checked, disabled, onChange, labelledBy, describedBy }: {
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
  labelledBy: string;
  describedBy?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      disabled={disabled}
      className={`ui-switch${checked ? ' on' : ''}`}
      onClick={() => onChange(!checked)}
    >
      <span className="ui-switch-thumb" aria-hidden="true" />
    </button>
  );
}

/** Строка настройки: иконка, название, пояснение и элемент управления справа. */
function SettingRow({ icon, title, badge, hint, control, disabled, children }: {
  icon: string;
  title: string;
  badge?: React.ReactNode;
  hint?: string;
  control: (ids: { labelId: string; hintId?: string }) => React.ReactNode;
  disabled?: boolean;
  children?: React.ReactNode;
}) {
  const labelId = useId();
  const hintId = useId();
  return (
    <div className={`settings-row${disabled ? ' disabled' : ''}`}>
      <div className="settings-row-main">
        <span className="settings-row-icon" aria-hidden="true">{icon}</span>
        <span className="settings-row-text">
          <span className="settings-row-title-line">
            <span className="settings-row-title" id={labelId}>{title}</span>
            {badge}
          </span>
          {hint ? <span className="settings-row-hint" id={hintId}>{hint}</span> : null}
        </span>
        <span className="settings-row-control">{control({ labelId, hintId: hint ? hintId : undefined })}</span>
      </div>
      {children}
    </div>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast('Скопировано.', 'success', 1500);
  } catch {
    showToast('Не удалось скопировать — выделите текст вручную.', 'error');
  }
}

function CopyField({ value, label, code }: { value: string; label: string; code?: boolean }) {
  return (
    <div className={`settings-copy${code ? ' settings-copy-code' : ''}`}>
      <code>{value}</code>
      <button type="button" className="settings-copy-button" onClick={() => void copyText(value)} aria-label={`Копировать: ${label}`}>Копировать</button>
    </div>
  );
}

/** Команды для администратора: та же настройка для всех пользователей компьютера (политика браузеров). */
function buildPolicyCommands(origin: string) {
  return ['Google\\Chrome', 'Microsoft\\Edge', 'YandexBrowser']
    .map((key) => `reg add "HKLM\\SOFTWARE\\Policies\\${key}\\OverrideSecurityRestrictionsOnInsecureOrigin" /v 1 /t REG_SZ /d "${origin}" /f`)
    .join('\n');
}

/**
 * CRM открыта без HTTPS: сайт не может сам изменить настройку браузера. Один понятный путь — скачать файл и
 * открыть его; запасной путь (страница флагов) и способ для администратора — свернуты.
 */
function BrowserSetup() {
  const { user } = useAuth();
  const origin = window.location.origin;
  const browser = detectBrowser(navigator.userAgent);
  const [downloaded, setDownloaded] = useState(false);

  return (
    <div className="settings-setup" role="region" aria-label="Настройка браузера">
      <div className="settings-setup-title">Разрешите уведомления на этом компьютере</div>
      <p className="settings-setup-text">Это нужно сделать один раз: пока CRM работает без защищенного адреса, браузер ждет вашего разрешения.</p>

      <ol className="settings-steps">
        <li className={downloaded ? 'done' : 'current'}>
          <span className="settings-step-mark" aria-hidden="true">{downloaded ? '✓' : '1'}</span>
          <span className="settings-step-body">
            <button
              type="button"
              className={downloaded ? 'secondary-button button-inline' : 'primary-button button-inline'}
              onClick={() => {
                downloadInsecureOriginRegFile(origin);
                setDownloaded(true);
              }}
            >
              {downloaded ? 'Скачать еще раз' : 'Скачать файл настройки'}
            </button>
          </span>
        </li>
        <li className={downloaded ? 'current' : ''}>
          <span className="settings-step-mark" aria-hidden="true">2</span>
          <span className="settings-step-body">Откройте скачанный файл и нажмите «Да». Права администратора не нужны.</span>
        </li>
        <li>
          <span className="settings-step-mark" aria-hidden="true">3</span>
          <span className="settings-step-body">Закройте браузер полностью и откройте CRM снова — переключатель станет доступен.</span>
        </li>
      </ol>

      <details className="settings-more">
        <summary>Другой способ — через настройки браузера</summary>
        <div className="settings-more-body">
          <p>Откройте в новой вкладке:</p>
          <CopyField value={getInsecureOriginFlagUrl(browser)} label="адрес настройки браузера" />
          <p>Впишите в поле адрес CRM, выберите <b>Enabled</b> и нажмите <b>Relaunch</b>:</p>
          <CopyField value={origin} label="адрес CRM" />
        </div>
      </details>

      {isAdmin(user) ? (
        <details className="settings-more settings-admin">
          <summary>Для администратора: включить на всех компьютерах</summary>
          <div className="settings-more-body">
            <p>Выполните на компьютере от имени администратора (или раздайте групповой политикой) — настройка включится для всех пользователей. С адресом HTTPS она не нужна.</p>
            <CopyField value={buildPolicyCommands(origin)} label="команды для администратора" code />
          </div>
        </details>
      ) : null}
    </div>
  );
}

const DESKTOP_STATUS: Record<DesktopNotificationStatus, { label: string; tone: 'ok' | 'neutral' | 'warn' } | null> = {
  granted: null,
  default: null,
  denied: { label: 'Запрещено', tone: 'warn' },
  insecure: { label: 'Нужна настройка', tone: 'warn' },
  unsupported: { label: 'Недоступно', tone: 'neutral' }
};

function DesktopNotificationsRow({ enabled, disabled, status, onStatus, onChange }: {
  enabled: boolean;
  disabled: boolean;
  status: DesktopNotificationStatus;
  onStatus: (status: DesktopNotificationStatus) => void;
  onChange: (value: boolean) => void;
}) {
  const unavailable = status === 'insecure' || status === 'unsupported';
  const badge = DESKTOP_STATUS[status];

  return (
    <SettingRow
      icon="🖥️"
      title="Уведомления Windows"
      hint="Приходят, даже когда CRM свернута или закрыта"
      badge={badge ? <span className={`settings-badge ${badge.tone}`}>{badge.label}</span> : undefined}
      disabled={disabled}
      control={({ labelId, hintId }) => (
        <>
          <Switch
            checked={enabled && !unavailable}
            disabled={disabled || unavailable}
            labelledBy={labelId}
            describedBy={hintId}
            onChange={async (value) => {
              if (value && status !== 'granted') {
                const result = await requestDesktopNotificationPermission();
                onStatus(result);
                onChange(result === 'granted');
                return;
              }

              onChange(value);
            }}
          />
        </>
      )}
    />
  );
}

/** Правая колонка: помощь, если браузер не дает уведомления Windows (без HTTPS, запрещены, не поддерживаются). */
function DesktopHelp({ status }: { status: DesktopNotificationStatus }) {
  if (status === 'insecure') {
    return <BrowserSetup />;
  }

  if (status === 'denied' || status === 'unsupported') {
    return (
      <div className="settings-setup" role="region" aria-label="Настройка браузера">
        <div className="settings-setup-title">{status === 'denied' ? 'Уведомления запрещены в браузере' : 'Браузер не умеет показывать уведомления'}</div>
        <p className="settings-setup-text">
          {status === 'denied'
            ? 'Нажмите на значок слева от адреса сайта → «Уведомления» → «Разрешить» и обновите страницу.'
            : 'Откройте CRM в Chrome, Edge или Яндекс.Браузере.'}
        </p>
      </div>
    );
  }

  return null;
}

/** Пример оповещения с текущими настройками: как его увидят на экране. */
function NotificationPreview({ draft }: { draft: ChatUserSettingsDto }) {
  return (
    <section className="settings-preview" aria-label="Пример оповещения">
      <div className="settings-preview-title">Так будет выглядеть оповещение</div>
      {draft.notificationsEnabled ? (
        <div className="settings-preview-toast">
          <span className="settings-preview-avatar" aria-hidden="true">АП</span>
          <span className="settings-preview-text">
            <span className="settings-preview-name">Петрова Анна</span>
            <span className="settings-preview-message">{draft.showMessagePreview ? 'Добрый день! Посмотрите, пожалуйста, отчет по лицензиям.' : 'Новое сообщение'}</span>
          </span>
          <span className="settings-preview-time">сейчас</span>
        </div>
      ) : (
        <div className="settings-preview-off">Оповещения выключены — новые сообщения будут видны только в чате.</div>
      )}
      <div className="settings-preview-meta">
        <span>{draft.soundEnabled ? `🔊 ${CHAT_SOUNDS.find((sound) => sound.name === draft.soundName)?.label ?? 'Звук'}, ${draft.soundVolume}%` : '🔇 Без звука'}</span>
        {draft.soundEnabled ? (
          <button type="button" className="settings-preview-play" onClick={() => void playChatSound(draft.soundName, draft.soundVolume)}>▶ Прослушать</button>
        ) : null}
      </div>
    </section>
  );
}

function sameSettings(left: ChatUserSettingsDto, right: ChatUserSettingsDto) {
  return left.notificationsEnabled === right.notificationsEnabled
    && left.showMessagePreview === right.showMessagePreview
    && !!left.desktopNotificationsEnabled === !!right.desktopNotificationsEnabled
    && left.soundEnabled === right.soundEnabled
    && left.soundName === right.soundName
    && left.soundVolume === right.soundVolume;
}

/** Настройки уведомлений чата: оповещения, уведомления Windows и звук. */
export function ChatSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, saveSettings } = useChat();
  const [draft, setDraft] = useState<ChatUserSettingsDto>(settings);
  const [saving, setSaving] = useState(false);
  const [desktopStatus, setDesktopStatus] = useState<DesktopNotificationStatus>(getDesktopNotificationStatus);
  const volumeId = useId();

  useEffect(() => {
    if (open) {
      setDraft(settings);
    }
  }, [open, settings]);

  const update = (patch: Partial<ChatUserSettingsDto>) => setDraft((current) => ({ ...current, ...patch }));
  const changed = !sameSettings(draft, settings);

  const save = async () => {
    setSaving(true);
    try {
      await saveSettings(draft);
      showToast('Настройки уведомлений сохранены.', 'success');
      onClose();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось сохранить настройки.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Уведомления"
      onClose={onClose}
      maxWidth={920}
      actions={(
        <div className="button-group">
          <button type="button" className="secondary-button button-inline" onClick={onClose}>Отмена</button>
          <button type="button" className="primary-button button-inline" disabled={saving || !changed} onClick={() => void save()}>
            {saving ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </div>
      )}
    >
      <div className="settings">
        <div className="settings-main">
        <section className="settings-group" aria-labelledby="settings-alerts-title">
          <h3 className="settings-group-title" id="settings-alerts-title">Оповещения</h3>
          <div className="settings-card">
            <SettingRow
              icon="🔔"
              title="Новые сообщения"
              hint="Всплывающее оповещение в углу экрана CRM"
              control={({ labelId, hintId }) => (
                <Switch checked={draft.notificationsEnabled} labelledBy={labelId} describedBy={hintId} onChange={(value) => update({ notificationsEnabled: value })} />
              )}
            />
            <SettingRow
              icon="💬"
              title="Текст сообщения"
              hint="Показывать начало сообщения, а не только «Новое сообщение»"
              disabled={!draft.notificationsEnabled}
              control={({ labelId, hintId }) => (
                <Switch
                  checked={draft.showMessagePreview}
                  disabled={!draft.notificationsEnabled}
                  labelledBy={labelId}
                  describedBy={hintId}
                  onChange={(value) => update({ showMessagePreview: value })}
                />
              )}
            />
            <DesktopNotificationsRow
              enabled={!!draft.desktopNotificationsEnabled}
              disabled={!draft.notificationsEnabled}
              status={desktopStatus}
              onStatus={setDesktopStatus}
              onChange={(value) => update({ desktopNotificationsEnabled: value })}
            />
          </div>
        </section>

        <section className="settings-group" aria-labelledby="settings-sound-title">
          <h3 className="settings-group-title" id="settings-sound-title">Звук</h3>
          <div className="settings-card">
            <SettingRow
              icon="🔊"
              title="Звук нового сообщения"
              control={({ labelId }) => (
                <Switch checked={draft.soundEnabled} labelledBy={labelId} onChange={(value) => update({ soundEnabled: value })} />
              )}
            >
              {draft.soundEnabled ? (
                <div className="settings-sound">
                  <div className="settings-sound-options" role="radiogroup" aria-label="Мелодия">
                    {CHAT_SOUNDS.map((sound) => (
                      <button
                        key={sound.name}
                        type="button"
                        role="radio"
                        aria-checked={draft.soundName === sound.name}
                        className={`settings-sound-option${draft.soundName === sound.name ? ' selected' : ''}`}
                        onClick={() => {
                          update({ soundName: sound.name as ChatSoundName });
                          void playChatSound(sound.name, draft.soundVolume);
                        }}
                        title="Выбрать и прослушать"
                      >
                        <span className="settings-sound-play" aria-hidden="true">▶</span>
                        {sound.label}
                      </button>
                    ))}
                  </div>
                  <div className="settings-volume">
                    <label htmlFor={volumeId}>Громкость</label>
                    <input
                      id={volumeId}
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={draft.soundVolume}
                      onChange={(event) => update({ soundVolume: Number(event.target.value) })}
                      onMouseUp={() => void playChatSound(draft.soundName, draft.soundVolume)}
                      onTouchEnd={() => void playChatSound(draft.soundName, draft.soundVolume)}
                      onKeyUp={() => void playChatSound(draft.soundName, draft.soundVolume)}
                    />
                    <span className="settings-volume-value">{draft.soundVolume}%</span>
                  </div>
                </div>
              ) : null}
            </SettingRow>
          </div>
        </section>

        </div>

        <aside className="settings-aside" aria-label="Подсказки">
          {draft.notificationsEnabled ? <DesktopHelp status={desktopStatus} /> : null}
          <NotificationPreview draft={draft} />
          <p className="settings-footnote">В диалогах с режимом «Без звука» оповещений и звука нет.</p>
        </aside>
      </div>
    </Modal>
  );
}

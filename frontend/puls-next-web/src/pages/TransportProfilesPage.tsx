import React, { useEffect, useMemo, useState } from 'react';
import { deleteTransportProfile, getTransportProfiles, saveTransportProfile, testTransportProfile } from '../app/api';
import { showToast } from '../app/toast';
import type { TransportProfileDto, TransportProfileUpsertRequest } from '../app/types';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';

const emptyModel: TransportProfileUpsertRequest = {
  name: '',
  host: '',
  port: 587,
  useSsl: true,
  username: '',
  password: '',
  senderEmail: '',
  senderName: '',
  replyToEmail: '',
  maxConnections: 2,
  messagesPerMinute: 60,
  isDefault: false,
  isEnabled: true
};

type SettingsGroupKey = 'general' | 'smtp';

export function TransportProfilesPage() {
  const [activeGroup, setActiveGroup] = useState<SettingsGroupKey>('smtp');
  const [rows, setRows] = useState<TransportProfileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>();
  const [model, setModel] = useState<TransportProfileUpsertRequest>(emptyModel);

  const editingProfile = useMemo(() => rows.find((item) => item.id === editingId), [editingId, rows]);
  const isSmtpGroup = activeGroup === 'smtp';

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getTransportProfiles());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openCreate = () => {
    setEditingId(undefined);
    setModel(emptyModel);
    setModalOpen(true);
  };

  const openEdit = (profile: TransportProfileDto) => {
    setEditingId(profile.id);
    setModel({
      name: profile.name,
      host: profile.host,
      port: profile.port,
      useSsl: profile.useSsl,
      username: profile.username,
      password: '',
      senderEmail: profile.senderEmail,
      senderName: profile.senderName,
      replyToEmail: profile.replyToEmail,
      maxConnections: profile.maxConnections,
      messagesPerMinute: profile.messagesPerMinute,
      isDefault: profile.isDefault,
      isEnabled: profile.isEnabled
    });
    setModalOpen(true);
  };

  const patchModel = <K extends keyof TransportProfileUpsertRequest>(key: K, value: TransportProfileUpsertRequest[K]) => {
    setModel((current) => ({ ...current, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveTransportProfile(model, editingId);
      showToast('SMTP профиль сохранен', 'success');
      setModalOpen(false);
      setEditingId(undefined);
      setModel(emptyModel);
      await load();
    } catch (error: any) {
      showToast(error.message || 'Не удалось сохранить SMTP профиль', 'error', 4000);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (id: number) => {
    const result = await testTransportProfile(id);
    showToast(result.message, result.success ? 'success' : 'error', 4000);
  };

  const remove = async (id: number) => {
    if (!window.confirm('Удалить SMTP профиль?')) {
      return;
    }

    try {
      await deleteTransportProfile(id);
      showToast('Профиль удален', 'success');
      if (editingId === id) {
        setModalOpen(false);
        setEditingId(undefined);
        setModel(emptyModel);
      }
      await load();
    } catch (error: any) {
      showToast(error.message || 'Не удалось удалить SMTP профиль', 'error', 4000);
    }
  };

  const activateGroup = (group: SettingsGroupKey) => {
    setActiveGroup(group);
    if (group !== 'smtp') {
      setModalOpen(false);
    }
  };

  return (
    <div className="page">
      <PageHeader
        title="Настройки"
        subtitle="Параметры системы и профили отправки"
        actions={isSmtpGroup ? <button type="button" className="primary-button" onClick={openCreate}>Новый профиль</button> : undefined}
      />

      <div className="settings-tabs">
        <button
          type="button"
          className={`settings-tab${activeGroup === 'general' ? ' active' : ''}`}
          onClick={() => activateGroup('general')}
        >
          Основные
        </button>
        <button
          type="button"
          className={`settings-tab${activeGroup === 'smtp' ? ' active' : ''}`}
          onClick={() => activateGroup('smtp')}
        >
          SMTP профили
        </button>
      </div>

      {activeGroup === 'general' ? (
        <section className="panel settings-placeholder">
          <div>
            <h3 className="settings-section-heading">Основные настройки</h3>
            <div className="field-hint">Раздел выделен в отдельную группу, чтобы дальше здесь появились системные параметры, а SMTP оставался самостоятельным блоком.</div>
          </div>

          <div className="detail-list">
            <div>
              <strong>Будущие параметры</strong>
              <div className="field-hint">Название системы, значения по умолчанию, лимиты и прочие общие настройки.</div>
            </div>
            <div>
              <strong>SMTP оставлен отдельно</strong>
              <div className="field-hint">Профили отправки теперь находятся в собственной группе и не смешиваются с другими настройками.</div>
            </div>
          </div>
        </section>
      ) : null}

      {activeGroup === 'smtp' ? (
        <section className="panel">
          <div className="section-header-inline">
            <h3>SMTP профили</h3>
            <button type="button" className="secondary-button button-inline" onClick={() => void load()}>Обновить</button>
          </div>

          <DataTable
            rows={rows}
            getRowKey={(row) => row.id}
            emptyText={loading ? 'Загрузка...' : 'Нет SMTP профилей'}
            columns={[
              { key: 'name', title: 'Профиль', render: (row) => row.name },
              { key: 'host', title: 'Сервер', render: (row) => row.host },
              { key: 'port', title: 'Порт', render: (row) => row.port },
              { key: 'senderEmail', title: 'Отправитель', render: (row) => row.senderEmail || '—' },
              { key: 'limits', title: 'Лимиты', render: (row) => `${row.maxConnections} / ${row.messagesPerMinute}` },
              { key: 'status', title: 'Статус', render: (row) => `${row.isEnabled ? 'Активен' : 'Выключен'}${row.isDefault ? ' • По умолчанию' : ''}` },
              {
                key: 'actions',
                title: 'Действия',
                render: (row) => (
                  <div className="button-group">
                    <button type="button" className="secondary-button button-inline" onClick={(event) => { event.stopPropagation(); openEdit(row); }}>
                      Редактировать
                    </button>
                    <button type="button" className="secondary-button button-inline" onClick={(event) => { event.stopPropagation(); void runTest(row.id); }}>
                      Проверить
                    </button>
                    <button type="button" className="secondary-button button-inline danger-button" onClick={(event) => { event.stopPropagation(); void remove(row.id); }}>
                      Удалить
                    </button>
                  </div>
                )
              }
            ]}
          />
        </section>
      ) : null}

      <Modal
        open={modalOpen}
        title={editingId ? `Редактирование профиля #${editingId}` : 'Новый SMTP профиль'}
        onClose={() => setModalOpen(false)}
        maxWidth={860}
        actions={(
          <>
            {editingId ? (
              <button type="button" className="secondary-button" onClick={() => void runTest(editingId)}>
                Проверить SMTP
              </button>
            ) : null}
            <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Закрыть</button>
            <button type="button" className="primary-button action-button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </>
        )}
      >
        <div className="settings-form-grid">
          <div className="field">
            <label>Название</label>
            <input className="form-input" value={model.name} onChange={(event) => patchModel('name', event.target.value)} />
          </div>
          <div className="field">
            <label>SMTP сервер</label>
            <input className="form-input" value={model.host} onChange={(event) => patchModel('host', event.target.value)} />
          </div>
          <div className="field">
            <label>Порт</label>
            <input className="form-input" type="number" min={1} value={model.port} onChange={(event) => patchModel('port', Number(event.target.value) || 587)} />
          </div>
          <div className="field">
            <label>Логин</label>
            <input className="form-input" value={model.username || ''} onChange={(event) => patchModel('username', event.target.value)} />
          </div>
          <div className="field">
            <label>Пароль</label>
            <input className="form-input" type="password" value={model.password || ''} onChange={(event) => patchModel('password', event.target.value)} />
            <div className="field-hint">Оставьте пустым, если пароль менять не нужно.</div>
          </div>
          <div className="field">
            <label>Адрес отправителя</label>
            <input className="form-input" value={model.senderEmail || ''} onChange={(event) => patchModel('senderEmail', event.target.value)} />
          </div>
          <div className="field">
            <label>Имя отправителя</label>
            <input className="form-input" value={model.senderName || ''} onChange={(event) => patchModel('senderName', event.target.value)} />
          </div>
          <div className="field">
            <label>Адрес для ответа</label>
            <input className="form-input" value={model.replyToEmail || ''} onChange={(event) => patchModel('replyToEmail', event.target.value)} />
          </div>
          <div className="field">
            <label>Макс. соединений</label>
            <input className="form-input" type="number" min={1} value={model.maxConnections} onChange={(event) => patchModel('maxConnections', Number(event.target.value) || 1)} />
          </div>
          <div className="field">
            <label>Писем в минуту</label>
            <input className="form-input" type="number" min={0} value={model.messagesPerMinute} onChange={(event) => patchModel('messagesPerMinute', Number(event.target.value) || 0)} />
          </div>
        </div>

        <div className="checkbox-grid">
          <label className="checkbox-option">
            <input type="checkbox" checked={model.useSsl} onChange={(event) => patchModel('useSsl', event.target.checked)} />
            <span>Использовать SSL</span>
          </label>
          <label className="checkbox-option">
            <input type="checkbox" checked={model.isDefault} onChange={(event) => patchModel('isDefault', event.target.checked)} />
            <span>Профиль по умолчанию</span>
          </label>
          <label className="checkbox-option">
            <input type="checkbox" checked={model.isEnabled} onChange={(event) => patchModel('isEnabled', event.target.checked)} />
            <span>Профиль активен</span>
          </label>
        </div>

        {editingProfile ? (
          <div className="settings-form-meta">
            Создан: {new Date(editingProfile.createdAtUtc).toLocaleString()} • Обновлен: {new Date(editingProfile.updatedAtUtc).toLocaleString()}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

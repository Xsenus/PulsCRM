import React, { useEffect, useMemo, useState } from 'react';
import { deleteTransportProfile, getTransportProfiles, saveTransportProfile, testTransportProfile } from '../app/api';
import { useAuth } from '../app/AuthContext';
import { getApiErrorMessage } from '../app/apiErrors';
import { formatDateTime } from '../app/format';
import { loadStoredPageSize, PAGE_SIZE_OPTIONS } from '../app/table';
import { showToast } from '../app/toast';
import type { TransportProfileDto, TransportProfileUpsertRequest } from '../app/types';
import { LoadingButtonLabel } from '../components/AppLoader';
import { DataTable } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';
import { Pagination } from '../components/Pagination';
import { RowActionsMenu } from '../components/RowActionsMenu';
import { SearchPanel } from '../components/SearchPanel';
import { StatusBadge } from '../components/StatusBadge';

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

const EMPTY_VALUE = '—';
const TRANSPORT_PROFILES_TABLE_STORAGE_ID = 'transport-profiles-list';

export function TransportProfilesPage() {
  const { user } = useAuth();
  const currentUserId = String(user?.id ?? 'guest');
  const tableSettingsKey = `puls-table-settings:${TRANSPORT_PROFILES_TABLE_STORAGE_ID}:${currentUserId}`;
  const pageSizeStorageKey = `puls-page-size:${TRANSPORT_PROFILES_TABLE_STORAGE_ID}:${currentUserId}`;

  const [activeGroup, setActiveGroup] = useState<SettingsGroupKey>('smtp');
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [rows, setRows] = useState<TransportProfileDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | undefined>();
  const [model, setModel] = useState<TransportProfileUpsertRequest>(emptyModel);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(() => loadStoredPageSize(pageSizeStorageKey));
  const [deleteTarget, setDeleteTarget] = useState<TransportProfileDto | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  const editingProfile = useMemo(() => rows.find((item) => item.id === editingId), [editingId, rows]);
  const isSmtpGroup = activeGroup === 'smtp';
  const filteredRows = useMemo(() => {
    const term = appliedSearch.trim().toLowerCase();
    if (!term) {
      return rows;
    }

    return rows.filter((row) => [row.name, row.host, row.senderEmail, row.senderName, row.username]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(term)));
  }, [appliedSearch, rows]);
  const totalCount = filteredRows.length;
  const pagedRows = useMemo(
    () => filteredRows.slice((page - 1) * pageSize, page * pageSize),
    [filteredRows, page, pageSize]
  );

  const load = async () => {
    setLoading(true);
    try {
      setRows(await getTransportProfiles());
    } catch (error) {
      setRows([]);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load().catch((error) => {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить SMTP профили'), 'error', 4000);
    });
  }, []);

  useEffect(() => {
    setPageSize(loadStoredPageSize(pageSizeStorageKey));
    setPage(1);
  }, [pageSizeStorageKey]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem(pageSizeStorageKey, String(pageSize));
  }, [pageSize, pageSizeStorageKey]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, pageSize, totalCount]);

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
      showToast('SMTP профиль сохранен', editingId ? 'update' : 'create');
      setModalOpen(false);
      setEditingId(undefined);
      setModel(emptyModel);
      try {
        await load();
      } catch (error) {
        showToast(getApiErrorMessage(error, 'SMTP профиль сохранен, но список не обновился'), 'error', 4000);
      }
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, 'Не удалось сохранить SMTP профиль'), 'error', 4000);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async (id: number) => {
    setTestingId(id);
    try {
      const result = await testTransportProfile(id);
      showToast(result.message, result.success ? 'success' : 'error', 4000);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось проверить SMTP профиль'), 'error', 4000);
    } finally {
      setTestingId((current) => current === id ? null : current);
    }
  };

  const remove = async () => {
    if (!deleteTarget) {
      return;
    }

    setDeleteBusy(true);

    try {
      await deleteTransportProfile(deleteTarget.id);
      showToast('Профиль удален', 'delete');
      if (editingId === deleteTarget.id) {
        setModalOpen(false);
        setEditingId(undefined);
        setModel(emptyModel);
      }
      setDeleteTarget(null);
      try {
        await load();
      } catch (error) {
        showToast(getApiErrorMessage(error, 'SMTP профиль удален, но список не обновился'), 'error', 4000);
      }
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, 'Не удалось удалить SMTP профиль'), 'error', 4000);
    } finally {
      setDeleteBusy(false);
    }
  };

  const activateGroup = (group: SettingsGroupKey) => {
    setActiveGroup(group);
    if (group !== 'smtp') {
      setModalOpen(false);
    }
  };

  const applySearchValue = (value: string) => {
    const nextSearch = value.trim();
    setAppliedSearch((current) => (current === nextSearch ? current : nextSearch));
    setPage((current) => (current === 1 ? current : 1));
  };

  const applySearch = () => {
    applySearchValue(search);
  };

  const clearSearch = () => {
    setSearch('');
    applySearchValue('');
  };

  return (
    <div className="page">
      <PageHeader
        title="Настройки"
        actions={isSmtpGroup ? <button type="button" className="primary-button" onClick={openCreate}>Новый профиль</button> : undefined}
      />

      <div className="settings-tabs" role="tablist" aria-label="Группы настроек">
        <button
          type="button"
          role="tab"
          aria-selected={activeGroup === 'general'}
          className={`settings-tab${activeGroup === 'general' ? ' active' : ''}`}
          onClick={() => activateGroup('general')}
        >
          Основные
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeGroup === 'smtp'}
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
          </div>

          <SearchPanel
            value={search}
            placeholder="Поиск по профилю, серверу, логину или email"
            onChange={setSearch}
            onSearch={applySearch}
            onClear={clearSearch}
            onDebouncedChange={applySearchValue}
            onRefresh={load}
            refreshSuccessMessage="Список SMTP профилей обновлен."
            refreshErrorMessage="Не удалось обновить список SMTP профилей."
          />

          <DataTable
            rows={pagedRows}
            getRowKey={(row) => row.id}
            loading={loading}
            emptyText="Нет SMTP профилей"
            settingsKey={tableSettingsKey}
            title="Список профилей"
            columns={[
              { key: 'name', title: 'Профиль', width: 220, minWidth: 180, isPrimary: true, priority: 1, render: (row) => row.name },
              { key: 'host', title: 'Сервер', width: 220, minWidth: 180, priority: 2, render: (row) => row.host },
              { key: 'port', title: 'Порт', width: 100, minWidth: 90, priority: 3, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.port },
              { key: 'username', title: 'Логин', width: 200, minWidth: 160, visible: false, render: (row) => row.username || EMPTY_VALUE },
              { key: 'senderEmail', title: 'Отправитель', width: 220, minWidth: 180, priority: 4, render: (row) => row.senderEmail || EMPTY_VALUE },
              { key: 'senderName', title: 'Имя отправителя', width: 220, minWidth: 180, visible: false, render: (row) => row.senderName || EMPTY_VALUE },
              { key: 'replyToEmail', title: 'Reply-To', width: 220, minWidth: 180, visible: false, render: (row) => row.replyToEmail || EMPTY_VALUE },
              { key: 'ssl', title: 'SSL', width: 90, minWidth: 80, visible: false, render: (row) => (row.useSsl ? 'Да' : 'Нет') },
              { key: 'limits', title: 'Лимиты', width: 130, minWidth: 110, priority: 5, render: (row) => `${row.maxConnections} / ${row.messagesPerMinute}` },
              {
                key: 'status',
                title: 'Статус',
                width: 190,
                minWidth: 160,
                priority: 6,
                render: (row) => (
                  <div className="status-badge-stack">
                    <StatusBadge tone={row.isEnabled ? 'success' : 'neutral'}>{row.isEnabled ? 'Активен' : 'Выключен'}</StatusBadge>
                    {row.isDefault ? <StatusBadge tone="info">По умолчанию</StatusBadge> : null}
                  </div>
                )
              },
              { key: 'createdAtUtc', title: 'Создано', width: 180, minWidth: 160, visible: false, render: (row) => formatDateTime(row.createdAtUtc) || EMPTY_VALUE },
              { key: 'updatedAtUtc', title: 'Обновлено', width: 180, minWidth: 160, visible: false, render: (row) => formatDateTime(row.updatedAtUtc) || EMPTY_VALUE },
              {
                key: 'actions',
                title: 'Действия',
                width: 86,
                minWidth: 76,
                canHide: false,
                isActions: true,
                mobileVisible: false,
                headerClassName: 'organization-cell-right',
                className: 'organization-cell-right',
                render: (row) => (
                  <RowActionsMenu
                    actions={[
                      { key: 'edit', label: 'Редактировать', primary: true, onClick: () => openEdit(row) },
                      { key: 'test', label: testingId === row.id ? 'Проверяем...' : 'Проверить', disabled: testingId === row.id, busy: testingId === row.id, onClick: () => runTest(row.id) },
                      { key: 'delete', label: 'Удалить', danger: true, onClick: () => setDeleteTarget(row) }
                    ]}
                  />
                )
              }
            ]}
          />

          <Pagination
            page={page}
            pageSize={pageSize}
            totalCount={totalCount}
            onPageChange={setPage}
            onPageSizeChange={(value) => {
              setPageSize(value);
              setPage(1);
            }}
            pageSizeOptions={PAGE_SIZE_OPTIONS}
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
              <button type="button" className="secondary-button" disabled={testingId === editingId} onClick={() => void runTest(editingId)}>
                {testingId === editingId ? <LoadingButtonLabel label="Проверяем" /> : 'Проверить SMTP'}
              </button>
            ) : null}
            <button type="button" className="secondary-button" onClick={() => setModalOpen(false)}>Закрыть</button>
            <button type="button" className="primary-button action-button" disabled={saving} onClick={() => void save()}>
              {saving ? <LoadingButtonLabel label="Сохраняем" /> : 'Сохранить'}
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

      <Modal
        open={!!deleteTarget}
        title="Удалить SMTP профиль"
        onClose={() => !deleteBusy && setDeleteTarget(null)}
        actions={(
          <>
            <button type="button" className="secondary-button" onClick={() => setDeleteTarget(null)} disabled={deleteBusy}>
              Отмена
            </button>
            <button type="button" className="primary-button danger-button" onClick={() => void remove()} disabled={deleteBusy}>
              {deleteBusy ? 'Удаление...' : 'Удалить'}
            </button>
          </>
        )}
      >
        <div className="confirmation-copy">
          {deleteTarget
            ? `Удалить SMTP профиль «${deleteTarget.name}»? Если профиль используется в кампаниях, API не позволит удалить его.`
            : 'SMTP профиль не выбран.'}
        </div>
      </Modal>
    </div>
  );
}

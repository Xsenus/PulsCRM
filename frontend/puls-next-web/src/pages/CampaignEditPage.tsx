import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  checkCampaignReadiness,
  getCampaign,
  getCampaignStats,
  getTransportProfiles,
  previewRecipients,
  previewSchedule,
  runCampaign,
  saveCampaign,
  uploadFile
} from '../app/api';
import { createCampaignDraftSnapshot } from '../app/campaignDraft';
import { campaignReadinessSummary, campaignReadinessTone } from '../app/campaignReadiness';
import { useAuth } from '../app/AuthContext';
import { formatDateTime } from '../app/format';
import { campaignStatusOptions, dispatchStatusOptions, labelOf, recipientSourceOptions } from '../app/lookups';
import { showToast } from '../app/toast';
import type {
  CampaignDetailsDto,
  CampaignRecipientPreviewDto,
  CampaignReadinessDto,
  CampaignStatisticsDto,
  CampaignUpsertRequest,
  OrganizationListItemDto,
  StoredFileDto,
  TransportProfileDto
} from '../app/types';
import { AppLoader, LoadingButtonLabel } from '../components/AppLoader';
import { AttachmentManager, type EditableAttachment } from '../components/AttachmentManager';
import { DataTable } from '../components/DataTable';
import { OrganizationPicker } from '../components/OrganizationPicker';
import { PageHeader } from '../components/PageHeader';
import { ScheduleBuilder } from '../components/ScheduleBuilder';
import { StatsCards } from '../components/StatsCards';
import { StatusBadge, type StatusBadgeTone } from '../components/StatusBadge';

type CampaignEditorTab = 'basic' | 'recipients' | 'message' | 'schedule' | 'review' | 'stats';

const campaignEditorTabs: Array<{ id: CampaignEditorTab; label: string }> = [
  { id: 'basic', label: 'Основное' },
  { id: 'recipients', label: 'Получатели' },
  { id: 'message', label: 'Письмо' },
  { id: 'schedule', label: 'Расписание' },
  { id: 'review', label: 'Проверка и запуск' },
  { id: 'stats', label: 'Статистика' }
];

function createDefaultModel(): CampaignUpsertRequest {
  return {
    name: '',
    subject: '',
    htmlBody: '',
    plainTextBody: '',
    status: 0,
    transportProfileId: undefined,
    scheduleKind: 0,
    cronExpression: '',
    timeZoneId: 'Europe/Amsterdam',
    startAtUtc: new Date().toISOString(),
    endAtUtc: undefined,
    intervalMinutes: 2,
    randomIntervalMinMinutes: 1,
    randomIntervalMaxMinutes: 5,
    maxRecipientsPerRun: 0,
    maxAttempts: 3,
    useOrgPrimaryEmail: true,
    useContactEmails: false,
    useSalaryEmail: false,
    useOneCEmail: false,
    useSiteEmail: false,
    useDirectorEmail: false,
    manualRecipientsCsv: '',
    targetOrganizationIds: [],
    attachments: []
  };
}

function dispatchStatusTone(status: number): StatusBadgeTone {
  if (status === 2) {
    return 'success';
  }

  if (status === 3) {
    return 'danger';
  }

  if (status === 4) {
    return 'warning';
  }

  if (status === 1) {
    return 'info';
  }

  return 'neutral';
}

function mapCampaignToState(campaign: CampaignDetailsDto): {
  model: CampaignUpsertRequest;
  attachments: EditableAttachment[];
  selectedOrganizations: OrganizationListItemDto[];
} {
  return {
    model: {
      name: campaign.name,
      subject: campaign.subject,
      htmlBody: campaign.htmlBody,
      plainTextBody: campaign.plainTextBody,
      status: campaign.status,
      transportProfileId: campaign.transportProfileId,
      scheduleKind: campaign.scheduleKind,
      cronExpression: campaign.cronExpression,
      timeZoneId: campaign.timeZoneId,
      startAtUtc: campaign.startAtUtc,
      endAtUtc: campaign.endAtUtc,
      intervalMinutes: campaign.intervalMinutes,
      randomIntervalMinMinutes: campaign.randomIntervalMinMinutes,
      randomIntervalMaxMinutes: campaign.randomIntervalMaxMinutes,
      maxRecipientsPerRun: campaign.maxRecipientsPerRun,
      maxAttempts: campaign.maxAttempts,
      useOrgPrimaryEmail: campaign.useOrgPrimaryEmail,
      useContactEmails: campaign.useContactEmails,
      useSalaryEmail: campaign.useSalaryEmail,
      useOneCEmail: campaign.useOneCEmail,
      useSiteEmail: campaign.useSiteEmail,
      useDirectorEmail: campaign.useDirectorEmail,
      manualRecipientsCsv: campaign.manualRecipientsCsv,
      targetOrganizationIds: campaign.targets.map((item) => item.legacyOrgId),
      attachments: campaign.attachments.map((item) => ({
        storedFileId: item.storedFile.id,
        attachmentKind: item.attachmentKind,
        displayName: item.displayName,
        contentId: item.contentId,
        sortOrder: item.sortOrder
      }))
    },
    attachments: campaign.attachments.map((item) => ({
      storedFile: item.storedFile,
      attachmentKind: item.attachmentKind,
      displayName: item.displayName,
      contentId: item.contentId,
      sortOrder: item.sortOrder
    })),
    selectedOrganizations: campaign.targets.map((item) => ({
      id: item.legacyOrgId,
      name: item.legacyOrgName || `Организация #${item.legacyOrgId}`,
      fullName: item.legacyOrgName,
      raion: item.legacyRaionName,
      visible: true,
      isManager: false,
      emails: [],
      emailCount: 0,
      contactCount: 0,
      openWorkItems: 0
    }))
  };
}

function buildCampaignRequest(
  model: CampaignUpsertRequest,
  selectedOrganizations: OrganizationListItemDto[],
  attachments: EditableAttachment[]
): CampaignUpsertRequest {
  return {
    ...model,
    targetOrganizationIds: selectedOrganizations.map((item) => item.id),
    attachments: attachments.map((item, index) => ({
      storedFileId: item.storedFile.id,
      attachmentKind: item.attachmentKind,
      displayName: item.displayName || item.storedFile.originalFileName,
      contentId: item.contentId,
      sortOrder: index
    }))
  };
}

export function CampaignEditPage() {
  const { user } = useAuth();
  const currentUserId = String(user?.id ?? 'guest');
  const previewTableSettingsKey = `puls-table-settings:campaign-preview:${currentUserId}`;
  const batchesTableSettingsKey = `puls-table-settings:campaign-batches:${currentUserId}`;
  const itemsTableSettingsKey = `puls-table-settings:campaign-items:${currentUserId}`;
  const params = useParams();
  const navigate = useNavigate();
  const id = params.id ? Number(params.id) : undefined;
  const isNew = !id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [model, setModel] = useState<CampaignUpsertRequest>(() => createDefaultModel());
  const [selectedOrganizations, setSelectedOrganizations] = useState<OrganizationListItemDto[]>([]);
  const [transportProfiles, setTransportProfiles] = useState<TransportProfileDto[]>([]);
  const [attachments, setAttachments] = useState<EditableAttachment[]>([]);
  const [schedulePreviewItems, setSchedulePreviewItems] = useState<Awaited<ReturnType<typeof previewSchedule>>>([]);
  const [recipientPreviewData, setRecipientPreviewData] = useState<CampaignRecipientPreviewDto | null>(null);
  const [readiness, setReadiness] = useState<CampaignReadinessDto | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [stats, setStats] = useState<CampaignStatisticsDto | null>(null);
  const [activeTab, setActiveTab] = useState<CampaignEditorTab>('basic');
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');

  const buildRequest = useMemo<CampaignUpsertRequest>(
    () => buildCampaignRequest(model, selectedOrganizations, attachments),
    [attachments, model, selectedOrganizations]
  );
  const currentSnapshot = useMemo(() => createCampaignDraftSnapshot(buildRequest), [buildRequest]);
  const hasUnsavedChanges = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;

  const load = async () => {
    setLoading(true);
    try {
      const transportResponse = await getTransportProfiles();

      setTransportProfiles(transportResponse);
      setSchedulePreviewItems([]);
      setRecipientPreviewData(null);
      setReadiness(null);

      if (id) {
        const campaign = await getCampaign(id);
        const mapped = mapCampaignToState(campaign);
        setModel(mapped.model);
        setAttachments(mapped.attachments);
        setSelectedOrganizations(mapped.selectedOrganizations);
        setSavedSnapshot(createCampaignDraftSnapshot(buildCampaignRequest(mapped.model, mapped.selectedOrganizations, mapped.attachments)));
        setStats(await getCampaignStats(id));
      } else {
        const defaultModel = createDefaultModel();
        setModel(defaultModel);
        setAttachments([]);
        setSelectedOrganizations([]);
        setSavedSnapshot(createCampaignDraftSnapshot(buildCampaignRequest(defaultModel, [], [])));
        setStats(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

  useEffect(() => {
    setReadiness(null);
  }, [buildRequest]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return;
      }

      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const patchModel = (patch: Partial<CampaignUpsertRequest>) => {
    setModel((current) => ({ ...current, ...patch }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const saved = await saveCampaign(buildRequest, id);
      const mapped = mapCampaignToState(saved);
      setModel(mapped.model);
      setAttachments(mapped.attachments);
      setSelectedOrganizations((current) => current.length > 0 ? current : mapped.selectedOrganizations);
      setSavedSnapshot(createCampaignDraftSnapshot(buildCampaignRequest(mapped.model, mapped.selectedOrganizations, mapped.attachments)));
      showToast('Кампания сохранена', id ? 'update' : 'create');

      if (!id) {
        navigate(`/campaigns/${saved.id}`, { replace: true });
        return;
      }

      setStats(await getCampaignStats(saved.id));
    } catch (error: any) {
      showToast(error.message || 'Не удалось сохранить кампанию', 'error', 4000);
    } finally {
      setSaving(false);
    }
  };

  const previewScheduleClick = async () => {
    try {
      const preview = await previewSchedule({
        scheduleKind: model.scheduleKind,
        cronExpression: model.cronExpression,
        timeZoneId: model.timeZoneId,
        startAtUtc: model.startAtUtc,
        endAtUtc: model.endAtUtc,
        intervalMinutes: model.intervalMinutes,
        randomIntervalMinMinutes: model.randomIntervalMinMinutes,
        randomIntervalMaxMinutes: model.randomIntervalMaxMinutes,
        count: 10
      });
      setSchedulePreviewItems(preview);
    } catch (error: any) {
      showToast(error.message || 'Не удалось построить расписание', 'error', 4000);
    }
  };

  const previewRecipientsClick = async () => {
    try {
      setActiveTab('recipients');
      setRecipientPreviewData(await previewRecipients(buildRequest));
    } catch (error: any) {
      showToast(error.message || 'Не удалось получить список получателей', 'error', 4000);
    }
  };

  const uploadFiles = async (files: File[]) => {
    const uploaded: Array<{ meta: StoredFileDto; file: File }> = [];

    for (const file of files) {
      const meta = await uploadFile(file);
      uploaded.push({ meta, file });
    }

    setAttachments((current) => [
      ...current,
      ...uploaded.map((item, index) => ({
        storedFile: item.meta,
        attachmentKind: item.file.type.startsWith('image/') ? 1 : 0,
        displayName: item.meta.originalFileName,
        contentId: item.file.type.startsWith('image/') ? `img-${item.meta.id}` : undefined,
        sortOrder: current.length + index
      }))
    ]);
  };

  const checkReadinessClick = async () => {
    setReadinessLoading(true);
    try {
      setActiveTab('review');
      const result = await checkCampaignReadiness(buildRequest);
      setReadiness(result);
      showToast(result.isReady ? 'Кампания готова к запуску' : 'Кампания не готова к запуску', result.isReady ? 'success' : 'warning');
      return result;
    } catch (error: any) {
      showToast(error.message || 'Не удалось проверить готовность кампании', 'error', 4000);
      return null;
    } finally {
      setReadinessLoading(false);
    }
  };

  const runNow = async () => {
    if (!id) {
      setActiveTab('basic');
      showToast('Сначала сохраните кампанию', 'warning');
      return;
    }

    const readinessResult = await checkReadinessClick();
    if (!readinessResult?.isReady) {
      return;
    }

    await runCampaign(id, {});
    showToast('Ручной запуск поставлен в очередь', 'success');
    setStats(await getCampaignStats(id));
  };

  return (
    <div className="page">
      <PageHeader
        title={isNew ? 'Новая кампания' : `Кампания #${id}`}
        subtitle="Письмо, расписание, источники адресов, вложения, статистика и ручной запуск."
        actions={(
          <>
            <button type="button" className="secondary-button button-inline" onClick={() => void previewRecipientsClick()}>
              Проверить получателей
            </button>
            <button type="button" className="secondary-button button-inline" disabled={readinessLoading} onClick={() => void checkReadinessClick()}>
              {readinessLoading ? <LoadingButtonLabel label="Проверяем" /> : 'Проверить готовность'}
            </button>
            <button type="button" className="secondary-button button-inline" disabled={!id} onClick={() => void runNow()}>
              Запустить сейчас
            </button>
            <button type="button" className="primary-button action-button" disabled={saving} onClick={() => void save()}>
              {saving ? <LoadingButtonLabel label="Сохраняем" /> : 'Сохранить'}
            </button>
          </>
        )}
      />

      {loading ? (
        <section className="panel">
          <AppLoader
            variant="panel"
            label="Собираем кампанию"
            description="Подтягиваем шаблон, настройки отправки и целевые организации."
          />
        </section>
      ) : null}

      {!loading ? (
        <>
          <section className="panel campaign-editor-navigation">
            <div className="section-header-inline">
              <div>
                <h3>Настройка кампании</h3>
                <div className="field-hint">
                  {hasUnsavedChanges ? 'Есть несохраненные изменения.' : 'Все изменения сохранены.'}
                </div>
              </div>
              <StatusBadge tone={hasUnsavedChanges ? 'warning' : 'success'}>
                {hasUnsavedChanges ? 'Черновик изменен' : 'Сохранено'}
              </StatusBadge>
            </div>

            <div className="settings-tabs campaign-editor-tabs" role="tablist" aria-label="Разделы кампании">
              {campaignEditorTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`settings-tab${activeTab === tab.id ? ' active' : ''}`}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </section>

          {activeTab === 'review' ? (
          <section className="panel campaign-readiness-panel">
            <div className="section-header-inline">
              <div>
                <h3>Готовность к запуску</h3>
                <div className="field-hint">{campaignReadinessSummary(readiness)}</div>
              </div>

              <button type="button" className="secondary-button button-inline" disabled={readinessLoading} onClick={() => void checkReadinessClick()}>
                {readinessLoading ? <LoadingButtonLabel label="Проверяем" /> : 'Проверить'}
              </button>
            </div>

            {readiness ? (
              <>
                <StatsCards
                  items={[
                    { label: 'Организаций', value: readiness.organizationCount },
                    { label: 'Получателей', value: readiness.recipientCount },
                    { label: 'Статус', value: readiness.isReady ? 'Готова' : 'Не готова' }
                  ]}
                />

                <div className="campaign-readiness-list">
                  {readiness.items.map((item) => (
                    <div key={item.key} className={`campaign-readiness-item${item.isBlocking ? ' blocking' : ''}`}>
                      <div>
                        <strong>{item.label}</strong>
                        <span>{item.message}</span>
                      </div>
                      <StatusBadge tone={campaignReadinessTone(item.status)}>
                        {item.status === 'ok' ? 'OK' : item.status === 'warning' ? 'Внимание' : 'Ошибка'}
                      </StatusBadge>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="empty-state">Запустите проверку, чтобы увидеть, можно ли ставить кампанию в очередь.</div>
            )}
          </section>
          ) : null}

          {activeTab === 'basic' ? (
          <section className="panel">
            <h3>Основное</h3>
            <div className="form-grid campaign-main-grid">
              <div className="field field-wide">
                <label>Название кампании</label>
                <input className="form-input" value={model.name} onChange={(event) => patchModel({ name: event.target.value })} />
              </div>

              <div className="field field-wide">
                <label>Тема письма</label>
                <input className="form-input" value={model.subject || ''} onChange={(event) => patchModel({ subject: event.target.value })} />
              </div>

              <div className="field">
                <label>Статус</label>
                <select className="form-select" value={model.status} onChange={(event) => patchModel({ status: Number(event.target.value) })}>
                  {campaignStatusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>SMTP профиль</label>
                <select
                  className="form-select"
                  value={model.transportProfileId ?? ''}
                  onChange={(event) => patchModel({ transportProfileId: event.target.value ? Number(event.target.value) : undefined })}
                >
                  <option value="">Не выбран</option>
                  {transportProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>{profile.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label>Макс. получателей за запуск</label>
                <input
                  className="form-input"
                  type="number"
                  min={0}
                  value={model.maxRecipientsPerRun}
                  onChange={(event) => patchModel({ maxRecipientsPerRun: Number(event.target.value) || 0 })}
                />
                <div className="field-hint">0 означает без лимита.</div>
              </div>

              <div className="field">
                <label>Макс. попыток</label>
                <input
                  className="form-input"
                  type="number"
                  min={1}
                  value={model.maxAttempts}
                  onChange={(event) => patchModel({ maxAttempts: Number(event.target.value) || 1 })}
                />
              </div>
            </div>
          </section>
          ) : null}

          {activeTab === 'schedule' ? (
          <ScheduleBuilder
            value={{
              scheduleKind: model.scheduleKind,
              cronExpression: model.cronExpression,
              timeZoneId: model.timeZoneId,
              startAtUtc: model.startAtUtc,
              endAtUtc: model.endAtUtc,
              intervalMinutes: model.intervalMinutes,
              randomIntervalMinMinutes: model.randomIntervalMinMinutes,
              randomIntervalMaxMinutes: model.randomIntervalMaxMinutes
            }}
            onChange={(patch) => patchModel(patch)}
            preview={schedulePreviewItems}
            onPreview={previewScheduleClick}
          />
          ) : null}

          {activeTab === 'recipients' ? (
          <>
          <OrganizationPicker value={selectedOrganizations} onChange={setSelectedOrganizations} />

          <section className="panel">
            <h3>Источники адресов</h3>
            <div className="checkbox-grid">
              <label className="checkbox-option">
                <input type="checkbox" checked={model.useOrgPrimaryEmail} onChange={(event) => patchModel({ useOrgPrimaryEmail: event.target.checked })} />
                <span>Основной email организации</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" checked={model.useContactEmails} onChange={(event) => patchModel({ useContactEmails: event.target.checked })} />
                <span>Адреса контактов</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" checked={model.useSalaryEmail} onChange={(event) => patchModel({ useSalaryEmail: event.target.checked })} />
                <span>Зарплата / ZP</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" checked={model.useOneCEmail} onChange={(event) => patchModel({ useOneCEmail: event.target.checked })} />
                <span>1C / F1c</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" checked={model.useSiteEmail} onChange={(event) => patchModel({ useSiteEmail: event.target.checked })} />
                <span>Адрес сайта</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" checked={model.useDirectorEmail} onChange={(event) => patchModel({ useDirectorEmail: event.target.checked })} />
                <span>Адрес руководителя</span>
              </label>
            </div>

            <div className="field field-wide">
              <label>Ручные адреса</label>
              <textarea
                className="form-textarea"
                value={model.manualRecipientsCsv || ''}
                onChange={(event) => patchModel({ manualRecipientsCsv: event.target.value })}
              />
              <div className="field-hint">Можно перечислять через запятую, точку с запятой или с новой строки.</div>
            </div>
          </section>

          {recipientPreviewData ? (
            <section className="panel">
              <h3>Предпросмотр получателей</h3>

              <StatsCards
                items={[
                  { label: 'Организаций', value: recipientPreviewData.organizationCount },
                  { label: 'Адресов', value: recipientPreviewData.recipientCount },
                  { label: 'Показано', value: recipientPreviewData.items.length, hint: 'Предел отображения в интерфейсе' }
                ]}
              />

              <DataTable
                rows={recipientPreviewData.items}
                getRowKey={(row) => `${row.legacyOrgId}-${row.email}`}
                settingsKey={previewTableSettingsKey}
                columns={[
                  { key: 'email', title: 'Адрес', width: 240, minWidth: 200, isPrimary: true, priority: 1, render: (row) => row.email },
                  { key: 'legacyOrgName', title: 'Организация', width: 260, minWidth: 220, priority: 2, render: (row) => row.legacyOrgName || '—' },
                  { key: 'displayName', title: 'Имя', width: 220, minWidth: 180, priority: 3, render: (row) => row.displayName || '—' },
                  { key: 'sourceKind', title: 'Источник', width: 170, minWidth: 150, priority: 4, render: (row) => labelOf(recipientSourceOptions, row.sourceKind) }
                ]}
              />
            </section>
          ) : (
            <section className="panel">
              <div className="empty-state">Нажмите “Проверить получателей”, чтобы увидеть найденные email.</div>
            </section>
          )}
          </>
          ) : null}

          {activeTab === 'message' ? (
          <>
          <section className="panel">
            <h3>Шаблон письма</h3>

            <div className="campaign-editor-grid">
              <div className="field">
                <label>HTML-версия письма</label>
                <textarea
                  className="form-textarea form-textarea-code"
                  value={model.htmlBody || ''}
                  onChange={(event) => patchModel({ htmlBody: event.target.value })}
                />
                <div className="field-hint">Используется как основная HTML-версия письма.</div>
              </div>

              <div className="field">
                <label>Предпросмотр HTML</label>
                <iframe
                  title="Предпросмотр HTML письма"
                  className="preview-frame"
                  sandbox=""
                  srcDoc={model.htmlBody || '<p style="font-family: sans-serif; color: #64748b;">HTML пока пуст.</p>'}
                />
              </div>
            </div>

            <div className="field field-wide">
              <label>Текстовая версия</label>
              <textarea
                className="form-textarea"
                value={model.plainTextBody || ''}
                onChange={(event) => patchModel({ plainTextBody: event.target.value })}
              />
            </div>
          </section>

          <AttachmentManager attachments={attachments} onChange={setAttachments} onUploadFiles={uploadFiles} />
          </>
          ) : null}

          {activeTab === 'stats' ? (
          stats ? (
            <section className="panel">
              <h3>Статистика</h3>

              <StatsCards
                items={[
                  { label: 'Всего записей', value: stats.totalItems },
                  { label: 'В очереди', value: stats.queued },
                  { label: 'В обработке', value: stats.processing },
                  { label: 'Отправлено', value: stats.sent },
                  { label: 'Ошибок', value: stats.failed },
                  { label: 'Отложено', value: stats.deferred }
                ]}
              />

              <div className="split-layout">
                <div className="panel-subsection">
                  <h4>Последние пакеты</h4>
                  <DataTable
                    rows={stats.recentBatches}
                    getRowKey={(row) => row.id}
                    settingsKey={batchesTableSettingsKey}
                    emptyText="Нет пакетов"
                    columns={[
                      { key: 'id', title: '#', width: 80, minWidth: 70, isPrimary: true, priority: 1, render: (row) => `Пакет #${row.id}` },
                      { key: 'createdAtUtc', title: 'Создан', width: 170, minWidth: 150, priority: 2, render: (row) => formatDateTime(row.createdAtUtc) || '—' },
                      { key: 'scheduledAtUtc', title: 'Запланирован', width: 170, minWidth: 150, priority: 3, render: (row) => formatDateTime(row.scheduledAtUtc) || '—' },
                      { key: 'totalRecipients', title: 'Всего', width: 100, minWidth: 90, priority: 4, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.totalRecipients },
                      { key: 'sentCount', title: 'Отправлено', width: 120, minWidth: 100, priority: 5, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.sentCount },
                      { key: 'failedCount', title: 'Ошибок', width: 110, minWidth: 100, priority: 6, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.failedCount },
                      { key: 'processingCount', title: 'В обработке', width: 130, minWidth: 110, priority: 7, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.processingCount }
                    ]}
                  />
                </div>

                <div className="panel-subsection">
                  <h4>Последние сообщения</h4>
                  <DataTable
                    rows={stats.recentItems}
                    getRowKey={(row) => row.id}
                    settingsKey={itemsTableSettingsKey}
                    emptyText="Нет сообщений"
                    columns={[
                      { key: 'recipientEmail', title: 'Адрес', width: 240, minWidth: 200, isPrimary: true, priority: 1, render: (row) => row.recipientEmail || '—' },
                      { key: 'legacyOrgName', title: 'Организация', width: 240, minWidth: 200, priority: 2, render: (row) => row.legacyOrgName || '—' },
                      {
                        key: 'status',
                        title: 'Статус',
                        width: 150,
                        minWidth: 130,
                        priority: 3,
                        render: (row) => (
                          <StatusBadge tone={dispatchStatusTone(row.status)}>
                            {labelOf(dispatchStatusOptions, row.status)}
                          </StatusBadge>
                        )
                      },
                      { key: 'attemptCount', title: 'Попыток', width: 100, minWidth: 90, priority: 4, headerClassName: 'organization-cell-right', className: 'organization-cell-right', render: (row) => row.attemptCount },
                      { key: 'sentAtUtc', title: 'Отправлено', width: 170, minWidth: 150, priority: 5, render: (row) => formatDateTime(row.sentAtUtc) || '—' },
                      { key: 'errorMessage', title: 'Ошибка', width: 280, minWidth: 220, priority: 6, render: (row) => row.errorMessage || '—' }
                    ]}
                  />
                </div>
              </div>
            </section>
          ) : (
            <section className="panel">
              <div className="empty-state">Статистика появится после сохранения и запуска кампании.</div>
            </section>
          )
          ) : null}
        </>
      ) : null}
    </div>
  );
}

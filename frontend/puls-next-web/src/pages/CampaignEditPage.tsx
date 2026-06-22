import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  checkCampaignReadiness,
  downloadFileBlob,
  getCampaign,
  getCampaignStats,
  getTransportProfiles,
  previewRecipients,
  previewSchedule,
  retryDispatchItem,
  runCampaign,
  saveCampaign,
  uploadFile
} from '../app/api';
import { createCampaignDraftSnapshot } from '../app/campaignDraft';
import { canApplyDefaultCampaignMessageTemplate, createDefaultCampaignMessageTemplate } from '../app/campaignMessageTemplate';
import { buildRecipientSourceSummary } from '../app/campaignRecipients';
import { campaignReadinessSummary, campaignReadinessTone } from '../app/campaignReadiness';
import { useAuth } from '../app/AuthContext';
import { getApiErrorMessage } from '../app/apiErrors';
import { formatDateTime } from '../app/format';
import { campaignStatusOptions, labelOf, recipientSourceOptions } from '../app/lookups';
import { validateMessageContent } from '../app/messageValidation';
import { DEFAULT_CAMPAIGN_TIME_ZONE } from '../app/scheduleValidation';
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
import { CampaignStatsPanel } from '../components/CampaignStatsPanel';
import { DataTable } from '../components/DataTable';
import { OrganizationPicker } from '../components/OrganizationPicker';
import { PageHeader } from '../components/PageHeader';
import { ScheduleBuilder } from '../components/ScheduleBuilder';
import { StatsCards } from '../components/StatsCards';
import { StatusBadge } from '../components/StatusBadge';

type CampaignEditorTab = 'basic' | 'recipients' | 'message' | 'schedule' | 'review' | 'stats';

const campaignEditorTabs: Array<{ id: CampaignEditorTab; label: string }> = [
  { id: 'basic', label: 'Основное' },
  { id: 'recipients', label: 'Получатели' },
  { id: 'message', label: 'Письмо' },
  { id: 'schedule', label: 'Расписание' },
  { id: 'review', label: 'Проверка и запуск' },
  { id: 'stats', label: 'Статистика' }
];

function buildCampaignEditorTabAriaLabel(label: string, active: boolean) {
  return `${label}: ${active ? 'текущий раздел' : 'открыть раздел'}`;
}

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
    timeZoneId: DEFAULT_CAMPAIGN_TIME_ZONE,
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
  const [schedulePreviewLoading, setSchedulePreviewLoading] = useState(false);
  const [schedulePreviewError, setSchedulePreviewError] = useState('');
  const [recipientPreviewData, setRecipientPreviewData] = useState<CampaignRecipientPreviewDto | null>(null);
  const [readiness, setReadiness] = useState<CampaignReadinessDto | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const [stats, setStats] = useState<CampaignStatisticsDto | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [activeTab, setActiveTab] = useState<CampaignEditorTab>('basic');
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');

  const buildRequest = useMemo<CampaignUpsertRequest>(
    () => buildCampaignRequest(model, selectedOrganizations, attachments),
    [attachments, model, selectedOrganizations]
  );
  const currentSnapshot = useMemo(() => createCampaignDraftSnapshot(buildRequest), [buildRequest]);
  const hasUnsavedChanges = Boolean(savedSnapshot) && currentSnapshot !== savedSnapshot;
  const messageValidationIssues = useMemo(
    () => validateMessageContent(model.htmlBody, model.plainTextBody, attachments),
    [attachments, model.htmlBody, model.plainTextBody]
  );
  const recipientSourceSummary = useMemo(
    () => buildRecipientSourceSummary(recipientPreviewData?.items ?? [], recipientSourceOptions),
    [recipientPreviewData]
  );
  const canApplyMessageTemplate = canApplyDefaultCampaignMessageTemplate(model.htmlBody, model.plainTextBody);
  const load = async () => {
    setLoading(true);
    try {
      const transportResponse = await getTransportProfiles();

      setTransportProfiles(transportResponse);
      setSchedulePreviewItems([]);
      setSchedulePreviewError('');
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
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить кампанию'), 'error', 4000);
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
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, 'Не удалось сохранить кампанию'), 'error', 4000);
    } finally {
      setSaving(false);
    }
  };

  const refreshStats = async (options: { showError?: boolean; rethrow?: boolean } = {}) => {
    if (!id) {
      return;
    }

    const showError = options.showError ?? true;
    setStatsLoading(true);
    try {
      setStats(await getCampaignStats(id));
    } catch (error: unknown) {
      if (showError) {
        showToast(getApiErrorMessage(error, 'Не удалось обновить статистику'), 'error', 4000);
      }

      if (options.rethrow) {
        throw error;
      }
    } finally {
      setStatsLoading(false);
    }
  };

  const retryCampaignDispatchItem = async (itemId: number) => {
    try {
      await retryDispatchItem(itemId);
      showToast('Сообщение возвращено в очередь', 'success');
      try {
        await refreshStats({ showError: false, rethrow: true });
      } catch (error) {
        showToast(getApiErrorMessage(error, 'Сообщение возвращено в очередь, но статистика не обновилась'), 'error', 4000);
      }
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, 'Не удалось вернуть сообщение в очередь'), 'error', 4000);
    }
  };

  const previewScheduleClick = async () => {
    setSchedulePreviewLoading(true);
    setSchedulePreviewError('');
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
    } catch (error: unknown) {
      const message = getApiErrorMessage(error, 'Не удалось построить расписание');
      setSchedulePreviewError(message);
      showToast(message, 'error', 4000);
    } finally {
      setSchedulePreviewLoading(false);
    }
  };

  const previewRecipientsClick = async () => {
    try {
      setActiveTab('recipients');
      setRecipientPreviewData(await previewRecipients(buildRequest));
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, 'Не удалось получить список получателей'), 'error', 4000);
    }
  };

  const applyMessageTemplate = () => {
    if (!canApplyMessageTemplate) {
      return;
    }

    const template = createDefaultCampaignMessageTemplate();
    patchModel(template);
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

  const loadAttachmentPreviewFile = useCallback((file: StoredFileDto) => downloadFileBlob(file.id), []);

  const checkReadinessClick = async () => {
    setReadinessLoading(true);
    try {
      setActiveTab('review');
      const result = await checkCampaignReadiness(buildRequest);
      setReadiness(result);
      showToast(result.isReady ? 'Кампания готова к запуску' : 'Кампания не готова к запуску', result.isReady ? 'success' : 'warning');
      return result;
    } catch (error: unknown) {
      showToast(getApiErrorMessage(error, 'Не удалось проверить готовность кампании'), 'error', 4000);
      return null;
    } finally {
      setReadinessLoading(false);
    }
  };

  const runNow = async () => {
    if (runningNow) {
      return;
    }

    if (!id) {
      setActiveTab('basic');
      showToast('Сначала сохраните кампанию', 'warning');
      return;
    }

    setRunningNow(true);
    try {
      const readinessResult = await checkReadinessClick();
      if (!readinessResult?.isReady) {
        return;
      }

      await runCampaign(id, {});
      showToast('Ручной запуск поставлен в очередь', 'success');
      try {
        await refreshStats({ showError: false, rethrow: true });
      } catch (error) {
        showToast(getApiErrorMessage(error, 'Кампания запущена, но статистика не обновилась'), 'error', 4000);
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось запустить кампанию вручную'), 'error', 4000);
    } finally {
      setRunningNow(false);
    }
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
            <button type="button" className="secondary-button button-inline" disabled={!id || runningNow || readinessLoading} onClick={() => void runNow()}>
              {runningNow ? <LoadingButtonLabel label="Запускаем" /> : 'Запустить сейчас'}
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
                  aria-label={buildCampaignEditorTabAriaLabel(tab.label, activeTab === tab.id)}
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
            onChange={(patch) => {
              setSchedulePreviewError('');
              patchModel(patch);
            }}
            preview={schedulePreviewItems}
            onPreview={previewScheduleClick}
            previewLoading={schedulePreviewLoading}
            previewError={schedulePreviewError}
          />
          ) : null}

          {activeTab === 'recipients' ? (
          <>
          <OrganizationPicker value={selectedOrganizations} onChange={setSelectedOrganizations} />

          <section className="panel">
            <h3>Источники адресов</h3>
            <div className="checkbox-grid">
              <label className="checkbox-option">
                <input type="checkbox" aria-label="Использовать основной email организации для рассылки" checked={model.useOrgPrimaryEmail} onChange={(event) => patchModel({ useOrgPrimaryEmail: event.target.checked })} />
                <span>Основной email организации</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" aria-label="Использовать адреса контактов для рассылки" checked={model.useContactEmails} onChange={(event) => patchModel({ useContactEmails: event.target.checked })} />
                <span>Адреса контактов</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" aria-label="Использовать email зарплатного сопровождения для рассылки" checked={model.useSalaryEmail} onChange={(event) => patchModel({ useSalaryEmail: event.target.checked })} />
                <span>Зарплата / ZP</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" aria-label="Использовать email 1C для рассылки" checked={model.useOneCEmail} onChange={(event) => patchModel({ useOneCEmail: event.target.checked })} />
                <span>1C / F1c</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" aria-label="Использовать email сайта для рассылки" checked={model.useSiteEmail} onChange={(event) => patchModel({ useSiteEmail: event.target.checked })} />
                <span>Адрес сайта</span>
              </label>
              <label className="checkbox-option">
                <input type="checkbox" aria-label="Использовать email руководителя для рассылки" checked={model.useDirectorEmail} onChange={(event) => patchModel({ useDirectorEmail: event.target.checked })} />
                <span>Адрес руководителя</span>
              </label>
            </div>

            <div className="field field-wide">
              <label>Ручные адреса</label>
              <textarea
                className="form-textarea"
                aria-label="Ручные адреса получателей рассылки"
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

              {recipientSourceSummary.length > 0 ? (
                <div className="recipient-source-summary" aria-label="Источники найденных адресов">
                  {recipientSourceSummary.map((item) => (
                    <div key={item.sourceKind} className="recipient-source-summary-item">
                      <span>{item.label}</span>
                      <strong>{item.count}</strong>
                    </div>
                  ))}
                </div>
              ) : null}

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
            <div className="section-header-inline">
              <div>
                <h3>Шаблон письма</h3>
                <div className="field-hint">HTML, текстовая версия и проверка встроенных изображений.</div>
              </div>
              <div className="message-template-actions">
                <button
                  type="button"
                  className="secondary-button button-inline"
                  disabled={!canApplyMessageTemplate}
                  onClick={applyMessageTemplate}
                >
                  Вставить шаблон
                </button>
                <StatusBadge tone={messageValidationIssues.some((issue) => issue.tone === 'danger') ? 'danger' : messageValidationIssues.length > 0 ? 'warning' : 'success'}>
                  {messageValidationIssues.length === 0 ? 'Письмо заполнено' : `Проверок: ${messageValidationIssues.length}`}
                </StatusBadge>
              </div>
            </div>

            {messageValidationIssues.length > 0 ? (
              <div className="message-validation-list">
                {messageValidationIssues.map((issue) => (
                  <div key={issue.key} className={`message-validation-item message-validation-item-${issue.tone}`}>
                    <StatusBadge tone={issue.tone}>{issue.tone === 'danger' ? 'Ошибка' : 'Внимание'}</StatusBadge>
                    <span>{issue.message}</span>
                  </div>
                ))}
              </div>
            ) : null}

            <div className="campaign-editor-grid">
              <div className="field">
                <label>HTML-версия письма</label>
                <textarea
                  className="form-textarea form-textarea-code"
                  value={model.htmlBody || ''}
                  placeholder="<p>Здравствуйте!</p>&#10;<p>Текст письма...</p>"
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
                placeholder="Здравствуйте! Текстовая версия письма..."
                onChange={(event) => patchModel({ plainTextBody: event.target.value })}
              />
            </div>
          </section>

          <AttachmentManager
            attachments={attachments}
            htmlBody={model.htmlBody}
            onChange={setAttachments}
            onUploadFiles={uploadFiles}
            onLoadPreviewFile={loadAttachmentPreviewFile}
          />
          </>
          ) : null}

          {activeTab === 'stats' ? (
            <CampaignStatsPanel
              stats={stats}
              loading={statsLoading}
              onRefresh={refreshStats}
              onRetryItem={retryCampaignDispatchItem}
              batchesTableSettingsKey={batchesTableSettingsKey}
              itemsTableSettingsKey={itemsTableSettingsKey}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}

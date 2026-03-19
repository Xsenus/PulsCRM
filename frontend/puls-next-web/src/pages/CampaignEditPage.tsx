import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getCampaign,
  getCampaignStats,
  getTransportProfiles,
  previewRecipients,
  previewSchedule,
  runCampaign,
  saveCampaign,
  uploadFile
} from '../app/api';
import { formatDateTime } from '../app/format';
import { campaignStatusOptions, dispatchStatusOptions, labelOf, recipientSourceOptions } from '../app/lookups';
import { showToast } from '../app/toast';
import type {
  CampaignDetailsDto,
  CampaignRecipientPreviewDto,
  CampaignStatisticsDto,
  CampaignUpsertRequest,
  OrganizationListItemDto,
  StoredFileDto,
  TransportProfileDto
} from '../app/types';
import { AttachmentManager, type EditableAttachment } from '../components/AttachmentManager';
import { DataTable } from '../components/DataTable';
import { OrganizationPicker } from '../components/OrganizationPicker';
import { PageHeader } from '../components/PageHeader';
import { ScheduleBuilder } from '../components/ScheduleBuilder';
import { StatsCards } from '../components/StatsCards';

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

export function CampaignEditPage() {
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
  const [stats, setStats] = useState<CampaignStatisticsDto | null>(null);

  const buildRequest = useMemo<CampaignUpsertRequest>(() => ({
    ...model,
    targetOrganizationIds: selectedOrganizations.map((item) => item.id),
    attachments: attachments.map((item, index) => ({
      storedFileId: item.storedFile.id,
      attachmentKind: item.attachmentKind,
      displayName: item.displayName || item.storedFile.originalFileName,
      contentId: item.contentId,
      sortOrder: index
    }))
  }), [attachments, model, selectedOrganizations]);

  const load = async () => {
    setLoading(true);
    try {
      const transportResponse = await getTransportProfiles();

      setTransportProfiles(transportResponse);
      setSchedulePreviewItems([]);
      setRecipientPreviewData(null);

      if (id) {
        const campaign = await getCampaign(id);
        const mapped = mapCampaignToState(campaign);
        setModel(mapped.model);
        setAttachments(mapped.attachments);
        setSelectedOrganizations(mapped.selectedOrganizations);
        setStats(await getCampaignStats(id));
      } else {
        setModel(createDefaultModel());
        setAttachments([]);
        setSelectedOrganizations([]);
        setStats(null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [id]);

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

  const runNow = async () => {
    if (!id) {
      showToast('Сначала сохраните кампанию', 'warning');
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
            <button type="button" className="secondary-button button-inline" disabled={!id} onClick={() => void runNow()}>
              Запустить сейчас
            </button>
            <button type="button" className="primary-button action-button" disabled={saving} onClick={() => void save()}>
              {saving ? 'Сохраняем...' : 'Сохранить'}
            </button>
          </>
        )}
      />

      {loading ? <div className="panel">Загрузка...</div> : null}

      {!loading ? (
        <>
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
                columns={[
                  { key: 'legacyOrgName', title: 'Организация', render: (row) => row.legacyOrgName || '—' },
                  { key: 'email', title: 'Адрес', render: (row) => row.email },
                  { key: 'displayName', title: 'Имя', render: (row) => row.displayName || '—' },
                  { key: 'sourceKind', title: 'Источник', render: (row) => labelOf(recipientSourceOptions, row.sourceKind) }
                ]}
              />
            </section>
          ) : null}

          {stats ? (
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
                    emptyText="Нет пакетов"
                    columns={[
                      { key: 'id', title: '#', render: (row) => row.id },
                      { key: 'createdAtUtc', title: 'Создан', render: (row) => formatDateTime(row.createdAtUtc) || '—' },
                      { key: 'scheduledAtUtc', title: 'Запланирован', render: (row) => formatDateTime(row.scheduledAtUtc) || '—' },
                      { key: 'totalRecipients', title: 'Всего', render: (row) => row.totalRecipients },
                      { key: 'sentCount', title: 'Отправлено', render: (row) => row.sentCount },
                      { key: 'failedCount', title: 'Ошибок', render: (row) => row.failedCount },
                      { key: 'processingCount', title: 'В обработке', render: (row) => row.processingCount }
                    ]}
                  />
                </div>

                <div className="panel-subsection">
                  <h4>Последние сообщения</h4>
                  <DataTable
                    rows={stats.recentItems}
                    getRowKey={(row) => row.id}
                    emptyText="Нет сообщений"
                    columns={[
                      { key: 'recipientEmail', title: 'Адрес', render: (row) => row.recipientEmail || '—' },
                      { key: 'legacyOrgName', title: 'Организация', render: (row) => row.legacyOrgName || '—' },
                      { key: 'status', title: 'Статус', render: (row) => labelOf(dispatchStatusOptions, row.status) },
                      { key: 'attemptCount', title: 'Попыток', render: (row) => row.attemptCount },
                      { key: 'sentAtUtc', title: 'Отправлено', render: (row) => formatDateTime(row.sentAtUtc) || '—' },
                      { key: 'errorMessage', title: 'Ошибка', render: (row) => row.errorMessage || '—' }
                    ]}
                  />
                </div>
              </div>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

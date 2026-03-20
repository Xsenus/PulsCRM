import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../app/AuthContext';
import { getOrganization, getOrganizationLookups, saveOrganization } from '../app/api';
import { showToast } from '../app/toast';
import type {
  OrganizationDetailsDto,
  OrganizationEditorLookupsDto,
  OrganizationUpsertRequest
} from '../app/types';
import { AppLoader, LoadingButtonLabel } from '../components/AppLoader';
import { OrganizationRecordWorkspace } from '../components/OrganizationRecordWorkspace';
import { PageHeader } from '../components/PageHeader';

const ORGANIZATION_REQUEST_KEYS: Array<keyof OrganizationUpsertRequest> = [
  'name',
  'smallName',
  'fullName',
  'inn',
  'raionId',
  'orgTypeId',
  'visible',
  'isManager',
  'ogrn',
  'kpp',
  'addressLegal',
  'addressActual',
  'phone',
  'site',
  'primaryEmail',
  'directorEmail',
  'salaryEmail',
  'oneCEmail',
  'siteEmail',
  'comment',
  'otherInfo',
  'salaryEnabled',
  'oneCAccountingEnabled',
  'oneCSalaryEnabled',
  'oneCHousingEnabled',
  'salaryContactName',
  'salaryContactPhone',
  'oneCContactName',
  'oneCContactPhone',
  'siteContactName',
  'siteContactPhone'
];

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M19 12H7M12 7L7 12L12 17"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function createEmptyOrganizationRequest(): OrganizationUpsertRequest {
  return {
    name: '',
    visible: true,
    isManager: false,
    salaryEnabled: false,
    oneCAccountingEnabled: false,
    oneCSalaryEnabled: false,
    oneCHousingEnabled: false
  };
}

function mapDetailsToRequest(details: OrganizationDetailsDto): OrganizationUpsertRequest {
  return {
    name: details.name,
    smallName: details.smallName,
    fullName: details.fullName,
    inn: details.inn,
    raionId: details.raionId,
    orgTypeId: details.orgTypeId,
    visible: details.visible,
    isManager: details.isManager,
    ogrn: details.ogrn,
    kpp: details.kpp,
    addressLegal: details.addressLegal,
    addressActual: details.addressActual,
    phone: details.phone,
    site: details.site,
    primaryEmail: details.primaryEmail,
    directorEmail: details.directorEmail,
    salaryEmail: details.salaryEmail,
    oneCEmail: details.oneCEmail,
    siteEmail: details.siteEmail,
    comment: details.comment,
    otherInfo: details.otherInfo,
    salaryEnabled: details.salaryEnabled,
    oneCAccountingEnabled: details.oneCAccountingEnabled,
    oneCSalaryEnabled: details.oneCSalaryEnabled,
    oneCHousingEnabled: details.oneCHousingEnabled,
    salaryContactName: details.salaryContactName,
    salaryContactPhone: details.salaryContactPhone,
    oneCContactName: details.oneCContactName,
    oneCContactPhone: details.oneCContactPhone,
    siteContactName: details.siteContactName,
    siteContactPhone: details.siteContactPhone
  };
}

function requestsEqual(left: OrganizationUpsertRequest, right: OrganizationUpsertRequest) {
  return ORGANIZATION_REQUEST_KEYS.every((key) => left[key] === right[key]);
}

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Неизвестная ошибка';
}

function getLookupName(items: OrganizationEditorLookupsDto['raions'] | OrganizationEditorLookupsDto['orgTypes'] | undefined, id?: number) {
  return id ? items?.find((item) => item.id === id)?.name : undefined;
}

export function OrganizationEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const currentUserId = String(user?.id ?? 'guest');
  const organizationId = id ? Number(id) : undefined;
  const isEdit = organizationId !== undefined && Number.isFinite(organizationId);

  const [lookups, setLookups] = useState<OrganizationEditorLookupsDto | null>(null);
  const [details, setDetails] = useState<OrganizationDetailsDto | null>(null);
  const [draft, setDraft] = useState<OrganizationUpsertRequest>(createEmptyOrganizationRequest());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const [lookupsResult, detailsResult] = await Promise.all([
          getOrganizationLookups(),
          isEdit && organizationId ? getOrganization(organizationId) : Promise.resolve(null)
        ]);

        if (cancelled) {
          return;
        }

        setLookups(lookupsResult);
        setDetails(detailsResult);
        setDraft(detailsResult ? mapDetailsToRequest(detailsResult) : createEmptyOrganizationRequest());
      } catch (error) {
        if (!cancelled) {
          showToast(toErrorMessage(error), 'error');
          navigate('/organizations', { replace: true });
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [isEdit, navigate, organizationId]);

  const handleSave = async () => {
    setSaving(true);

    try {
      const result = await saveOrganization(draft, isEdit ? organizationId : undefined);
      setDetails(result);
      setDraft(mapDetailsToRequest(result));
      showToast(isEdit ? 'Организация сохранена.' : 'Организация создана.', isEdit ? 'update' : 'create');

      if (!isEdit) {
        navigate(`/organizations/${result.id}/edit`, { replace: true });
      }
    } catch (error) {
      showToast(toErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const disabled = loading || saving;
  const raionName = details?.raion ?? getLookupName(lookups?.raions, draft.raionId);
  const orgTypeName = details?.orgType ?? getLookupName(lookups?.orgTypes, draft.orgTypeId);
  const pageTitle = isEdit
    ? draft.name.trim() || details?.name || `Организация #${organizationId}`
    : draft.name.trim() || 'Новая организация';
  const pageSubtitle = [
    draft.inn?.trim() ? `ИНН ${draft.inn.trim()}` : details?.inn ? `ИНН ${details.inn}` : null,
    raionName,
    orgTypeName
  ].filter(Boolean).join(' • ') || undefined;
  const baselineRequest = useMemo(
    () => (details ? mapDetailsToRequest(details) : createEmptyOrganizationRequest()),
    [details]
  );
  const isDirty = useMemo(
    () => !requestsEqual(baselineRequest, draft),
    [baselineRequest, draft]
  );

  return (
    <div className="page">
      <PageHeader
        title={pageTitle}
        subtitle={pageSubtitle}
        leading={(
          <button
            type="button"
            className="button-inline icon-button page-back-button"
            onClick={() => navigate('/organizations')}
            disabled={disabled}
            aria-label="К списку организаций"
            title="К списку организаций"
          >
            <BackIcon />
          </button>
        )}
        actions={(
          <button type="button" className="primary-button button-inline" onClick={() => void handleSave()} disabled={disabled}>
            {saving ? <LoadingButtonLabel label="Сохраняем" /> : 'Сохранить'}
          </button>
        )}
      />

      {loading ? (
        <section className="panel">
          <AppLoader
            variant="panel"
            label="Открываем карточку организации"
            description="Собираем реквизиты, сопровождение, связи и историю."
          />
        </section>
      ) : (
        <OrganizationRecordWorkspace
          details={details}
          draft={draft}
          lookups={lookups}
          disabled={disabled}
          isDirty={isDirty}
          raionName={raionName}
          orgTypeName={orgTypeName}
          onDraftChange={setDraft}
          tableSettings={{
            contacts: `puls-table-settings:organization-card-contacts:${currentUserId}`,
            events: `puls-table-settings:organization-card-events:${currentUserId}`,
            documents: `puls-table-settings:organization-card-documents:${currentUserId}`,
            contracts: `puls-table-settings:organization-card-contracts:${currentUserId}`,
            realizations: `puls-table-settings:organization-card-realizations:${currentUserId}`,
            licenses: `puls-table-settings:organization-card-licenses:${currentUserId}`,
            orders: `puls-table-settings:organization-card-orders:${currentUserId}`
          }}
        />
      )}
    </div>
  );
}

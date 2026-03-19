import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { deleteOrganization, getOrganization, getOrganizationLookups, saveOrganization } from '../app/api';
import { showToast } from '../app/toast';
import type { OrganizationEditorLookupsDto, OrganizationUpsertRequest, OrganizationDetailsDto } from '../app/types';
import { OrganizationEditorForm } from '../components/OrganizationEditorForm';
import { PageHeader } from '../components/PageHeader';

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

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Неизвестная ошибка';
}

export function OrganizationEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const organizationId = id ? Number(id) : undefined;
  const isEdit = organizationId !== undefined && Number.isFinite(organizationId);

  const [lookups, setLookups] = useState<OrganizationEditorLookupsDto | null>(null);
  const [draft, setDraft] = useState<OrganizationUpsertRequest>(createEmptyOrganizationRequest());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

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
      await saveOrganization(draft, isEdit ? organizationId : undefined);
      showToast(isEdit ? 'Организация сохранена.' : 'Организация создана.', isEdit ? 'update' : 'create');
      navigate('/organizations');
    } catch (error) {
      showToast(toErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!isEdit || !organizationId) {
      return;
    }

    if (!window.confirm('Удалить организацию?')) {
      return;
    }

    setDeleting(true);

    try {
      await deleteOrganization(organizationId);
      showToast('Организация удалена.', 'delete');
      navigate('/organizations');
    } catch (error) {
      showToast(toErrorMessage(error), 'error');
    } finally {
      setDeleting(false);
    }
  };

  const disabled = loading || saving || deleting;

  return (
    <div className="page">
      <PageHeader
        title={isEdit ? 'Редактирование организации' : 'Новая организация'}
        actions={(
          <>
            <button type="button" className="secondary-button" onClick={() => navigate('/organizations')} disabled={disabled}>
              К списку
            </button>
            {isEdit ? (
              <button type="button" className="secondary-button danger-button" onClick={() => void handleDelete()} disabled={disabled}>
                {deleting ? 'Удаление...' : 'Удалить'}
              </button>
            ) : null}
            <button type="button" className="primary-button" onClick={() => void handleSave()} disabled={disabled}>
              {saving ? 'Сохранение...' : 'Сохранить'}
            </button>
          </>
        )}
      />

      <section className="panel">
        {loading ? (
          <div className="empty-state">Загрузка формы...</div>
        ) : (
          <OrganizationEditorForm
            value={draft}
            lookups={lookups}
            disabled={disabled}
            onChange={setDraft}
          />
        )}
      </section>
    </div>
  );
}

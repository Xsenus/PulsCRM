import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getEmployee, getEmployeeLookups, saveEmployee } from '../app/api';
import { getApiErrorMessage } from '../app/apiErrors';
import { useAuth } from '../app/AuthContext';
import { showToast } from '../app/toast';
import type { EmployeeDetailsDto, EmployeeEditorLookupsDto, EmployeeUpsertRequest } from '../app/types';
import { ActionIcon } from '../components/ActionIcon';
import { AppLoader, LoadingButtonLabel } from '../components/AppLoader';
import { EmployeeEditorForm } from '../components/EmployeeEditorForm';
import { Modal } from '../components/Modal';
import { PageHeader } from '../components/PageHeader';

function normalizeDateInput(value?: string) {
  return value ? value.slice(0, 10) : undefined;
}

function createEmptyEmployeeRequest(lookups?: EmployeeEditorLookupsDto | null): EmployeeUpsertRequest {
  return {
    login: '',
    fullName: '',
    userGroupId: lookups?.defaultGroupId ?? lookups?.groups?.[0]?.id,
    ruleId: lookups?.defaultRuleId ?? lookups?.rules?.[0]?.id,
    privacyGroupId: lookups?.defaultPrivacyGroupId ?? lookups?.privacyGroups?.[0]?.id,
    email: '',
    phone: '',
    phoneWorkRedirect: '',
    site: '',
    address: '',
    position: '',
    icq: '',
    skype: '',
    comment: '',
    s1cCode: '',
    birthDay: undefined,
    isMale: true,
    isRoot: false,
    password: '',
    avatarBase64: undefined,
    avatarContentType: undefined,
    photoBase64: undefined,
    photoContentType: undefined
  };
}

function mapDetailsToRequest(details: EmployeeDetailsDto): EmployeeUpsertRequest {
  return {
    login: details.login,
    fullName: details.fullName ?? '',
    userGroupId: details.userGroupId,
    ruleId: details.ruleId,
    privacyGroupId: details.privacyGroupId,
    email: details.email ?? '',
    phone: details.phone ?? '',
    phoneWorkRedirect: details.phoneWorkRedirect ?? '',
    site: details.site ?? '',
    address: details.address ?? '',
    position: details.position ?? '',
    icq: details.icq ?? '',
    skype: details.skype ?? '',
    comment: details.comment ?? '',
    s1cCode: details.s1cCode ?? '',
    birthDay: normalizeDateInput(details.birthDay),
    isMale: details.isMale,
    isRoot: details.isRoot,
    password: '',
    avatarBase64: details.avatarBase64,
    avatarContentType: details.avatarContentType,
    photoBase64: details.photoBase64,
    photoContentType: details.photoContentType
  };
}

function validateDraft(
  draft: EmployeeUpsertRequest,
  isEdit: boolean,
  changePassword: boolean,
  passwordRepeat: string
) {
  if (!draft.login.trim()) {
    return 'Введите логин.';
  }

  if (!draft.fullName?.trim()) {
    return 'Введите ФИО.';
  }

  if (changePassword || !isEdit) {
    if (!draft.password?.trim()) {
      return 'Укажите пароль.';
    }

    if (draft.password !== passwordRepeat) {
      return 'Пароль и подтверждение не совпадают.';
    }
  }

  return null;
}

export function EmployeeEditPage() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user, loading: authLoading } = useAuth();
  const employeeId = id ? Number(id) : undefined;
  const isEdit = employeeId !== undefined && Number.isFinite(employeeId);
  const canEdit = !!user?.isRoot;

  const [lookups, setLookups] = useState<EmployeeEditorLookupsDto | null>(null);
  const [draft, setDraft] = useState<EmployeeUpsertRequest>(createEmptyEmployeeRequest());
  const [passwordRepeat, setPasswordRepeat] = useState('');
  const [changePassword, setChangePassword] = useState(!isEdit);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false);

  useEffect(() => {
    if (authLoading || canEdit || isEdit) {
      return;
    }

    showToast('Создание сотрудников доступно только администратору.', 'error');
    navigate('/employees', { replace: true });
  }, [authLoading, canEdit, isEdit, navigate]);

  useEffect(() => {
    if (!isEdit && !canEdit && !authLoading) {
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);

      try {
        const [lookupsResult, detailsResult] = await Promise.all([
          getEmployeeLookups(),
          isEdit && employeeId ? getEmployee(employeeId) : Promise.resolve(null)
        ]);

        if (cancelled) {
          return;
        }

        setLookups(lookupsResult);
        setChangePassword(!isEdit);
        setPasswordRepeat('');
        setDraft(detailsResult ? mapDetailsToRequest(detailsResult) : createEmptyEmployeeRequest(lookupsResult));
      } catch (error) {
        if (!cancelled) {
          showToast(getApiErrorMessage(error), 'error');
          navigate('/employees', { replace: true });
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
  }, [authLoading, canEdit, employeeId, isEdit, navigate]);

  const handlePasswordModeChange = (next: boolean) => {
    setChangePassword(next);

    if (!next) {
      setPasswordRepeat('');
      setDraft((current) => ({
        ...current,
        password: ''
      }));
    }
  };

  const requestSave = () => {
    const validationError = validateDraft(draft, isEdit, changePassword, passwordRepeat);
    if (validationError) {
      showToast(validationError, 'error');
      return;
    }

    setSaveConfirmOpen(true);
  };

  const confirmSave = async () => {
    const validationError = validateDraft(draft, isEdit, changePassword, passwordRepeat);
    if (validationError) {
      showToast(validationError, 'error');
      setSaveConfirmOpen(false);
      return;
    }

    setSaving(true);

    try {
      const request: EmployeeUpsertRequest = {
        ...draft,
        login: draft.login.trim(),
        fullName: draft.fullName?.trim(),
        password: changePassword || !isEdit ? draft.password?.trim() : undefined
      };

      await saveEmployee(request, isEdit ? employeeId : undefined);
      setSaveConfirmOpen(false);
      showToast(isEdit ? 'Изменения сотрудника сохранены.' : 'Сотрудник создан.', isEdit ? 'update' : 'create');
      navigate('/employees');
    } catch (error) {
      showToast(getApiErrorMessage(error), 'error');
    } finally {
      setSaving(false);
    }
  };

  const formDisabled = authLoading || loading || saving || !canEdit;
  const pageDisabled = authLoading || loading || saving;

  return (
    <div className="page">
      <PageHeader
        title={isEdit ? 'Редактирование сотрудника' : 'Новый сотрудник'}
        leading={(
          <button
            type="button"
            className="button-inline icon-button page-back-button"
            onClick={() => navigate('/employees')}
            disabled={pageDisabled}
            aria-label="К списку сотрудников"
            title="К списку сотрудников"
          >
            <ActionIcon kind="back" />
          </button>
        )}
        actions={(
          <>
            {canEdit ? (
              <button type="button" className="primary-button button-inline" onClick={requestSave} disabled={pageDisabled}>
                {saving ? <LoadingButtonLabel label="Сохраняем" /> : 'Сохранить'}
              </button>
            ) : null}
          </>
        )}
      />

      <section className="panel">
        {!canEdit && isEdit ? (
          <div className="readonly-banner">
            Режим просмотра. Изменение данных сотрудника доступно только администратору.
          </div>
        ) : null}

        {loading || authLoading ? (
          <AppLoader
            variant="panel"
            label="Подготавливаем форму сотрудника"
            description="Загружаем карточку, группы, правила и параметры доступа."
          />
        ) : (
          <EmployeeEditorForm
            value={draft}
            lookups={lookups}
            disabled={formDisabled}
            isEdit={isEdit}
            changePassword={changePassword}
            passwordRepeat={passwordRepeat}
            onChange={setDraft}
            onChangePasswordChange={handlePasswordModeChange}
            onPasswordRepeatChange={setPasswordRepeat}
          />
        )}
      </section>

      <Modal
        open={saveConfirmOpen}
        title={isEdit ? 'Сохранить изменения' : 'Создать сотрудника'}
        onClose={() => {
          if (!saving) {
            setSaveConfirmOpen(false);
          }
        }}
        maxWidth={520}
        actions={(
          <>
            <button type="button" className="primary-button" onClick={() => void confirmSave()} disabled={saving}>
              {saving ? <LoadingButtonLabel label="Сохраняем" /> : 'Подтвердить'}
            </button>
            <button type="button" className="secondary-button" onClick={() => setSaveConfirmOpen(false)} disabled={saving}>
              Отмена
            </button>
          </>
        )}
      >
        <div className="confirmation-copy">
          {isEdit
            ? 'Сохранить изменения в карточке сотрудника?'
            : 'Создать нового сотрудника с указанными данными?'}
        </div>
      </Modal>
    </div>
  );
}

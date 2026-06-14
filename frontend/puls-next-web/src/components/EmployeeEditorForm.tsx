import React, { useRef, useState } from 'react';
import { getApiErrorMessage } from '../app/apiErrors';
import { showToast } from '../app/toast';
import type { EmployeeEditorLookupsDto, EmployeeUpsertRequest } from '../app/types';
import { DatePickerInput } from './DatePickerInput';
import { Modal } from './Modal';

interface EmployeeEditorFormProps {
  value: EmployeeUpsertRequest;
  lookups: EmployeeEditorLookupsDto | null;
  disabled?: boolean;
  isEdit?: boolean;
  changePassword: boolean;
  passwordRepeat: string;
  onChange: (next: EmployeeUpsertRequest) => void;
  onChangePasswordChange: (next: boolean) => void;
  onPasswordRepeatChange: (next: string) => void;
}

type MediaKind = 'avatar' | 'photo';

interface PendingMediaAction {
  kind: MediaKind;
  mode: 'upload' | 'clear';
}

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 16V5M12 5L8 9M12 5L16 9M5 19H19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M4 7H20M9 7V4H15V7M8 10V17M12 10V17M16 10V17M6 7L7 19C7.06 20 7.89 20.8 8.9 20.8H15.1C16.11 20.8 16.94 20 17 19L18 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2 12S5.5 5 12 5s10 7 10 7-3.5 7-10 7S2 12 2 12Zm10 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M3 3L21 21M10.58 10.58A2 2 0 0 0 13.42 13.42M9.88 5.09A10.94 10.94 0 0 1 12 5c6.5 0 10 7 10 7a15.77 15.77 0 0 1-4.04 4.69M6.23 6.23C3.63 8 2 12 2 12s3.5 7 10 7a10.8 10.8 0 0 0 4.18-.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function updateValue(
  value: EmployeeUpsertRequest,
  patch: Partial<EmployeeUpsertRequest>
): EmployeeUpsertRequest {
  return {
    ...value,
    ...patch
  };
}

function buildImageSource(base64?: string, contentType?: string) {
  if (!base64) {
    return undefined;
  }

  return `data:${contentType || 'image/jpeg'};base64,${base64}`;
}

function extractBase64FromDataUrl(dataUrl: string) {
  const commaIndex = dataUrl.indexOf(',');
  return commaIndex >= 0 ? dataUrl.slice(commaIndex + 1) : dataUrl;
}

function readImageFile(file: File) {
  return new Promise<{ base64: string; contentType?: string }>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Не удалось прочитать изображение.'));
        return;
      }

      resolve({
        base64: extractBase64FromDataUrl(reader.result),
        contentType: file.type || undefined
      });
    };

    reader.onerror = () => reject(new Error('Не удалось загрузить изображение.'));
    reader.readAsDataURL(file);
  });
}

function getMediaTitle(kind: MediaKind) {
  return kind === 'photo' ? 'Фотография' : 'Аватар';
}

export function EmployeeEditorForm({
  value,
  lookups,
  disabled = false,
  isEdit = false,
  changePassword,
  passwordRepeat,
  onChange,
  onChangePasswordChange,
  onPasswordRepeatChange
}: EmployeeEditorFormProps) {
  const avatarInputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordRepeat, setShowPasswordRepeat] = useState(false);
  const [pendingMediaAction, setPendingMediaAction] = useState<PendingMediaAction | null>(null);
  const avatarSource = buildImageSource(value.avatarBase64, value.avatarContentType);
  const photoSource = buildImageSource(value.photoBase64, value.photoContentType);
  const passwordMismatch = !!value.password && !!passwordRepeat && value.password !== passwordRepeat;

  const applyImageUpload = async (kind: MediaKind, file?: File) => {
    if (!file) {
      return;
    }

    try {
      const image = await readImageFile(file);
      onChange(updateValue(value, kind === 'photo'
        ? {
            photoBase64: image.base64,
            photoContentType: image.contentType
          }
        : {
            avatarBase64: image.base64,
            avatarContentType: image.contentType
          }));
      showToast(`Изображение "${getMediaTitle(kind)}" обновлено.`, 'update');
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось загрузить изображение.'), 'error');
    }
  };

  const requestImageUpload = (kind: MediaKind) => {
    setPendingMediaAction({
      kind,
      mode: 'upload'
    });
  };

  const requestImageClear = (kind: MediaKind) => {
    const hasImage = kind === 'photo' ? !!value.photoBase64 : !!value.avatarBase64;
    if (!hasImage) {
      return;
    }

    setPendingMediaAction({
      kind,
      mode: 'clear'
    });
  };

  const confirmMediaAction = () => {
    if (!pendingMediaAction) {
      return;
    }

    const action = pendingMediaAction;
    const label = getMediaTitle(action.kind);
    setPendingMediaAction(null);

    if (action.mode === 'upload') {
      if (action.kind === 'photo') {
        photoInputRef.current?.click();
      } else {
        avatarInputRef.current?.click();
      }
      return;
    }

    if (action.mode === 'clear') {
      onChange(updateValue(value, action.kind === 'photo'
        ? {
            photoBase64: undefined,
            photoContentType: undefined
          }
        : {
            avatarBase64: undefined,
            avatarContentType: undefined
          }));
      showToast(`Изображение "${label}" очищено.`, 'info');
    }
  };

  const passwordInputType = showPassword ? 'text' : 'password';
  const passwordRepeatInputType = showPasswordRepeat ? 'text' : 'password';

  return (
    <form
      className="organization-editor employee-editor employee-editor-single"
      autoComplete="off"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="form-autocomplete-trap" aria-hidden="true">
        <input type="text" tabIndex={-1} autoComplete="username" />
        <input type="password" tabIndex={-1} autoComplete="new-password" />
      </div>

      <div className="employee-editor-layout">
        <div className="employee-editor-main">
          <div className="panel-subsection">
            <h4>Учетная запись</h4>
            <div className="form-grid employee-account-grid">
              <div className="field field-wide employee-account-login">
                <label htmlFor="employee-login">Логин</label>
                <input
                  id="employee-login"
                  className="form-input"
                  autoComplete="off"
                  value={value.login}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { login: event.target.value }))}
                />
              </div>

              <div className="field employee-account-full-name">
                <label htmlFor="employee-full-name">ФИО</label>
                <input
                  id="employee-full-name"
                  className="form-input"
                  autoComplete="off"
                  value={value.fullName ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { fullName: event.target.value }))}
                />
              </div>

              <div className="field employee-account-birth-day">
                <label htmlFor="employee-birth-day">Дата рождения</label>
                <DatePickerInput
                  id="employee-birth-day"
                  value={value.birthDay ?? ''}
                  disabled={disabled}
                  onChange={(birthDay) => onChange(updateValue(value, { birthDay }))}
                />
              </div>

              <div className="field employee-account-gender">
                <label>Пол</label>
                <div className="employee-gender-group" role="group" aria-label="Пол сотрудника">
                  <label className={`employee-choice-card${value.isMale ? ' active' : ''}`}>
                    <input
                      type="radio"
                      name="employee-gender"
                      checked={value.isMale}
                      disabled={disabled}
                      onChange={() => onChange(updateValue(value, { isMale: true }))}
                    />
                    <span>Мужчина</span>
                  </label>

                  <label className={`employee-choice-card${!value.isMale ? ' active' : ''}`}>
                    <input
                      type="radio"
                      name="employee-gender"
                      checked={!value.isMale}
                      disabled={disabled}
                      onChange={() => onChange(updateValue(value, { isMale: false }))}
                    />
                    <span>Женщина</span>
                  </label>
                </div>
              </div>

              <div className="field">
                <label htmlFor="employee-group">Группа</label>
                <select
                  id="employee-group"
                  className="form-select"
                  value={value.userGroupId ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, {
                    userGroupId: event.target.value ? Number(event.target.value) : undefined
                  }))}
                >
                  <option value="">Не выбрана</option>
                  {lookups?.groups.map((group) => (
                    <option key={group.id} value={group.id}>{group.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="employee-position">Должность</label>
                <input
                  id="employee-position"
                  className="form-input"
                  autoComplete="off"
                  value={value.position ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { position: event.target.value }))}
                />
              </div>

              <div className="field employee-account-code">
                <label htmlFor="employee-s1c-code">Код 1С</label>
                <input
                  id="employee-s1c-code"
                  className="form-input"
                  autoComplete="off"
                  value={value.s1cCode ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { s1cCode: event.target.value }))}
                />
              </div>
            </div>
          </div>

          <div className="panel-subsection">
            <h4>Контакты</h4>
            <div className="form-grid employee-contacts-grid">
              <div className="field employee-contact-phone">
                <label htmlFor="employee-phone">Телефон</label>
                <input
                  id="employee-phone"
                  className="form-input"
                  autoComplete="off"
                  value={value.phone ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { phone: event.target.value }))}
                />
              </div>

              <div className="field employee-contact-phone-work">
                <label htmlFor="employee-phone-work-redirect">Внутр. №</label>
                <input
                  id="employee-phone-work-redirect"
                  className="form-input"
                  autoComplete="off"
                  value={value.phoneWorkRedirect ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { phoneWorkRedirect: event.target.value }))}
                />
              </div>

              <div className="field field-wide">
                <label htmlFor="employee-email">Email</label>
                <input
                  id="employee-email"
                  className="form-input"
                  autoComplete="off"
                  value={value.email ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { email: event.target.value }))}
                />
              </div>

              <div className="field">
                <label htmlFor="employee-site">Сайт</label>
                <input
                  id="employee-site"
                  className="form-input"
                  autoComplete="off"
                  value={value.site ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { site: event.target.value }))}
                />
              </div>

              <div className="field">
                <label htmlFor="employee-icq">ICQ</label>
                <input
                  id="employee-icq"
                  className="form-input"
                  autoComplete="off"
                  value={value.icq ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { icq: event.target.value }))}
                />
              </div>

              <div className="field">
                <label htmlFor="employee-skype">Skype</label>
                <input
                  id="employee-skype"
                  className="form-input"
                  autoComplete="off"
                  value={value.skype ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { skype: event.target.value }))}
                />
              </div>

              <div className="field field-wide">
                <label htmlFor="employee-address">Адрес</label>
                <input
                  id="employee-address"
                  className="form-input"
                  autoComplete="off"
                  value={value.address ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { address: event.target.value }))}
                />
              </div>

              <div className="field field-wide">
                <label htmlFor="employee-comment">Комментарий</label>
                <textarea
                  id="employee-comment"
                  className="form-textarea"
                  autoComplete="off"
                  value={value.comment ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, { comment: event.target.value }))}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="employee-editor-side">
          <div className="panel-subsection employee-side-section">
            <h4>Изображения</h4>

            <input
              ref={avatarInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              className="employee-hidden-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                void applyImageUpload('avatar', file);
              }}
            />

            <input
              ref={photoInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/bmp"
              className="employee-hidden-input"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                void applyImageUpload('photo', file);
              }}
            />

            <div className="employee-image-grid">
              <div className="employee-image-card">
                <div className="employee-image-card-head employee-image-card-head-inline">
                  <strong>Фотография</strong>

                  <div className="employee-image-tools">
                    <button
                      type="button"
                      className="secondary-button button-inline icon-button employee-image-tool-button"
                      disabled={disabled}
                      onClick={() => requestImageUpload('photo')}
                      aria-label="Загрузить фотографию"
                      title="Загрузить фотографию"
                    >
                      <UploadIcon />
                    </button>
                    <button
                      type="button"
                      className="secondary-button button-inline icon-button employee-image-tool-button"
                      disabled={disabled || !value.photoBase64}
                      onClick={() => requestImageClear('photo')}
                      aria-label="Очистить фотографию"
                      title="Очистить фотографию"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                <div className="employee-image-preview employee-image-preview-photo">
                  {photoSource ? (
                    <img src={photoSource} alt="Фотография сотрудника" />
                  ) : (
                    <div className="employee-image-placeholder">Фотография не загружена</div>
                  )}
                </div>
              </div>

              <div className="employee-image-card">
                <div className="employee-image-card-head employee-image-card-head-inline">
                  <strong>Аватар</strong>

                  <div className="employee-image-tools">
                    <button
                      type="button"
                      className="secondary-button button-inline icon-button employee-image-tool-button"
                      disabled={disabled}
                      onClick={() => requestImageUpload('avatar')}
                      aria-label="Загрузить аватар"
                      title="Загрузить аватар"
                    >
                      <UploadIcon />
                    </button>
                    <button
                      type="button"
                      className="secondary-button button-inline icon-button employee-image-tool-button"
                      disabled={disabled || !value.avatarBase64}
                      onClick={() => requestImageClear('avatar')}
                      aria-label="Очистить аватар"
                      title="Очистить аватар"
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>

                <div className="employee-image-preview employee-image-preview-avatar">
                  {avatarSource ? (
                    <img src={avatarSource} alt="Аватар сотрудника" />
                  ) : (
                    <div className="employee-image-placeholder">Аватар не загружен</div>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="panel-subsection employee-side-section">
            <h4>Доступ</h4>

            <label className="checkbox-option employee-checkbox-card">
              <input
                type="checkbox"
                checked={value.isRoot}
                disabled={disabled}
                onChange={(event) => onChange(updateValue(value, { isRoot: event.target.checked }))}
              />
              <span>Администратор системы</span>
            </label>

            <div className="employee-access-grid">
              <div className="field">
                <label htmlFor="employee-rule">Набор правил</label>
                <select
                  id="employee-rule"
                  className="form-select"
                  value={value.ruleId ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, {
                    ruleId: event.target.value ? Number(event.target.value) : undefined
                  }))}
                >
                  <option value="">Не выбран</option>
                  {lookups?.rules.map((rule) => (
                    <option key={rule.id} value={rule.id}>{rule.name}</option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="employee-privacy-group">Приватность</label>
                <select
                  id="employee-privacy-group"
                  className="form-select"
                  value={value.privacyGroupId ?? ''}
                  disabled={disabled}
                  onChange={(event) => onChange(updateValue(value, {
                    privacyGroupId: event.target.value ? Number(event.target.value) : undefined
                  }))}
                >
                  <option value="">Не выбрана</option>
                  {lookups?.privacyGroups.map((privacyGroup) => (
                    <option key={privacyGroup.id} value={privacyGroup.id}>{privacyGroup.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {isEdit ? (
              <div className="employee-password-controls">
                <label className="checkbox-option employee-checkbox-card">
                  <input
                    type="checkbox"
                    checked={changePassword}
                    disabled={disabled}
                    onChange={(event) => onChangePasswordChange(event.target.checked)}
                  />
                  <span>Изменить пароль</span>
                </label>
              </div>
            ) : null}

            {!isEdit || changePassword ? (
              <div className="employee-password-stack">
                <div className="field">
                  <label htmlFor="employee-password">{isEdit ? 'Новый пароль' : 'Пароль'}</label>
                  <div className="employee-password-shell">
                    <input
                      id="employee-password"
                      type={passwordInputType}
                      className="form-input employee-password-input"
                      autoComplete="new-password"
                      value={value.password ?? ''}
                      disabled={disabled}
                      onChange={(event) => onChange(updateValue(value, { password: event.target.value }))}
                    />
                    <button
                      type="button"
                      className="employee-password-toggle"
                      disabled={disabled}
                      onClick={() => setShowPassword((current) => !current)}
                      aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                      title={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <span className="employee-password-toggle-icon">
                        {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                      </span>
                    </button>
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="employee-password-repeat">Повтор пароля</label>
                  <div className="employee-password-shell">
                    <input
                      id="employee-password-repeat"
                      type={passwordRepeatInputType}
                      className="form-input employee-password-input"
                      autoComplete="new-password"
                      value={passwordRepeat}
                      disabled={disabled}
                      onChange={(event) => onPasswordRepeatChange(event.target.value)}
                    />
                    <button
                      type="button"
                      className="employee-password-toggle"
                      disabled={disabled}
                      onClick={() => setShowPasswordRepeat((current) => !current)}
                      aria-label={showPasswordRepeat ? 'Скрыть пароль' : 'Показать пароль'}
                      title={showPasswordRepeat ? 'Скрыть пароль' : 'Показать пароль'}
                    >
                      <span className="employee-password-toggle-icon">
                        {showPasswordRepeat ? <EyeOffIcon /> : <EyeIcon />}
                      </span>
                    </button>
                  </div>
                  {passwordMismatch ? <div className="field-hint field-hint-error">Пароли не совпадают.</div> : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <Modal
        open={pendingMediaAction !== null}
        title="Подтвердить изменение изображения"
        onClose={() => setPendingMediaAction(null)}
        maxWidth={480}
        actions={(
          <>
            <button type="button" className="primary-button" onClick={confirmMediaAction}>
              Подтвердить
            </button>
            <button type="button" className="secondary-button" onClick={() => setPendingMediaAction(null)}>
              Отмена
            </button>
          </>
        )}
      >
        {pendingMediaAction ? (
          <div className="confirmation-copy">
            {pendingMediaAction.mode === 'upload'
              ? `Подтвердить выбор нового изображения "${getMediaTitle(pendingMediaAction.kind)}"?`
              : `Очистить изображение "${getMediaTitle(pendingMediaAction.kind)}" из формы?`}
          </div>
        ) : null}
      </Modal>
    </form>
  );
}

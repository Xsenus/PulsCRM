import React from 'react';
import type { OrganizationEditorLookupsDto, OrganizationUpsertRequest } from '../app/types';

export type OrganizationEditorSection = 'main' | 'contacts' | 'programs';

interface OrganizationEditorFormProps {
  value: OrganizationUpsertRequest;
  lookups: OrganizationEditorLookupsDto | null;
  section: OrganizationEditorSection;
  disabled?: boolean;
  onChange: (next: OrganizationUpsertRequest) => void;
}

function updateValue(
  value: OrganizationUpsertRequest,
  patch: Partial<OrganizationUpsertRequest>
): OrganizationUpsertRequest {
  return {
    ...value,
    ...patch
  };
}

function renderMainSection(
  value: OrganizationUpsertRequest,
  lookups: OrganizationEditorLookupsDto | null,
  disabled: boolean,
  onChange: (next: OrganizationUpsertRequest) => void
) {
  return (
    <>
      <div className="panel-subsection">
        <h4>Основные реквизиты</h4>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="org-name">Название</label>
            <input
              id="org-name"
              className="form-input"
              aria-label="Название организации"
              value={value.name}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { name: event.target.value }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-small-name">Краткое название</label>
            <input
              id="org-small-name"
              className="form-input"
              aria-label="Краткое название организации"
              value={value.smallName ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { smallName: event.target.value || undefined }))}
            />
          </div>

          <div className="field field-wide">
            <label htmlFor="org-full-name">Полное название</label>
            <input
              id="org-full-name"
              className="form-input"
              aria-label="Полное название организации"
              value={value.fullName ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { fullName: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-inn">ИНН</label>
            <input
              id="org-inn"
              className="form-input"
              aria-label="ИНН организации"
              value={value.inn ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { inn: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-ogrn">ОГРН</label>
            <input
              id="org-ogrn"
              className="form-input"
              aria-label="ОГРН организации"
              value={value.ogrn ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { ogrn: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-kpp">КПП</label>
            <input
              id="org-kpp"
              className="form-input"
              aria-label="КПП организации"
              value={value.kpp ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { kpp: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-raion">Район</label>
            <select
              id="org-raion"
              className="form-select"
              aria-label="Район организации"
              value={value.raionId ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, {
                raionId: event.target.value ? Number(event.target.value) : undefined
              }))}
            >
              <option value="">Не выбран</option>
              {lookups?.raions.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label htmlFor="org-type">Тип организации</label>
            <select
              id="org-type"
              className="form-select"
              aria-label="Тип организации"
              value={value.orgTypeId ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, {
                orgTypeId: event.target.value ? Number(event.target.value) : undefined
              }))}
            >
              <option value="">Не выбран</option>
              {lookups?.orgTypes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="checkbox-grid organization-editor-flags">
          <label className="checkbox-option">
            <input
              type="checkbox"
              aria-label="Запись организации видима"
              checked={value.visible}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { visible: event.target.checked }))}
            />
            <span>Запись видима</span>
          </label>

          <label className="checkbox-option">
            <input
              type="checkbox"
              aria-label="Организация доступна менеджеру"
              checked={value.isManager}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { isManager: event.target.checked }))}
            />
            <span>Для менеджера</span>
          </label>
        </div>
      </div>

      <div className="panel-subsection">
        <h4>Примечания</h4>
        <div className="form-grid">
          <div className="field field-wide">
            <label htmlFor="org-comment">Комментарий</label>
            <textarea
              id="org-comment"
              className="form-textarea"
              aria-label="Комментарий организации"
              value={value.comment ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { comment: event.target.value || undefined }))}
            />
          </div>

          <div className="field field-wide">
            <label htmlFor="org-other-info">Дополнительно</label>
            <textarea
              id="org-other-info"
              className="form-textarea"
              aria-label="Дополнительная информация организации"
              value={value.otherInfo ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { otherInfo: event.target.value || undefined }))}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function renderContactsSection(
  value: OrganizationUpsertRequest,
  disabled: boolean,
  onChange: (next: OrganizationUpsertRequest) => void
) {
  return (
    <>
      <div className="panel-subsection">
        <h4>Контактные данные</h4>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="org-phone">Телефон</label>
            <input
              id="org-phone"
              className="form-input"
              aria-label="Телефон организации"
              value={value.phone ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { phone: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-site">Сайт</label>
            <input
              id="org-site"
              className="form-input"
              aria-label="Сайт организации"
              value={value.site ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { site: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-primary-email">Основной email</label>
            <input
              id="org-primary-email"
              className="form-input"
              aria-label="Основной email организации"
              value={value.primaryEmail ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { primaryEmail: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-director-email">Email руководителя</label>
            <input
              id="org-director-email"
              className="form-input"
              aria-label="Email руководителя организации"
              value={value.directorEmail ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { directorEmail: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-salary-email">Email зарплаты</label>
            <input
              id="org-salary-email"
              className="form-input"
              aria-label="Email зарплаты организации"
              value={value.salaryEmail ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { salaryEmail: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-onec-email">Email 1C</label>
            <input
              id="org-onec-email"
              className="form-input"
              aria-label="Email 1C организации"
              value={value.oneCEmail ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { oneCEmail: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="org-site-email">Email сайта</label>
            <input
              id="org-site-email"
              className="form-input"
              aria-label="Email сайта организации"
              value={value.siteEmail ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { siteEmail: event.target.value || undefined }))}
            />
          </div>
        </div>
      </div>

      <div className="panel-subsection">
        <h4>Адреса</h4>
        <div className="form-grid">
          <div className="field field-wide">
            <label htmlFor="org-address-legal">Юридический адрес</label>
            <input
              id="org-address-legal"
              className="form-input"
              aria-label="Юридический адрес организации"
              value={value.addressLegal ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { addressLegal: event.target.value || undefined }))}
            />
          </div>

          <div className="field field-wide">
            <label htmlFor="org-address-actual">Фактический адрес</label>
            <input
              id="org-address-actual"
              className="form-input"
              aria-label="Фактический адрес организации"
              value={value.addressActual ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { addressActual: event.target.value || undefined }))}
            />
          </div>
        </div>
      </div>
    </>
  );
}

function renderProgramsSection(
  value: OrganizationUpsertRequest,
  disabled: boolean,
  onChange: (next: OrganizationUpsertRequest) => void
) {
  return (
    <>
      <div className="panel-subsection">
        <h4>Продукты и сопровождение</h4>
        <div className="checkbox-grid organization-editor-flags">
          <label className="checkbox-option">
            <input
              type="checkbox"
              aria-label="Подключена зарплата организации"
              checked={value.salaryEnabled}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { salaryEnabled: event.target.checked }))}
            />
            <span>Зарплата</span>
          </label>

          <label className="checkbox-option">
            <input
              type="checkbox"
              aria-label="Подключена 1C бухгалтерия организации"
              checked={value.oneCAccountingEnabled}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { oneCAccountingEnabled: event.target.checked }))}
            />
            <span>1C бухгалтерия</span>
          </label>

          <label className="checkbox-option">
            <input
              type="checkbox"
              aria-label="Подключена 1C зарплата организации"
              checked={value.oneCSalaryEnabled}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { oneCSalaryEnabled: event.target.checked }))}
            />
            <span>1C зарплата</span>
          </label>

          <label className="checkbox-option">
            <input
              type="checkbox"
              aria-label="Подключена 1C ЖКХ организации"
              checked={value.oneCHousingEnabled}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { oneCHousingEnabled: event.target.checked }))}
            />
            <span>1C ЖКХ</span>
          </label>
        </div>
      </div>

      <div className="panel-subsection">
        <h4>Ответственные контакты</h4>
        <div className="form-grid">
          <div className="field">
            <label htmlFor="salary-contact-name">Контакт по зарплате</label>
            <input
              id="salary-contact-name"
              className="form-input"
              value={value.salaryContactName ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { salaryContactName: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="salary-contact-phone">Телефон по зарплате</label>
            <input
              id="salary-contact-phone"
              className="form-input"
              value={value.salaryContactPhone ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { salaryContactPhone: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="onec-contact-name">Контакт по 1C</label>
            <input
              id="onec-contact-name"
              className="form-input"
              value={value.oneCContactName ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { oneCContactName: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="onec-contact-phone">Телефон по 1C</label>
            <input
              id="onec-contact-phone"
              className="form-input"
              value={value.oneCContactPhone ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { oneCContactPhone: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="site-contact-name">Контакт по сайту</label>
            <input
              id="site-contact-name"
              className="form-input"
              value={value.siteContactName ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { siteContactName: event.target.value || undefined }))}
            />
          </div>

          <div className="field">
            <label htmlFor="site-contact-phone">Телефон по сайту</label>
            <input
              id="site-contact-phone"
              className="form-input"
              value={value.siteContactPhone ?? ''}
              disabled={disabled}
              onChange={(event) => onChange(updateValue(value, { siteContactPhone: event.target.value || undefined }))}
            />
          </div>
        </div>
      </div>
    </>
  );
}

export function OrganizationEditorForm({
  value,
  lookups,
  section,
  disabled = false,
  onChange
}: OrganizationEditorFormProps) {
  return (
    <div className="organization-editor">
      {section === 'main' ? renderMainSection(value, lookups, disabled, onChange) : null}
      {section === 'contacts' ? renderContactsSection(value, disabled, onChange) : null}
      {section === 'programs' ? renderProgramsSection(value, disabled, onChange) : null}
    </div>
  );
}

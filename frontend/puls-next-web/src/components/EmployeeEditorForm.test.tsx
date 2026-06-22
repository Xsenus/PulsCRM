/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EmployeeUpsertRequest } from '../app/types';
import { EmployeeEditorForm } from './EmployeeEditorForm';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

const employeeValue: EmployeeUpsertRequest = {
  login: 'tester',
  fullName: 'Тестовый сотрудник',
  isMale: true,
  isRoot: false
};

function render(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container!);
    root.render(ui);
  });

  return container;
}

function renderEmployeeForm(isEdit = true) {
  return render(
    <EmployeeEditorForm
      value={employeeValue}
      lookups={{ groups: [], rules: [], privacyGroups: [] }}
      isEdit={isEdit}
      changePassword={false}
      passwordRepeat=""
      onChange={vi.fn()}
      onChangePasswordChange={vi.fn()}
      onPasswordRepeatChange={vi.fn()}
    />
  );
}

afterEach(() => {
  if (root && container) {
    act(() => {
      root?.unmount();
    });
  }

  root = null;
  container?.remove();
  container = null;
});

describe('EmployeeEditorForm', () => {
  it('labels account fields for assistive technologies', () => {
    const view = renderEmployeeForm();

    expect(view.querySelector('[aria-label="Логин сотрудника"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="ФИО сотрудника"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Группа сотрудника"]')).toBeInstanceOf(HTMLSelectElement);
    expect(view.querySelector('[aria-label="Должность сотрудника"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Код 1С сотрудника"]')).toBeInstanceOf(HTMLInputElement);
  });

  it('labels contact fields for assistive technologies', () => {
    const view = renderEmployeeForm();

    expect(view.querySelector('[aria-label="Телефон сотрудника"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Внутренний номер сотрудника"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Email сотрудника"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Сайт сотрудника"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="ICQ сотрудника"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Skype сотрудника"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Адрес сотрудника"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Комментарий сотрудника"]')).toBeInstanceOf(HTMLTextAreaElement);
  });

  it('labels gender and access toggles for assistive technologies', () => {
    const view = renderEmployeeForm();

    expect(view.querySelector('[aria-label="Пол сотрудника: мужчина"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Пол сотрудника: женщина"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Сотрудник является администратором системы"]')).toBeInstanceOf(HTMLInputElement);
    expect(view.querySelector('[aria-label="Изменить пароль сотрудника"]')).toBeInstanceOf(HTMLInputElement);
  });
});

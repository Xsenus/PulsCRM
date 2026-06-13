/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_CAMPAIGN_TIME_ZONE } from '../app/scheduleValidation';
import type { ScheduleOccurrenceDto } from '../app/types';
import { ScheduleBuilder, type ScheduleBuilderValue } from './ScheduleBuilder';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function scheduleValue(patch: Partial<ScheduleBuilderValue> = {}): ScheduleBuilderValue {
  return {
    scheduleKind: 0,
    cronExpression: '',
    timeZoneId: DEFAULT_CAMPAIGN_TIME_ZONE,
    startAtUtc: '2026-06-10T08:00:00.000Z',
    endAtUtc: undefined,
    intervalMinutes: 10,
    randomIntervalMinMinutes: 3,
    randomIntervalMaxMinutes: 9,
    ...patch
  };
}

function render(ui: React.ReactElement) {
  container = document.createElement('div');
  document.body.appendChild(container);

  act(() => {
    root = createRoot(container!);
    root.render(ui);
  });

  return container;
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

describe('ScheduleBuilder', () => {
  it('renders project timezone as a select option with description', () => {
    const onChange = vi.fn();
    const view = render(
      <ScheduleBuilder
        value={scheduleValue()}
        onChange={onChange}
        preview={[]}
        onPreview={vi.fn()}
      />
    );

    const timezoneSelect = view.querySelector<HTMLSelectElement>('select.form-select');

    expect(timezoneSelect?.value).toBe(DEFAULT_CAMPAIGN_TIME_ZONE);
    expect(timezoneSelect?.textContent).toContain('Новосибирск (UTC+7)');
    expect(view.textContent).toContain('Основной часовой пояс проекта.');
  });

  it('shows timezone label in schedule preview rows', () => {
    const preview: ScheduleOccurrenceDto[] = [
      {
        utc: '2026-06-10T08:00:00.000Z',
        local: '2026-06-10T15:00:00.000'
      }
    ];

    const view = render(
      <ScheduleBuilder
        value={scheduleValue()}
        onChange={vi.fn()}
        preview={preview}
        onPreview={vi.fn()}
      />
    );

    const previewRow = view.querySelector('.schedule-preview-item');

    expect(previewRow?.textContent).toContain('#1');
    expect(previewRow?.textContent).toContain('Новосибирск (UTC+7)');
    expect(previewRow?.textContent).toContain('UTC:');
  });

  it('keeps unknown timezone visible and asks to select a supported one', () => {
    const view = render(
      <ScheduleBuilder
        value={scheduleValue({ timeZoneId: 'Europe/Amsterdam' })}
        onChange={vi.fn()}
        preview={[]}
        onPreview={vi.fn()}
      />
    );

    const timezoneSelect = view.querySelector<HTMLSelectElement>('select.form-select');

    expect(timezoneSelect?.value).toBe('Europe/Amsterdam');
    expect(timezoneSelect?.textContent).toContain('Нестандартный: Europe/Amsterdam');
    expect(view.textContent).toContain('Выберите поддерживаемый часовой пояс из списка.');
  });
});

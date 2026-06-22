/** @vitest-environment jsdom */
import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act, Simulate } from 'react-dom/test-utils';
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
  it('marks schedule kinds as tabs with accessible state labels', () => {
    function ScheduleHarness() {
      const [value, setValue] = React.useState(scheduleValue({ scheduleKind: 1 }));

      return (
        <ScheduleBuilder
          value={value}
          onChange={(patch) => setValue((current) => ({ ...current, ...patch }))}
          preview={[]}
          onPreview={vi.fn()}
        />
      );
    }

    const view = render(<ScheduleHarness />);
    const tablist = view.querySelector('.schedule-kind-tabs[role="tablist"]');
    const tabs = Array.from(tablist?.querySelectorAll<HTMLButtonElement>('.settings-tab') ?? []);

    expect(tablist?.getAttribute('aria-label')).toBe('Тип расписания');
    expect(tabs.map((tab) => tab.getAttribute('role'))).toEqual(['tab', 'tab', 'tab', 'tab']);
    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'true', 'false', 'false']);
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Один запуск: выбрать тип расписания',
      'Фиксированный интервал: текущий тип расписания',
      'Случайный интервал: выбрать тип расписания',
      'Cron-расписание: выбрать тип расписания'
    ]);

    act(() => {
      Simulate.click(tabs[2]);
    });

    expect(tabs.map((tab) => tab.getAttribute('aria-selected'))).toEqual(['false', 'false', 'true', 'false']);
    expect(tabs.map((tab) => tab.getAttribute('aria-label'))).toEqual([
      'Один запуск: выбрать тип расписания',
      'Фиксированный интервал: выбрать тип расписания',
      'Случайный интервал: текущий тип расписания',
      'Cron-расписание: выбрать тип расписания'
    ]);
  });

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
    const previewTimes = Array.from(previewRow?.querySelectorAll('time') ?? []);

    expect(previewRow?.textContent).toContain('#1');
    expect(previewRow?.textContent).toContain('Новосибирск (UTC+7)');
    expect(previewRow?.textContent).toContain('UTC:');
    expect(previewTimes).toHaveLength(2);
    expect(previewTimes[0]?.getAttribute('dateTime')).toBe('2026-06-10T15:00:00.000');
    expect(previewTimes[1]?.getAttribute('dateTime')).toBe('2026-06-10T08:00:00.000Z');
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

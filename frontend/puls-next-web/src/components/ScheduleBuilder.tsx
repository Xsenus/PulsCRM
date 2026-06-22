import React from 'react';
import { formatDateTime, fromDateTimeLocalValue, toDateTimeLocalValue } from '../app/format';
import { scheduleKindOptions } from '../app/lookups';
import {
  campaignTimeZoneOptions,
  findCampaignTimeZoneOption,
  normalizeCampaignTimeZoneId,
  validateScheduleBuilderValue
} from '../app/scheduleValidation';
import type { ScheduleOccurrenceDto } from '../app/types';
import { LoadingButtonLabel } from './AppLoader';

export interface ScheduleBuilderValue {
  scheduleKind: number;
  cronExpression?: string;
  timeZoneId?: string;
  startAtUtc?: string;
  endAtUtc?: string;
  intervalMinutes: number;
  randomIntervalMinMinutes: number;
  randomIntervalMaxMinutes: number;
}

interface ScheduleBuilderProps {
  value: ScheduleBuilderValue;
  onChange: (patch: Partial<ScheduleBuilderValue>) => void;
  preview: ScheduleOccurrenceDto[];
  onPreview: () => Promise<void> | void;
  previewLoading?: boolean;
  previewError?: string;
}

const scheduleDescriptions: Record<number, string> = {
  0: 'Один запуск в выбранное время.',
  1: 'Повторять через одинаковый интервал.',
  2: 'Повторять через случайный интервал в заданных границах.',
  3: 'Использовать cron-выражение для сложного расписания.'
};

function renderDateTime(value: string) {
  return <time dateTime={value}>{formatDateTime(value)}</time>;
}

function buildScheduleKindAriaLabel(label: string, active: boolean) {
  return `${label}: ${active ? 'текущий тип расписания' : 'выбрать тип расписания'}`;
}

export function ScheduleBuilder({ value, onChange, preview, onPreview, previewLoading = false, previewError }: ScheduleBuilderProps) {
  const validationIssues = validateScheduleBuilderValue(value);
  const canPreview = validationIssues.length === 0 && !previewLoading;
  const timeZoneId = normalizeCampaignTimeZoneId(value.timeZoneId);
  const selectedTimeZone = findCampaignTimeZoneOption(timeZoneId);

  return (
    <section className="panel">
      <h3>Расписание</h3>

      <div className="settings-tabs schedule-kind-tabs" role="tablist" aria-label="Тип расписания">
        {scheduleKindOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`settings-tab${value.scheduleKind === option.value ? ' active' : ''}`}
            role="tab"
            aria-selected={value.scheduleKind === option.value}
            aria-label={buildScheduleKindAriaLabel(option.label, value.scheduleKind === option.value)}
            title={scheduleDescriptions[option.value]}
            onClick={() => onChange({ scheduleKind: option.value })}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="field-hint schedule-kind-description">
        {scheduleDescriptions[value.scheduleKind] || 'Выберите режим расчета расписания.'}
      </div>

      <div className="form-grid">
        <div className="field">
          <label>Часовой пояс</label>
          <select
            className="form-select"
            aria-label="Часовой пояс расписания"
            value={timeZoneId}
            onChange={(event) => onChange({ timeZoneId: event.target.value })}
          >
            {selectedTimeZone ? null : (
              <option value={timeZoneId}>Нестандартный: {timeZoneId}</option>
            )}
            {campaignTimeZoneOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </select>
          <div className="field-hint">
            {selectedTimeZone?.description || `Выбран нестандартный часовой пояс ${timeZoneId}.`}
          </div>
        </div>

        <div className="field">
          <label>Старт</label>
          <input
            className="form-input"
            aria-label="Старт расписания"
            type="datetime-local"
            value={toDateTimeLocalValue(value.startAtUtc)}
            onChange={(event) => onChange({ startAtUtc: fromDateTimeLocalValue(event.target.value) })}
          />
        </div>

        <div className="field">
          <label>Конец</label>
          <input
            className="form-input"
            aria-label="Конец расписания"
            type="datetime-local"
            value={toDateTimeLocalValue(value.endAtUtc)}
            onChange={(event) => onChange({ endAtUtc: fromDateTimeLocalValue(event.target.value) })}
          />
        </div>
      </div>

      {value.scheduleKind === 1 ? (
        <div className="form-grid">
          <div className="field">
            <label>Интервал, минут</label>
            <input
              className="form-input"
              aria-label="Интервал расписания в минутах"
              type="number"
              min={1}
              value={value.intervalMinutes}
              onChange={(event) => onChange({ intervalMinutes: Number(event.target.value) || 1 })}
            />
          </div>
        </div>
      ) : null}

      {value.scheduleKind === 2 ? (
        <div className="form-grid">
          <div className="field">
            <label>Минимум, минут</label>
            <input
              className="form-input"
              aria-label="Минимальный случайный интервал расписания в минутах"
              type="number"
              min={1}
              value={value.randomIntervalMinMinutes}
              onChange={(event) => onChange({ randomIntervalMinMinutes: Number(event.target.value) || 1 })}
            />
          </div>

          <div className="field">
            <label>Максимум, минут</label>
            <input
              className="form-input"
              aria-label="Максимальный случайный интервал расписания в минутах"
              type="number"
              min={1}
              value={value.randomIntervalMaxMinutes}
              onChange={(event) => onChange({ randomIntervalMaxMinutes: Number(event.target.value) || 1 })}
            />
          </div>
        </div>
      ) : null}

      {value.scheduleKind === 3 ? (
        <div className="form-grid">
          <div className="field field-wide">
            <label>Cron-выражение</label>
            <input
              className="form-input"
              aria-label="Cron-выражение расписания"
              value={value.cronExpression || ''}
              onChange={(event) => onChange({ cronExpression: event.target.value })}
            />
            <div className="field-hint">Например: `0 0/2 * * * ?` или `0 0 9 ? * MON`.</div>
          </div>
        </div>
      ) : null}

      {validationIssues.length > 0 ? (
        <div className="form-validation-list" role="alert">
          {validationIssues.map((issue) => (
            <div key={issue.key}>{issue.message}</div>
          ))}
        </div>
      ) : null}

      {previewError ? (
        <div className="form-validation-list" role="alert">
          <div>{previewError}</div>
        </div>
      ) : null}

      <div className="row-actions">
        <button type="button" className="secondary-button" disabled={!canPreview} onClick={() => void onPreview()}>
          {previewLoading ? <LoadingButtonLabel label="Считаем расписание" /> : 'Показать ближайшие запуски'}
        </button>
      </div>

      {preview.length > 0 ? (
        <div className="schedule-preview">
          {preview.map((item, index) => (
            <div key={`${item.utc}-${index}`} className="schedule-preview-item">
              <div className="schedule-preview-number">#{index + 1}</div>
              <div className="schedule-preview-time">
                <strong>{renderDateTime(item.local)}</strong>
                <span>{selectedTimeZone?.label || timeZoneId}</span>
              </div>
              <div className="schedule-preview-utc">UTC: {renderDateTime(item.utc)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

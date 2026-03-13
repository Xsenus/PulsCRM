import React from 'react';
import { formatDateTime, fromDateTimeLocalValue, toDateTimeLocalValue } from '../app/format';
import { scheduleKindOptions } from '../app/lookups';
import type { ScheduleOccurrenceDto } from '../app/types';

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
}

export function ScheduleBuilder({ value, onChange, preview, onPreview }: ScheduleBuilderProps) {
  return (
    <section className="panel">
      <h3>Расписание</h3>

      <div className="form-grid">
        <div className="field">
          <label>Тип расписания</label>
          <select
            className="form-select"
            value={value.scheduleKind}
            onChange={(event) => onChange({ scheduleKind: Number(event.target.value) })}
          >
            {scheduleKindOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Часовой пояс</label>
          <input
            className="form-input"
            value={value.timeZoneId || 'Europe/Amsterdam'}
            onChange={(event) => onChange({ timeZoneId: event.target.value })}
          />
        </div>

        <div className="field">
          <label>Старт</label>
          <input
            className="form-input"
            type="datetime-local"
            value={toDateTimeLocalValue(value.startAtUtc)}
            onChange={(event) => onChange({ startAtUtc: fromDateTimeLocalValue(event.target.value) })}
          />
        </div>

        <div className="field">
          <label>Конец</label>
          <input
            className="form-input"
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
              value={value.cronExpression || ''}
              onChange={(event) => onChange({ cronExpression: event.target.value })}
            />
            <div className="field-hint">Например: `0 0/2 * * * ?` или `0 0 9 ? * MON`.</div>
          </div>
        </div>
      ) : null}

      <div className="row-actions">
        <button type="button" className="secondary-button" onClick={() => void onPreview()}>
          Показать ближайшие запуски
        </button>
      </div>

      {preview.length > 0 ? (
        <div className="schedule-preview">
          {preview.map((item, index) => (
            <div key={`${item.utc}-${index}`} className="schedule-preview-item">
              <div>#{index + 1}</div>
              <div>{formatDateTime(item.local)}</div>
              <div className="schedule-preview-utc">UTC: {formatDateTime(item.utc)}</div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}

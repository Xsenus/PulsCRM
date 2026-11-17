import { useEffect, useState } from 'react';
import dayjs from 'dayjs';
import { ActionIcon } from '../../components/ActionIcon';
import { GROUP_STATUS_OPTIONS, formatInputDate, parseInputDate, formatTypedDate, getGroupStatusLabel } from './analyticsFormat';

export const WEEK_DAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export interface InfoDetails {
  label: string;
  title: string;
  description: string;
}

export function InfoHeader({ label, info, onOpen }: { label: string; info: InfoDetails; onOpen: (info: InfoDetails) => void }) {
  return (
    <span className="analytics-info-header">
      <span>{label}</span>
      <button type="button" className="analytics-info-icon" aria-label={`Подробнее: ${label}`} onClick={() => onOpen(info)}>
        i
        <span className="analytics-info-tooltip" role="tooltip">
          <strong>{info.title}</strong>
          <span>{info.description}</span>
        </span>
      </button>
    </span>
  );
}

export function TextHeader({ label }: { label: string }) {
  return <span className="analytics-info-header">{label}</span>;
}

export function AnalyticsDatePicker({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(() => formatInputDate(value));
  const [visibleMonth, setVisibleMonth] = useState(() => dayjs(value).startOf('month'));
  const monthStart = visibleMonth.startOf('month');
  const firstDayOffset = (monthStart.day() + 6) % 7;
  const daysInMonth = visibleMonth.daysInMonth();
  const cells = [
    ...Array.from({ length: firstDayOffset }, () => null as number | null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1)
  ];

  useEffect(() => {
    setInputValue(formatInputDate(value));
    setVisibleMonth(dayjs(value).startOf('month'));
  }, [value]);

  const commitInput = (nextValue: string) => {
    const parsed = parseInputDate(nextValue);
    if (parsed) {
      onChange(parsed);
    }
  };

  return (
    <div className="field analytics-date-field">
      <label id={`${id}-label`}>{label}</label>
      <div
        className="analytics-date-picker"
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setOpen(false);
          }
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
      >
        <div className={`analytics-date-control${open ? ' open' : ''}`}>
          <input
            id={id}
            className="analytics-date-input"
            inputMode="numeric"
            aria-labelledby={`${id}-label`}
            value={inputValue}
            onChange={(event) => {
              const nextValue = formatTypedDate(event.target.value);
              setInputValue(nextValue);
              commitInput(nextValue);
            }}
            onBlur={() => {
              if (!parseInputDate(inputValue)) {
                setInputValue(formatInputDate(value));
              }
            }}
          />
          <button
            type="button"
            className="analytics-date-trigger"
            aria-label={`Открыть календарь: ${label}`}
            aria-expanded={open}
            onClick={() => setOpen((current) => !current)}
          >
            <span className="analytics-date-icon" aria-hidden="true">▦</span>
          </button>
        </div>
        {open ? (
          <div className="analytics-calendar-popover">
            <div className="analytics-calendar-header">
              <button type="button" className="analytics-calendar-nav" onClick={() => setVisibleMonth((current) => current.subtract(1, 'month'))}>‹</button>
              <strong>{visibleMonth.format('MM.YYYY')}</strong>
              <button type="button" className="analytics-calendar-nav" onClick={() => setVisibleMonth((current) => current.add(1, 'month'))}>›</button>
            </div>
            <div className="analytics-calendar-grid analytics-calendar-weekdays">
              {WEEK_DAYS.map((day) => <span key={day}>{day}</span>)}
            </div>
            <div className="analytics-calendar-grid">
              {cells.map((day, index) => {
                if (day === null) {
                  return <span key={`empty-${index}`} className="analytics-calendar-empty" />;
                }

                const current = visibleMonth.date(day);
                const currentValue = current.format('YYYY-MM-DD');
                return (
                  <button
                    type="button"
                    key={currentValue}
                    className={`analytics-calendar-day${currentValue === value ? ' selected' : ''}${current.isSame(dayjs(), 'day') ? ' today' : ''}`}
                    onClick={() => {
                      onChange(currentValue);
                      setOpen(false);
                    }}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function StatusCombobox({
  value,
  options,
  onChange
}: {
  value: string;
  options: typeof GROUP_STATUS_OPTIONS;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedLabel = getGroupStatusLabel(value);

  return (
    <div
      className="analytics-combobox"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="analytics-combobox-button analytics-groups-status"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Фильтр по статусу"
        onClick={() => setOpen((current) => !current)}
      >
        <span>{selectedLabel}</span>
        <ActionIcon kind="chevronDown" />
      </button>
      {open ? (
        <div className="analytics-combobox-menu" role="listbox" aria-label="Фильтр по статусу">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              data-value={option.value}
              aria-selected={option.value === value}
              className={`analytics-combobox-option${option.value === value ? ' selected' : ''}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

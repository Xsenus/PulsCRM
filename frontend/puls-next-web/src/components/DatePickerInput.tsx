import React, { useEffect, useRef, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { formatDate } from '../app/format';

interface DatePickerInputProps {
  id: string;
  value?: string;
  disabled?: boolean;
  onChange: (next?: string) => void;
}

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь'
];

const WEEKDAY_NAMES = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

function parseValue(value?: string) {
  if (!value) {
    return null;
  }

  const parsed = dayjs(value);
  return parsed.isValid() ? parsed : null;
}

function getCalendarDays(month: Dayjs) {
  const monthStart = month.startOf('month');
  const startOffset = (monthStart.day() + 6) % 7;
  const startDate = monthStart.subtract(startOffset, 'day');
  const days: Dayjs[] = [];

  for (let index = 0; index < 42; index += 1) {
    days.push(startDate.add(index, 'day'));
  }

  return days;
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M8 3V6M16 3V6M4 9H20M6 5H18C19.1 5 20 5.9 20 7V19C20 20.1 19.1 21 18 21H6C4.9 21 4 20.1 4 19V7C4 5.9 4.9 5 6 5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M15 5L8 12L15 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 5L16 12L9 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function DatePickerInput({ id, value, disabled = false, onChange }: DatePickerInputProps) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selectedDate = parseValue(value);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState((selectedDate ?? dayjs()).startOf('month'));

  useEffect(() => {
    if (!open) {
      return;
    }

    setViewMonth((selectedDate ?? dayjs()).startOf('month'));
  }, [open, selectedDate?.valueOf()]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const calendarDays = getCalendarDays(viewMonth);
  const today = dayjs();

  return (
    <div className={`date-picker${open ? ' open' : ''}`} ref={wrapperRef}>
      <button
        id={id}
        type="button"
        className="form-input date-picker-trigger"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <span className={`date-picker-value${selectedDate ? '' : ' is-placeholder'}`}>
          {selectedDate ? formatDate(selectedDate.toISOString()) : 'Выберите дату'}
        </span>
        <span className="date-picker-icon">
          <CalendarIcon />
        </span>
      </button>

      {open ? (
        <div className="date-picker-popover" role="dialog" aria-label="Выбор даты">
          <div className="date-picker-header">
            <button
              type="button"
              className="secondary-button button-inline icon-button date-picker-nav"
              onClick={() => setViewMonth((current) => current.subtract(1, 'month'))}
              aria-label="Предыдущий месяц"
            >
              <ChevronLeftIcon />
            </button>

            <div className="date-picker-title">
              {MONTH_NAMES[viewMonth.month()]} {viewMonth.year()}
            </div>

            <button
              type="button"
              className="secondary-button button-inline icon-button date-picker-nav"
              onClick={() => setViewMonth((current) => current.add(1, 'month'))}
              aria-label="Следующий месяц"
            >
              <ChevronRightIcon />
            </button>
          </div>

          <div className="date-picker-weekdays">
            {WEEKDAY_NAMES.map((dayName) => (
              <span key={dayName}>{dayName}</span>
            ))}
          </div>

          <div className="date-picker-grid">
            {calendarDays.map((day) => {
              const isCurrentMonth = day.month() === viewMonth.month();
              const isSelected = !!selectedDate && day.isSame(selectedDate, 'day');
              const isToday = day.isSame(today, 'day');

              return (
                <button
                  key={day.format('YYYY-MM-DD')}
                  type="button"
                  className={`date-picker-day${isCurrentMonth ? '' : ' muted'}${isSelected ? ' selected' : ''}${isToday ? ' today' : ''}`}
                  onClick={() => {
                    onChange(day.format('YYYY-MM-DD'));
                    setOpen(false);
                  }}
                >
                  {day.date()}
                </button>
              );
            })}
          </div>

          <div className="date-picker-actions">
            <button
              type="button"
              className="secondary-button button-inline"
              onClick={() => {
                onChange(undefined);
                setOpen(false);
              }}
            >
              Очистить
            </button>
            <button
              type="button"
              className="secondary-button button-inline"
              onClick={() => {
                const nextDate = today.format('YYYY-MM-DD');
                onChange(nextDate);
                setViewMonth(today.startOf('month'));
                setOpen(false);
              }}
            >
              Сегодня
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CAMPAIGN_TIME_ZONE,
  findCampaignTimeZoneOption,
  normalizeCampaignTimeZoneId,
  validateScheduleBuilderValue
} from './scheduleValidation';
import type { ScheduleBuilderValue } from '../components/ScheduleBuilder';

function createSchedule(patch: Partial<ScheduleBuilderValue> = {}): ScheduleBuilderValue {
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

describe('schedule validation', () => {
  it('normalizes an empty timezone to the project default', () => {
    expect(normalizeCampaignTimeZoneId('')).toBe(DEFAULT_CAMPAIGN_TIME_ZONE);
    expect(findCampaignTimeZoneOption(undefined)?.id).toBe(DEFAULT_CAMPAIGN_TIME_ZONE);
  });

  it('accepts a valid one-time schedule', () => {
    expect(validateScheduleBuilderValue(createSchedule())).toEqual([]);
  });

  it('rejects unsupported timezone ids', () => {
    expect(validateScheduleBuilderValue(createSchedule({ timeZoneId: 'Europe/Amsterdam' }))).toContainEqual({
      key: 'timezone-unknown',
      message: 'Выберите поддерживаемый часовой пояс из списка.'
    });
  });

  it('rejects an end date before the start date', () => {
    expect(validateScheduleBuilderValue(createSchedule({ endAtUtc: '2026-06-10T07:59:00.000Z' }))).toContainEqual({
      key: 'range',
      message: 'Окончание расписания должно быть позже старта.'
    });
  });

  it('rejects invalid fixed interval', () => {
    expect(validateScheduleBuilderValue(createSchedule({ scheduleKind: 1, intervalMinutes: 0 }))).toContainEqual({
      key: 'interval',
      message: 'Фиксированный интервал должен быть не меньше 1 минуты.'
    });
  });

  it('rejects random interval when min is greater than max', () => {
    expect(validateScheduleBuilderValue(createSchedule({
      scheduleKind: 2,
      randomIntervalMinMinutes: 20,
      randomIntervalMaxMinutes: 10
    }))).toContainEqual({
      key: 'random-range',
      message: 'Минимальный случайный интервал не может быть больше максимального.'
    });
  });

  it('rejects malformed cron shape', () => {
    expect(validateScheduleBuilderValue(createSchedule({
      scheduleKind: 3,
      cronExpression: '0 0'
    }))).toContainEqual({
      key: 'cron-shape',
      message: 'Cron должен содержать 5, 6 или 7 частей.'
    });
  });
});

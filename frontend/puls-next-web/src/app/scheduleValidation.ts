import type { ScheduleBuilderValue } from '../components/ScheduleBuilder';

export const DEFAULT_CAMPAIGN_TIME_ZONE = 'Asia/Novosibirsk';

export interface CampaignTimeZoneOption {
  id: string;
  label: string;
  description: string;
}

export const campaignTimeZoneOptions: CampaignTimeZoneOption[] = [
  {
    id: DEFAULT_CAMPAIGN_TIME_ZONE,
    label: 'Новосибирск (UTC+7)',
    description: 'Основной часовой пояс проекта.'
  },
  {
    id: 'Asia/Krasnoyarsk',
    label: 'Красноярск (UTC+7)',
    description: 'Для регионов с красноярским временем.'
  },
  {
    id: 'Asia/Barnaul',
    label: 'Барнаул (UTC+7)',
    description: 'Для Алтайского края.'
  },
  {
    id: 'Asia/Tomsk',
    label: 'Томск (UTC+7)',
    description: 'Для Томской области.'
  },
  {
    id: 'Asia/Omsk',
    label: 'Омск (UTC+6)',
    description: 'Для Омской области.'
  },
  {
    id: 'Europe/Moscow',
    label: 'Москва (UTC+3)',
    description: 'Для федеральных или московских рассылок.'
  },
  {
    id: 'UTC',
    label: 'UTC',
    description: 'Технический режим без локального смещения.'
  }
];

export function normalizeCampaignTimeZoneId(value?: string | null) {
  return value?.trim() || DEFAULT_CAMPAIGN_TIME_ZONE;
}

export function findCampaignTimeZoneOption(value?: string | null) {
  const normalized = normalizeCampaignTimeZoneId(value);
  return campaignTimeZoneOptions.find((option) => option.id === normalized);
}

export interface ScheduleValidationIssue {
  key: string;
  message: string;
}

function isValidDate(value?: string | null) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

function hasCronShape(value?: string) {
  const parts = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  return parts.length === 5 || parts.length === 6 || parts.length === 7;
}

export function validateScheduleBuilderValue(value: ScheduleBuilderValue): ScheduleValidationIssue[] {
  const issues: ScheduleValidationIssue[] = [];

  const timeZoneId = normalizeCampaignTimeZoneId(value.timeZoneId);

  if (!value.timeZoneId?.trim()) {
    issues.push({ key: 'timezone', message: 'Укажите часовой пояс для расчета локального времени.' });
  } else if (!findCampaignTimeZoneOption(timeZoneId)) {
    issues.push({ key: 'timezone-unknown', message: 'Выберите поддерживаемый часовой пояс из списка.' });
  }

  if (!isValidDate(value.startAtUtc)) {
    issues.push({ key: 'start', message: 'Укажите корректную дату и время старта.' });
  }

  if (value.endAtUtc && !isValidDate(value.endAtUtc)) {
    issues.push({ key: 'end', message: 'Укажите корректную дату и время окончания.' });
  }

  if (isValidDate(value.startAtUtc) && isValidDate(value.endAtUtc) && new Date(value.endAtUtc!).getTime() <= new Date(value.startAtUtc!).getTime()) {
    issues.push({ key: 'range', message: 'Окончание расписания должно быть позже старта.' });
  }

  if (value.scheduleKind === 1 && value.intervalMinutes < 1) {
    issues.push({ key: 'interval', message: 'Фиксированный интервал должен быть не меньше 1 минуты.' });
  }

  if (value.scheduleKind === 2) {
    if (value.randomIntervalMinMinutes < 1 || value.randomIntervalMaxMinutes < 1) {
      issues.push({ key: 'random-positive', message: 'Случайный интервал должен быть не меньше 1 минуты.' });
    }

    if (value.randomIntervalMinMinutes > value.randomIntervalMaxMinutes) {
      issues.push({ key: 'random-range', message: 'Минимальный случайный интервал не может быть больше максимального.' });
    }
  }

  if (value.scheduleKind === 3) {
    if (!value.cronExpression?.trim()) {
      issues.push({ key: 'cron-empty', message: 'Укажите cron-выражение.' });
    } else if (!hasCronShape(value.cronExpression)) {
      issues.push({ key: 'cron-shape', message: 'Cron должен содержать 5, 6 или 7 частей.' });
    }
  }

  return issues;
}

export const campaignStatusOptions = [
  { value: 0, label: 'Черновик' },
  { value: 1, label: 'Активна' },
  { value: 2, label: 'На паузе' },
  { value: 3, label: 'Завершена' },
  { value: 4, label: 'Архив' }
];

export const scheduleKindOptions = [
  { value: 0, label: 'Один запуск' },
  { value: 1, label: 'Фиксированный интервал' },
  { value: 2, label: 'Случайный интервал' },
  { value: 3, label: 'Cron-расписание' }
];

export const attachmentKindOptions = [
  { value: 0, label: 'Вложение' },
  { value: 1, label: 'Встроенное изображение' }
];

export const dispatchStatusOptions = [
  { value: 0, label: 'В очереди' },
  { value: 1, label: 'В обработке' },
  { value: 2, label: 'Отправлено' },
  { value: 3, label: 'Ошибка' },
  { value: 4, label: 'Отменено' },
  { value: 5, label: 'Отложено' }
];

export const recipientSourceOptions = [
  { value: 0, label: 'Вручную' },
  { value: 1, label: 'Основной адрес организации' },
  { value: 2, label: 'Контактное лицо' },
  { value: 3, label: 'Зарплата' },
  { value: 4, label: '1C' },
  { value: 5, label: 'Сайт' },
  { value: 6, label: 'Руководитель' }
];

export function labelOf(options: Array<{ value: number; label: string }>, value?: number) {
  return options.find((option) => option.value === value)?.label || String(value ?? '');
}

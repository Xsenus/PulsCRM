import { describe, expect, it } from 'vitest';
import { describeBirthdayDistance, formatBirthday, getUpcomingBirthdays, type ColleagueDto } from './colleagues';

function colleague(id: number, fullName: string, month: number | null, day: number | null): ColleagueDto {
  return { id, fullName, birthdayMonth: month, birthdayDay: day, hasPhoto: false, isMale: true };
}

describe('getUpcomingBirthdays', () => {
  const today = new Date(2026, 11, 25); // 25 декабря

  it('takes the next two weeks across the new year, sorted, and skips unknown dates', () => {
    const result = getUpcomingBirthdays([
      colleague(1, 'Январский', 1, 5),
      colleague(2, 'Сегодняшний', 12, 25),
      colleague(3, 'Прошедший', 12, 24),
      colleague(4, 'Без даты', null, null),
      colleague(5, 'Далекий', 1, 10)
    ], today, 14);

    expect(result.map((item) => [item.colleague.fullName, item.inDays])).toEqual([['Сегодняшний', 0], ['Январский', 11]]);
  });

  it('celebrates 29 February on 28 February in a non-leap year', () => {
    const result = getUpcomingBirthdays([colleague(1, 'Високосный', 2, 29)], new Date(2027, 1, 27), 3);
    expect(result).toHaveLength(1);
    expect(result[0].inDays).toBe(1);
  });
});

describe('birthday formatting', () => {
  it('formats the date and the distance in Russian', () => {
    expect(formatBirthday(3, 8)).toBe('8 марта');
    expect(describeBirthdayDistance(0)).toBe('Сегодня');
    expect(describeBirthdayDistance(1)).toBe('Завтра');
    expect(describeBirthdayDistance(3)).toBe('Через 3 дня');
    expect(describeBirthdayDistance(5)).toBe('Через 5 дней');
    expect(describeBirthdayDistance(11)).toBe('Через 11 дней');
    expect(describeBirthdayDistance(21)).toBe('Через 21 день');
  });
});

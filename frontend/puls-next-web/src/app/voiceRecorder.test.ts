import { describe, expect, it } from 'vitest';
import { buildVoiceFileName, formatVoiceDuration } from './voiceRecorder';

describe('голосовые сообщения', () => {
  it('показывает длительность минутами и секундами', () => {
    expect(formatVoiceDuration(0)).toBe('0:00');
    expect(formatVoiceDuration(7_400)).toBe('0:07');
    expect(formatVoiceDuration(65_000)).toBe('1:05');
    expect(formatVoiceDuration(-5)).toBe('0:00');
    // Идущая запись: «0:01» — только через полную секунду.
    expect(formatVoiceDuration(999, true)).toBe('0:00');
    expect(formatVoiceDuration(1000, true)).toBe('0:01');
  });

  it('называет файл по дате и формату записи', () => {
    const now = new Date(2026, 10, 17, 9, 5, 3);
    expect(buildVoiceFileName('audio/webm', now)).toBe('Голосовое сообщение 2026-11-17 09-05-03.webm');
    expect(buildVoiceFileName('audio/ogg', now)).toBe('Голосовое сообщение 2026-11-17 09-05-03.ogg');
    expect(buildVoiceFileName('audio/mp4', now)).toBe('Голосовое сообщение 2026-11-17 09-05-03.m4a');
  });
});

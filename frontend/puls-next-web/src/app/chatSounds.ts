import type { ChatSoundName } from './chatTypes';

export const CHAT_SOUNDS: Array<{ name: ChatSoundName; label: string }> = [
  { name: 'chime', label: 'Перезвон' },
  { name: 'pop', label: 'Щелчок' },
  { name: 'ding', label: 'Динь' },
  { name: 'bell', label: 'Колокольчик' },
  { name: 'soft', label: 'Мягкий' }
];

interface Tone {
  frequency: number;
  start: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
}

/** Звуки синтезируются Web Audio — без аудиофайлов и внешних ресурсов. */
const SOUND_TONES: Record<ChatSoundName, Tone[]> = {
  chime: [
    { frequency: 880, start: 0, duration: 0.18 },
    { frequency: 1318.5, start: 0.12, duration: 0.32 }
  ],
  pop: [
    { frequency: 620, start: 0, duration: 0.07, type: 'triangle', gain: 1.2 },
    { frequency: 940, start: 0.04, duration: 0.08, type: 'triangle' }
  ],
  ding: [
    { frequency: 1568, start: 0, duration: 0.45, type: 'sine' }
  ],
  bell: [
    { frequency: 1046.5, start: 0, duration: 0.6, type: 'sine' },
    { frequency: 2093, start: 0, duration: 0.35, type: 'sine', gain: 0.35 },
    { frequency: 1318.5, start: 0.18, duration: 0.5, type: 'sine', gain: 0.6 }
  ],
  soft: [
    { frequency: 523.25, start: 0, duration: 0.3, type: 'sine', gain: 0.8 },
    { frequency: 659.25, start: 0.15, duration: 0.35, type: 'sine', gain: 0.7 }
  ]
};

let context: AudioContext | null = null;

function getContext() {
  if (typeof window === 'undefined') {
    return null;
  }

  const AudioContextClass = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    return null;
  }

  context ??= new AudioContextClass();
  return context;
}

/**
 * Проигрывает звук оповещения. Браузер разрешает звук только после первого действия пользователя
 * на странице — до этого вызов тихо ничего не делает.
 */
export async function playChatSound(name: ChatSoundName, volumePercent: number) {
  const audio = getContext();
  const tones = SOUND_TONES[name] ?? SOUND_TONES.chime;
  const volume = Math.max(0, Math.min(100, volumePercent)) / 100;
  if (!audio || volume <= 0) {
    return;
  }

  try {
    if (audio.state === 'suspended') {
      await audio.resume();
    }

    const now = audio.currentTime + 0.01;
    tones.forEach((tone) => {
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = tone.type ?? 'sine';
      oscillator.frequency.value = tone.frequency;

      const peak = 0.25 * volume * (tone.gain ?? 1);
      const start = now + tone.start;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0002), start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + tone.duration);

      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + tone.duration + 0.05);
    });
  } catch {
    // Звук — не критичная функция: ошибки воспроизведения игнорируем.
  }
}

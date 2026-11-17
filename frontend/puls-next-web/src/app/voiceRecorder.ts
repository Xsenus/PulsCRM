import { useCallback, useEffect, useRef, useState } from 'react';

/** Самое длинное голосовое сообщение: запись останавливается и отправляется сама. */
export const VOICE_MAX_DURATION_MS = 5 * 60 * 1000;
/** Слишком короткие записи (случайное нажатие) не отправляются. */
export const VOICE_MIN_DURATION_MS = 700;

const MIME_CANDIDATES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];

export type VoiceSupport = 'ok' | 'insecure' | 'unsupported';

/**
 * Можно ли записывать голос: нужен MediaRecorder и микрофон, а браузер дает микрофон только на HTTPS
 * (или на адресе, который в настройках браузера разрешено считать безопасным — как для уведомлений).
 */
export function getVoiceSupport(): VoiceSupport {
  if (typeof window === 'undefined' || typeof MediaRecorder === 'undefined') {
    return 'unsupported';
  }

  if (!window.isSecureContext) {
    return 'insecure';
  }

  return navigator.mediaDevices?.getUserMedia ? 'ok' : 'unsupported';
}

export function pickVoiceMimeType() {
  return MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? '';
}

function extensionFor(mimeType: string) {
  if (mimeType.includes('ogg')) {
    return 'ogg';
  }

  return mimeType.includes('mp4') ? 'm4a' : 'webm';
}

/**
 * «0:07», «1:05» — длительность записи. Для идущей записи (running) секунды не округляются вверх:
 * «0:01» появляется ровно через секунду.
 */
export function formatVoiceDuration(ms: number, running = false) {
  const seconds = ms / 1000;
  const total = Math.max(0, running ? Math.floor(seconds) : Math.round(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Имя файла голосового сообщения: «Голосовое сообщение 2026-11-17 10-30-15.webm». */
export function buildVoiceFileName(mimeType: string, now = new Date()) {
  const pad = (value: number) => String(value).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
  return `Голосовое сообщение ${stamp}.${extensionFor(mimeType)}`;
}

export interface RecordedVoice {
  file: File;
  durationMs: number;
}

/**
 * Запись голоса. start() просит микрофон и начинает запись; finish() останавливает и отдает файл в onRecorded;
 * cancel() останавливает без отправки. Микрофон отпускается сразу после остановки.
 */
export function useVoiceRecorder(onRecorded: (voice: RecordedVoice) => void, onError: (message: string) => void) {
  const [recording, setRecording] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const sendRef = useRef(false);
  const timerRef = useRef<number | null>(null);
  const callbacksRef = useRef({ onRecorded, onError });
  callbacksRef.current = { onRecorded, onError };

  const release = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    recorderRef.current = null;
    setRecording(false);
    setElapsedMs(0);
  }, []);

  const stop = useCallback((send: boolean) => {
    const recorder = recorderRef.current;
    if (!recorder) {
      return;
    }

    sendRef.current = send;
    if (recorder.state !== 'inactive') {
      recorder.stop();
    } else {
      release();
    }
  }, [release]);

  const start = useCallback(async () => {
    if (recorderRef.current) {
      return;
    }

    const support = getVoiceSupport();
    if (support !== 'ok') {
      callbacksRef.current.onError(support === 'insecure'
        ? 'Браузер дает микрофон только по защищенному адресу. Включите настройку из «Оповещения и звук» (та же, что для уведомлений) или откройте CRM по HTTPS.'
        : 'Этот браузер не умеет записывать голос.');
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (error) {
      const name = (error as DOMException | undefined)?.name;
      callbacksRef.current.onError(name === 'NotAllowedError' || name === 'SecurityError'
        ? 'Нет доступа к микрофону. Разрешите его для этого сайта (значок слева от адреса).'
        : name === 'NotFoundError' ? 'Микрофон не найден.' : 'Не удалось включить микрофон.');
      return;
    }

    const mimeType = pickVoiceMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    sendRef.current = false;
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      const durationMs = Date.now() - startedAtRef.current;
      const type = (recorder.mimeType || mimeType || 'audio/webm').split(';')[0];
      const send = sendRef.current;
      const chunks = chunksRef.current;
      chunksRef.current = [];
      release();
      if (!send) {
        return;
      }

      if (durationMs < VOICE_MIN_DURATION_MS || chunks.length === 0) {
        callbacksRef.current.onError('Слишком короткая запись — удерживайте запись хотя бы секунду.');
        return;
      }

      const file = new File(chunks, buildVoiceFileName(type), { type });
      callbacksRef.current.onRecorded({ file, durationMs: Math.min(durationMs, VOICE_MAX_DURATION_MS) });
    };

    streamRef.current = stream;
    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    recorder.start(250);
    setRecording(true);
    setElapsedMs(0);
    timerRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startedAtRef.current;
      setElapsedMs(elapsed);
      if (elapsed >= VOICE_MAX_DURATION_MS) {
        stop(true);
      }
    }, 200);
  }, [release, stop]);

  // Ушли со страницы или закрыли диалог посреди записи — запись отменяется, микрофон отпускается.
  useEffect(() => () => {
    sendRef.current = false;
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current);
    }
  }, []);

  return {
    recording,
    elapsedMs,
    start,
    finish: useCallback(() => stop(true), [stop]),
    cancel: useCallback(() => stop(false), [stop])
  };
}

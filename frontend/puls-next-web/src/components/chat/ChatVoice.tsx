import React, { useEffect, useRef, useState } from 'react';
import { fetchChatAttachmentBlob } from '../../app/chatApi';
import type { ChatAttachmentDto } from '../../app/chatTypes';
import { showToast } from '../../app/toast';
import { formatVoiceDuration } from '../../app/voiceRecorder';
import { downloadChatAttachment } from './ChatAttachmentView';

/**
 * Проигрыватель голосового сообщения (и любого аудиовложения): кнопка, полоса прогресса с перемоткой, время.
 * Файл скачивается при первом нажатии «▶» — лента не качает все записи сразу.
 */
export function ChatVoicePlayer({ attachment }: { attachment: ChatAttachmentDto }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(attachment.durationMs ?? 0);

  useEffect(() => () => {
    audioRef.current?.pause();
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
    }
  }, []);

  const ensureAudio = async () => {
    if (audioRef.current) {
      return audioRef.current;
    }

    const blob = await fetchChatAttachmentBlob(attachment.id, false);
    const url = URL.createObjectURL(blob);
    urlRef.current = url;
    const audio = new Audio(url);
    audio.preload = 'auto';
    audio.ontimeupdate = () => setPositionMs(audio.currentTime * 1000);
    audio.onloadedmetadata = () => {
      // В записях MediaRecorder длительности в файле часто нет (Infinity) — тогда берем ту, что прислал сервер.
      if (Number.isFinite(audio.duration) && audio.duration > 0) {
        setDurationMs(audio.duration * 1000);
      }
    };
    audio.onended = () => {
      setState('paused');
      setPositionMs(0);
      audio.currentTime = 0;
    };
    audio.onpause = () => setState((current) => (current === 'playing' ? 'paused' : current));
    audio.onplay = () => setState('playing');
    audioRef.current = audio;
    return audio;
  };

  const toggle = async () => {
    try {
      if (state === 'playing') {
        audioRef.current?.pause();
        return;
      }

      if (!audioRef.current) {
        setState('loading');
      }

      const audio = await ensureAudio();
      await audio.play();
    } catch {
      setState('idle');
      showToast('Не удалось воспроизвести запись.', 'error');
    }
  };

  const seek = (event: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || durationMs <= 0) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width));
    audio.currentTime = (ratio * durationMs) / 1000;
    setPositionMs(ratio * durationMs);
  };

  const progress = durationMs > 0 ? Math.min(100, (positionMs / durationMs) * 100) : 0;
  const shownTime = state === 'idle' || (state === 'paused' && positionMs === 0) ? durationMs : positionMs;
  const label = state === 'playing' ? 'Пауза' : 'Прослушать голосовое сообщение';

  return (
    <div className={`chat-voice${state === 'playing' ? ' playing' : ''}`}>
      <button type="button" className="chat-voice-toggle" onClick={() => void toggle()} aria-label={label} title={label} disabled={state === 'loading'}>
        {state === 'loading' ? <span className="chat-voice-spinner" aria-hidden="true" /> : state === 'playing' ? '❚❚' : '▶'}
      </button>
      <div
        className="chat-voice-track"
        onClick={seek}
        role="slider"
        aria-label="Позиция воспроизведения"
        aria-valuemin={0}
        aria-valuemax={Math.round(durationMs / 1000)}
        aria-valuenow={Math.round(positionMs / 1000)}
      >
        <span className="chat-voice-progress" style={{ width: `${progress}%` }} />
      </div>
      <span className="chat-voice-time">{durationMs > 0 || state !== 'idle' ? formatVoiceDuration(shownTime) : '🎤'}</span>
      <button type="button" className="chat-voice-download" onClick={() => void downloadChatAttachment(attachment)} aria-label="Скачать запись" title="Скачать запись">⤓</button>
    </div>
  );
}

/** Полоса записи вместо поля ввода: мигающая точка, время, «Отмена» и «Отправить». */
export function ChatVoiceRecorderBar({ elapsedMs, onCancel, onSend }: { elapsedMs: number; onCancel: () => void; onSend: () => void }) {
  return (
    <div
      className="chat-composer-row chat-voice-recording"
      role="group"
      aria-label="Запись голосового сообщения"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <button type="button" className="chat-icon-button" onClick={onCancel} aria-label="Отменить запись" title="Отменить запись (Esc)">✕</button>
      <span className="chat-voice-recording-dot" aria-hidden="true" />
      <span className="chat-voice-recording-time" aria-live="off">{formatVoiceDuration(elapsedMs, true)}</span>
      <span className="chat-voice-recording-hint">Идет запись…</span>
      <button type="button" className="chat-send-button" onClick={onSend} aria-label="Отправить голосовое сообщение" title="Отправить (Enter)" autoFocus>➤</button>
    </div>
  );
}

import React, { useEffect, useRef, useState } from 'react';

export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✅'];

export const EMOJI_GROUPS: Array<{ key: string; label: string; icon: string; items: string[] }> = [
  {
    key: 'smileys',
    label: 'Смайлы',
    icon: '😀',
    items: ['😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😋', '😜', '🤪', '🤗', '🤔', '🤨', '😐', '😑', '😶', '🙄', '😏', '😌', '😴', '🤒', '🤯', '🥳', '😎', '🤓', '🧐', '😕', '😟', '😮', '😲', '🥺', '😢', '😭', '😤', '😡', '🤬', '😱', '😳', '🫡', '🤝']
  },
  {
    key: 'gestures',
    label: 'Жесты',
    icon: '👍',
    items: ['👍', '👎', '👌', '✌️', '🤞', '🤟', '🤙', '👋', '👏', '🙌', '🙏', '💪', '👀', '🫶', '✍️', '☝️', '👉', '👈', '👆', '👇', '✋', '🤚', '🖐️', '🤷', '🤦', '🙋', '🙅', '🙆', '💁', '🧑‍💻']
  },
  {
    key: 'symbols',
    label: 'Символы',
    icon: '❤️',
    items: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💯', '🔥', '⭐', '✨', '⚡', '💡', '✅', '☑️', '❌', '⚠️', '❗', '❓', '⏰', '⏳', '📌', '📍', '🔔', '🔕', '🎉', '🎯', '🏆']
  },
  {
    key: 'work',
    label: 'Работа',
    icon: '💼',
    items: ['💼', '📁', '📂', '📄', '📃', '📑', '📊', '📈', '📉', '🗂️', '🗓️', '📅', '📆', '📎', '🖇️', '✂️', '🖊️', '📝', '📋', '📞', '☎️', '📧', '✉️', '📨', '💻', '🖥️', '🖨️', '⌨️', '🧾', '💰', '💳', '🏦', '🏢', '🔒', '🔑', '🛠️', '⚙️', '🚀', '☕', '🍕']
  }
];

/** Иконки для групповых чатов. */
export const GROUP_ICONS = ['💬', '👥', '💼', '📊', '📈', '🛠️', '🚀', '📣', '🏢', '💰', '🧾', '🎯', '⚙️', '📦', '🤝', '☕'];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  className?: string;
}

export function EmojiPicker({ onSelect, onClose, className }: EmojiPickerProps) {
  const [group, setGroup] = useState(EMOJI_GROUPS[0].key);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const current = EMOJI_GROUPS.find((item) => item.key === group) ?? EMOJI_GROUPS[0];

  return (
    <div className={`chat-emoji-picker ${className ?? ''}`} ref={ref} role="dialog" aria-label="Выбор эмодзи">
      <div className="chat-emoji-tabs" role="tablist">
        {EMOJI_GROUPS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === group}
            className={`chat-emoji-tab${item.key === group ? ' active' : ''}`}
            onClick={() => setGroup(item.key)}
            title={item.label}
          >
            {item.icon}
          </button>
        ))}
      </div>
      <div className="chat-emoji-grid">
        {current.items.map((emoji) => (
          <button key={emoji} type="button" className="chat-emoji-item" onClick={() => onSelect(emoji)} aria-label={emoji}>
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

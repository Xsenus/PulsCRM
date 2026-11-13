import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from '../Modal';
import { useChat } from '../../app/ChatContext';
import {
  addChatMembers,
  createGroupChat,
  forwardChatMessage,
  leaveChat,
  openDirectChat,
  removeChatMember,
  searchChatUsers,
  setChatMemberRole,
  updateGroupChat
} from '../../app/chatApi';
import { CHAT_SOUNDS, playChatSound } from '../../app/chatSounds';
import { getDesktopNotificationStatus, requestDesktopNotificationPermission, type DesktopNotificationStatus } from '../../app/desktopNotifications';
import type { ChatConversationDto, ChatMessageDto, ChatSoundName, ChatUserDto, ChatUserSettingsDto } from '../../app/chatTypes';
import { isGroupConversation, roleRank } from '../../app/chatTypes';
import { getApiErrorMessage } from '../../app/apiErrors';
import { showToast } from '../../app/toast';
import { ChatAvatar } from './ChatAvatar';
import { describeMessageBody } from '../../app/chatFormat';
import { GROUP_ICONS } from './EmojiPicker';

function useUserSearch(open: boolean) {
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<ChatUserDto[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchChatUsers(search.trim(), 50)
        .then((items) => active && setUsers(items))
        .catch(() => active && setUsers([]))
        .finally(() => active && setLoading(false));
    }, 250);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, search]);

  return { search, setSearch, users, loading };
}

function UserPicker({ users, loading, search, onSearch, selected, onToggle, excludeIds, multiple }: {
  users: ChatUserDto[];
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  selected: number[];
  onToggle: (user: ChatUserDto) => void;
  excludeIds?: number[];
  multiple: boolean;
}) {
  const { onlineUserIds } = useChat();
  const visible = users.filter((user) => !excludeIds?.includes(user.id));

  return (
    <div className="chat-user-picker">
      <input
        className="chat-input"
        type="search"
        placeholder="Поиск сотрудника по имени или логину"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        autoFocus
      />
      <div className="chat-user-list" role="listbox" aria-multiselectable={multiple}>
        {loading && visible.length === 0 ? <div className="chat-muted">Загрузка…</div> : null}
        {!loading && visible.length === 0 ? <div className="chat-muted">Никого не нашли</div> : null}
        {visible.map((user) => {
          const isSelected = selected.includes(user.id);
          return (
            <button
              key={user.id}
              type="button"
              role="option"
              aria-selected={isSelected}
              className={`chat-user-row${isSelected ? ' selected' : ''}`}
              onClick={() => onToggle(user)}
            >
              <ChatAvatar name={user.displayName} seed={user.id} size={36} online={onlineUserIds.has(user.id)} />
              <span className="chat-user-row-text">
                <span className="chat-user-row-name">{user.displayName}</span>
                <span className="chat-user-row-meta">{[user.login, user.groupName].filter(Boolean).join(' · ')}</span>
              </span>
              {multiple ? <span className={`chat-check${isSelected ? ' checked' : ''}`} aria-hidden="true">{isSelected ? '✓' : ''}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export const MAX_FORWARD_TARGETS = 10;

/** Выбор диалогов для пересылки сообщения. */
export function ForwardMessageDialog({ message, onClose }: {
  /** null — окно закрыто. */
  message: ChatMessageDto | null;
  onClose: () => void;
}) {
  const { conversations, currentUserId, applyMessageLocally } = useChat();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<number[]>([]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (message) {
      setFilter('');
      setSelected([]);
    }
  }, [message]);

  const candidates = useMemo(() => {
    const term = filter.trim().toLowerCase();
    return conversations.filter((item) => {
      // В личный диалог с уволенным писать нельзя.
      const peer = !isGroupConversation(item) ? item.participants.find((participant) => participant.userId !== currentUserId) : null;
      if (peer?.isInactive) {
        return false;
      }

      return !term || item.title.toLowerCase().includes(term);
    });
  }, [conversations, currentUserId, filter]);

  const toggle = (conversationId: number) => {
    setSelected((current) => {
      if (current.includes(conversationId)) {
        return current.filter((id) => id !== conversationId);
      }

      if (current.length >= MAX_FORWARD_TARGETS) {
        showToast(`Переслать можно не больше чем в ${MAX_FORWARD_TARGETS} чатов за раз.`, 'warning');
        return current;
      }

      return [...current, conversationId];
    });
  };

  const submit = async () => {
    if (!message || selected.length === 0) {
      return;
    }

    setSending(true);
    try {
      const created = await forwardChatMessage(message.id, selected);
      created.forEach((item) => applyMessageLocally(item));
      showToast(created.length === 1 ? 'Сообщение переслано.' : `Сообщение переслано в ${created.length} чата.`, 'success', 2000);
      onClose();
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось переслать сообщение.'), 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal
      open={!!message}
      title="Переслать сообщение"
      onClose={onClose}
      maxWidth={520}
      actions={(
        <div className="button-group">
          <button type="button" className="secondary-button button-inline" onClick={onClose}>Отмена</button>
          <button type="button" className="primary-button button-inline" disabled={sending || selected.length === 0} onClick={() => void submit()}>
            Переслать{selected.length > 0 ? ` (${selected.length})` : ''}
          </button>
        </div>
      )}
    >
      {message ? <div className="chat-forward-preview">{describeMessageBody(message) || 'Сообщение'}</div> : null}
      <div className="chat-user-picker">
        <input
          className="chat-input"
          type="search"
          placeholder="Найти чат"
          aria-label="Найти чат"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
          autoFocus
        />
        <div className="chat-user-list" role="listbox" aria-multiselectable="true" aria-label="Куда переслать">
          {candidates.length === 0 ? <div className="chat-muted">Чатов не нашли</div> : null}
          {candidates.map((item) => {
            const isSelected = selected.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`chat-user-row${isSelected ? ' selected' : ''}`}
                onClick={() => toggle(item.id)}
              >
                <ChatAvatar name={item.title} seed={item.peerUserId ?? `g${item.id}`} icon={item.icon} group={isGroupConversation(item)} size={36} />
                <span className="chat-user-row-text">
                  <span className="chat-user-row-name">{item.title}</span>
                  <span className="chat-user-row-meta">{isGroupConversation(item) ? `Групповой · ${item.participants.length}` : 'Личный'}</span>
                </span>
                <span className={`chat-check${isSelected ? ' checked' : ''}`} aria-hidden="true">{isSelected ? '✓' : ''}</span>
              </button>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

export function NewChatDialog({ open, onClose, onOpened }: {
  open: boolean;
  onClose: () => void;
  onOpened: (conversation: ChatConversationDto) => void;
}) {
  const { upsertConversation } = useChat();
  const [mode, setMode] = useState<'direct' | 'group'>('direct');
  const [title, setTitle] = useState('');
  const [icon, setIcon] = useState(GROUP_ICONS[0]);
  const [selected, setSelected] = useState<ChatUserDto[]>([]);
  const [saving, setSaving] = useState(false);
  const { search, setSearch, users, loading } = useUserSearch(open);

  useEffect(() => {
    if (open) {
      setMode('direct');
      setTitle('');
      setIcon(GROUP_ICONS[0]);
      setSelected([]);
      setSearch('');
    }
  }, [open, setSearch]);

  const openDirect = async (user: ChatUserDto) => {
    setSaving(true);
    try {
      const conversation = await openDirectChat(user.id);
      upsertConversation(conversation);
      onOpened(conversation);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось открыть диалог.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const createGroup = async () => {
    setSaving(true);
    try {
      const conversation = await createGroupChat({ title: title.trim(), icon, memberUserIds: selected.map((user) => user.id) });
      upsertConversation(conversation);
      onOpened(conversation);
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось создать чат.'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Новый чат"
      onClose={onClose}
      maxWidth={560}
      actions={mode === 'group' ? (
        <div className="button-group">
          <button type="button" className="secondary-button button-inline" onClick={onClose}>Отмена</button>
          <button
            type="button"
            className="primary-button button-inline"
            disabled={saving || !title.trim() || selected.length === 0}
            onClick={() => void createGroup()}
          >
            Создать чат{selected.length > 0 ? ` (${selected.length + 1})` : ''}
          </button>
        </div>
      ) : undefined}
    >
      <div className="chat-segmented" role="tablist">
        <button type="button" role="tab" aria-selected={mode === 'direct'} className={mode === 'direct' ? 'active' : ''} onClick={() => setMode('direct')}>
          Личный
        </button>
        <button type="button" role="tab" aria-selected={mode === 'group'} className={mode === 'group' ? 'active' : ''} onClick={() => setMode('group')}>
          Групповой
        </button>
      </div>

      {mode === 'group' ? (
        <div className="chat-group-form">
          <div className="chat-icon-picker" role="radiogroup" aria-label="Иконка чата">
            {GROUP_ICONS.map((item) => (
              <button key={item} type="button" role="radio" aria-checked={icon === item} className={icon === item ? 'active' : ''} onClick={() => setIcon(item)}>
                {item}
              </button>
            ))}
          </div>
          <input className="chat-input" placeholder="Название чата" value={title} maxLength={256} onChange={(event) => setTitle(event.target.value)} />
          {selected.length > 0 ? (
            <div className="chat-chips">
              {selected.map((user) => (
                <button key={user.id} type="button" className="chat-chip" onClick={() => setSelected((items) => items.filter((item) => item.id !== user.id))} title="Убрать">
                  {user.displayName} ×
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      <UserPicker
        users={users}
        loading={loading}
        search={search}
        onSearch={setSearch}
        multiple={mode === 'group'}
        selected={selected.map((user) => user.id)}
        onToggle={(user) => {
          if (mode === 'direct') {
            if (!saving) {
              void openDirect(user);
            }

            return;
          }

          setSelected((items) => items.some((item) => item.id === user.id) ? items.filter((item) => item.id !== user.id) : [...items, user]);
        }}
      />
    </Modal>
  );
}

export function ConversationInfoDialog({ open, conversation, onClose, onLeft }: {
  open: boolean;
  conversation: ChatConversationDto;
  onClose: () => void;
  onLeft: () => void;
}) {
  const { currentUserId, onlineUserIds, upsertConversation, removeConversation } = useChat();
  const isGroup = isGroupConversation(conversation);
  const myRank = roleRank(conversation.myRole);
  const canManage = isGroup && myRank >= 1;
  const [title, setTitle] = useState(conversation.title);
  const [description, setDescription] = useState(conversation.description ?? '');
  const [icon, setIcon] = useState(conversation.icon ?? GROUP_ICONS[0]);
  const [adding, setAdding] = useState(false);
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const { search, setSearch, users, loading } = useUserSearch(open && adding);

  useEffect(() => {
    if (open) {
      setTitle(conversation.title);
      setDescription(conversation.description ?? '');
      setIcon(conversation.icon ?? GROUP_ICONS[0]);
      setAdding(false);
      setSelected([]);
    }
  }, [open, conversation.id, conversation.title, conversation.description, conversation.icon]);

  const run = async (action: () => Promise<ChatConversationDto | void>, success?: string) => {
    setBusy(true);
    try {
      const result = await action();
      if (result) {
        upsertConversation(result);
      }

      if (success) {
        showToast(success, 'success');
      }
    } catch (error) {
      showToast(getApiErrorMessage(error, 'Не удалось выполнить действие.'), 'error');
    } finally {
      setBusy(false);
    }
  };

  const participants = useMemo(() => [...conversation.participants].sort((a, b) => roleRank(b.role) - roleRank(a.role) || a.displayName.localeCompare(b.displayName, 'ru')), [conversation.participants]);
  const dirty = title.trim() !== conversation.title || description.trim() !== (conversation.description ?? '') || icon !== (conversation.icon ?? GROUP_ICONS[0]);

  return (
    <Modal open={open} title={isGroup ? 'О групповом чате' : 'О диалоге'} onClose={onClose} maxWidth={600}>
      {isGroup && canManage ? (
        <div className="chat-group-form">
          <div className="chat-icon-picker" role="radiogroup" aria-label="Иконка чата">
            {GROUP_ICONS.map((item) => (
              <button key={item} type="button" role="radio" aria-checked={icon === item} className={icon === item ? 'active' : ''} onClick={() => setIcon(item)}>
                {item}
              </button>
            ))}
          </div>
          <input className="chat-input" value={title} maxLength={256} onChange={(event) => setTitle(event.target.value)} placeholder="Название чата" />
          <textarea className="chat-input" value={description} maxLength={1024} rows={2} onChange={(event) => setDescription(event.target.value)} placeholder="Описание (необязательно)" />
          {dirty ? (
            <button
              type="button"
              className="primary-button button-inline"
              disabled={busy || !title.trim()}
              onClick={() => void run(() => updateGroupChat(conversation.id, { title: title.trim(), description: description.trim() || undefined, icon }), 'Чат обновлен.')}
            >
              Сохранить
            </button>
          ) : null}
        </div>
      ) : (
        <div className="chat-info-head">
          <ChatAvatar name={conversation.title} seed={conversation.peerUserId ?? conversation.id} icon={conversation.icon} size={56} group={isGroup} />
          <div>
            <div className="chat-info-title">{conversation.title}</div>
            {conversation.description ? <div className="chat-muted">{conversation.description}</div> : null}
          </div>
        </div>
      )}

      {isGroup ? (
        <>
          <div className="chat-section-title">
            Участники · {participants.length}
            {canManage && !adding ? (
              <button type="button" className="chat-link-button" onClick={() => setAdding(true)}>+ Добавить</button>
            ) : null}
          </div>

          {adding ? (
            <div className="chat-add-members">
              <UserPicker
                users={users}
                loading={loading}
                search={search}
                onSearch={setSearch}
                multiple
                selected={selected}
                excludeIds={participants.map((item) => item.userId)}
                onToggle={(user) => setSelected((items) => items.includes(user.id) ? items.filter((id) => id !== user.id) : [...items, user.id])}
              />
              <div className="button-group">
                <button type="button" className="secondary-button button-inline" onClick={() => { setAdding(false); setSelected([]); }}>Отмена</button>
                <button
                  type="button"
                  className="primary-button button-inline"
                  disabled={busy || selected.length === 0}
                  onClick={() => void run(async () => {
                    const result = await addChatMembers(conversation.id, selected);
                    setAdding(false);
                    setSelected([]);
                    return result;
                  }, 'Участники добавлены.')}
                >
                  Добавить ({selected.length})
                </button>
              </div>
            </div>
          ) : null}

          <div className="chat-member-list">
            {participants.map((participant) => {
              const rank = roleRank(participant.role);
              const isMe = participant.userId === currentUserId;
              return (
                <div key={participant.userId} className="chat-member-row">
                  <ChatAvatar name={participant.displayName} seed={participant.userId} size={34} online={onlineUserIds.has(participant.userId)} />
                  <span className="chat-user-row-text">
                    <span className="chat-user-row-name">{participant.displayName}{isMe ? ' (вы)' : ''}</span>
                    <span className="chat-user-row-meta">
                      {rank === 2 ? 'Создатель' : rank === 1 ? 'Администратор' : 'Участник'}
                      {participant.isInactive ? ' · уволен' : ''}
                      {onlineUserIds.has(participant.userId) ? ' · в сети' : ''}
                    </span>
                  </span>
                  {!isMe && myRank === 2 && rank < 2 ? (
                    <button
                      type="button"
                      className="chat-link-button"
                      disabled={busy}
                      onClick={() => void run(() => setChatMemberRole(conversation.id, participant.userId, rank === 1 ? 'Member' : 'Admin'))}
                    >
                      {rank === 1 ? 'Снять админа' : 'Сделать админом'}
                    </button>
                  ) : null}
                  {!isMe && canManage && rank < 2 && (myRank === 2 || rank === 0) ? (
                    <button
                      type="button"
                      className="chat-link-button chat-danger-text"
                      disabled={busy}
                      onClick={() => {
                        if (window.confirm(`Исключить ${participant.displayName} из чата?`)) {
                          void run(() => removeChatMember(conversation.id, participant.userId));
                        }
                      }}
                    >
                      Исключить
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            className="danger-button button-inline chat-leave-button"
            disabled={busy}
            onClick={() => {
              if (!window.confirm('Покинуть чат? Вернуть вас сможет администратор.')) {
                return;
              }

              void run(async () => {
                await leaveChat(conversation.id);
                removeConversation(conversation.id);
                onLeft();
              });
            }}
          >
            Покинуть чат
          </button>
        </>
      ) : null}
    </Modal>
  );
}

export function ChatSettingsDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, saveSettings } = useChat();
  const [draft, setDraft] = useState<ChatUserSettingsDto>(settings);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDraft(settings);
    }
  }, [open, settings]);

  const update = (patch: Partial<ChatUserSettingsDto>) => setDraft((current) => ({ ...current, ...patch }));

  return (
    <Modal
      open={open}
      title="Оповещения чата"
      onClose={onClose}
      maxWidth={520}
      actions={(
        <div className="button-group">
          <button type="button" className="secondary-button button-inline" onClick={onClose}>Отмена</button>
          <button
            type="button"
            className="primary-button button-inline"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              try {
                await saveSettings(draft);
                showToast('Настройки сохранены.', 'success');
                onClose();
              } catch (error) {
                showToast(getApiErrorMessage(error, 'Не удалось сохранить настройки.'), 'error');
              } finally {
                setSaving(false);
              }
            }}
          >
            Сохранить
          </button>
        </div>
      )}
    >
      <div className="chat-settings">
        <label className="chat-toggle">
          <input type="checkbox" checked={draft.notificationsEnabled} onChange={(event) => update({ notificationsEnabled: event.target.checked })} />
          <span>Показывать оповещения о новых сообщениях</span>
        </label>
        <label className="chat-toggle">
          <input
            type="checkbox"
            checked={draft.showMessagePreview}
            disabled={!draft.notificationsEnabled}
            onChange={(event) => update({ showMessagePreview: event.target.checked })}
          />
          <span>Показывать текст сообщения в оповещении</span>
        </label>
        <DesktopNotificationsToggle
          enabled={!!draft.desktopNotificationsEnabled}
          disabled={!draft.notificationsEnabled}
          onChange={(value) => update({ desktopNotificationsEnabled: value })}
        />
        <label className="chat-toggle">
          <input type="checkbox" checked={draft.soundEnabled} onChange={(event) => update({ soundEnabled: event.target.checked })} />
          <span>Звук при новом сообщении</span>
        </label>

        <div className={`chat-sound-options${draft.soundEnabled ? '' : ' disabled'}`}>
          <div className="chat-section-title">Звук</div>
          <div className="chat-sound-list" role="radiogroup" aria-label="Звук оповещения">
            {CHAT_SOUNDS.map((sound) => (
              <label key={sound.name} className={`chat-sound-item${draft.soundName === sound.name ? ' active' : ''}`}>
                <input
                  type="radio"
                  name="chat-sound"
                  value={sound.name}
                  checked={draft.soundName === sound.name}
                  disabled={!draft.soundEnabled}
                  onChange={() => {
                    update({ soundName: sound.name as ChatSoundName });
                    void playChatSound(sound.name, draft.soundVolume);
                  }}
                />
                <span>{sound.label}</span>
                <button
                  type="button"
                  className="chat-sound-play"
                  disabled={!draft.soundEnabled}
                  onClick={(event) => { event.preventDefault(); void playChatSound(sound.name, draft.soundVolume); }}
                  aria-label={`Прослушать «${sound.label}»`}
                >
                  ▶
                </button>
              </label>
            ))}
          </div>

          <label className="chat-volume">
            <span>Громкость: {draft.soundVolume}%</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={draft.soundVolume}
              disabled={!draft.soundEnabled}
              onChange={(event) => update({ soundVolume: Number(event.target.value) })}
              onMouseUp={() => void playChatSound(draft.soundName, draft.soundVolume)}
              onTouchEnd={() => void playChatSound(draft.soundName, draft.soundVolume)}
            />
          </label>
        </div>
        <div className="chat-muted">Звук и оповещения не срабатывают для диалогов, у которых включен режим «Без звука».</div>
      </div>
    </Modal>
  );
}

const DESKTOP_STATUS_TEXT: Record<DesktopNotificationStatus, string> = {
  granted: 'Браузер разрешил оповещения.',
  default: 'Браузер спросит разрешение, когда вы включите оповещения.',
  denied: 'Оповещения запрещены в настройках браузера для этого сайта — разрешите их там (значок замка слева от адреса).',
  insecure: 'Недоступно: браузер показывает системные оповещения только для сайтов по HTTPS. Оповещения внутри системы и звук работают.',
  unsupported: 'Этот браузер не поддерживает системные оповещения.'
};

function DesktopNotificationsToggle({ enabled, disabled, onChange }: { enabled: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  const [status, setStatus] = useState<DesktopNotificationStatus>(getDesktopNotificationStatus);
  const unavailable = status === 'insecure' || status === 'unsupported';

  return (
    <div className="chat-desktop-toggle">
      <label className="chat-toggle">
        <input
          type="checkbox"
          checked={enabled && !unavailable}
          disabled={disabled || unavailable}
          onChange={async (event) => {
            const value = event.target.checked;
            if (value && status !== 'granted') {
              const result = await requestDesktopNotificationPermission();
              setStatus(result);
              onChange(result === 'granted');
              return;
            }

            onChange(value);
          }}
        />
        <span>Системные оповещения Windows, когда вкладка свернута</span>
      </label>
      <div className={`chat-muted chat-desktop-status${status === 'denied' || unavailable ? ' warn' : ''}`}>{DESKTOP_STATUS_TEXT[status]}</div>
    </div>
  );
}

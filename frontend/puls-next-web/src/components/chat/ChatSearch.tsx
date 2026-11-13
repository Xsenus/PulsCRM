import React, { useEffect, useState } from 'react';
import { searchChatMessages } from '../../app/chatApi';
import { describeMessageBody, formatConversationTime } from '../../app/chatFormat';
import type { ChatSearchResultDto } from '../../app/chatTypes';
import { getApiErrorMessage } from '../../app/apiErrors';
import { ChatAvatar } from './ChatAvatar';

export const CHAT_SEARCH_MIN_LENGTH = 2;
const SEARCH_DELAY_MS = 300;
const SNIPPET_CONTEXT = 40;

/** Поиск сообщений с задержкой ввода; короткий запрос не отправляется. */
export function useChatMessageSearch(query: string, conversationId?: number) {
  const term = query.trim();
  const enabled = term.length >= CHAT_SEARCH_MIN_LENGTH;
  const [results, setResults] = useState<ChatSearchResultDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    const timer = window.setTimeout(() => {
      searchChatMessages(term, conversationId)
        .then((items) => {
          if (active) {
            setResults(items);
            setError(null);
          }
        })
        .catch((reason) => active && setError(getApiErrorMessage(reason, 'Не удалось выполнить поиск.')))
        .finally(() => active && setLoading(false));
    }, SEARCH_DELAY_MS);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [conversationId, enabled, term]);

  return { term, enabled, results, loading, error };
}

function foldForSearch(value: string) {
  return value.toLowerCase().replace(/ё/g, 'е');
}

/** Фрагмент текста вокруг первого совпадения с подсветкой всех совпадений. */
export function HighlightedSnippet({ text, term }: { text: string; term: string }) {
  const normalized = text.replace(/\s+/g, ' ');
  // Сравниваем без учета регистра и разницы «ё»/«е», как сервер; длина строки не меняется.
  const lower = foldForSearch(normalized);
  const needle = foldForSearch(term.trim());
  if (!needle) {
    return <>{normalized}</>;
  }

  const first = lower.indexOf(needle);
  const start = first > SNIPPET_CONTEXT ? first - SNIPPET_CONTEXT : 0;
  const snippet = normalized.slice(start);
  const snippetLower = lower.slice(start);
  const parts: React.ReactNode[] = [];
  let position = 0;
  let index = snippetLower.indexOf(needle);
  while (index >= 0) {
    if (index > position) {
      parts.push(snippet.slice(position, index));
    }

    parts.push(<mark key={index}>{snippet.slice(index, index + needle.length)}</mark>);
    position = index + needle.length;
    index = snippetLower.indexOf(needle, position);
  }

  parts.push(snippet.slice(position));
  return <>{start > 0 ? '…' : ''}{parts}</>;
}

export function ChatSearchResults({ search, showConversation, onSelect }: {
  search: ReturnType<typeof useChatMessageSearch>;
  /** Показывать диалог результата (поиск по всем чатам). */
  showConversation: boolean;
  onSelect: (result: ChatSearchResultDto) => void;
}) {
  if (!search.enabled) {
    return null;
  }

  return (
    <div className="chat-search-results" aria-label="Найденные сообщения" aria-busy={search.loading}>
      {search.error ? <div className="chat-muted chat-list-hint">{search.error}</div> : null}
      {!search.error && search.loading && search.results.length === 0 ? <div className="chat-muted chat-list-hint">Поиск…</div> : null}
      {!search.error && !search.loading && search.results.length === 0 ? <div className="chat-muted chat-list-hint">Сообщений не найдено</div> : null}
      {search.results.map((result) => {
        const isGroup = result.conversationKind === 1 || result.conversationKind === 'Group';
        return (
          <button key={result.message.id} type="button" className="chat-search-result" onClick={() => onSelect(result)}>
            {showConversation ? (
              <ChatAvatar
                name={result.conversationTitle}
                seed={result.peerUserId ?? `g${result.conversationId}`}
                icon={result.conversationIcon}
                group={isGroup}
                size={36}
              />
            ) : null}
            <span className="chat-search-result-body">
              <span className="chat-search-result-top">
                <span className="chat-search-result-title">
                  {showConversation ? result.conversationTitle : result.message.senderName}
                </span>
                <span className="chat-conversation-time">{formatConversationTime(result.message.createdAtUtc)}</span>
              </span>
              <span className="chat-search-result-text">
                {showConversation && isGroup ? <strong>{result.message.senderName.split(' ')[0]}: </strong> : null}
                {result.message.text
                  ? <HighlightedSnippet text={result.message.text} term={search.term} />
                  : describeMessageBody(result.message)}
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

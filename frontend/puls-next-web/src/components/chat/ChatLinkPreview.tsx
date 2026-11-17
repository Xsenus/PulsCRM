import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getCampaign, getOrganization } from '../../app/api';
import { getColleague } from '../../app/colleagues';
import { openColleagueCard } from '../../app/colleagueCard';
import { getOrganizationDirectoryCard } from '../../app/organizationDirectory';

export type AppLinkKind = 'organization' | 'campaign' | 'employee';

export interface AppLink {
  kind: AppLinkKind;
  id: number;
  path: string;
}

const ROUTES: Array<{ kind: AppLinkKind; pattern: RegExp; path: (id: number) => string }> = [
  { kind: 'organization', pattern: /^\/organizations\/(\d+)(?:\/edit)?\/?$/, path: (id) => `/organizations/${id}/edit` },
  { kind: 'campaign', pattern: /^\/campaigns\/(\d+)\/?$/, path: (id) => `/campaigns/${id}` },
  { kind: 'employee', pattern: /^\/employees\/(\d+)(?:\/edit)?\/?$/, path: (id) => `/employees/${id}/edit` }
];

/**
 * Ссылка на объект этой же CRM (организация, кампания, сотрудник) — та же «origin», что и у открытой страницы.
 * Чужие сайты не распознаются: для них остается обычная ссылка в новой вкладке.
 */
export function parseAppLink(href: string, origin = typeof window === 'undefined' ? '' : window.location.origin): AppLink | null {
  let url: URL;
  try {
    url = new URL(href, origin || undefined);
  } catch {
    return null;
  }

  if (!origin || url.origin !== origin) {
    return null;
  }

  for (const route of ROUTES) {
    const match = url.pathname.match(route.pattern);
    if (match) {
      const id = Number(match[1]);
      return Number.isSafeInteger(id) && id > 0 ? { kind: route.kind, id, path: route.path(id) } : null;
    }
  }

  return null;
}

export function extractAppLinks(hrefs: string[], origin?: string, limit = 3): AppLink[] {
  const seen = new Set<string>();
  const result: AppLink[] = [];
  for (const href of hrefs) {
    const link = parseAppLink(href, origin);
    if (link && !seen.has(link.path)) {
      seen.add(link.path);
      result.push(link);
      if (result.length >= limit) {
        break;
      }
    }
  }

  return result;
}

interface PreviewData {
  title: string;
  subtitle?: string;
  /** Открывать справочник организаций (полная карточка недоступна — сотрудник не администратор). */
  directory?: boolean;
}

const KIND_META: Record<AppLinkKind, { icon: string; label: string }> = {
  organization: { icon: '🏢', label: 'Организация' },
  campaign: { icon: '✉️', label: 'Рассылка' },
  employee: { icon: '👤', label: 'Сотрудник' }
};

/** Кэш на время сессии: одна и та же ссылка в ленте не запрашивается повторно. */
const previewCache = new Map<string, Promise<PreviewData | null>>();

function loadPreview(link: AppLink): Promise<PreviewData | null> {
  let promise = previewCache.get(link.path);
  if (!promise) {
    const request: Promise<PreviewData> = link.kind === 'organization'
      ? getOrganization(link.id)
        .then((item): PreviewData => ({ title: item.smallName || item.name, subtitle: [item.inn ? `ИНН ${item.inn}` : '', item.raion ?? ''].filter(Boolean).join(' · ') || undefined }))
        // Полная карточка — только администраторам; остальным — справочник организаций (только чтение).
        .catch(() => getOrganizationDirectoryCard(link.id).then((item): PreviewData => ({
          title: item.name,
          subtitle: [item.inn ? `ИНН ${item.inn}` : '', item.raion ?? ''].filter(Boolean).join(' · ') || undefined,
          directory: true
        })))
      : link.kind === 'campaign'
        ? getCampaign(link.id).then((item) => ({ title: item.name, subtitle: item.subject || undefined }))
        // Справочник коллег доступен всем сотрудникам, а полная карточка — только администраторам.
        : getColleague(link.id).then((item) => ({ title: item.fullName, subtitle: [item.position, item.department].filter(Boolean).join(' · ') || undefined }));
    promise = request.catch(() => null);
    previewCache.set(link.path, promise);
  }

  return promise;
}

export function ChatLinkPreview({ link }: { link: AppLink }) {
  const navigate = useNavigate();
  const [data, setData] = useState<PreviewData | null | undefined>(undefined);
  const meta = KIND_META[link.kind];

  useEffect(() => {
    let active = true;
    void loadPreview(link).then((value) => active && setData(value));
    return () => {
      active = false;
    };
  }, [link]);

  return (
    <button
      type="button"
      className="chat-link-preview"
      // Сотрудник — карточка коллеги поверх чата (полная карточка в /employees — только для администраторов).
      onClick={() => (link.kind === 'employee'
        ? openColleagueCard(link.id)
        : navigate(data?.directory ? `/directory/organizations?open=${link.id}` : link.path))}
      title={`Открыть: ${meta.label.toLowerCase()} #${link.id}`}>
      <span className="chat-link-preview-icon" aria-hidden="true">{meta.icon}</span>
      <span className="chat-link-preview-text">
        <span className="chat-link-preview-kind">{meta.label} #{link.id}</span>
        <span className="chat-link-preview-title">
          {data === undefined ? 'Загрузка…' : data === null ? 'Нет доступа или объект удален' : data.title}
        </span>
        {data?.subtitle ? <span className="chat-link-preview-subtitle">{data.subtitle}</span> : null}
      </span>
    </button>
  );
}

import type { CurrentUserDto } from './types';

const LAST_LOGIN_PROFILE_STORAGE_KEY = 'puls-last-login-profile';

export interface LastLoginProfile {
  id: number;
  login: string;
  fullName?: string;
  userGroup?: string;
  lastUsedAt: string;
}

function normalizeProfile(value: unknown): LastLoginProfile | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const profile = value as Partial<LastLoginProfile>;
  const id = typeof profile.id === 'number' && Number.isFinite(profile.id) ? Math.round(profile.id) : 0;
  const login = typeof profile.login === 'string' ? profile.login.trim() : '';
  const fullName = typeof profile.fullName === 'string' ? profile.fullName.trim() : '';
  const userGroup = typeof profile.userGroup === 'string' ? profile.userGroup.trim() : '';
  const lastUsedAt = typeof profile.lastUsedAt === 'string' ? profile.lastUsedAt : '';

  if (id <= 0 || !login || !lastUsedAt) {
    return null;
  }

  return {
    id,
    login,
    fullName: fullName || undefined,
    userGroup: userGroup || undefined,
    lastUsedAt
  };
}

export function loadLastLoginProfile(): LastLoginProfile | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(LAST_LOGIN_PROFILE_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeProfile(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function rememberLastLoginProfile(user: CurrentUserDto) {
  if (typeof window === 'undefined') {
    return;
  }

  const profile: LastLoginProfile = {
    id: user.id,
    login: user.login.trim(),
    fullName: user.fullName?.trim() || undefined,
    userGroup: user.userGroup?.trim() || undefined,
    lastUsedAt: new Date().toISOString()
  };

  window.localStorage.setItem(LAST_LOGIN_PROFILE_STORAGE_KEY, JSON.stringify(profile));
}

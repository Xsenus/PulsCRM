import { api } from './api';
import { throwApiError } from './apiErrors';

/** Организация в справочнике для всех сотрудников (/api/organization-directory): найти и связаться. */
export interface OrganizationDirectoryItemDto {
  id: number;
  name: string;
  fullName?: string | null;
  inn?: string | null;
  raion?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface OrganizationDirectoryCardDto {
  id: number;
  name: string;
  fullName?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  raion?: string | null;
  orgType?: string | null;
  addressLegal?: string | null;
  addressActual?: string | null;
  phone?: string | null;
  site?: string | null;
  emails: Array<{ label: string; email: string }>;
  directorName?: string | null;
  directorPosition?: string | null;
  directorPhone?: string | null;
  contacts: Array<{ fio?: string | null; position?: string | null; phone?: string | null; email?: string | null }>;
}

export async function searchOrganizationDirectory(search: string, skip: number, take: number) {
  try {
    const { data } = await api.get<{ items: OrganizationDirectoryItemDto[]; totalCount: number }>('/api/organization-directory', {
      params: { search: search.trim() || undefined, skip, take }
    });
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

export async function getOrganizationDirectoryCard(id: number): Promise<OrganizationDirectoryCardDto> {
  try {
    const { data } = await api.get<OrganizationDirectoryCardDto>(`/api/organization-directory/${id}`);
    return data;
  } catch (error) {
    throwApiError(error);
  }
}

/** Ссылка tel: из телефона в любом виде («+7 (383) 111-22-33 доб. 5» → tel:+73831112233). */
export function phoneHref(phone: string) {
  const main = phone.split(/доб|ext|,|;/i)[0];
  return `tel:${main.replace(/[^\d+]/g, '')}`;
}

/** Адрес сайта со схемой: «romashka.ru» → https://romashka.ru. */
export function siteHref(site: string) {
  const trimmed = site.trim();
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

import axios, { AxiosHeaders } from 'axios';
import type {
  AuthResponse,
  CampaignDetailsDto,
  CampaignManualRunRequest,
  CampaignRecipientPreviewDto,
  CampaignStatisticsDto,
  CampaignStatusChangeRequest,
  CampaignUpsertRequest,
  DashboardDto,
  EmployeeListItemDto,
  OrganizationDetailsDto,
  OrganizationListItemDto,
  OrganizationRaionDto,
  PagedResult,
  ScheduleOccurrenceDto,
  SchedulePreviewRequest,
  StoredFileDto,
  TransportProfileDto,
  TransportProfileTestResultDto,
  TransportProfileUpsertRequest,
  WorkItemDto,
  CampaignListItemDto,
  DispatchBatchDto,
  CurrentUserDto,
  LoginUserOptionDto
} from './types';

const API_BASE = (import.meta as any).env?.VITE_API_URL || '';
const TOKEN_KEY = 'puls-next-token';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    const headers = AxiosHeaders.from(config.headers);
    headers.set('Authorization', `Bearer ${token}`);
    config.headers = headers;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem(TOKEN_KEY);
      window.dispatchEvent(new CustomEvent('puls-auth-expired'));
    }

    return Promise.reject(error);
  }
);

function unwrapError(error: any): never {
  const message = error?.response?.data?.message || error?.message || 'Неизвестная ошибка';
  throw new Error(message);
}

export function setToken(token: string | null) {
  if (token) {
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export async function login(loginValue: string, password: string): Promise<AuthResponse> {
  try {
    const { data } = await api.post<AuthResponse>('/api/auth/login', {
      login: loginValue,
      password
    });
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getCurrentUser(): Promise<CurrentUserDto | null> {
  try {
    const { data } = await api.get<CurrentUserDto>('/api/auth/me');
    return data;
  } catch (error: any) {
    if (error?.response?.status === 401) {
      return null;
    }

    unwrapError(error);
  }
}

export async function getLoginUsers(search = '', take = 12): Promise<LoginUserOptionDto[]> {
  try {
    const { data } = await api.get<LoginUserOptionDto[]>('/api/auth/users', {
      params: { search, take }
    });
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getDashboard(): Promise<DashboardDto> {
  try {
    const { data } = await api.get<DashboardDto>('/api/dashboard');
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getEmployees(search = '', skip = 0, take = 200): Promise<PagedResult<EmployeeListItemDto>> {
  try {
    const { data } = await api.get<PagedResult<EmployeeListItemDto>>('/api/employees', {
      params: { search, skip, take }
    });
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getOrganizations(search = '', raionId?: number, skip = 0, take = 50): Promise<PagedResult<OrganizationListItemDto>> {
  try {
    const { data } = await api.get<PagedResult<OrganizationListItemDto>>('/api/organizations', {
      params: { search, raionId, skip, take }
    });
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getOrganizationRaions(search = ''): Promise<OrganizationRaionDto[]> {
  try {
    const { data } = await api.get<OrganizationRaionDto[]>('/api/organizations/raions', {
      params: { search }
    });
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getOrganization(id: number): Promise<OrganizationDetailsDto> {
  try {
    const { data } = await api.get<OrganizationDetailsDto>(`/api/organizations/${id}`);
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getWork(search = '', orgId?: number, employeeId?: number, onlyOpen = false, skip = 0, take = 500): Promise<PagedResult<WorkItemDto>> {
  try {
    const { data } = await api.get<PagedResult<WorkItemDto>>('/api/work', {
      params: { search, orgId, employeeId, onlyOpen, skip, take }
    });
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getTransportProfiles(): Promise<TransportProfileDto[]> {
  try {
    const { data } = await api.get<TransportProfileDto[]>('/api/transport-profiles');
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function saveTransportProfile(request: TransportProfileUpsertRequest, id?: number): Promise<TransportProfileDto> {
  try {
    const { data } = id
      ? await api.put<TransportProfileDto>(`/api/transport-profiles/${id}`, request)
      : await api.post<TransportProfileDto>('/api/transport-profiles', request);
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function deleteTransportProfile(id: number): Promise<void> {
  try {
    await api.delete(`/api/transport-profiles/${id}`);
  } catch (error) {
    unwrapError(error);
  }
}

export async function testTransportProfile(id: number): Promise<TransportProfileTestResultDto> {
  try {
    const { data } = await api.post<TransportProfileTestResultDto>(`/api/transport-profiles/${id}/test`);
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function uploadFile(file: File, isPublic = false): Promise<StoredFileDto> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('isPublic', isPublic ? 'true' : 'false');

    const { data } = await api.post<StoredFileDto>('/api/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });

    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getCampaigns(search = '', status?: number, skip = 0, take = 100): Promise<PagedResult<CampaignListItemDto>> {
  try {
    const { data } = await api.get<PagedResult<CampaignListItemDto>>('/api/campaigns', {
      params: { search, status, skip, take }
    });
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getCampaign(id: number): Promise<CampaignDetailsDto> {
  try {
    const { data } = await api.get<CampaignDetailsDto>(`/api/campaigns/${id}`);
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function saveCampaign(request: CampaignUpsertRequest, id?: number): Promise<CampaignDetailsDto> {
  try {
    const { data } = id
      ? await api.put<CampaignDetailsDto>(`/api/campaigns/${id}`, request)
      : await api.post<CampaignDetailsDto>('/api/campaigns', request);
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function deleteCampaign(id: number): Promise<void> {
  try {
    await api.delete(`/api/campaigns/${id}`);
  } catch (error) {
    unwrapError(error);
  }
}

export async function previewSchedule(request: SchedulePreviewRequest): Promise<ScheduleOccurrenceDto[]> {
  try {
    const { data } = await api.post<ScheduleOccurrenceDto[]>('/api/campaigns/preview-schedule', request);
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function previewRecipients(request: CampaignUpsertRequest): Promise<CampaignRecipientPreviewDto> {
  try {
    const { data } = await api.post<CampaignRecipientPreviewDto>('/api/campaigns/preview-recipients', request);
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function changeCampaignStatus(id: number, request: CampaignStatusChangeRequest): Promise<CampaignDetailsDto> {
  try {
    const { data } = await api.post<CampaignDetailsDto>(`/api/campaigns/${id}/status`, request);
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function runCampaign(id: number, request: CampaignManualRunRequest): Promise<DispatchBatchDto> {
  try {
    const { data } = await api.post<DispatchBatchDto>(`/api/campaigns/${id}/run`, request);
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

export async function getCampaignStats(id: number): Promise<CampaignStatisticsDto> {
  try {
    const { data } = await api.get<CampaignStatisticsDto>(`/api/campaigns/${id}/stats`);
    return data;
  } catch (error) {
    unwrapError(error);
  }
}

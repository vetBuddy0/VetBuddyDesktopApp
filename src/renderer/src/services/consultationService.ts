// Consultation API service for VetBuddy Desktop Overlay
import type {
  Consultation,
  ConsultationWithPatient,
  CreateConsultationData,
  UpdateConsultationData,
  ConsultationValidationResponse,
} from '../types/consultation';
import { getAuthHeaders } from '../authUtils';
import { logout } from '../authService';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

async function apiRequest<T>(
  method: string,
  endpoint: string,
  body?: any
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const headers = await getAuthHeaders();

  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'include',
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await logout();
    }
    const text = await response.text();
    let errorMessage = 'Request failed';
    try {
      const error = JSON.parse(text);
      errorMessage = error.message || text;
    } catch {
      errorMessage = text || response.statusText;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

export const consultationService = {
  async getAll(params?: { page?: number; limit?: number; status?: string }): Promise<ConsultationWithPatient[]> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.status) searchParams.set('status', params.status);
    const endpoint = searchParams.toString() ? `/api/consultations?${searchParams.toString()}` : '/api/consultations';
    return apiRequest<ConsultationWithPatient[]>('GET', endpoint);
  },

  async getActive(): Promise<ConsultationWithPatient[]> {
    return apiRequest<ConsultationWithPatient[]>('GET', '/api/consultations/active');
  },

  async getPast(params?: { page?: number; limit?: number }): Promise<ConsultationWithPatient[]> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    const endpoint = searchParams.toString() ? `/api/consultations/past?${searchParams.toString()}` : '/api/consultations/past';
    return apiRequest<ConsultationWithPatient[]>('GET', endpoint);
  },

  async getById(id: number): Promise<ConsultationWithPatient> {
    return apiRequest<ConsultationWithPatient>('GET', `/api/consultations/${id}`);
  },

  async validatePatient(patientId: number): Promise<ConsultationValidationResponse> {
    return apiRequest<ConsultationValidationResponse>('GET', `/api/consultation/valid/${patientId}`);
  },

  async create(consultationData: CreateConsultationData): Promise<Consultation> {
    const payload = {
      status: 'active',
      startedAt: new Date().toISOString(),
      ...consultationData,
    };
    return apiRequest<Consultation>('POST', '/api/consultations', payload);
  },

  async update(id: number, consultationData: UpdateConsultationData): Promise<Consultation> {
    return apiRequest<Consultation>('PUT', `/api/consultations/${id}`, consultationData);
  },

  async complete(id: number): Promise<Consultation> {
    return apiRequest<Consultation>('PUT', `/api/consultations/${id}`, {
      status: 'completed',
      completedAt: new Date().toISOString(),
    });
  },

  async delete(id: number): Promise<void> {
    return apiRequest<void>('DELETE', `/api/consultations/${id}`);
  },

  async linkPatient(consultationId: number, patientId: number): Promise<Consultation> {
    return apiRequest<Consultation>('PUT', `/api/consultations/${consultationId}/link-patient`, { patientId });
  },
};

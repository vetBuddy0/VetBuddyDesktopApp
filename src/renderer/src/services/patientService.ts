// Patient API service for VetBuddy Desktop Overlay
import type {
  Patient,
  CreatePatientData,
  Owner,
  CreateOwnerData,
  ConsultationHistory,
} from '../types/patient';
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

export const patientService = {
  async getAll(params?: { page?: number; limit?: number; search?: string }): Promise<Patient[]> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.limit) searchParams.set('limit', params.limit.toString());
    if (params?.search) searchParams.set('search', params.search);
    const endpoint = searchParams.toString() ? `/api/patients?${searchParams.toString()}` : '/api/patients';
    return apiRequest<Patient[]>('GET', endpoint);
  },

  async getById(id: number): Promise<Patient> {
    return apiRequest<Patient>('GET', `/api/patients/${id}`);
  },

  async search(query: string): Promise<Patient[]> {
    return apiRequest<Patient[]>('GET', `/api/patients/search?q=${encodeURIComponent(query)}`);
  },

  async create(patientData: CreatePatientData): Promise<Patient> {
    return apiRequest<Patient>('POST', '/api/patients', patientData);
  },

  async update(id: number, patientData: Partial<CreatePatientData>): Promise<Patient> {
    return apiRequest<Patient>('PUT', `/api/patients/${id}`, patientData);
  },

  async delete(id: number): Promise<void> {
    return apiRequest<void>('DELETE', `/api/patients/${id}`);
  },

  async getConsultations(patientId: number): Promise<ConsultationHistory[]> {
    return apiRequest<ConsultationHistory[]>('GET', `/api/patients/${patientId}/consultations`);
  },
};

export const ownerService = {
  async getAll(): Promise<Owner[]> {
    return apiRequest<Owner[]>('GET', '/api/owners');
  },

  async getById(id: number): Promise<Owner> {
    return apiRequest<Owner>('GET', `/api/owners/${id}`);
  },

  async create(ownerData: CreateOwnerData): Promise<Owner> {
    return apiRequest<Owner>('POST', '/api/owners', ownerData);
  },

  async update(id: number, ownerData: Partial<CreateOwnerData>): Promise<Owner> {
    return apiRequest<Owner>('PUT', `/api/owners/${id}`, ownerData);
  },

  async delete(id: number): Promise<void> {
    return apiRequest<void>('DELETE', `/api/owners/${id}`);
  },
};

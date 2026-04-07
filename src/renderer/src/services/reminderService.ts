// Reminder API service for VetBuddy Desktop Overlay
import type { CreateReminderData } from '../types/reminder';
import { getAuthHeaders } from '../authUtils';
import { logout } from '../authService';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

async function apiRequest<T>(
  method: string,
  endpoint: string,
  body?: any,
  timeout: number = 30000
): Promise<T> {
  const url = `${API_URL}${endpoint}`;
  const headers = await getAuthHeaders();

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    throw error;
  }
}

export const reminderService = {
  async create(reminderData: CreateReminderData): Promise<any> {
    return apiRequest('POST', '/api/reminders', reminderData, 30000);
  },

  async getAll(): Promise<any[]> {
    return apiRequest('GET', '/api/reminders');
  },

  async getByPatient(patientId: number): Promise<any[]> {
    return apiRequest('GET', `/api/patients/${patientId}/reminders`);
  },
};

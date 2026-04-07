// Note Template API service for VetBuddy Desktop Overlay
import type {
  SOAPTemplate,
  CreateSOAPTemplatePayload,
  UpdateSOAPTemplatePayload,
} from "../types/soapTemplate";
import { getAuthHeaders } from "../authUtils";
import { logout } from "../authService";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

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
      "Content-Type": "application/json",
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
    credentials: "include",
  });

  if (response.status === 204) {
    return { success: true } as T;
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      await logout();
    }
    const text = await response.text();
    let errorMessage = "Request failed";
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

export const templateService = {
  async getAll(): Promise<SOAPTemplate[]> {
    return apiRequest<SOAPTemplate[]>("GET", "/api/note-templates");
  },

  async getById(id: number): Promise<SOAPTemplate> {
    return apiRequest<SOAPTemplate>("GET", `/api/note-templates/${id}`);
  },

  async create(payload: CreateSOAPTemplatePayload): Promise<SOAPTemplate> {
    return apiRequest<SOAPTemplate>("POST", "/api/note-templates", payload);
  },

  async update(id: number, payload: UpdateSOAPTemplatePayload): Promise<SOAPTemplate> {
    return apiRequest<SOAPTemplate>("PUT", `/api/note-templates/${id}`, payload);
  },

  async delete(id: number): Promise<{ success: boolean }> {
    return apiRequest<{ success: boolean }>("DELETE", `/api/note-templates/${id}`);
  },

  async seedDefaults(): Promise<{ created: SOAPTemplate[]; skipped: number }> {
    return apiRequest<{ created: SOAPTemplate[]; skipped: number }>("POST", "/api/note-templates/seed-v2");
  },

  async setDefault(id: number): Promise<SOAPTemplate> {
    return apiRequest<SOAPTemplate>("PUT", `/api/note-templates/${id}`, { isDefault: true });
  },
};

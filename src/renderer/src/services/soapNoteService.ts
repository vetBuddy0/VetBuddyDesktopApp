// SOAP Note API service for VetBuddy Desktop Overlay
import type {
  SOAPNote,
  SharedSOAPNoteWithPatient,
  SOAPSharingStatus,
  SharedSOAPNotesResponse,
} from "../types/soapNote";
import { getAuthHeaders } from "../authUtils";
import { logout } from "../authService";

const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

export interface ClinicalNoteSection {
  sectionId: string;
  title: string;
  content: string;
  evidence?: string[];
  subsections?: ClinicalNoteSection[];
}

export interface ClinicalNote {
  id: number;
  consultationId: number;
  templateId: number;
  noteContent: {
    templateId: number;
    sections: ClinicalNoteSection[];
  };
  plainTextContent: string;
  clientSummary: string;
  createdAt: string;
  updatedAt: string;
  mapping: { title: string; ezyVetMapping: string }[];
}

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

export const soapNoteService = {
  async getExportable(): Promise<SharedSOAPNoteWithPatient[]> {
    const response = await apiRequest<{ success: boolean; notes: SharedSOAPNoteWithPatient[] }>("GET", "/api/soap-notes/exportable");
    return response.notes;
  },

  async getShared(): Promise<SharedSOAPNoteWithPatient[]> {
    const response = await apiRequest<SharedSOAPNotesResponse>("GET", "/api/soap-notes/shared");
    return response.notes;
  },

  async getByConsultationId(consultationId: number, templateId?: number): Promise<ClinicalNote> {
    const queryParams = templateId ? `?templateId=${templateId}` : '';
    return apiRequest<ClinicalNote>("GET", `/api/consultations/${consultationId}/clinical-notes${queryParams}`);
  },

  async getShareStatus(consultationId: number): Promise<SOAPSharingStatus> {
    return apiRequest<SOAPSharingStatus>("GET", `/api/consultations/${consultationId}/soap/share-status`);
  },

  async markAsExported(soapNoteId: number): Promise<void> {
    await apiRequest("POST", `/api/soap-notes/${soapNoteId}/export`, {});
  },

  async generate(
    consultationId: number,
    options?: { transcription?: string; patientInfo?: any; aiSuggestions?: any; template?: any }
  ): Promise<SOAPNote> {
    return apiRequest<SOAPNote>("POST", `/api/consultations/${consultationId}/soap`, options || {});
  },

  async generateClinicalNote(
    consultationId: number,
    templateId: number,
    options?: { customInstructions?: string; formatPreference?: "bullet" | "paragraph" }
  ): Promise<ClinicalNote> {
    return apiRequest<ClinicalNote>("POST", `/api/consultations/${consultationId}/clinical-notes`, {
      templateId,
      ...options,
    });
  },

  async getClinicalNote(consultationId: number, templateId?: number): Promise<ClinicalNote | null> {
    try {
      const queryParams = templateId ? `?templateId=${templateId}` : '';
      const result = await apiRequest<ClinicalNote>("GET", `/api/consultations/${consultationId}/clinical-notes${queryParams}`);
      if (result?.noteContent?.sections) {
        return result;
      }
      return null;
    } catch {
      return null;
    }
  },

  async updateClinicalNote(
    consultationId: number,
    noteData: Partial<{
      noteContent: { templateId: number; sections: ClinicalNoteSection[] };
      plainTextContent: string;
      clientSummary: string;
    }>
  ): Promise<ClinicalNote> {
    return apiRequest<ClinicalNote>("PUT", `/api/consultations/${consultationId}/clinical-notes`, noteData);
  },

  async getSOAPNote(consultationId: number): Promise<SOAPNote | null> {
    try {
      return await apiRequest<SOAPNote>("GET", `/api/consultations/${consultationId}/soap`);
    } catch {
      return null;
    }
  },

  async update(
    consultationId: number,
    soapData: Partial<{ subjective: string; objective: string; assessment: string; plan: string; clientSummary: string }>
  ): Promise<SOAPNote> {
    return apiRequest<SOAPNote>("PUT", `/api/consultations/${consultationId}/soap`, soapData);
  },
};

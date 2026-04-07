// Consultation types for VetBuddy Extension

import type { Patient } from './patient';

export type ConsultationStatus = 'draft' | 'active' | 'completed';
export type ConsultationType = 'standard' | 'quick_start';

export interface Consultation {
  id: number;
  patientId?: number | null;
  userId: number;
  status: ConsultationStatus;
  consultationType: ConsultationType;
  species?: string | null;
  patientLinkedAt?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
  duration?: number | null;
  notes?: string | null;
  isDeleted: boolean;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConsultationWithPatient extends Consultation {
  patient?: Patient | null;
  recordingsCount?: number;
  hasSOAP?: boolean;
}

export interface CreateConsultationData {
  patientId?: number;
  species?: string;
  consultationType?: ConsultationType;
  status?: ConsultationStatus;
  startedAt?: string;
}

export interface UpdateConsultationData extends Partial<CreateConsultationData> {
  status?: ConsultationStatus;
  completedAt?: string;
  notes?: string;
}

export interface ConsultationValidationResponse {
  valid: boolean;
  message?: string;
}

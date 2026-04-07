/**
 * SOAP Note Types for Extension
 * Defines TypeScript interfaces for SOAP notes and related data
 */

export interface SOAPNote {
  id: number;
  consultationId: number;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  clientSummary: string | null;
  sharedAt: Date | null;
  createdAt: Date;
}

export interface SharedSOAPNoteWithPatient {
  id: number;
  consultationId: number;
  subjective: string | null;
  objective: string | null;
  assessment: string | null;
  plan: string | null;
  clientSummary: string | null;
  sharedAt: Date | null;
  createdAt: Date;
  // Patient context
  patientName: string;
  patientSpecies: string;
  patientBreed: string | null;
  patientAge: number | null;
  ownerName: string;
}

export interface SOAPSharingStatus {
  success: boolean;
  isShared: boolean;
  sharedAt: Date | null;
}

export interface SharedSOAPNotesResponse {
  success: boolean;
  notes: SharedSOAPNoteWithPatient[];
}

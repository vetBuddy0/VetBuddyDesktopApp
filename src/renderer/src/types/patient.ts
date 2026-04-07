// Patient types for VetBuddy Extension

export interface Owner {
  id: number;
  name: string;
  phone: string;
  email?: string;
}

export interface Patient {
  id: number;
  name: string;
  species: string;
  breed?: string;
  age?: string;
  weight?: string;
  medicalHistory?: string;
  owner: Owner;
  ownerId: number;
  userId: number;
  createdAt: string;
  updatedAt?: string;
}

export interface ConsultationHistory {
  id: number;
  startedAt: string;
  completedAt?: string;
  status: string;
  recordingsCount: number;
  hasSOAP: boolean;
}

export interface PatientWithOwner extends Patient {
  owner: Owner;
}

export interface CreatePatientData {
  name: string;
  species: string;
  breed?: string;
  age?: string;
  weight?: string;
  medicalHistory?: string;
  ownerId: number;
}

export interface UpdatePatientData extends Partial<CreatePatientData> {
  id: number;
}

export interface CreateOwnerData {
  name: string;
  phone: string;
  email?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
}

export type Species = 'Dog' | 'Cat' | 'Bird' | 'Rabbit' | 'Fish' | 'Other';

export const SPECIES_OPTIONS: Species[] = ['Dog', 'Cat', 'Bird', 'Rabbit', 'Fish', 'Other'];

export interface EzyVetPrefillData {
    name: string;       // already includes "(animalId)" suffix
    species: string;
    breed: string;
    weight: string;
    ownerName: string;
    animalId: string;
}

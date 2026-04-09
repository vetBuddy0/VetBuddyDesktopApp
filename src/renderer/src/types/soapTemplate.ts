// SOAP / Note Template types for VetBuddy Desktop
// Standards with the flexible NoteTemplate schema on the backend

export interface TemplateSection {
  id: string;
  title: string;
  instructions?: string;
  placeholder?: string;
  defaultValue?: string;
  subsections?: TemplateSection[];
  order: number;
}

export interface NoteTemplateDefinition {
  version: number;
  name: string;
  description?: string;
  sections: TemplateSection[];
  metadata?: {
    createdBy?: string;
    createdAt?: string;
    isSystemTemplate?: boolean;
  };
}

// Fixed-structure legacy type (still used in some places for mapping)
export interface SoapSectionInstructions {
  title: string;
  instructions: string;
  placeholder?: string;
}

export interface SoapTemplateDefinitionV2 {
  version: 2;
  name: string;
  description?: string;
  sections: {
    subjective: SoapSectionInstructions;
    objective: SoapSectionInstructions;
    assessment: SoapSectionInstructions;
    plan: SoapSectionInstructions;
  };
  metadata?: {
    createdBy?: string;
    createdAt?: string;
  };
}

// Union type for template definitions to support smooth transition
export type AnyTemplateDefinition = NoteTemplateDefinition | SoapTemplateDefinitionV2;

// Template entity from database
export interface SOAPTemplate {
  id: number;
  name: string;
  description?: string;
  templateDefinition: AnyTemplateDefinition;
  isDefault: boolean;
  version: string; // e.g., "v1", "v2"
  isSystemTemplate?: boolean;
  category?: string;
  createdAt: string;
  updatedAt: string;
  userId?: number;
  clinicId?: number | null;
}

// For creating new templates
export interface CreateSOAPTemplatePayload {
  name: string;
  description?: string;
  templateDefinition: AnyTemplateDefinition;
  isDefault?: boolean;
}

// For updating templates
export interface UpdateSOAPTemplatePayload {
  name?: string;
  description?: string;
  templateDefinition?: AnyTemplateDefinition;
  isDefault?: boolean;
}

// SOAP Template types for VetBuddy Extension
// Mirrors the types from the backend shared/types/soapTemplate.ts

// V2 Template Types (Instruction-based, free-form text per SOAP section)
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

// V2 Output structure - each section has generated text content
export interface SoapGeneratedContentV2 {
  version: 2;
  templateId?: number | null;
  sections: {
    subjective: {
      content: string;
      evidence?: string[];
    };
    objective: {
      content: string;
      evidence?: string[];
    };
    assessment: {
      content: string;
      evidence?: string[];
    };
    plan: {
      content: string;
      evidence?: string[];
    };
  };
}

// Template entity from database
export interface SOAPTemplate {
  id: number;
  name: string;
  description?: string;
  templateDefinition: SoapTemplateDefinitionV2;
  isDefault: boolean;
  version: string; // e.g., "v2"
  createdAt: string;
  updatedAt: string;
  userId?: number;
  clinicId?: number | null;
}

// For creating new templates
export interface CreateSOAPTemplatePayload {
  name: string;
  description?: string;
  templateDefinition: SoapTemplateDefinitionV2;
  isDefault?: boolean;
}

// For updating templates
export interface UpdateSOAPTemplatePayload {
  name?: string;
  description?: string;
  templateDefinition?: SoapTemplateDefinitionV2;
  isDefault?: boolean;
}

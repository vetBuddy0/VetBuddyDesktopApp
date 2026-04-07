/**
 * ezyVet Clinical Record configuration types
 * Used to dynamically configure which records are active in ezyVet
 * and how they map to the paste automation flow.
 */

export interface EzyVetClinicalRecord {
    /** Original ezyVet record name (e.g., "History", "Physical Exam") */
    name: string;
    /** Whether this record is enabled (shown in consult) */
    enabled: boolean;
    /** Alternate display name in ezyVet (e.g., "Differential diagnosis" for Assessment) */
    alternateName: string | null;
    /** The textarea selector name attribute (e.g., "visithistorydata_comments") — stays constant */
    inputFieldSelector: string;
    /** Display order (0-based, matches ezyVet's ordering) */
    order: number;
}

export interface EzyVetClinicConfig {
    id?: number;
    clinicId: number;
    records: EzyVetClinicalRecord[];
    defaultMappings: Record<string, Array<{ title: string; ezyVetMapping: string }>>;
    updatedAt: string;
}

/**
 * Default ezyVet clinical records matching the standard ezyVet configuration.
 * Pre-populated selectors for the 4 known records; rest left empty for user input.
 */
export const DEFAULT_EZYVET_RECORDS: EzyVetClinicalRecord[] = [
    // { name: "Master Problems", enabled: false, alternateName: null, inputFieldSelector: "", order: 0 },
    // { name: "Health Status", enabled: false, alternateName: null, inputFieldSelector: "", order: 1 },
    { name: "Pertinent History", enabled: false, alternateName: null, inputFieldSelector: "consultpertinenthistorydata_notes", order: 2 },
    { name: "History", enabled: true, alternateName: null, inputFieldSelector: "visithistorydata_comments", order: 3 },
    { name: "Physical Exam", enabled: true, alternateName: null, inputFieldSelector: "visitexamdata_comments", order: 4 },
    { name: "Assessments", enabled: true, alternateName: null, inputFieldSelector: "consultassessmentdata_notes", order: 5 },
    { name: "Plan", enabled: true, alternateName: null, inputFieldSelector: "consultplandata_notes", order: 6 },
    { name: "Revisit", enabled: false, alternateName: null, inputFieldSelector: "revisitdata_notes", order: 7 },
    // { name: "Medications", enabled: false, alternateName: null, inputFieldSelector: "", order: 8 },
    // { name: "Therapeutics", enabled: false, alternateName: null, inputFieldSelector: "", order: 9 },
    // { name: "Diagnostics Request", enabled: false, alternateName: null, inputFieldSelector: "", order: 10 },
    // { name: "Diagnostics Result", enabled: false, alternateName: null, inputFieldSelector: "", order: 11 },
    // { name: "Diagnostic Interpretation Requests", enabled: false, alternateName: null, inputFieldSelector: "", order: 12 },
    // { name: "Vaccinations", enabled: false, alternateName: null, inputFieldSelector: "", order: 13 },
    // { name: "In Clinic Notes", enabled: false, alternateName: null, inputFieldSelector: "", order: 14 },
    // { name: "Hospital Notes", enabled: false, alternateName: null, inputFieldSelector: "", order: 15 },
    // { name: "Addendums", enabled: false, alternateName: null, inputFieldSelector: "", order: 16 },
    // { name: "Client Communication", enabled: false, alternateName: null, inputFieldSelector: "", order: 17 },
    // { name: "Vet Communication", enabled: false, alternateName: null, inputFieldSelector: "", order: 18 },
    // { name: "Discharge Summaries", enabled: false, alternateName: null, inputFieldSelector: "", order: 19 },
    { name: "Hospital Notes", enabled: true, alternateName: null, inputFieldSelector: "consulthospitalnotedata_notes", order: 20 },
];

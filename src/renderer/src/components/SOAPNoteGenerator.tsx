import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import { consultationService } from "../services/consultationService";
import {
  soapNoteService,
  type ClinicalNote,
  type ClinicalNoteSection,
} from "../services/soapNoteService";
import { templateService } from "../services/templateService";
import { ezyvetConfigService } from "../services/ezyvetConfigService";
import {
  pasteSOAPNote,
  copyToClipboard,
} from "../services/soapPasteService";
import { SectionMappingDialog } from "./SectionMappingDialog";
import type { ConsultationWithPatient } from "../types/consultation";
import type { SOAPNote } from "../types/soapNote";
import type { SOAPTemplate } from "../types/soapTemplate";
import { ChatInterface } from "./ChatInterface";
import {
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  Loader2,
  AlertCircle,
  CheckCircle,
  Edit2,
  X,
  RefreshCw,
} from "lucide-react";

interface EditableClinicalNoteSectionProps {
  section: ClinicalNoteSection;
  depth: number;
  expandedSections: Record<string, boolean>;
  onToggle: (id: string) => void;
  onUpdate: (updatedSection: ClinicalNoteSection) => Promise<void>;
}

function EditableClinicalNoteSection({
  section,
  depth,
  expandedSections,
  onToggle,
  onUpdate,
}: EditableClinicalNoteSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(section.content || "");
  const [isSaving, setIsSaving] = useState(false);
  const isExpanded = expandedSections[section.sectionId];

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onUpdate({ ...section, content: editContent });
      setIsEditing(false);
    } catch (err) {
      console.error("Failed to save section:", err);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditContent(section.content || "");
    setIsEditing(false);
  };

  return (
    <div
      className={`border border-gray-300 rounded-lg overflow-hidden ${depth > 0 ? "ml-4 mt-2" : ""
        }`}
    >
      <button
        onClick={() => onToggle(section.sectionId)}
        className={`w-full p-3 ${depth > 0 ? "bg-gray-25" : "bg-gray-50"
          } hover:bg-gray-100 flex items-center justify-between transition-colors`}
      >
        <span className={`font-medium ${depth > 0 ? "text-sm" : ""}`}>
          {section.title}
        </span>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5" />
          ) : (
            <ChevronDown className="w-5 h-5" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="p-4 bg-white">
          {isEditing ? (
            <div className="space-y-3">
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="w-full min-h-[120px] p-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                autoFocus
                placeholder="Enter section content..."
              />
              <div className="flex justify-end gap-2 text-sm mt-3">
                <button
                  className="px-4 py-2 border border-blue-500 text-blue-500 rounded hover:bg-blue-50 transition-colors flex items-center gap-1"
                  onClick={handleCancel}
                  disabled={isSaving}
                >
                  <X className="w-4 h-4" /> Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  Save Changes
                </button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <div
                className="whitespace-pre-wrap text-sm text-gray-700 pr-8 min-h-[1.5rem] cursor-text hover:bg-gray-50 rounded p-1 -m-1 transition-colors"
                onClick={() => {
                  setEditContent(section.content || "");
                  setIsEditing(true);
                }}
              >
                {section.content || (
                  <span className="text-gray-400 italic">No content</span>
                )}
              </div>
              <button
                className="absolute top-0 right-0 p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-600 hover:bg-blue-50 rounded"
                title="Edit Section"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditContent(section.content || "");
                  setIsEditing(true);
                }}
              >
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Render subsections recursively */}
          {section.subsections && section.subsections.length > 0 && (
            <div className="mt-4 space-y-3">
              {section.subsections.map((sub) => (
                <EditableClinicalNoteSection
                  key={sub.sectionId}
                  section={sub}
                  depth={depth + 1}
                  expandedSections={expandedSections}
                  onToggle={onToggle}
                  onUpdate={async (updatedSub) => {
                    const newSubs = section.subsections?.map((s) =>
                      s.sectionId === sub.sectionId ? updatedSub : s
                    );
                    await onUpdate({ ...section, subsections: newSubs });
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface SOAPNoteGeneratorProps {
  initialConsultationId?: number | null;
  autoGenerate?: boolean;
}

export function SOAPNoteGenerator({
  initialConsultationId,
  autoGenerate = false,
}: SOAPNoteGeneratorProps) {
  // State
  const [consultations, setConsultations] = useState<ConsultationWithPatient[]>(
    []
  );
  const [selectedConsultationId, setSelectedConsultationId] = useState<
    number | null
  >(initialConsultationId || null);
  const [soapNote, setSOAPNote] = useState<SOAPNote | null>(null);
  // Clinical note state for dynamic template sections
  const [clinicalNote, setClinicalNote] = useState<ClinicalNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  // Prevent repeated auto-generate retries per selection
  const [autoTried, setAutoTried] = useState(false);

  // Template state
  const [templates, setTemplates] = useState<SOAPTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<SOAPTemplate | null>(
    null
  );

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editedSOAP, setEditedSOAP] = useState<Partial<SOAPNote>>({});

  // Client Summary Editing state
  const [clientSummaryEditMode, setClientSummaryEditMode] = useState(false);
  const [editedClientSummary, setEditedClientSummary] = useState("");
  const [isSavingClientSummary, setIsSavingClientSummary] = useState(false);

  // Collapsible sections state - dynamic for clinical notes
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    subjective: true,
    objective: true,
    assessment: true,
    plan: true,
    clientSummary: false,
  });

  // Section mapping dialog state
  const [showMappingDialog, setShowMappingDialog] = useState(false);
  const [customMappings, setCustomMappings] = useState<
    { title: string; ezyVetMapping: string }[]
  >([]);

  // ezyVet dynamic field config
  const [ezyVetFields, setEzyVetFields] = useState<
    Array<{ value: string; label: string; inputSelector: string; displayName: string; originalName?: string }>
  >([]);

  // Saved per-template mappings from database
  const [savedTemplateMappings, setSavedTemplateMappings] = useState<
    Record<string, Array<{ title: string; ezyVetMapping: string }>>
  >({});

  // Display format preference
  const [formatPreference, setFormatPreference] = useState<"bullet" | "paragraph">("bullet");


  // Load active consultations and templates on mount
  useEffect(() => {
    loadConsultations();
    loadTemplates();
    loadEzyVetConfig();
  }, []);

  // Auto-select default template when templates load
  useEffect(() => {
    if (templates.length > 0 && !selectedTemplate) {
      // Priority 1: Use template marked as default
      const defaultTemplate = templates.find((t) => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplate(defaultTemplate);
        return;
      }

      // Priority 2: Use "General Consultation" template
      const generalTemplate = templates.find(
        (t) => t.name === "General Consultation"
      );
      if (generalTemplate) {
        setSelectedTemplate(generalTemplate);
        return;
      }

      // Priority 3: Use first template
      if (templates.length > 0) {
        setSelectedTemplate(templates[0]);
      }
    }
  }, [templates]);

  // Load existing SOAP note when consultation is selected
  useEffect(() => {
    if (selectedConsultationId) {
      loadExistingSOAP();
    }
    // Reset auto-generate attempt guard on selection change
    setAutoTried(false);
  }, [selectedConsultationId, selectedTemplate]);

  // Auto-generate SOAP note if enabled and not already attempted for this selection
  useEffect(() => {
    if (
      autoGenerate &&
      selectedConsultationId &&
      soapNote === null &&
      !generating &&
      !loading &&
      !autoTried
    ) {
      // Small delay to ensure the UI has loaded
      const timer = setTimeout(() => {
        setAutoTried(true);
        handleGenerateSOAP();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [
    autoGenerate,
    selectedConsultationId,
    soapNote,
    generating,
    loading,
    autoTried,
  ]);

  const loadConsultations = async () => {
    try {
      setLoading(true);
      const data = await consultationService.getActive();
      setConsultations(data);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load consultations");
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const data = await templateService.getAll();
      setTemplates(data);
    } catch (err: any) {
      console.error("Failed to load templates:", err.message);
      // Don't show error to user, templates are optional
    }
  };

  const loadExistingSOAP = async () => {
    if (!selectedConsultationId) return;

    try {
      // Pass selectedTemplate.id to filter by template
      const existingSOAP = await soapNoteService.getByConsultationId(
        selectedConsultationId,
        selectedTemplate?.id
      );
      setClinicalNote(existingSOAP);
      setCustomMappings([]); // Clear any manual mappings from previous note
    } catch (err: any) {
      // SOAP note doesn't exist yet - this is fine
      console.log("No existing SOAP note found:", err.message);
      setClinicalNote(null);
    }
  };


  const loadEzyVetConfig = async () => {
    try {
      const config = await ezyvetConfigService.getConfig();
      const enabledRecords = config.records
        .filter((r) => r.enabled && r.inputFieldSelector)
        .sort((a, b) => a.order - b.order);
      setEzyVetFields(
        enabledRecords.map((r) => ({
          value: r.inputFieldSelector,
          label: r.alternateName || r.name,
          inputSelector: r.inputFieldSelector,
          displayName: r.alternateName || r.name,
          originalName: r.name,
        }))
      );
      // Load saved per-template mappings
      if (config.defaultMappings) {
        setSavedTemplateMappings(config.defaultMappings);
      }
    } catch (err) {
      console.warn("[SOAPNoteGenerator] Failed to load ezyVet config:", err);
    }
  };

  /**
   * Get the best existing mappings for the current template.
   * Priority: saved DB mappings > clinicalNote.mapping > empty
   */
  const getExistingMappingsForTemplate = (): Array<{ title: string; ezyVetMapping: string }> => {
    const templateKey = selectedTemplate?.id ? String(selectedTemplate.id) : "";
    if (templateKey && savedTemplateMappings[templateKey]?.length) {
      return savedTemplateMappings[templateKey];
    }
    return clinicalNote?.mapping || [];
  };

  const handleGenerateSOAP = async () => {
    if (!selectedConsultationId) {
      setError("Please select a consultation");
      return;
    }

    // Require template selection for clinical notes
    if (!selectedTemplate) {
      setError("Please select a template");
      return;
    }

    setGenerating(true);
    setError(null);
    setSuccess(null);

    try {
      // Use clinical notes API for template-based generation
      const generatedNote = await soapNoteService.generateClinicalNote(
        selectedConsultationId,
        selectedTemplate.id,
        { formatPreference }
      );

      setClinicalNote(generatedNote);
      setCustomMappings([]); // Clear any manual mappings from previous note
      setSOAPNote(null); // Clear any legacy SOAP note

      // Initialize expanded sections for dynamic template sections
      if (generatedNote.noteContent?.sections) {
        const newExpandedSections: Record<string, boolean> = {
          clientSummary: false,
        };
        const initSectionExpansion = (sections: ClinicalNoteSection[]) => {
          sections.forEach((section) => {
            newExpandedSections[section.sectionId] = true;
            if (section.subsections) {
              initSectionExpansion(section.subsections);
            }
          });
        };
        initSectionExpansion(generatedNote.noteContent.sections);
        setExpandedSections(newExpandedSections);
      }

      setSuccess("Note generated successfully!");
    } catch (err: any) {
      const rawMessage = (err && err.message ? String(err.message) : "").trim();
      const lower = rawMessage.toLowerCase();
      const isNoData =
        lower.includes("no recording") ||
        lower.includes("no recordings") ||
        lower.includes("no notes") ||
        lower.includes("nothing to generate") ||
        lower.includes("no data");

      if (isNoData) {
        setError(
          "No recordings or notes found for this consultation. Record audio or add notes, then click Generate again."
        );
      } else {
        setError(rawMessage || "Failed to generate note");
      }
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveEdits = async () => {
    if (!selectedConsultationId) return;

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // Filter out null values and only send defined strings
      const updateData: Partial<{
        subjective: string;
        objective: string;
        assessment: string;
        plan: string;
        clientSummary: string;
      }> = {};

      if (
        editedSOAP.subjective !== undefined &&
        editedSOAP.subjective !== null
      ) {
        updateData.subjective = editedSOAP.subjective;
      }
      if (editedSOAP.objective !== undefined && editedSOAP.objective !== null) {
        updateData.objective = editedSOAP.objective;
      }
      if (
        editedSOAP.assessment !== undefined &&
        editedSOAP.assessment !== null
      ) {
        updateData.assessment = editedSOAP.assessment;
      }
      if (editedSOAP.plan !== undefined && editedSOAP.plan !== null) {
        updateData.plan = editedSOAP.plan;
      }
      if (
        editedSOAP.clientSummary !== undefined &&
        editedSOAP.clientSummary !== null
      ) {
        updateData.clientSummary = editedSOAP.clientSummary;
      }

      const updatedSOAP = await soapNoteService.update(
        selectedConsultationId,
        updateData
      );
      setSOAPNote(updatedSOAP);
      setEditedSOAP(updatedSOAP);
      setIsEditing(false);
      setSuccess("SOAP note updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to save changes");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateClinicalNoteSection = async (sectionIndex: number, updatedSection: ClinicalNoteSection) => {
    if (!selectedConsultationId || !clinicalNote || !clinicalNote.noteContent) return;

    // Update local tree
    const newSections = [...clinicalNote.noteContent.sections];
    newSections[sectionIndex] = updatedSection;

    try {
      // Save to backend
      const updatedNote = await soapNoteService.updateClinicalNote(
        selectedConsultationId,
        {
          noteContent: {
            ...clinicalNote.noteContent,
            sections: newSections
          }
        }
      );
      setClinicalNote(updatedNote);
      setSuccess("Section updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to update section");
      throw err; // So the EditableSection knows it failed
    }
  };

  const handleUpdateClientSummary = async () => {
    if (!selectedConsultationId || !clinicalNote) return;

    setIsSavingClientSummary(true);
    try {
      const updatedNote = await soapNoteService.updateClinicalNote(
        selectedConsultationId,
        {
          clientSummary: editedClientSummary,
        }
      );
      setClinicalNote(updatedNote);
      setClientSummaryEditMode(false);
      setSuccess("Client summary updated successfully!");
    } catch (err: any) {
      setError(err.message || "Failed to update client summary");
    } finally {
      setIsSavingClientSummary(false);
    }
  };

  const handlePasteToEHR = async (overrideMappings?: { title: string; ezyVetMapping: string }[]) => {
    // Support both clinical notes and legacy SOAP notes
    if (!clinicalNote && !soapNote) {
      setError("No note to paste");
      return;
    }

    // For clinical notes, check if we have mappings
    if (clinicalNote && clinicalNote.noteContent?.sections) {
      const effectiveMappings = overrideMappings || customMappings.length > 0 ? customMappings : (clinicalNote.mapping || []);
      const hasMappings = effectiveMappings.some(
        (m) => m.ezyVetMapping && m.ezyVetMapping !== "none"
      );

      // If no mappings exist, show the mapping dialog
      if (!hasMappings && !overrideMappings) {
        setShowMappingDialog(true);
        return;
      }
    }

    setPasting(true);
    setError(null);
    setSuccess(null);

    try {
      let contentToPaste: {
        subjective: string | null;
        objective: string | null;
        assessment: string | null;
        plan: string | null;
        clientSummary: string | null;
      };

      if (clinicalNote && clinicalNote.noteContent?.sections) {
        // Use override mappings, custom mappings, or template mappings
        const effectiveMappings = overrideMappings || (customMappings.length > 0 ? customMappings : (clinicalNote.mapping || []));

        // Convert clinical note sections to plain text for paste
        const formatSection = (
          section: ClinicalNoteSection,
          depth: number = 0
        ): string => {
          const indent = "  ".repeat(depth);
          let text = `${indent}${section.title}:\n${indent}${section.content || "Not specified"
            }`;
          if (section.subsections && section.subsections.length > 0) {
            text +=
              "\n" +
              section.subsections
                .map((sub) => formatSection(sub, depth + 1))
                .join("\n");
          }
          return text;
        };

        const getMappedContent = (mappingType: string) => {
          return clinicalNote.noteContent.sections
            .filter((section) => {
              const mapping = effectiveMappings.find(
                (m) => m.title === section.title
              );
              return mapping?.ezyVetMapping === mappingType;
            })
            .map((section) => formatSection(section))
            .join("\n\n") || null;
        };

        contentToPaste = {
          subjective: getMappedContent("history"),
          objective: getMappedContent("physical_exam"),
          assessment: getMappedContent("differential_diagnosis"),
          plan: getMappedContent("plan"),
          clientSummary: clinicalNote.clientSummary || null,
        };

        // Build dynamic paste records for ezyVet if we have config
        if (ezyVetFields.length > 0) {
          const pasteRecords: Array<{ displayName: string; inputSelector: string; content: string }> = [];
          for (const field of ezyVetFields) {
            const content = getMappedContent(field.value);
            if (content) {
              pasteRecords.push({
                displayName: field.displayName,
                inputSelector: field.inputSelector,
                content,
              });
            }
          }
          if (pasteRecords.length > 0) {
            // Use pasteSOAPNote which routes to pasteEzyVet with records
            const { pasteSOAPNoteWithRecords } = await import("../services/soapPasteService");
            const result = await pasteSOAPNoteWithRecords(contentToPaste, pasteRecords);
            if (result.success) {
              setSuccess(result.message);
            } else {
              setError(result.message);
            }
            return;
          }
        }
      } else if (soapNote) {
        contentToPaste = {
          subjective: isEditing
            ? editedSOAP.subjective || null
            : soapNote.subjective,
          objective: isEditing
            ? editedSOAP.objective || null
            : soapNote.objective,
          assessment: isEditing
            ? editedSOAP.assessment || null
            : soapNote.assessment,
          plan: isEditing ? editedSOAP.plan || null : soapNote.plan,
          clientSummary: isEditing
            ? editedSOAP.clientSummary || null
            : soapNote.clientSummary,
        };
      } else {
        setError("No note content available");
        return;
      }

      const result = await pasteSOAPNote(contentToPaste);

      if (result.success) {
        setSuccess(result.message);
        // Mark as exported
        if (soapNote?.id) {
          await soapNoteService.markAsExported(soapNote.id);
        }
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || "Failed to paste note");
    } finally {
      setPasting(false);
    }
  };

  const handleCopyToClipboard = async () => {
    // Support both clinical notes and legacy SOAP notes
    if (!clinicalNote && !soapNote) {
      setError("No note to copy");
      return;
    }

    try {
      let contentToCopy: {
        subjective: string | null;
        objective: string | null;
        assessment: string | null;
        plan: string | null;
        clientSummary: string | null;
      };

      if (clinicalNote && clinicalNote.noteContent?.sections) {
        // Convert clinical note sections to plain text
        const formatSection = (
          section: ClinicalNoteSection,
          depth: number = 0
        ): string => {
          const indent = "  ".repeat(depth);
          let text = `${indent}${section.title}:\n${indent}${section.content || "Not specified"
            }`;
          if (section.subsections && section.subsections.length > 0) {
            text +=
              "\n" +
              section.subsections
                .map((sub) => formatSection(sub, depth + 1))
                .join("\n");
          }
          return text;
        };

        const allSectionsText = clinicalNote.noteContent.sections
          .map((section) => formatSection(section))
          .join("\n\n");

        contentToCopy = {
          subjective: allSectionsText,
          objective: null,
          assessment: null,
          plan: null,
          clientSummary: clinicalNote.clientSummary || null,
        };
      } else if (soapNote) {
        contentToCopy = {
          subjective: isEditing
            ? editedSOAP.subjective || null
            : soapNote.subjective,
          objective: isEditing
            ? editedSOAP.objective || null
            : soapNote.objective,
          assessment: isEditing
            ? editedSOAP.assessment || null
            : soapNote.assessment,
          plan: isEditing ? editedSOAP.plan || null : soapNote.plan,
          clientSummary: isEditing
            ? editedSOAP.clientSummary || null
            : soapNote.clientSummary,
        };
      } else {
        setError("No note content available");
        return;
      }

      const result = await copyToClipboard(contentToCopy);

      if (result.success) {
        setSuccess(result.message);
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError(err.message || "Failed to copy to clipboard");
    }
  };

  const toggleSection = (section: keyof typeof expandedSections) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleEditField = (field: keyof SOAPNote, value: string) => {
    setEditedSOAP((prev) => ({ ...prev, [field]: value }));
  };

  const selectedConsultation = consultations.find(
    (c) => c.id === selectedConsultationId
  );

  // Initial load spinner
  if (loading && consultations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
        <p className="text-muted text-sm">Loading consultations...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <FileText className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          Clinical Notes
        </h2>
        <p className="text-xs text-muted mt-0.5">
          Select a consultation to generate or view its note
        </p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
          <div className="flex-1 text-sm text-red-800">{error}</div>
        </div>
      )}

      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-2">
          <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
          <div className="flex-1 text-sm text-green-800">{success}</div>
        </div>
      )}

      {/* Consultation Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Select Consultation
        </label>
        <select
          value={selectedConsultationId || ""}
          onChange={(e) =>
            setSelectedConsultationId(Number(e.target.value) || null)
          }
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          disabled={loading}
        >
          <option value="">-- Select a consultation --</option>
          {consultations.map((consultation) => (
            <option key={consultation.id} value={consultation.id}>
              {consultation.consultationType === "quick_start"
                ? `Quick Start - ${consultation.species || "Unknown"}`
                : `${consultation.patient?.name || "Unknown"} (${consultation.patient?.species || "Unknown"
                })`}{" "}
              - {new Date(consultation.startedAt || "").toLocaleDateString()}
            </option>
          ))}
        </select>
      </div>

      {/* Template Selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">
          Note Template
          {selectedTemplate?.isDefault && (
            <span className="ml-2 text-xs text-amber-600">(Default)</span>
          )}
        </label>
        <select
          value={selectedTemplate?.id || ""}
          onChange={(e) => {
            const templateId = Number(e.target.value);
            const template = templates.find((t) => t.id === templateId) || null;
            setSelectedTemplate(template);
          }}
          className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">-- No template (basic note) --</option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {template.name}
              {template.isDefault ? " ⭐" : ""}
            </option>
          ))}
        </select>
        {selectedTemplate && (
          <p className="mt-1 text-xs text-gray-600">
            {selectedTemplate.description ||
              "Custom template with specific instructions for AI generation"}
          </p>
        )}
      </div>

      {/* Patient Info Display */}
      {selectedConsultation && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-medium mb-2">Consultation Details</h3>
          {selectedConsultation.patient ? (
            <div className="text-sm text-gray-700 space-y-1">
              <div>
                <strong>Patient:</strong> {selectedConsultation.patient.name}
              </div>
              <div>
                <strong>Species:</strong> {selectedConsultation.patient.species}
              </div>
              {selectedConsultation.patient.breed && (
                <div>
                  <strong>Breed:</strong> {selectedConsultation.patient.breed}
                </div>
              )}
              <div>
                <strong>Owner:</strong>{" "}
                {selectedConsultation.patient.owner.name}
              </div>
              <div>
                <strong>Started:</strong>{" "}
                {new Date(
                  selectedConsultation.startedAt || ""
                ).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="text-sm text-yellow-700">
              Quick Start consultation - Patient not linked yet
            </div>
          )}
        </div>
      )}

      {/* Format Preference */}
      {selectedConsultationId && !soapNote && !clinicalNote && selectedTemplate && (
        <div className="mb-6">
          <label className="block text-sm font-medium mb-2">Note Format</label>
          <div className="flex bg-gray-100 p-1 rounded-lg">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-shadow ${formatPreference === "bullet"
                ? "bg-white text-blue-700 shadow border border-gray-200"
                : "text-gray-500 hover:text-gray-700"
                }`}
              onClick={() => setFormatPreference("bullet")}
            >
              Bullet Points
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-shadow ${formatPreference === "paragraph"
                ? "bg-white text-blue-700 shadow border border-gray-200"
                : "text-gray-500 hover:text-gray-700"
                }`}
              onClick={() => setFormatPreference("paragraph")}
            >
              Paragraph
            </button>
          </div>
        </div>
      )}

      {/* Generate Button */}
      {selectedConsultationId && !soapNote && !clinicalNote && (
        <div className="mb-6">
          <button
            onClick={handleGenerateSOAP}
            disabled={
              generating || !selectedConsultationId || !selectedTemplate
            }
            className="btn btn-primary w-full py-3 flex items-center justify-center gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Note...
              </>
            ) : (
              <>
                <FileText className="w-5 h-5" />
                Generate Note
              </>
            )}
          </button>
          {!selectedTemplate && (
            <p className="text-xs text-amber-600 mt-2 text-center">
              Please select a template to generate notes
            </p>
          )}
        </div>
      )}

      {/* Clinical Note Display (Dynamic Template Sections) */}
      {clinicalNote && clinicalNote.noteContent?.sections && (
        <div className="space-y-4">
          {/* Format Preference for Regeneration */}
          <div className="mb-4">
            <label className="block text-sm font-medium mb-2 text-gray-700">Note Format</label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-shadow ${formatPreference === "bullet"
                  ? "bg-white text-blue-700 shadow border border-gray-200"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
                onClick={() => setFormatPreference("bullet")}
              >
                Bullet Points
              </button>
              <button
                className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-shadow ${formatPreference === "paragraph"
                  ? "bg-white text-blue-700 shadow border border-gray-200"
                  : "text-gray-500 hover:text-gray-700"
                  }`}
                onClick={() => setFormatPreference("paragraph")}
              >
                Paragraph
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={handleGenerateSOAP}
              disabled={generating}
              className="btn btn-outline flex-1 py-2 flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Regenerating...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Regenerate
                </>
              )}
            </button>
          </div>

          {/* Dynamic Template Sections */}
          {clinicalNote.noteContent.sections.map((section, idx) => (
            <EditableClinicalNoteSection
              key={section.sectionId}
              section={section}
              depth={0}
              expandedSections={expandedSections}
              onToggle={toggleSection}
              onUpdate={async (updatedSection) => {
                await handleUpdateClinicalNoteSection(idx, updatedSection);
              }}
            />
          ))}

          {/* Client Summary */}
          {clinicalNote.clientSummary && (
            <div className="border border-gray-300 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection("clientSummary")}
                className="w-full p-4 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
              >
                <span className="font-medium">Client Summary</span>
                {expandedSections["clientSummary"] ? (
                  <ChevronUp className="w-5 h-5" />
                ) : (
                  <ChevronDown className="w-5 h-5" />
                )}
              </button>
              {expandedSections["clientSummary"] && (
                <div className="p-4 bg-white">
                  {clientSummaryEditMode ? (
                    <div className="space-y-3">
                      <textarea
                        value={editedClientSummary}
                        onChange={(e) => setEditedClientSummary(e.target.value)}
                        className="w-full min-h-[150px] p-3 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
                        autoFocus
                        placeholder="Enter client summary..."
                      />
                      <div className="flex justify-end gap-2 text-sm mt-3">
                        <button
                          className="px-4 py-2 border border-blue-500 text-blue-500 rounded hover:bg-blue-50 transition-colors flex items-center gap-1"
                          onClick={() => setClientSummaryEditMode(false)}
                          disabled={isSavingClientSummary}
                        >
                          <X className="w-4 h-4" /> Cancel
                        </button>
                        <button
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center gap-1"
                          onClick={handleUpdateClientSummary}
                          disabled={isSavingClientSummary}
                        >
                          {isSavingClientSummary ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4" />
                          )}
                          Save Changes
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="group relative">
                      <div className="text-sm text-gray-700 markdown-content min-h-[1.5rem] pr-8 cursor-text hover:bg-gray-50 rounded p-1 -m-1 transition-colors"
                        onClick={() => {
                          setEditedClientSummary(clinicalNote.clientSummary || "");
                          setClientSummaryEditMode(true);
                        }}
                      >
                        <ReactMarkdown
                          components={{
                            h1: ({ node, ...props }) => (
                              <h1 className="text-xl font-bold mb-2 mt-4" {...props} />
                            ),
                            h2: ({ node, ...props }) => (
                              <h2 className="text-lg font-bold mb-2 mt-3" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                              <h3 className="text-base font-bold mb-1 mt-2" {...props} />
                            ),
                            p: ({ node, ...props }) => (
                              <p className="mb-2" {...props} />
                            ),
                            strong: ({ node, ...props }) => (
                              <strong className="font-semibold" {...props} />
                            ),
                            ul: ({ node, ...props }) => (
                              <ul className="list-disc pl-5 mb-2" {...props} />
                            ),
                            ol: ({ node, ...props }) => (
                              <ol className="list-decimal pl-5 mb-2" {...props} />
                            ),
                            li: ({ node, ...props }) => (
                              <li className="mb-1" {...props} />
                            ),
                          }}
                        >
                          {clinicalNote.clientSummary}
                        </ReactMarkdown>
                      </div>
                      <button
                        className="absolute top-0 right-0 p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity hover:text-blue-600 hover:bg-blue-50 rounded"
                        title="Edit Client Summary"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditedClientSummary(clinicalNote.clientSummary || "");
                          setClientSummaryEditMode(true);
                        }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Copy Actions */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyToClipboard}
              disabled={pasting}
              className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              {pasting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Note to Clipboard
                </>
              )}
            </button>
            <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
              Copy the note then paste it into your EHR
            </p>
          </div>
        </div>
      )}

      {/* Legacy SOAP Note Display (fallback) */}
      {soapNote && !clinicalNote && (
        <div className="space-y-4">
          {/* Action Buttons */}
          <div className="flex gap-2 mb-4">
            {!isEditing ? (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="btn btn-outline flex-1 py-2"
                >
                  Edit
                </button>
                <button
                  onClick={handleGenerateSOAP}
                  disabled={generating}
                  className="btn btn-outline flex-1 py-2"
                >
                  {generating ? "Regenerating..." : "Regenerate"}
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={handleSaveEdits}
                  disabled={loading}
                  className="btn btn-primary flex-1 py-2"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    setEditedSOAP(soapNote);
                  }}
                  className="btn btn-outline flex-1 py-2"
                >
                  Cancel
                </button>
              </>
            )}
          </div>

          {/* Note Sections */}
          {(
            [
              "subjective",
              "objective",
              "assessment",
              "plan",
              "clientSummary",
            ] as const
          ).map((section) => {
            const sectionLabels = {
              subjective: "Subjective",
              objective: "Objective",
              assessment: "Assessment",
              plan: "Plan",
              clientSummary: "Client Summary",
            };

            const content = isEditing
              ? editedSOAP[section] || ""
              : soapNote[section] || "";

            if (!content && !isEditing) return null;

            return (
              <div
                key={section}
                className="border border-gray-300 rounded-lg overflow-hidden"
              >
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full p-4 bg-gray-50 hover:bg-gray-100 flex items-center justify-between transition-colors"
                >
                  <span className="font-medium">{sectionLabels[section]}</span>
                  {expandedSections[section] ? (
                    <ChevronUp className="w-5 h-5" />
                  ) : (
                    <ChevronDown className="w-5 h-5" />
                  )}
                </button>

                {expandedSections[section] && (
                  <div className="p-4 bg-white">
                    {isEditing ? (
                      <textarea
                        value={content}
                        onChange={(e) =>
                          handleEditField(section, e.target.value)
                        }
                        className="w-full p-3 border border-gray-300 rounded-lg min-h-32 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder={`Enter ${sectionLabels[
                          section
                        ].toLowerCase()}...`}
                      />
                    ) : section === "clientSummary" ? (
                      <div className="text-sm text-gray-700 markdown-content">
                        {content ? (
                          <ReactMarkdown
                            components={{
                              h1: ({ node, ...props }) => (
                                <h1
                                  className="text-xl font-bold mb-2 mt-4"
                                  {...props}
                                />
                              ),
                              h2: ({ node, ...props }) => (
                                <h2
                                  className="text-lg font-bold mb-2 mt-3"
                                  {...props}
                                />
                              ),
                              h3: ({ node, ...props }) => (
                                <h3
                                  className="text-base font-bold mb-1 mt-2"
                                  {...props}
                                />
                              ),
                              p: ({ node, ...props }) => (
                                <p className="mb-2" {...props} />
                              ),
                              strong: ({ node, ...props }) => (
                                <strong className="font-semibold" {...props} />
                              ),
                              ul: ({ node, ...props }) => (
                                <ul
                                  className="list-disc pl-5 mb-2"
                                  {...props}
                                />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol
                                  className="list-decimal pl-5 mb-2"
                                  {...props}
                                />
                              ),
                              li: ({ node, ...props }) => (
                                <li className="mb-1" {...props} />
                              ),
                            }}
                          >
                            {content}
                          </ReactMarkdown>
                        ) : (
                          <span className="text-gray-400 italic">
                            No content
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="whitespace-pre-wrap text-sm text-gray-700">
                        {content || (
                          <span className="text-gray-400 italic">
                            No content
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Copy Actions */}
          <div className="mt-4 space-y-2">
            <button
              onClick={handleCopyToClipboard}
              disabled={pasting}
              className="btn btn-primary w-full py-2.5 flex items-center justify-center gap-2"
            >
              {pasting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Copying...
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy Note to Clipboard
                </>
              )}
            </button>
            <p className="text-xs text-center" style={{ color: 'var(--color-muted-foreground)' }}>
              Copy the note then paste it into your EHR
            </p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!selectedConsultationId && !loading && (
        <div className="text-center py-10 rounded-lg" style={{ background: 'var(--color-muted)' }}>
          <FileText className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-muted-foreground)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>Select a consultation</p>
          <p className="text-xs mt-1" style={{ color: 'var(--color-muted-foreground)' }}>Choose from the dropdown above to get started</p>
        </div>
      )}

      {/* Section Mapping Dialog */}
      {showMappingDialog && clinicalNote && clinicalNote.noteContent?.sections && (
        <SectionMappingDialog
          sections={clinicalNote.noteContent.sections.map((s) => ({
            title: s.title,
            content: s.content || "",
          }))}
          existingMappings={getExistingMappingsForTemplate()}
          ezyVetFields={ezyVetFields.length > 0 ? ezyVetFields.map((f) => ({ value: f.value, label: f.label })) : undefined}
          onConfirm={async (mappings) => {
            setCustomMappings(mappings);
            setShowMappingDialog(false);

            // Save mappings to DB for this template
            if (selectedTemplate?.id) {
              try {
                await ezyvetConfigService.saveMappings(selectedTemplate.id, mappings);
                setSavedTemplateMappings((prev) => ({
                  ...prev,
                  [String(selectedTemplate.id)]: mappings,
                }));
              } catch (err) {
                console.warn("[SOAPNoteGenerator] Failed to save mappings:", err);
              }
            }

            handlePasteToEHR(mappings);
          }}
          onCancel={() => setShowMappingDialog(false)}
        />
      )}

      {/* Chat Interface */}
      {selectedConsultationId && (
        <ChatInterface
          consultationId={selectedConsultationId}
          patientId={consultations.find(c => c.id === selectedConsultationId)?.patient?.id}
          contextData={{
            patient: consultations.find(c => c.id === selectedConsultationId)?.patient,
            soapNote: clinicalNote,
          }}
        />
      )}
    </div>
  );
}


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
  CheckCircle,
  Check,
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
  const [isCopied, setIsCopied] = useState(false);
  const isExpanded = expandedSections[section.sectionId];

  const handleCopySelf = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const formatSectionText = (s: ClinicalNoteSection, depth = 0): string => {
      const indent = '  '.repeat(depth);
      let text = `${indent}${s.title}:\n${indent}${s.content || 'Not specified'}`;
      if (s.subsections?.length)
        text += '\n' + s.subsections.map(sub => formatSectionText(sub, depth + 1)).join('\n');
      return text;
    };
    try {
      await navigator.clipboard.writeText(formatSectionText(section));
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {}
  };

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
    <div style={{
      border: '1px solid var(--color-border)',
      borderRadius: 10,
      overflow: 'hidden',
      marginLeft: depth > 0 ? 12 : 0,
      marginTop: depth > 0 ? 8 : 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-muted)' }}>
        <button
          onClick={() => onToggle(section.sectionId)}
          style={{
            flex: 1, padding: '9px 13px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            border: 'none', cursor: 'pointer', background: 'transparent', transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-purple-100)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          <span style={{ fontWeight: 600, fontSize: depth > 0 ? 12 : 12.5, color: 'var(--color-foreground)', letterSpacing: '-0.1px' }}>
            {section.title}
          </span>
          {isExpanded ? <ChevronUp size={15} style={{ color: 'var(--color-muted-foreground)' }} /> : <ChevronDown size={15} style={{ color: 'var(--color-muted-foreground)' }} />}
        </button>
        <button
          className="btn-icon"
          title={`Copy ${section.title}`}
          onClick={handleCopySelf}
          style={{ marginRight: 8, opacity: 0.55, flexShrink: 0 }}
        >
          {isCopied ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
        </button>
      </div>

      {isExpanded && (
        <div style={{ padding: '12px 13px', background: 'var(--color-card)', borderTop: '1px solid var(--color-border)' }}>
          {isEditing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                className="input"
                style={{ minHeight: 100, resize: 'vertical', fontSize: 12.5, lineHeight: 1.6 }}
                autoFocus
                placeholder="Enter section content..."
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
                <button className="btn btn-secondary btn-sm" onClick={handleCancel} disabled={isSaving}>
                  <X size={13} /> Cancel
                </button>
                <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={13} />}
                  Save
                </button>
              </div>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              <div
                style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--color-foreground)', lineHeight: 1.65, paddingRight: 28, minHeight: 24, cursor: 'text', borderRadius: 6, padding: '4px 28px 4px 4px', transition: 'background 0.15s' }}
                onClick={() => { setEditContent(section.content || ''); setIsEditing(true); }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-muted)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                {section.content || <span style={{ color: 'var(--color-muted-foreground)', fontStyle: 'italic' }}>No content — click to edit</span>}
              </div>
              <button
                className="btn-icon primary"
                title="Edit Section"
                style={{ position: 'absolute', top: 2, right: 2, opacity: 0.6 }}
                onClick={(e) => { e.stopPropagation(); setEditContent(section.content || ''); setIsEditing(true); }}
              >
                <Edit2 size={13} />
              </button>
            </div>
          )}

          {section.subsections && section.subsections.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
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
}

export function SOAPNoteGenerator({
  initialConsultationId,
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
  const [copiedLegacyKey, setCopiedLegacyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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
  }, [selectedConsultationId, selectedTemplate]);

  const loadConsultations = async () => {
    try {
      setLoading(true);
      const data = await consultationService.getActive();
      // Sort newest first so the dropdown also shows latest at top
      const sorted = [...data].sort((a, b) => {
        const tA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
        const tB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
        return tB - tA;
      });
      setConsultations(sorted);
      // Auto-select the latest consultation only when no id was passed in
      if (!initialConsultationId && sorted.length > 0) {
        setSelectedConsultationId(sorted[0].id);
      }
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
      <div className="page-header">
        <div>
          <h2 className="page-title">Clinical Notes</h2>
          <p style={{ fontSize: 11.5, color: 'var(--color-muted-foreground)', marginTop: 2 }}>Select a consultation to generate or view its note</p>
        </div>
      </div>

      {error && <div className="alert alert-error" style={{ marginBottom: 10 }}>{error}</div>}
      {success && <div className="alert alert-success" style={{ marginBottom: 10 }}>{success}</div>}
      {/* Consultation + Template Selectors */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-foreground)', display: 'block', marginBottom: 5 }}>Consultation</label>
          <select
            value={selectedConsultationId || ""}
            onChange={(e) => setSelectedConsultationId(Number(e.target.value) || null)}
            className="select"
            style={{ width: '100%' }}
            disabled={loading}
          >
            <option value="">-- Select a consultation --</option>
            {consultations.map((consultation) => (
              <option key={consultation.id} value={consultation.id}>
                {consultation.consultationType === "quick_start"
                  ? `Quick Start - ${consultation.species || "Unknown"}`
                  : `${consultation.patient?.name || "Unknown"} (${consultation.patient?.species || "Unknown"})`
                } - {new Date(consultation.startedAt || "").toLocaleDateString()}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-foreground)', display: 'block', marginBottom: 5 }}>
            Template {selectedTemplate?.isDefault && <span className="badge badge-warning" style={{ marginLeft: 5, fontSize: 10 }}>Default</span>}
          </label>
          <select
            value={selectedTemplate?.id || ""}
            onChange={(e) => { const t = templates.find((t) => t.id === Number(e.target.value)) || null; setSelectedTemplate(t); }}
            className="select"
            style={{ width: '100%' }}
          >
            <option value="">-- No template (basic note) --</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>{template.name}{template.isDefault ? " ⭐" : ""}</option>
            ))}
          </select>
          {selectedTemplate?.description && (
            <p style={{ marginTop: 4, fontSize: 11, color: 'var(--color-muted-foreground)' }}>{selectedTemplate.description}</p>
          )}
        </div>
      </div>

      {/* Patient Info Display */}
      {selectedConsultation && (
        <div style={{ marginBottom: 12, padding: '10px 13px', background: 'rgba(102,56,182,0.06)', border: '1px solid var(--color-purple-200)', borderLeft: '3px solid var(--color-primary)', borderRadius: 10 }}>
          {selectedConsultation.patient ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px 16px', fontSize: 12 }}>
              <span style={{ color: 'var(--color-muted-foreground)' }}>Patient</span>
              <span style={{ fontWeight: 600, color: 'var(--color-foreground)' }}>{selectedConsultation.patient.name}</span>
              <span style={{ color: 'var(--color-muted-foreground)' }}>Species</span>
              <span style={{ color: 'var(--color-foreground)' }}>{selectedConsultation.patient.species}{selectedConsultation.patient.breed ? ` · ${selectedConsultation.patient.breed}` : ''}</span>
              <span style={{ color: 'var(--color-muted-foreground)' }}>Owner</span>
              <span style={{ color: 'var(--color-foreground)' }}>{selectedConsultation.patient.owner.name}</span>
              <span style={{ color: 'var(--color-muted-foreground)' }}>Started</span>
              <span style={{ color: 'var(--color-foreground)' }}>{new Date(selectedConsultation.startedAt || "").toLocaleString()}</span>
            </div>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)' }}>Quick Start — patient not linked yet</span>
          )}
        </div>
      )}

      {/* Format Preference */}
      {selectedConsultationId && !soapNote && !clinicalNote && selectedTemplate && (
        <div style={{ marginBottom: 12 }}>
          <label style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-foreground)', display: 'block', marginBottom: 5 }}>Note Format</label>
          <div style={{ display: 'flex', background: 'var(--color-muted)', borderRadius: 10, padding: 3, gap: 3 }}>
            {(['bullet', 'paragraph'] as const).map((f) => (
              <button key={f} onClick={() => setFormatPreference(f)} style={{
                flex: 1, padding: '5px 0', fontSize: 12, fontWeight: formatPreference === f ? 600 : 500,
                borderRadius: 8, border: 'none', cursor: 'pointer',
                background: formatPreference === f ? 'var(--color-card)' : 'transparent',
                color: formatPreference === f ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                boxShadow: formatPreference === f ? 'var(--shadow-xs)' : 'none',
                transition: 'all 0.15s',
              }}>
                {f === 'bullet' ? 'Bullet Points' : 'Paragraph'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Generate Button */}
      {selectedConsultationId && !soapNote && !clinicalNote && (
        <div style={{ marginBottom: 12 }}>
          <button
            onClick={handleGenerateSOAP}
            disabled={generating || !selectedConsultationId || !selectedTemplate}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            {generating
              ? <><Loader2 size={14} style={{ animation: 'spin 0.8s linear infinite' }} />Generating Note...</>
              : <><FileText size={14} />Generate Note</>}
          </button>
          {!selectedTemplate && (
            <p style={{ fontSize: 11, color: 'hsl(38,92%,40%)', marginTop: 6, textAlign: 'center' }}>Please select a template to generate notes</p>
          )}
        </div>
      )}

      {/* Clinical Note Display (Dynamic Template Sections) */}
      {clinicalNote && clinicalNote.noteContent?.sections && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Format + Regenerate row */}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', background: 'var(--color-muted)', borderRadius: 10, padding: 3, gap: 3, flex: 1 }}>
              {(['bullet', 'paragraph'] as const).map((f) => (
                <button key={f} onClick={() => setFormatPreference(f)} style={{
                  flex: 1, padding: '4px 0', fontSize: 11.5, fontWeight: formatPreference === f ? 600 : 500,
                  borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: formatPreference === f ? 'var(--color-card)' : 'transparent',
                  color: formatPreference === f ? 'var(--color-primary)' : 'var(--color-muted-foreground)',
                  boxShadow: formatPreference === f ? 'var(--shadow-xs)' : 'none',
                  transition: 'all 0.15s',
                }}>
                  {f === 'bullet' ? 'Bullets' : 'Paragraph'}
                </button>
              ))}
            </div>
            <button onClick={handleGenerateSOAP} disabled={generating} className="btn btn-secondary btn-sm">
              {generating ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <RefreshCw size={13} />}
              {generating ? 'Regenerating...' : 'Regenerate'}
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
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
              <button
                onClick={() => toggleSection("clientSummary")}
                style={{ width: '100%', padding: '9px 13px', background: 'rgba(34,197,94,0.08)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--color-success)' }}>Client Summary</span>
                {expandedSections["clientSummary"] ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
              </button>
              {expandedSections["clientSummary"] && (
                <div style={{ padding: '12px 13px', background: 'var(--color-card)', borderTop: '1px solid var(--color-border)' }}>
                  {clientSummaryEditMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        value={editedClientSummary}
                        onChange={(e) => setEditedClientSummary(e.target.value)}
                        className="input"
                        style={{ minHeight: 120, resize: 'vertical', fontSize: 12.5 }}
                        autoFocus
                        placeholder="Enter client summary..."
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 7 }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => setClientSummaryEditMode(false)} disabled={isSavingClientSummary}>
                          <X size={13} /> Cancel
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={handleUpdateClientSummary} disabled={isSavingClientSummary}>
                          {isSavingClientSummary ? <Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} /> : <CheckCircle size={13} />}
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ position: 'relative' }}>
                      <div
                        className="markdown-content"
                        style={{ fontSize: 12.5, color: 'var(--color-foreground)', lineHeight: 1.65, paddingRight: 28, cursor: 'text', borderRadius: 6, padding: '4px 28px 4px 4px', transition: 'background 0.15s' }}
                        onClick={() => { setEditedClientSummary(clinicalNote.clientSummary || ''); setClientSummaryEditMode(true); }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-muted)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <ReactMarkdown>{clinicalNote.clientSummary}</ReactMarkdown>
                      </div>
                      <button
                        className="btn-icon primary"
                        title="Edit Client Summary"
                        style={{ position: 'absolute', top: 2, right: 2, opacity: 0.6 }}
                        onClick={(e) => { e.stopPropagation(); setEditedClientSummary(clinicalNote.clientSummary || ''); setClientSummaryEditMode(true); }}
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Copy Actions */}
          <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={handleCopyToClipboard} disabled={pasting} className="btn btn-primary" style={{ width: '100%' }}>
              {pasting ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />Copying...</> : <><Copy size={13} />Copy Note to Clipboard</>}
            </button>
            <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Copy the note then paste it into your EHR</p>
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
              <div key={section} style={{ border: '1px solid var(--color-border)', borderRadius: 10, overflow: 'hidden' }}>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--color-muted)' }}>
                  <button
                    onClick={() => toggleSection(section)}
                    style={{ flex: 1, padding: '9px 13px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-purple-100)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ fontWeight: 600, fontSize: 12.5, color: 'var(--color-foreground)' }}>{sectionLabels[section]}</span>
                    {expandedSections[section] ? <ChevronUp size={15} style={{ color: 'var(--color-muted-foreground)' }} /> : <ChevronDown size={15} style={{ color: 'var(--color-muted-foreground)' }} />}
                  </button>
                  <button
                    className="btn-icon"
                    title={`Copy ${sectionLabels[section]}`}
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!content) return;
                      try {
                        await navigator.clipboard.writeText(`${sectionLabels[section]}:\n${content}`);
                        setCopiedLegacyKey(section);
                        setTimeout(() => setCopiedLegacyKey(null), 2000);
                      } catch {}
                    }}
                    style={{ marginRight: 8, opacity: 0.55, flexShrink: 0 }}
                  >
                    {copiedLegacyKey === section ? <Check size={12} style={{ color: 'var(--color-success)' }} /> : <Copy size={12} />}
                  </button>
                </div>

                {expandedSections[section] && (
                  <div style={{ padding: '12px 13px', background: 'var(--color-card)', borderTop: '1px solid var(--color-border)' }}>
                    {isEditing ? (
                      <textarea
                        value={content}
                        onChange={(e) => handleEditField(section, e.target.value)}
                        className="input"
                        style={{ width: '100%', minHeight: 100, fontSize: 12.5, resize: 'vertical' }}
                        placeholder={`Enter ${sectionLabels[section].toLowerCase()}...`}
                      />
                    ) : section === "clientSummary" ? (
                      <div className="markdown-content" style={{ fontSize: 12.5, color: 'var(--color-foreground)', lineHeight: 1.65 }}>
                        {content ? <ReactMarkdown>{content}</ReactMarkdown> : <span style={{ color: 'var(--color-muted-foreground)', fontStyle: 'italic' }}>No content</span>}
                      </div>
                    ) : (
                      <div style={{ whiteSpace: 'pre-wrap', fontSize: 12.5, color: 'var(--color-foreground)', lineHeight: 1.65 }}>
                        {content || <span style={{ color: 'var(--color-muted-foreground)', fontStyle: 'italic' }}>No content</span>}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Copy Actions */}
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={handleCopyToClipboard} disabled={pasting} className="btn btn-primary" style={{ width: '100%' }}>
              {pasting ? <><Loader2 size={13} style={{ animation: 'spin 0.8s linear infinite' }} />Copying...</> : <><Copy size={13} />Copy Note to Clipboard</>}
            </button>
            <p style={{ fontSize: 11, textAlign: 'center', color: 'var(--color-muted-foreground)' }}>Copy the note then paste it into your EHR</p>
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


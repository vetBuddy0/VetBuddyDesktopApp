import React, { useState, useEffect } from 'react';
import { soapNoteService, type ClinicalNote, type ClinicalNoteSection } from '../services/soapNoteService';
import { patientService } from '../services/patientService';
import { copyToClipboard } from '../services/soapPasteService';
import { FileText, ChevronDown, ChevronUp, Calendar, ArrowLeft, Clipboard, Check } from 'lucide-react';
import type { Patient } from '../types/patient';
import type { SOAPNote } from '../types/soapNote';

interface SOAPNoteListProps {
  selectedPatientId?: number;
  selectedPatientName?: string;
  onBack?: () => void;
}

interface ConsultationWithSOAP {
  id: number;
  completedAt: string | null;
  patient?: Patient;
  soapNote?: SOAPNote;
  clinicalNote?: ClinicalNote;
}

export const SOAPNoteList: React.FC<SOAPNoteListProps> = ({
  selectedPatientId,
  selectedPatientName,
  onBack
}) => {
  const [consultations, setConsultations] = useState<ConsultationWithSOAP[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedNoteId, setExpandedNoteId] = useState<number | null>(null);
  const [copyLoading, setCopyLoading] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  useEffect(() => {
    if (selectedPatientId !== undefined && selectedPatientId !== null) {
      loadPatientSOAPNotes();
    }
  }, [selectedPatientId]);

  const loadPatientSOAPNotes = async () => {
    if (selectedPatientId === undefined || selectedPatientId === null) return;

    try {
      setLoading(true);
      const consultationHistory = await patientService.getConsultations(selectedPatientId);
      const consultationsWithSOAPFlag = consultationHistory.filter(c => c.hasSOAP);
      const consultationsWithSOAP: ConsultationWithSOAP[] = [];

      for (const consultation of consultationsWithSOAPFlag) {
        const clinicalNote = await soapNoteService.getClinicalNote(consultation.id);
        if (clinicalNote?.noteContent?.sections) {
          consultationsWithSOAP.push({ id: consultation.id, completedAt: consultation.completedAt || null, clinicalNote });
          continue;
        }

        const soapNote = await soapNoteService.getSOAPNote(consultation.id);
        if (soapNote && (soapNote.subjective || soapNote.objective || soapNote.assessment || soapNote.plan)) {
          consultationsWithSOAP.push({ id: consultation.id, completedAt: consultation.completedAt || null, soapNote });
        }
      }

      consultationsWithSOAP.sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt).getTime() : 0;
        const dateB = b.completedAt ? new Date(b.completedAt).getTime() : 0;
        return dateB - dateA;
      });

      setConsultations(consultationsWithSOAP.slice(0, 6));
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load SOAP notes');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (noteId: number) => {
    setExpandedNoteId(expandedNoteId === noteId ? null : noteId);
  };

  const handleCopy = async (consultation: ConsultationWithSOAP) => {
    const clinicalNote = consultation.clinicalNote;
    const soapNote = consultation.soapNote;
    if (!clinicalNote && !soapNote) return;

    try {
      setCopyLoading(consultation.id);

      const formatSectionText = (section: ClinicalNoteSection, depth: number = 0): string => {
        const indent = '  '.repeat(depth);
        let text = `${indent}${section.title}:\n${indent}${section.content || 'Not specified'}`;
        if (section.subsections?.length) {
          text += '\n' + section.subsections.map(sub => formatSectionText(sub, depth + 1)).join('\n');
        }
        return text;
      };

      let content = '';
      if (clinicalNote?.noteContent?.sections) {
        content = clinicalNote.noteContent.sections.map(s => formatSectionText(s)).join('\n\n');
        if (clinicalNote.clientSummary) {
          content += `\n\nClient Summary:\n${clinicalNote.clientSummary}`;
        }
      } else if (soapNote) {
        const parts = [];
        if (soapNote.subjective) parts.push(`Subjective:\n${soapNote.subjective}`);
        if (soapNote.objective) parts.push(`Objective:\n${soapNote.objective}`);
        if (soapNote.assessment) parts.push(`Assessment:\n${soapNote.assessment}`);
        if (soapNote.plan) parts.push(`Plan:\n${soapNote.plan}`);
        if (soapNote.clientSummary) parts.push(`Client Summary:\n${soapNote.clientSummary}`);
        content = parts.join('\n\n');
      }

      await copyToClipboard(content);
      setCopiedId(consultation.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      alert(`Failed to copy: ${err.message}`);
    } finally {
      setCopyLoading(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  };

  if (selectedPatientId === undefined || selectedPatientId === null) {
    return (
      <div className="text-center text-muted">
        <p>Please select a patient to view SOAP notes</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="spinner w-6 h-6"></div>
        <p className="text-muted text-sm">Loading SOAP notes for {selectedPatientName}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        {onBack && (
          <button onClick={onBack} className="btn btn-ghost btn-sm mb-3 gap-2">
            <ArrowLeft size={14} /> Back to Patients
          </button>
        )}
        <div className="alert alert-error">
          <p>{error}</p>
          <button onClick={loadPatientSOAPNotes} className="btn btn-primary btn-sm mt-2">Retry</button>
        </div>
      </div>
    );
  }

  if (consultations.length === 0) {
    return (
      <div>
        {onBack && (
          <button onClick={onBack} className="btn btn-ghost btn-sm mb-3 gap-2">
            <ArrowLeft size={14} /> Back to Patients
          </button>
        )}
        <div className="flex flex-col items-center gap-3 py-8 text-center">
          <FileText size={40} style={{ color: 'var(--color-muted-foreground)' }} />
          <p className="font-medium text-foreground">No SOAP notes found</p>
          <p className="text-muted text-sm">No completed consultations with notes for {selectedPatientName}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      {/* Header */}
      <div className="mb-4">
        {onBack && (
          <button onClick={onBack} className="btn btn-ghost btn-sm mb-3 gap-2">
            <ArrowLeft size={14} /> Back to Patients
          </button>
        )}
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-base">
            Notes for {selectedPatientName} <span className="text-muted text-sm">({consultations.length})</span>
          </h2>
          <button onClick={loadPatientSOAPNotes} className="btn btn-ghost btn-sm">Refresh</button>
        </div>
      </div>

      {/* List */}
      <div className="flex flex-col gap-3">
        {consultations.map((consultation) => {
          const hasClinicalNote = consultation.clinicalNote?.noteContent?.sections;
          const hasLegacySOAP = consultation.soapNote;
          if (!hasClinicalNote && !hasLegacySOAP) return null;

          const isExpanded = expandedNoteId === consultation.id;
          const isCopying = copyLoading === consultation.id;
          const isCopied = copiedId === consultation.id;

          const renderSection = (section: ClinicalNoteSection, depth: number = 0): JSX.Element => (
            <div
              key={section.sectionId}
              style={{
                marginBottom: depth === 0 ? '12px' : '6px',
                marginLeft: depth > 0 ? '12px' : '0',
                paddingLeft: depth > 0 ? '10px' : '0',
                borderLeft: depth > 0 ? '2px solid var(--color-border)' : 'none',
              }}
            >
              <h4 style={{
                fontWeight: 600,
                fontSize: depth === 0 ? '13px' : '12px',
                marginBottom: '3px',
                color: 'var(--color-foreground)',
              }}>
                {section.title}
              </h4>
              <p style={{ fontSize: '12px', whiteSpace: 'pre-wrap', color: 'var(--color-foreground)', lineHeight: '1.5' }}>
                {section.content || <span style={{ color: 'var(--color-muted-foreground)', fontStyle: 'italic' }}>No content</span>}
              </p>
              {section.subsections?.length ? (
                <div style={{ marginTop: '6px' }}>
                  {section.subsections.map(sub => renderSection(sub, depth + 1))}
                </div>
              ) : null}
            </div>
          );

          return (
            <div key={consultation.id} className="card">
              {/* Card Header */}
              <div className="px-3 py-2.5" style={{ background: 'var(--color-muted)', borderBottom: '1px solid var(--color-border)' }}>
                <div className="flex items-center gap-2">
                  <Calendar size={13} style={{ color: 'var(--color-muted-foreground)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--color-foreground)' }}>
                    {formatDate(consultation.completedAt)}
                  </span>
                  <span className="text-xs text-muted ml-auto">#{consultation.id}</span>
                </div>
              </div>

              {/* Toggle */}
              <div
                className="flex items-center justify-between px-3 py-2.5 cursor-pointer"
                onClick={() => toggleExpand(consultation.id)}
                style={{ background: 'var(--color-card)' }}
              >
                <span className="flex items-center gap-2 text-sm font-medium" style={{ color: 'var(--color-foreground)' }}>
                  <FileText size={14} style={{ color: 'var(--color-primary)' }} />
                  {hasClinicalNote ? 'Clinical Note' : 'SOAP Note'}
                </span>
                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>

              {/* Content */}
              {isExpanded && (
                <div className="px-3 pb-3" style={{ borderTop: '1px solid var(--color-border)' }}>
                  <div className="mt-3">
                    {hasClinicalNote && consultation.clinicalNote?.noteContent?.sections && (
                      <>
                        {consultation.clinicalNote.noteContent.sections.map(section => renderSection(section))}
                        {consultation.clinicalNote.clientSummary && (
                          <div className="mt-3 p-2.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                            <h4 className="font-semibold text-xs mb-1" style={{ color: 'var(--color-success)' }}>Client Summary</h4>
                            <p className="text-xs" style={{ whiteSpace: 'pre-wrap', color: 'var(--color-foreground)' }}>
                              {consultation.clinicalNote.clientSummary}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {!hasClinicalNote && hasLegacySOAP && (
                      <>
                        {(['subjective', 'objective', 'assessment', 'plan'] as const).map(key =>
                          consultation.soapNote?.[key] ? (
                            <div key={key} className="mb-3">
                              <h4 className="font-semibold text-xs mb-1 capitalize" style={{ color: 'var(--color-foreground)' }}>{key}</h4>
                              <p className="text-xs" style={{ whiteSpace: 'pre-wrap', color: 'var(--color-foreground)', lineHeight: '1.5' }}>
                                {consultation.soapNote[key]}
                              </p>
                            </div>
                          ) : null
                        )}
                        {consultation.soapNote?.clientSummary && (
                          <div className="mt-2 p-2.5 rounded-lg" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                            <h4 className="font-semibold text-xs mb-1" style={{ color: 'var(--color-success)' }}>Client Summary</h4>
                            <p className="text-xs" style={{ whiteSpace: 'pre-wrap', color: 'var(--color-foreground)' }}>
                              {consultation.soapNote.clientSummary}
                            </p>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Copy button */}
                  <button
                    onClick={() => handleCopy(consultation)}
                    disabled={isCopying}
                    className={`btn w-full mt-3 gap-2 ${isCopied ? 'btn-secondary' : 'btn-primary'}`}
                    style={{ fontSize: '12px', padding: '7px' }}
                  >
                    {isCopying ? (
                      <><div className="spinner" style={{ width: '12px', height: '12px', borderWidth: '2px' }}></div>Copying...</>
                    ) : isCopied ? (
                      <><Check size={13} />Copied!</>
                    ) : (
                      <><Clipboard size={13} />Copy to Clipboard</>
                    )}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

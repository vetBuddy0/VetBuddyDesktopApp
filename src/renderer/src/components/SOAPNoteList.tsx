import React, { useState, useEffect } from 'react';
import { soapNoteService, type ClinicalNote, type ClinicalNoteSection } from '../services/soapNoteService';
import { patientService } from '../services/patientService';
import { FileText, ChevronDown, ChevronUp, Calendar, ArrowLeft, Clipboard, Check, RefreshCw, Copy } from 'lucide-react';
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
  const [copiedSectionKey, setCopiedSectionKey] = useState<string | null>(null);

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
      const consultationsWithSOAPFlag = consultationHistory.filter((c: any) => c.hasSOAP);
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
          text += '\n' + section.subsections.map((sub: ClinicalNoteSection) => formatSectionText(sub, depth + 1)).join('\n');
        }
        return text;
      };

      let content = '';
      if (clinicalNote?.noteContent?.sections) {
        content = clinicalNote.noteContent.sections.map((s: ClinicalNoteSection) => formatSectionText(s)).join('\n\n');
        if (clinicalNote.clientSummary) content += `\n\nClient Summary:\n${clinicalNote.clientSummary}`;
      } else if (soapNote) {
        const parts: string[] = [];
        if (soapNote.subjective) parts.push(`Subjective:\n${soapNote.subjective}`);
        if (soapNote.objective) parts.push(`Objective:\n${soapNote.objective}`);
        if (soapNote.assessment) parts.push(`Assessment:\n${soapNote.assessment}`);
        if (soapNote.plan) parts.push(`Plan:\n${soapNote.plan}`);
        if (soapNote.clientSummary) parts.push(`Client Summary:\n${soapNote.clientSummary}`);
        content = parts.join('\n\n');
      }

      await navigator.clipboard.writeText(content);
      setCopiedId(consultation.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err: any) {
      alert(`Failed to copy: ${err.message}`);
    } finally {
      setCopyLoading(null);
    }
  };

  const handleCopySection = async (section: ClinicalNoteSection, consultationId: number) => {
    const formatSectionText = (s: ClinicalNoteSection, depth = 0): string => {
      const indent = '  '.repeat(depth);
      let text = `${indent}${s.title}:\n${indent}${s.content || 'Not specified'}`;
      if (s.subsections?.length)
        text += '\n' + s.subsections.map(sub => formatSectionText(sub, depth + 1)).join('\n');
      return text;
    };
    const key = `${consultationId}-${section.sectionId}`;
    try {
      await navigator.clipboard.writeText(formatSectionText(section));
      setCopiedSectionKey(key);
      setTimeout(() => setCopiedSectionKey(null), 2000);
    } catch (err: any) {
      alert(`Failed to copy: ${err.message}`);
    }
  };

  const handleCopyLegacySection = async (label: string, content: string, consultationId: number, sectionKey: string) => {
    const key = `${consultationId}-soap-${sectionKey}`;
    try {
      await navigator.clipboard.writeText(`${label}:\n${content}`);
      setCopiedSectionKey(key);
      setTimeout(() => setCopiedSectionKey(null), 2000);
    } catch (err: any) {
      alert(`Failed to copy: ${err.message}`);
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
      <div className="empty-state">
        <div className="empty-state-icon"><FileText size={22} /></div>
        <span className="empty-state-title">No patient selected</span>
        <span className="empty-state-desc">Select a patient from the Patients tab to view their SOAP notes.</span>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {onBack && (
            <button onClick={onBack} className="btn-icon" title="Back to Patients">
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="page-title" style={{ marginBottom: 0 }}>
              {selectedPatientName ? `${selectedPatientName}'s Notes` : 'SOAP Notes'}
            </h2>
            {!loading && (
              <p style={{ fontSize: 11, color: 'var(--color-muted-foreground)', marginTop: 2 }}>
                {consultations.length} note{consultations.length !== 1 ? 's' : ''} found
              </p>
            )}
          </div>
        </div>
        <button
          onClick={loadPatientSOAPNotes}
          disabled={loading}
          className="btn-icon primary"
          title="Refresh"
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Loading */}
      {loading ? (
        <div className="empty-state">
          <div className="spinner" style={{ width: 24, height: 24 }} />
          <span style={{ fontSize: 12 }}>Loading notes for {selectedPatientName}...</span>
        </div>
      ) : consultations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><FileText size={22} /></div>
          <span className="empty-state-title">No notes yet</span>
          <span className="empty-state-desc">
            No completed consultations with notes found for {selectedPatientName}.
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
                  marginBottom: depth === 0 ? 10 : 5,
                  marginLeft: depth > 0 ? 10 : 0,
                  paddingLeft: depth > 0 ? 10 : 0,
                  borderLeft: depth > 0 ? '2px solid var(--color-border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                  <h4 style={{
                    fontWeight: 600,
                    fontSize: depth === 0 ? 12.5 : 11.5,
                    color: 'var(--color-foreground)',
                    letterSpacing: '-0.1px',
                    margin: 0,
                  }}>
                    {section.title}
                  </h4>
                  <button
                    className="btn-icon"
                    title={`Copy ${section.title}`}
                    onClick={(e) => { e.stopPropagation(); handleCopySection(section, consultation.id); }}
                    style={{ opacity: 0.55, padding: '2px 4px', flexShrink: 0 }}
                  >
                    {copiedSectionKey === `${consultation.id}-${section.sectionId}`
                      ? <Check size={12} style={{ color: 'var(--color-success)' }} />
                      : <Copy size={12} />}
                  </button>
                </div>
                <p style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--color-foreground)', lineHeight: 1.6 }}>
                  {section.content || <span style={{ color: 'var(--color-muted-foreground)', fontStyle: 'italic' }}>No content</span>}
                </p>
                {section.subsections?.length ? (
                  <div style={{ marginTop: 5 }}>
                    {section.subsections.map((sub: ClinicalNoteSection) => renderSection(sub, depth + 1))}
                  </div>
                ) : null}
              </div>
            );

            return (
              <div key={consultation.id} className="card slide-in" style={{ overflow: 'hidden' }}>
                {/* Date strip */}
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 13px',
                  background: 'var(--color-muted)',
                  borderBottom: '1px solid var(--color-border)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Calendar size={12} style={{ color: 'var(--color-muted-foreground)' }} />
                    <span style={{ fontSize: 11.5, fontWeight: 500, color: 'var(--color-foreground)' }}>
                      {formatDate(consultation.completedAt)}
                    </span>
                  </div>
                  <span style={{ fontSize: 10.5, color: 'var(--color-muted-foreground)' }}>
                    #{consultation.id}
                  </span>
                </div>

                {/* Expand toggle row */}
                <div
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '10px 13px', cursor: 'pointer',
                    background: 'var(--color-card)',
                    transition: 'background 0.15s',
                  }}
                  onClick={() => toggleExpand(consultation.id)}
                >
                  <span style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, fontWeight: 600, color: 'var(--color-foreground)' }}>
                    <FileText size={14} style={{ color: 'var(--color-primary)' }} />
                    {hasClinicalNote ? 'Clinical Note' : 'SOAP Note'}
                  </span>
                  <span style={{ color: 'var(--color-muted-foreground)', display: 'flex' }}>
                    {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                  </span>
                </div>

                {/* Content */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid var(--color-border)', padding: '13px 13px 12px' }}>
                    {hasClinicalNote && consultation.clinicalNote?.noteContent?.sections && (
                      <>
                        {consultation.clinicalNote.noteContent.sections.map((section: ClinicalNoteSection) => renderSection(section))}
                        {consultation.clinicalNote.clientSummary && (
                          <div style={{
                            marginTop: 10, padding: '10px 12px', borderRadius: 9,
                            background: 'rgba(34,197,94,0.07)',
                            border: '1px solid rgba(34,197,94,0.18)',
                          }}>
                            <h4 style={{ fontWeight: 600, fontSize: 11.5, marginBottom: 4, color: 'var(--color-success)' }}>
                              Client Summary
                            </h4>
                            <p style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--color-foreground)', lineHeight: 1.6 }}>
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
                            <div key={key} style={{ marginBottom: 10 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
                                <h4 style={{ fontWeight: 600, fontSize: 12, color: 'var(--color-foreground)', textTransform: 'capitalize', margin: 0 }}>
                                  {key}
                                </h4>
                                <button
                                  className="btn-icon"
                                  title={`Copy ${key}`}
                                  onClick={(e) => { e.stopPropagation(); handleCopyLegacySection(key.charAt(0).toUpperCase() + key.slice(1), consultation.soapNote![key] as string, consultation.id, key); }}
                                  style={{ opacity: 0.55, padding: '2px 4px', flexShrink: 0 }}
                                >
                                  {copiedSectionKey === `${consultation.id}-soap-${key}`
                                    ? <Check size={12} style={{ color: 'var(--color-success)' }} />
                                    : <Copy size={12} />}
                                </button>
                              </div>
                              <p style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--color-foreground)', lineHeight: 1.6 }}>
                                {consultation.soapNote[key]}
                              </p>
                            </div>
                          ) : null
                        )}
                        {consultation.soapNote?.clientSummary && (
                          <div style={{
                            marginTop: 8, padding: '10px 12px', borderRadius: 9,
                            background: 'rgba(34,197,94,0.07)',
                            border: '1px solid rgba(34,197,94,0.18)',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                              <h4 style={{ fontWeight: 600, fontSize: 11.5, color: 'var(--color-success)', margin: 0 }}>
                                Client Summary
                              </h4>
                              <button
                                className="btn-icon"
                                title="Copy Client Summary"
                                onClick={(e) => { e.stopPropagation(); handleCopyLegacySection('Client Summary', consultation.soapNote!.clientSummary as string, consultation.id, 'clientSummary'); }}
                                style={{ opacity: 0.55, padding: '2px 4px', flexShrink: 0 }}
                              >
                                {copiedSectionKey === `${consultation.id}-soap-clientSummary`
                                  ? <Check size={12} style={{ color: 'var(--color-success)' }} />
                                  : <Copy size={12} />}
                              </button>
                            </div>
                            <p style={{ fontSize: 12, whiteSpace: 'pre-wrap', color: 'var(--color-foreground)', lineHeight: 1.6 }}>
                              {consultation.soapNote.clientSummary}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Copy button */}
                    <button
                      onClick={() => handleCopy(consultation)}
                      disabled={isCopying}
                      className={`btn ${isCopied ? 'btn-secondary' : 'btn-primary'}`}
                      style={{ width: '100%', marginTop: 12, fontSize: 12 }}
                    >
                      {isCopying ? (
                        <><div className="spinner" style={{ width: 12, height: 12, borderWidth: 2, borderTopColor: 'var(--color-primary)' }} />Copying...</>
                      ) : isCopied ? (
                        <><Check size={13} />Copied to clipboard</>
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
      )}
    </div>
  );
};

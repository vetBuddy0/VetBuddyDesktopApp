import React, { useState, useEffect } from 'react';
import { consultationService } from '../services/consultationService';
import type { ConsultationWithPatient } from '../types/consultation';
import { Check, FileText, Phone, Play, RefreshCw, Trash2, User, Users2, X } from "lucide-react";

interface ActiveConsultationsProps {
  onResumeConsultation?: (consultationId: number) => void;
  onGenerateSOAP?: (consultationId: number) => void;
}

export const ActiveConsultations: React.FC<ActiveConsultationsProps> = ({
  onResumeConsultation,
  onGenerateSOAP,
}) => {
  const [consultations, setConsultations] = useState<ConsultationWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => { loadActiveConsultations(); }, []);

  const loadActiveConsultations = async () => {
    try {
      setLoading(true);
      const data = await consultationService.getActive();
      setConsultations(data);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load active consultations');
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteConsultation = async (id: number) => {
    if (!confirm('Are you sure you want to complete this consultation?')) return;
    try {
      setLoading(true);
      await consultationService.complete(id);
      await loadActiveConsultations();
    } catch (err: any) {
      setError(err.message || 'Failed to complete consultation');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConsultation = async (id: number) => {
    if (!confirm('Are you sure you want to delete this consultation?')) return;
    try {
      setLoading(true);
      await consultationService.delete(id);
      await loadActiveConsultations();
    } catch (err: any) {
      setError(err.message || 'Failed to delete consultation');
    } finally {
      setLoading(false);
    }
  };

  const filteredConsultations = consultations.filter((consultation) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const patientName = consultation.patient?.name?.toLowerCase() || '';
    const ownerName = consultation.patient?.owner?.name?.toLowerCase() || '';
    const species = consultation.species?.toLowerCase() || consultation.patient?.species?.toLowerCase() || '';
    return patientName.includes(query) || ownerName.includes(query) || species.includes(query);
  });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h2 className="page-title">Active Consultations</h2>
        <button
          onClick={loadActiveConsultations}
          disabled={loading}
          className="btn-icon primary"
          title="Refresh"
        >
          <RefreshCw size={14} style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }} />
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Search */}
      <div className="search-input-wrapper" style={{ marginBottom: 12 }}>
        <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by patient, owner, or species..."
          className="input"
          style={{ paddingRight: 40 }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="btn-icon sm"
            style={{ 
              position: 'absolute', 
              right: 8, 
              top: '50%', 
              transform: 'translateY(-50%)',
              zIndex: 2,
              background: 'transparent',
              color: 'var(--color-muted-foreground)'
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* List */}
      {loading && consultations.length === 0 ? (
        <div className="empty-state">
          <div className="spinner" style={{ width: 24, height: 24 }} />
          <span style={{ fontSize: 12 }}>Loading consultations...</span>
        </div>
      ) : filteredConsultations.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <Users2 size={22} />
          </div>
          <span className="empty-state-title">
            {searchQuery ? 'No results found' : 'No active consultations'}
          </span>
          <span className="empty-state-desc">
            {searchQuery ? 'Try a different search term.' : 'Start a consultation from the Patients tab.'}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {filteredConsultations.map((consultation) => (
            <div
              key={consultation.id}
              className="card card-hover"
              style={{ 
                animation: 'fadeSlideIn 0.2s ease-out',
                borderLeft: '4px solid var(--color-primary)',
                padding: '16px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                {/* Left side: Patient & Owner info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <h3 style={{ 
                      fontSize: 16, 
                      fontWeight: 700, 
                      letterSpacing: '-0.4px', 
                      margin: 0,
                      color: 'var(--color-foreground)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {consultation.consultationType === 'quick_start'
                        ? `${consultation.species || 'Unknown'} (Quick Start)`
                        : consultation.patient?.name || 'Unknown Patient'}
                    </h3>
                    {consultation.consultationType === 'quick_start' && !consultation.patient && (
                       <span className="badge badge-warning" style={{ fontSize: 10 }}>UNLINKED</span>
                    )}
                    <span className="badge badge-secondary" style={{ fontSize: 10, opacity: 0.8 }}>
                      ID: #{consultation.id}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                    <span className="badge badge-primary" style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {consultation.patient?.species || consultation.species || 'Unknown'}
                    </span>
                    {consultation.patient?.breed && (
                      <span style={{ fontSize: 12, color: 'var(--color-muted-foreground)', fontWeight: 500 }}>
                        • {consultation.patient.breed}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 8 }}>
                    {consultation.patient && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-foreground)', fontSize: 13 }}>
                        <div style={{ 
                          width: 28, height: 28, borderRadius: '50%', background: 'var(--color-muted)', 
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                        }}>
                          <User size={14} style={{ color: 'var(--color-muted-foreground)' }} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontWeight: 600, fontSize: 12 }}>{consultation.patient.owner.name}</span>
                          <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Phone size={10} /> {consultation.patient.owner.phone}
                          </span>
                        </div>
                      </div>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--color-muted-foreground)', fontSize: 12 }}>
                      <div style={{ 
                        width: 28, height: 28, borderRadius: '50%', background: 'var(--color-muted)', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                      }}>
                        <RefreshCw size={14} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500, fontSize: 11 }}>STARTED AT</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-foreground)' }}>
                          {consultation.startedAt ? new Date(consultation.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right side: Actions & Status */}
                <div style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'flex-end', 
                  justifyContent: 'space-between',
                  minWidth: '140px',
                  borderLeft: '1px solid var(--color-border)',
                  paddingLeft: 16
                }}>
                  <div style={{ textAlign: 'right', marginBottom: 12 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'flex-end',
                      gap: 6, 
                      color: consultation.hasSOAP ? 'var(--color-primary)' : 'var(--color-success)', 
                      fontWeight: 700, 
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      <div style={{ 
                        width: 6, 
                        height: 6, 
                        borderRadius: '50%', 
                        background: consultation.hasSOAP ? 'var(--color-primary)' : 'var(--color-success)',
                        boxShadow: consultation.hasSOAP ? '0 0 8px var(--color-primary)' : 'none'
                      }} />
                      {consultation.hasSOAP ? 'Note Ready' : 'In Progress'}
                    </div>
                    {consultation.startedAt && (
                      <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)' }}>
                        {Math.floor((Date.now() - new Date(consultation.startedAt).getTime()) / (1000 * 60 * 60)) > 24 
                          ? new Date(consultation.startedAt).toLocaleDateString()
                          : `${Math.floor((Date.now() - new Date(consultation.startedAt).getTime()) / 60000)} mins ago`}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 6 }}>
                    <button 
                      onClick={() => onResumeConsultation?.(consultation.id)} 
                      disabled={loading}
                      className="btn btn-primary"
                      style={{ padding: '8px 12px', height: 'auto', display: 'flex', alignItems: 'center', gap: 6 }}
                      title="Continue recording or editing"
                    >
                      <Play size={14} fill="currentColor" />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>RESUME</span>
                    </button>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button 
                          onClick={() => onGenerateSOAP?.(consultation.id)} 
                          disabled={loading}
                          className="btn-icon primary sm" 
                          title="Generate SOAP Note"
                        >
                          <FileText size={13} />
                        </button>
                        <button 
                          onClick={() => handleCompleteConsultation(consultation.id)} 
                          disabled={loading}
                          className="btn-icon success sm" 
                          title="Mark as Complete"
                        >
                          <Check size={13} />
                        </button>
                        <button 
                          onClick={() => handleDeleteConsultation(consultation.id)} 
                          disabled={loading}
                          className="btn-icon danger sm" 
                          title="Delete Consultation"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

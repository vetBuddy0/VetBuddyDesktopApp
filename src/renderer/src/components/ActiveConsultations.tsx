import React, { useState, useEffect } from 'react';
import { consultationService } from '../services/consultationService';
import type { ConsultationWithPatient } from '../types/consultation';
import { Check, Phone, RefreshCw, Trash2, User, Play, FileText, 
  // Brain 
} from "lucide-react";

interface ActiveConsultationsProps {
  onResumeConsultation?: (consultationId: number) => void;
  onGenerateSOAP?: (consultationId: number) => void;
  // onAnalyze?: (consultationId: number) => void;
}

export const ActiveConsultations: React.FC<ActiveConsultationsProps> = ({
  onResumeConsultation,
  onGenerateSOAP,
  // onAnalyze
}) => {
  const [consultations, setConsultations] = useState<ConsultationWithPatient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadActiveConsultations();
  }, []);

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

  // Calculate duration since consultation started
  // const getDuration = (startedAt?: string | null): string => {
  //   if (!startedAt) return 'Unknown';

  //   const now = new Date();
  //   const start = new Date(startedAt);
  //   const diffMs = now.getTime() - start.getTime();
  //   const diffMins = Math.floor(diffMs / 60000);

  //   if (diffMins < 60) {
  //     return `${diffMins} min${diffMins !== 1 ? 's' : ''}`;
  //   } else {
  //     const hours = Math.floor(diffMins / 60);
  //     const mins = diffMins % 60;
  //     return `${hours}h ${mins}m`;
  //   }
  // };

  // Filter consultations
  const filteredConsultations = consultations.filter((consultation) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    const patientName = consultation.patient?.name?.toLowerCase() || '';
    const ownerName = consultation.patient?.owner?.name?.toLowerCase() || '';
    const species = consultation.species?.toLowerCase() || consultation.patient?.species?.toLowerCase() || '';

    return (
      patientName.includes(query) ||
      ownerName.includes(query) ||
      species.includes(query)
    );
  });

  return (
    <div>
      <div className="mb-4">
        <h2 className="m-0 mb-4 text-xl font-semibold text-foreground">
          Active Consultations
        </h2>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by patient, owner, or species..."
          className="input mb-4"
        />

        <button
          onClick={loadActiveConsultations}
          disabled={loading}
          className="btn btn-outline w-full gap-2"
        >
          {loading ? (
            <>
              <div className='spinner'></div>
              Refreshing...
            </>
          ) : (
            <>
              <RefreshCw className='w-4 h-4' />
              Refresh
            </>
          )}
        </button>
      </div>

      {/* Consultations List */}
      {loading && consultations.length === 0 ? (
        <div className="text-muted text-center p-8">
          <div className="spinner m-auto mb-4 w-6 h-6"></div>
          Loading...
        </div>
      ) : filteredConsultations.length === 0 ? (
        <div className="text-muted text-center p-8">
          {searchQuery ? 'No consultations found' : 'No active consultations'}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredConsultations.map((consultation) => (
            <div key={consultation.id} className="card">
              <div className="card-content">
                {/* Header with Name and Action Icons */}
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold m-0">
                    {consultation.consultationType === 'quick_start' ? (
                      <>Quick Start - {consultation.species || 'Unknown'}</>
                    ) : (
                      consultation.patient?.name || 'Unknown Patient'
                    )}
                  </h3>
                  <div className="flex gap-1">
                    {/* Resume Icon */}
                    <button
                      onClick={() => onResumeConsultation?.(consultation.id)}
                      disabled={loading}
                      className="p-2 rounded-full hover:bg-blue-50 transition-colors text-blue-600"
                      title="Resume"
                    >
                      <Play className='w-4 h-4' />
                    </button>
                    {/* Analyze Icon */}
                    {/* <button
                      onClick={() => onAnalyze?.(consultation.id)}
                      disabled={loading}
                      className="p-2 rounded-full hover:bg-teal-50 transition-colors text-teal-600"
                      title="AI Analysis"
                    >
                      <Brain className='w-4 h-4' />
                    </button> */}
                    {/* Generate SOAP Icon */}
                    <button
                      onClick={() => onGenerateSOAP?.(consultation.id)}
                      disabled={loading}
                      className="p-2 rounded-full hover:bg-purple-50 transition-colors text-purple-600"
                      title="Generate SOAP Note"
                    >
                      <FileText className='w-4 h-4' />
                    </button>
                    {/* Complete Icon */}
                    <button
                      onClick={() => handleCompleteConsultation(consultation.id)}
                      disabled={loading}
                      className="p-2 rounded-full hover:bg-green-50 transition-colors text-green-600"
                      title="Complete"
                    >
                      <Check className='w-4 h-4' />
                    </button>
                    {/* Delete Icon */}
                    <button
                      onClick={() => handleDeleteConsultation(consultation.id)}
                      disabled={loading}
                      className="p-2 rounded-full hover:bg-red-50 transition-colors text-red-600"
                      title="Delete"
                    >
                      <Trash2 className='w-4 h-4' />
                    </button>
                  </div>
                </div>

                {/* Species Badge and Patient Details */}
                {consultation.patient && (
                  <div className="mb-2">
                    <span className="badge badge-primary">
                      {consultation.patient.species}
                    </span>
                    {consultation.patient.breed && (
                      <span className="text-sm text-gray-600 ml-2">
                        {consultation.patient.breed}
                      </span>
                    )}
                  </div>
                )}

                {/* Quick Start Warning */}
                {consultation.consultationType === 'quick_start' && !consultation.patient && (
                  <div className="mb-2">
                    <span className="badge badge-primary">
                      {consultation.species || 'Unknown'}
                    </span>
                    <div className="text-warning italic text-sm mt-1">
                      Patient not linked yet
                    </div>
                  </div>
                )}

                {/* Owner Info */}
                {consultation.patient && (
                  <div className="mb-4 text-sm">
                    <div className="flex items-center gap-2 text-gray-700 mb-1">
                      <User className='w-4 h-4' />
                      <span className="font-medium">{consultation.patient.owner.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className='w-4 h-4' />
                      <span>{consultation.patient.owner.phone}</span>
                    </div>
                  </div>
                )}

                {/* Started Time */}
                <div className="text-xs text-gray-500">
                  Started: {consultation.startedAt ? new Date(consultation.startedAt).toLocaleString() : 'Unknown'}
                </div>

                {/* Complete Consultation Button */}
                {/* <button
                  onClick={() => handleCompleteConsultation(consultation.id)}
                  disabled={loading}
                  className="btn btn-primary w-full gap-2"
                  style={{ background: 'var(--success)', borderColor: 'var(--success)' }}
                >
                  <Check className='w-4 h-4' />
                  Complete Consultation
                </button> */}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

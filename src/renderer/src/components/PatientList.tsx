import React, { useState, useEffect, useRef } from 'react';
import { patientService, ownerService } from '../services/patientService';
import { consultationService } from '../services/consultationService';
import type { Patient, Owner, Species, EzyVetPrefillData } from '../types/patient';
import { SPECIES_OPTIONS } from '../types/patient';
import { Bell, Calendar, Edit2, Phone, Plus, Search, Trash2, User, Weight, X } from "lucide-react";
import { ReminderDialog } from './ReminderDialog';

interface PatientListProps {
  onConsultationStart?: (consultationId: number) => void;
  onViewActiveConsultations?: () => void;
  onViewSOAPNotes?: (patientId: number, patientName: string) => void;
  prefillData?: EzyVetPrefillData | null;
  onPatientAdded?: (patientId: number, patientName: string) => void;
}



export const PatientList: React.FC<PatientListProps> = ({
  onConsultationStart,
  onViewActiveConsultations,
  onViewSOAPNotes,
  prefillData,
  onPatientAdded,
}) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [owners, setOwners] = useState<Owner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSpecies, setSelectedSpecies] = useState<string>('');
  const [showAddPatient, setShowAddPatient] = useState(false);
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [reminderDialogOpen, setReminderDialogOpen] = useState(false);
  const [selectedPatientForReminder, setSelectedPatientForReminder] = useState<Patient | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    name: '', species: '' as Species | '', breed: '', age: '', weight: '',
    medicalHistory: '', ownerId: 0,
  });

  const [isNewOwner, setIsNewOwner] = useState(false);
  const [newOwner, setNewOwner] = useState({ name: '', phone: '', email: '' });

  useEffect(() => { loadData(); }, []);

  useEffect(() => {
    if (!prefillData) return;
    setEditingPatient(null);
    setIsNewOwner(true);
    setNewOwner({ name: prefillData.ownerName || '', phone: '—', email: '' });
    setFormData({
      name: prefillData.name,
      species: (SPECIES_OPTIONS.includes(prefillData.species as Species) ? prefillData.species : '') as Species | '',
      breed: prefillData.breed || '', age: '', weight: prefillData.weight || '',
      medicalHistory: '', ownerId: 0,
    });
    setShowAddPatient(true);
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }, [prefillData]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [patientsData, ownersData] = await Promise.all([
        patientService.getAll(),
        ownerService.getAll(),
      ]);
      setPatients(patientsData);
      setOwners(ownersData);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({ name: '', species: '', breed: '', age: '', weight: '', medicalHistory: '', ownerId: 0 });
    setNewOwner({ name: '', phone: '', email: '' });
    setIsNewOwner(false);
  };

  const handleAddPatient = async () => {
    try {
      setLoading(true);
      let ownerId = formData.ownerId;
      if (isNewOwner) {
        if (!newOwner.name || !newOwner.phone) { setError('Owner name and phone are required'); setLoading(false); return; }
        const createdOwner = await ownerService.create(newOwner);
        ownerId = createdOwner.id;
      }
      if (!formData.name || !formData.species || !ownerId) {
        setError('Patient name, species, and owner are required'); setLoading(false); return;
      }
      const newPatient = await patientService.create({
        name: formData.name, species: formData.species, breed: formData.breed,
        age: formData.age, weight: formData.weight, medicalHistory: formData.medicalHistory, ownerId,
      });
      onPatientAdded?.(newPatient.id, newPatient.name);
      resetForm();
      setShowAddPatient(false);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to add patient');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePatient = async () => {
    if (!editingPatient) return;
    try {
      setLoading(true);
      await patientService.update(editingPatient.id, {
        name: formData.name, species: formData.species, breed: formData.breed,
        age: formData.age, weight: formData.weight, medicalHistory: formData.medicalHistory,
      });
      setEditingPatient(null);
      setShowAddPatient(false);
      resetForm();
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to update patient');
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePatient = async (id: number) => {
    if (!confirm('Are you sure you want to delete this patient?')) return;
    try {
      setLoading(true);
      await patientService.delete(id);
      await loadData();
    } catch (err: any) {
      setError(err.message || 'Failed to delete patient');
    } finally {
      setLoading(false);
    }
  };

  const handleEditPatient = (patient: Patient) => {
    setEditingPatient(patient);
    setFormData({
      name: patient.name, species: patient.species as Species, breed: patient.breed || '',
      age: patient.age || '', weight: patient.weight || '',
      medicalHistory: patient.medicalHistory || '', ownerId: patient.ownerId,
    });
    setShowAddPatient(true);
  };

  const handleStartConsultation = async (patient: Patient) => {
    if (!patient.id) return;
    try {
      setError('');
      const validation = await consultationService.validatePatient(patient.id);
      if (!validation.valid) {
        const proceed = confirm(
          `⚠️ Active Consultation Detected\n\n${patient.name} already has an active consultation.\n\nWould you like to view active consultations?`
        );
        if (proceed && onViewActiveConsultations) onViewActiveConsultations();
        return;
      }
      const consultation = await consultationService.create({ patientId: patient.id, consultationType: 'standard' });
      if (onConsultationStart) {
        onConsultationStart(consultation.id);
      } else {
        alert(`Consultation started for ${patient.name}!`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start consultation');
    }
  };

  const filteredPatients = patients.filter((patient) => {
    const matchesSearch =
      patient.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.owner.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      patient.owner.phone.includes(searchQuery);
    const matchesSpecies = !selectedSpecies || patient.species === selectedSpecies;
    return matchesSearch && matchesSpecies;
  });

  return (
    <div>
      {/* Page Header */}
      <div className="page-header">
        <h2 className="page-title">Patients</h2>
        <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)', fontWeight: 500 }}>
          {patients.length} record{patients.length !== 1 ? 's' : ''}
        </span>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Search & Filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <div className="search-input-wrapper" style={{ flex: 1 }}>
          <Search size={14} className="search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients or owners..."
            className="input"
          />
        </div>
        <select
          value={selectedSpecies}
          onChange={(e) => setSelectedSpecies(e.target.value)}
          className="select"
          style={{ maxWidth: 110 }}
        >
          <option value="">All species</option>
          {SPECIES_OPTIONS.map((species) => (
            <option key={species} value={species}>{species}</option>
          ))}
        </select>
      </div>

      {/* Add Patient Button */}
      <button
        onClick={() => { resetForm(); setEditingPatient(null); setShowAddPatient(true); }}
        className="btn btn-primary"
        style={{ width: '100%', marginBottom: 14 }}
      >
        <Plus size={14} />
        Add New Patient
      </button>

      {/* Add/Edit Form */}
      {showAddPatient && (
        <div ref={formRef} className="card" style={{ marginBottom: 14, animation: 'scaleIn 0.2s ease' }}>
          <div className="card-header">
            <span className="card-title">{editingPatient ? 'Edit Patient' : 'New Patient'}</span>
            <button
              onClick={() => { setShowAddPatient(false); setEditingPatient(null); resetForm(); }}
              className="btn-icon"
            >
              <X size={14} />
            </button>
          </div>
          <div className="card-content" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <input type="text" placeholder="Patient name *" value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })} className="input" />
            <select value={formData.species}
              onChange={(e) => setFormData({ ...formData, species: e.target.value as Species })} className="select">
              <option value="">Select species *</option>
              {SPECIES_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              <input type="text" placeholder="Breed" value={formData.breed}
                onChange={(e) => setFormData({ ...formData, breed: e.target.value })} className="input" />
              <input type="text" placeholder="Age (e.g. 2 yrs)" value={formData.age}
                onChange={(e) => setFormData({ ...formData, age: e.target.value })} className="input" />
            </div>
            <input type="text" placeholder="Weight (e.g. 15 kg)" value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })} className="input" />
            <textarea placeholder="Medical history" value={formData.medicalHistory}
              onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
              rows={2} className="input" style={{ resize: 'vertical' }} />

            {!editingPatient && (
              <>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer' }}>
                  <input type="checkbox" checked={isNewOwner}
                    onChange={(e) => setIsNewOwner(e.target.checked)} style={{ accentColor: 'var(--color-primary)' }} />
                  Create new owner
                </label>
                {isNewOwner ? (
                  <>
                    <input type="text" placeholder="Owner name *" value={newOwner.name}
                      onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })} className="input" />
                    <input type="tel" placeholder="Owner phone *" value={newOwner.phone}
                      onChange={(e) => setNewOwner({ ...newOwner, phone: e.target.value })} className="input" />
                    <input type="email" placeholder="Owner email" value={newOwner.email}
                      onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })} className="input" />
                  </>
                ) : (
                  <select value={formData.ownerId}
                    onChange={(e) => setFormData({ ...formData, ownerId: Number(e.target.value) })} className="select">
                    <option value={0}>Select owner *</option>
                    {owners.map((o) => <option key={o.id} value={o.id}>{o.name} — {o.phone}</option>)}
                  </select>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <button onClick={editingPatient ? handleUpdatePatient : handleAddPatient}
                disabled={loading} className="btn btn-primary" style={{ flex: 1 }}>
                {loading ? <><span className="spinner" style={{ borderTopColor: 'white', borderColor: 'rgba(255,255,255,0.3)' }} /> Saving...</> : (editingPatient ? 'Update Patient' : 'Add Patient')}
              </button>
              <button onClick={() => { setShowAddPatient(false); setEditingPatient(null); resetForm(); }}
                disabled={loading} className="btn btn-secondary">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Patient List */}
      {loading && !showAddPatient ? (
        <div className="empty-state">
          <div className="spinner" style={{ width: 24, height: 24 }} />
          <span style={{ fontSize: 12 }}>Loading patients...</span>
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <User size={22} />
          </div>
          <span className="empty-state-title">{searchQuery ? 'No results found' : 'No patients yet'}</span>
          <span className="empty-state-desc">
            {searchQuery ? 'Try a different search term.' : 'Add your first patient using the button above.'}
          </span>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filteredPatients.map((patient) => (
            <div key={patient.id} className="card card-hover" style={{ animation: 'fadeSlideIn 0.2s ease-out' }}>
              <div className="card-content">
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  {/* Main Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
                      <div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-0.3px', color: 'var(--color-foreground)', marginBottom: 3 }}>
                          {patient.name}
                        </h3>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span className="badge badge-primary">{patient.species}</span>
                          {patient.age && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--color-muted-foreground)' }}>
                              <Calendar size={10} />{patient.age}
                            </span>
                          )}
                          {patient.weight && (
                            <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: 'var(--color-muted-foreground)' }}>
                              <Weight size={10} />{patient.weight}
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Action icon row */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                        <button onClick={() => { setReminderDialogOpen(true); setSelectedPatientForReminder(patient); }}
                          className="btn-icon warning" title="Set Reminder">
                          <Bell size={13} />
                        </button>
                        <button onClick={() => handleEditPatient(patient)} className="btn-icon primary" title="Edit">
                          <Edit2 size={13} />
                        </button>
                        <button onClick={() => handleDeletePatient(patient.id)} className="btn-icon danger" title="Delete">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    {/* Owner info */}
                    <div style={{ borderTop: '1px solid var(--color-border)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, color: 'var(--color-foreground)', fontWeight: 500 }}>
                          <User size={11} style={{ color: 'var(--color-muted-foreground)' }} />
                          {patient.owner.name === 'Owner' ? 'Unknown User' : patient.owner.name}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--color-muted-foreground)' }}>
                          <Phone size={11} />
                          {patient.owner.phone === '9999999999' ? 'No phone' : patient.owner.phone}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleStartConsultation(patient)} disabled={loading}
                          className="btn btn-secondary btn-sm">
                          Start
                        </button>
                        <button onClick={() => onViewSOAPNotes?.(patient.id, patient.name)} disabled={loading}
                          className="btn btn-primary btn-sm">
                          SOAP
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

      {reminderDialogOpen && selectedPatientForReminder && (
        <ReminderDialog
          isOpen={reminderDialogOpen}
          onClose={() => { setReminderDialogOpen(false); setSelectedPatientForReminder(null); }}
          patient={selectedPatientForReminder}
        />
      )}
    </div>
  );
};

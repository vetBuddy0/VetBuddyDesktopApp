import React, { useState, useEffect, useRef } from 'react';
import { patientService, ownerService } from '../services/patientService';
import { consultationService } from '../services/consultationService';
import type { Patient, Owner, Species, EzyVetPrefillData } from '../types/patient';
import { SPECIES_OPTIONS } from '../types/patient';
import { Bell, Calendar, Edit2, Phone, Plus, Trash2, User, Weight } from "lucide-react";
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

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    species: '' as Species | '',
    breed: '',
    age: '',
    weight: '',
    medicalHistory: '',
    ownerId: 0,
  });

  // New owner form
  const [isNewOwner, setIsNewOwner] = useState(false);
  const [newOwner, setNewOwner] = useState({
    name: '',
    phone: '',
    email: '',
  });

  // Load patients and owners
  useEffect(() => {
    loadData();
  }, []);

  // When prefill data arrives from ezyVet import, open the form pre-populated
  useEffect(() => {
    if (!prefillData) return;
    setEditingPatient(null);
    setIsNewOwner(true);
    setNewOwner({ name: prefillData.ownerName || '', phone: '—', email: '' });
    setFormData({
      name: prefillData.name,
      species: (SPECIES_OPTIONS.includes(prefillData.species as Species) ? prefillData.species : '') as Species | '',
      breed: prefillData.breed || '',
      age: '',
      weight: prefillData.weight || '',
      medicalHistory: '',
      ownerId: 0,
    });
    setShowAddPatient(true);
    // Scroll the form into view after render
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

  const handleAddPatient = async () => {
    try {
      setLoading(true);
      let ownerId = formData.ownerId;

      // Create new owner if needed
      if (isNewOwner) {
        if (!newOwner.name || !newOwner.phone) {
          setError('Owner name and phone are required');
          setLoading(false);
          return;
        }
        const createdOwner = await ownerService.create(newOwner);
        ownerId = createdOwner.id;
      }

      if (!formData.name || !formData.species || !ownerId) {
        setError('Patient name, species, and owner are required');
        setLoading(false);
        return;
      }

      const newPatient = await patientService.create({
        name: formData.name,
        species: formData.species,
        breed: formData.breed,
        age: formData.age,
        weight: formData.weight,
        medicalHistory: formData.medicalHistory,
        ownerId,
      });

      onPatientAdded?.(newPatient.id, newPatient.name);

      // Reset form
      setFormData({
        name: '',
        species: '',
        breed: '',
        age: '',
        weight: '',
        medicalHistory: '',
        ownerId: 0,
      });
      setNewOwner({ name: '', phone: '', email: '' });
      setIsNewOwner(false);
      setShowAddPatient(false);

      // Reload data
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
        name: formData.name,
        species: formData.species,
        breed: formData.breed,
        age: formData.age,
        weight: formData.weight,
        medicalHistory: formData.medicalHistory,
      });

      setEditingPatient(null);
      setShowAddPatient(false);
      setFormData({
        name: '',
        species: '',
        breed: '',
        age: '',
        weight: '',
        medicalHistory: '',
        ownerId: 0,
      });

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
      name: patient.name,
      species: patient.species as Species,
      breed: patient.breed || '',
      age: patient.age || '',
      weight: patient.weight || '',
      medicalHistory: patient.medicalHistory || '',
      ownerId: patient.ownerId,
    });
    setShowAddPatient(true);
  };

  const handleOpenReminderDialog = (patient: Patient) => {
    setSelectedPatientForReminder(patient);
    setReminderDialogOpen(true);
  };

  const handleCloseReminderDialog = () => {
    setReminderDialogOpen(false);
    setSelectedPatientForReminder(null);
  };

  // Start Consultation functionality
  const handleStartConsultation = async (patient: Patient) => {
    if (!patient.id) return;
    try {
      setError('');
      const validation = await consultationService.validatePatient(patient.id);
      if (!validation.valid) {
        const proceed = confirm(
          `⚠️ Active Consultation Detected\n\n${patient.name} already has an active consultation.\n\nWould you like to view active consultations?`
        );
        if (proceed && onViewActiveConsultations) {
          onViewActiveConsultations();
        }
        return;
      }
      const consultation = await consultationService.create({
        patientId: patient.id,
        consultationType: 'standard',
      });
      if (onConsultationStart) {
        onConsultationStart(consultation.id);
      } else {
        alert(`Consultation started for ${patient.name}!`);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to start consultation');
    }
  };

  // Filter patients
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
      <div className="mb-4">
        <h2 className="m-0 mb-4 text-xl font-semibold text-foreground">
          Patients
        </h2>

        {error && (
          <div className="alert alert-error">
            {error}
          </div>
        )}

        {/* Search and Filter */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search patients..."
            className="input flex-1"
          />
          <select
            value={selectedSpecies}
            onChange={(e) => setSelectedSpecies(e.target.value)}
            className="select max-w-[100px]"
          >
            <option value="">Species</option>
            {SPECIES_OPTIONS.map((species) => (
              <option key={species} value={species}>
                {species}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={() => {
            setEditingPatient(null);
            setFormData({
              name: '',
              species: '',
              breed: '',
              age: '',
              weight: '',
              medicalHistory: '',
              ownerId: 0,
            });
            setShowAddPatient(true);
          }}
          className="btn btn-primary w-full gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Patient
        </button>
      </div>

      {/* Add/Edit Patient Form */}
      {showAddPatient && (
        <div ref={formRef} className="card mb-6">
          <div className="card-header">
            <h3 className="card-title">
              {editingPatient ? 'Edit Patient' : 'Add Patient'}
            </h3>
          </div>

          <div className="card-content flex flex-col gap-4">
            <input
              type="text"
              placeholder="Patient Name *"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="input"
            />

            <select
              value={formData.species}
              onChange={(e) => setFormData({ ...formData, species: e.target.value as Species })}
              className="select"
            >
              <option value="">Select Species *</option>
              {SPECIES_OPTIONS.map((species) => (
                <option key={species} value={species}>
                  {species}
                </option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Breed"
              value={formData.breed}
              onChange={(e) => setFormData({ ...formData, breed: e.target.value })}
              className="input"
            />

            <input
              type="text"
              placeholder="Age (e.g., 2 years)"
              value={formData.age}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="input"
            />

            <input
              type="text"
              placeholder="Weight (e.g., 15 kg)"
              value={formData.weight}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              className="input"
            />

            <textarea
              placeholder="Medical History"
              value={formData.medicalHistory}
              onChange={(e) => setFormData({ ...formData, medicalHistory: e.target.value })}
              rows={3}
              className="input resize-y"
            />

            {!editingPatient && (
              <>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={isNewOwner}
                    onChange={(e) => setIsNewOwner(e.target.checked)}
                    id="newOwner"
                  />
                  <label htmlFor="newOwner" className="text-sm">
                    Create new owner
                  </label>
                </div>

                {isNewOwner ? (
                  <>
                    <input
                      type="text"
                      placeholder="Owner Name *"
                      value={newOwner.name}
                      onChange={(e) => setNewOwner({ ...newOwner, name: e.target.value })}
                      className="input"
                    />
                    <input
                      type="tel"
                      placeholder="Owner Phone (with country code) *"
                      value={newOwner.phone}
                      onChange={(e) => setNewOwner({ ...newOwner, phone: e.target.value })}
                      className="input"
                    />
                    <input
                      type="email"
                      placeholder="Owner Email"
                      value={newOwner.email}
                      onChange={(e) => setNewOwner({ ...newOwner, email: e.target.value })}
                      className="input"
                    />
                  </>
                ) : (
                  <select
                    value={formData.ownerId}
                    onChange={(e) => setFormData({ ...formData, ownerId: Number(e.target.value) })}
                    className="select"
                  >
                    <option value={0}>Select Owner *</option>
                    {owners.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name} - {owner.phone}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}

            <div className="flex gap-2">
              <button
                onClick={editingPatient ? handleUpdatePatient : handleAddPatient}
                disabled={loading}
                className="btn btn-primary flex-1"
              >
                {loading ? (
                  <div className="flex items-center justify-center gap-2">
                    <div className="spinner"></div>
                    Saving...
                  </div>
                ) : (
                  editingPatient ? 'Update' : 'Add Patient'
                )}
              </button>
              <button
                onClick={() => {
                  setShowAddPatient(false);
                  setEditingPatient(null);
                }}
                disabled={loading}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient List */}
      {loading && !showAddPatient ? (
        <div className="text-muted text-center p-8">
          <div className="spinner m-auto mb-4 w-6 h-6"></div>
          Loading...
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="text-muted text-center p-8">
          No patients found
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredPatients.map((patient) => (
            <div key={patient.id} className="card">
              <div className="card-content">
                {/* Header with Name and Action Icons */}
                <div className="flex justify-between items-start mb-2">
                  <h3 className="text-lg font-semibold m-0">
                    {patient.name}
                  </h3>
                  <div className="flex gap-1">
                    {/* Reminder Icon */}
                    <button
                      onClick={() => handleOpenReminderDialog(patient)}
                      className="p-2 rounded-full hover:bg-orange-50 transition-colors"
                      title="Set Reminder"
                    >
                      <Bell className="w-4 h-4 text-orange-600"/>
                    </button>
                    {/* Edit Icon */}
                    <button
                      onClick={() => handleEditPatient(patient)}
                      className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-4 h-4"/>
                    </button>
                    {/* Delete Icon */}
                    <button
                      onClick={() => handleDeletePatient(patient.id)}
                      className="p-2 rounded-full hover:bg-red-50 transition-colors text-red-600"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4"/>
                    </button>
                  </div>
                </div>

                {/* Species, Age, Weight Row */}
                <div className="flex items-center gap-4 mb-2 text-sm text-gray-600">
                  <span className="badge badge-primary">
                    {patient.species}
                  </span>
                  {patient.age && (
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4"/>
                      <span>{patient.age}</span>
                    </div>
                  )}
                  {patient.weight && (
                    <div className="flex items-center gap-1">
                      <Weight className="w-4 h-4"/>
                      <span>{patient.weight}</span>
                    </div>
                  )}
                </div>
                <div className='flex justify-between items-center pt-2 border-t'>
                  {/* Owner Info */}
                  <div className="text-sm">
                    <div className="flex items-center gap-2 text-gray-700 mb-1">
                      <User className="w-4 h-4"/>
                      <span className="font-medium">{patient.owner.name === "Owner" ? "Unknown User" : patient.owner.name}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Phone className="w-4 h-4"/>
                      <span className="text-gray-600">{patient.owner.phone === "9999999999" ? "No Phone Number" : patient.owner.phone}</span>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-2">
                    {/* Start Consultation Button */}
                    <button
                      onClick={() => handleStartConsultation(patient)}
                      disabled={loading}
                      className="btn btn-secondary h-8"
                      style={{
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      Start
                    </button>

                    {/* View SOAP Notes Button */}
                    <button
                      onClick={() => onViewSOAPNotes?.(patient.id, patient.name)}
                      disabled={loading}
                      className="btn btn-primary h-8"
                      style={{
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      SOAP
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reminder Dialog */}
      {reminderDialogOpen && selectedPatientForReminder && (
        <ReminderDialog
          isOpen={reminderDialogOpen}
          onClose={handleCloseReminderDialog}
          patient={selectedPatientForReminder}
        />
      )}
    </div>
  );
};

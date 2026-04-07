import React, { useState, useEffect } from 'react';
import { Bell, X, Mail } from 'lucide-react';
import type { Patient } from '../types/patient';
import type { ReminderFormData, EventType, VoiceLanguage } from '../types/reminder';
import {
  EVENT_TYPE_OPTIONS,
  EMAIL_DAYS_OPTIONS,
  WHATSAPP_DAYS_OPTIONS,
} from '../types/reminder';
import { reminderService } from '../services/reminderService';

interface ReminderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  patient: Patient;
}

export const ReminderDialog: React.FC<ReminderDialogProps> = ({
  isOpen,
  onClose,
  patient,
}) => {
  const [reminderData, setReminderData] = useState<ReminderFormData>({
    eventType: 'vaccination' as EventType,
    eventDate: '',
    emailDaysBefore: 7,
    whatsappDaysBefore: 3,
    voiceCallDaysBefore: 0,
    voiceCallLanguage: 'en-US' as VoiceLanguage,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Get today's date in YYYY-MM-DD format for min date
  const today = new Date().toISOString().split('T')[0];

  // Reset form when dialog opens
  useEffect(() => {
    if (isOpen) {
      setReminderData({
        eventType: 'vaccination',
        eventDate: '',
        emailDaysBefore: 7,
        whatsappDaysBefore: 3,
        voiceCallDaysBefore: 0,
        voiceCallLanguage: 'en-US',
      });
      setError('');
    }
  }, [isOpen]);

  // Calculate reminder dates
  const calculateReminderDate = (eventDate: string, daysBefore: number): string => {
    if (!eventDate) return '';
    const date = new Date(eventDate);
    date.setDate(date.getDate() - daysBefore);
    return date.toLocaleDateString();
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validation
    if (!reminderData.eventDate) {
      setError('Please select an appointment date');
      return;
    }

    if (!patient.owner.phone || patient.owner.phone === '9999999999') {
      setError('Patient owner must have a valid phone number for reminders');
      return;
    }

    setError('');
    setIsSubmitting(true);

    try {
      // Generate message
      const message = `Reminder for ${patient.name}'s ${reminderData.eventType.replace('_', ' ')}`;

      // Prepare API payload
      const payload = {
        patientId: patient.id,
        consultationId: null,
        prescriptionId: null,
        eventType: reminderData.eventType,
        eventDate: reminderData.eventDate,
        recipientEmail: patient.owner.email || '',
        recipientPhone: patient.owner.phone,
        message,
        emailDaysBefore: reminderData.emailDaysBefore,
        whatsappDaysBefore: reminderData.whatsappDaysBefore,
        voiceCallDaysBefore: reminderData.voiceCallDaysBefore,
        voiceCallLanguage: reminderData.voiceCallLanguage,
        metadata: {
          patientName: patient.name,
          ownerName: patient.owner.name,
          species: patient.species,
          breed: patient.breed || '',
        },
      };

      await reminderService.create(payload);

      alert(`Reminder scheduled successfully for ${patient.name}!\n\nReminders will be sent:\n- Email: ${calculateReminderDate(reminderData.eventDate, reminderData.emailDaysBefore)}\n- WhatsApp: ${calculateReminderDate(reminderData.eventDate, reminderData.whatsappDaysBefore)}\n- Voice Call: ${calculateReminderDate(reminderData.eventDate, reminderData.voiceCallDaysBefore)}`);

      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to schedule reminder. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget && !isSubmitting) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-xl shadow-lg max-w-[550px] w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Bell className="w-5 h-5 text-orange-600" />
              Schedule Appointment Reminder
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Configure automated reminders via Email and WhatsApp Messages
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Error Alert */}
          {error && (
            <div className="alert alert-error bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="eventType">
              Event Type
            </label>
            <select
              id="eventType"
              className="select w-full"
              value={reminderData.eventType}
              onChange={(e) =>
                setReminderData((prev) => ({ ...prev, eventType: e.target.value as EventType }))
              }
              disabled={isSubmitting}
            >
              {EVENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Appointment Date */}
          <div>
            <label className="block text-sm font-medium mb-1" htmlFor="eventDate">
              Appointment Date
            </label>
            <input
              id="eventDate"
              type="date"
              className="input w-full"
              value={reminderData.eventDate}
              min={today}
              onChange={(e) =>
                setReminderData((prev) => ({ ...prev, eventDate: e.target.value }))
              }
              disabled={isSubmitting}
            />
          </div>

          {/* Reminder Timing Options */}
          <div className="space-y-3 p-3 border border-blue-200 rounded-lg bg-blue-50">
            <p className="text-sm font-semibold text-blue-900">Reminder Timing</p>

            {/* Email Timing */}
            <div>
              <label className="text-sm flex items-center gap-2 mb-1" htmlFor="emailDaysBefore">
                <Mail className="w-4 h-4 text-blue-600" />
                Email Reminder (Days Before)
              </label>
              <select
                id="emailDaysBefore"
                className="select w-full text-sm"
                value={reminderData.emailDaysBefore}
                onChange={(e) =>
                  setReminderData((prev) => ({ ...prev, emailDaysBefore: parseInt(e.target.value) }))
                }
                disabled={isSubmitting}
              >
                {EMAIL_DAYS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* WhatsApp Timing */}
            <div>
              <label className="text-sm flex items-center gap-2 mb-1" htmlFor="whatsappDaysBefore">
                <span className="text-green-600">📱</span>
                WhatsApp Reminder (Days Before)
              </label>
              <select
                id="whatsappDaysBefore"
                className="select w-full text-sm"
                value={reminderData.whatsappDaysBefore}
                onChange={(e) =>
                  setReminderData((prev) => ({
                    ...prev,
                    whatsappDaysBefore: parseInt(e.target.value),
                  }))
                }
                disabled={isSubmitting}
              >
                {WHATSAPP_DAYS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Voice Call Timing */}
            {/* <div>
              <label className="text-sm flex items-center gap-2 mb-1" htmlFor="voiceCallDaysBefore">
                <span>📞</span>
                Voice Call Reminder (Days Before)
              </label>
              <select
                id="voiceCallDaysBefore"
                className="select w-full text-sm"
                value={reminderData.voiceCallDaysBefore}
                onChange={(e) =>
                  setReminderData((prev) => ({
                    ...prev,
                    voiceCallDaysBefore: parseInt(e.target.value),
                  }))
                }
                disabled={isSubmitting}
              >
                {VOICE_DAYS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div> */}

            {/* Voice Call Language */}
            {/* <div>
              <label className="text-sm flex items-center gap-2 mb-1" htmlFor="voiceCallLanguage">
                <span>🌐</span>
                Voice Call Language
              </label>
              <select
                id="voiceCallLanguage"
                className="select w-full text-sm"
                value={reminderData.voiceCallLanguage}
                onChange={(e) =>
                  setReminderData((prev) => ({
                    ...prev,
                    voiceCallLanguage: e.target.value as VoiceLanguage,
                  }))
                }
                disabled={isSubmitting}
              >
                {VOICE_LANGUAGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div> */}
          </div>

          {/* Patient & Owner Info */}
          <div className="bg-gray-50 p-3 rounded-lg space-y-1 text-sm">
            <p className="font-medium text-gray-700">Reminder will be sent to:</p>
            <p>
              <strong>Patient:</strong> {patient.name}
            </p>
            <p>
              <strong>Owner:</strong> {patient.owner.name === 'Owner' ? 'Unknown User' : patient.owner.name}
            </p>
            <p>
              <strong>Phone:</strong>{' '}
              {patient.owner.phone === '9999999999' ? 'Not provided' : patient.owner.phone}
            </p>
            {patient.owner.email ? (
              <p className="text-green-700">
                <strong>Email:</strong> {patient.owner.email} ✓
              </p>
            ) : (
              <p className="text-orange-600">
                <strong>Email:</strong> Not available - Email reminders will be skipped!
              </p>
            )}
          </div>

          {/* Schedule Info */}
          {reminderData.eventDate && (
            <div className="bg-blue-50 border border-blue-200 p-3 rounded-lg space-y-1 text-sm">
              <p className="font-medium text-blue-800 mb-2">Reminder Schedule:</p>
              <div className="space-y-1 text-blue-700">
                <p className="flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email: {calculateReminderDate(reminderData.eventDate, reminderData.emailDaysBefore)}{' '}
                  ({reminderData.emailDaysBefore === 0 ? 'same day' : `${reminderData.emailDaysBefore} days before`})
                </p>
                <p className="flex items-center gap-1">
                  <span className="text-green-600">📱</span>
                  WhatsApp: {calculateReminderDate(reminderData.eventDate, reminderData.whatsappDaysBefore)}{' '}
                  ({reminderData.whatsappDaysBefore === 0 ? 'same day' : `${reminderData.whatsappDaysBefore} days before`})
                </p>
                <p className="flex items-center gap-1">
                  <span>📞</span>
                  Voice Call: {calculateReminderDate(reminderData.eventDate, reminderData.voiceCallDaysBefore)}{' '}
                  ({reminderData.voiceCallDaysBefore === 0 ? 'same day' : `${reminderData.voiceCallDaysBefore} days before`})
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-2 justify-end p-6 border-t">
          <button
            type="button"
            className="btn btn-outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary bg-orange-600 hover:bg-orange-700"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{
              backgroundColor: 'rgb(234, 88, 12)',
              opacity: isSubmitting ? 0.7 : 1,
            }}
          >
            {isSubmitting ? 'Scheduling...' : 'Schedule Reminder'}
          </button>
        </div>
      </div>
    </div>
  );
};

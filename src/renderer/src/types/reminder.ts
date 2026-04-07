// Reminder types for VetBuddy Extension

export type EventType =
  | 'vaccination'
  | 'checkup'
  | 'medication_refill'
  | 'follow_up'
  | 'surgery'
  | 'dental'
  | 'grooming';

export type VoiceLanguage =
  | 'en-US'
  | 'en-IN'
  | 'en-GB'
  | 'hi-IN';

export interface ReminderMetadata {
  patientName: string;
  ownerName: string;
  species: string;
  breed?: string;
}

export interface ReminderData {
  patientId: number;
  consultationId?: number | null;
  prescriptionId?: number | null;
  eventType: EventType;
  eventDate: Date | string;
  recipientEmail: string;
  recipientPhone: string;
  message: string;
  emailDaysBefore: number;
  whatsappDaysBefore: number;
  voiceCallDaysBefore: number;
  voiceCallLanguage: VoiceLanguage;
  metadata: ReminderMetadata;
}

export interface CreateReminderData extends ReminderData {}

export interface ReminderFormData {
  eventType: EventType;
  eventDate: string;
  emailDaysBefore: number;
  whatsappDaysBefore: number;
  voiceCallDaysBefore: number;
  voiceCallLanguage: VoiceLanguage;
}

export const EVENT_TYPE_OPTIONS: { value: EventType; label: string }[] = [
  { value: 'vaccination', label: 'Vaccination' },
  { value: 'checkup', label: 'Check-up' },
  { value: 'medication_refill', label: 'Medication Refill' },
  { value: 'follow_up', label: 'Follow-up Visit' },
  { value: 'surgery', label: 'Surgery' },
  { value: 'dental', label: 'Dental Cleaning' },
  { value: 'grooming', label: 'Grooming' },
];

export const EMAIL_DAYS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Same day' },
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
  { value: 14, label: '2 weeks before' },
  { value: 30, label: '1 month before' },
];

export const WHATSAPP_DAYS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Same day' },
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
  { value: 14, label: '2 weeks before' },
];

export const VOICE_DAYS_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Same day' },
  { value: 1, label: '1 day before' },
  { value: 3, label: '3 days before' },
  { value: 7, label: '1 week before' },
];

export const VOICE_LANGUAGE_OPTIONS: { value: VoiceLanguage; label: string }[] = [
  { value: 'en-US', label: 'English (US)' },
  { value: 'en-IN', label: 'English (India)' },
  { value: 'en-GB', label: 'English (UK)' },
  { value: 'hi-IN', label: 'Hindi' },
];

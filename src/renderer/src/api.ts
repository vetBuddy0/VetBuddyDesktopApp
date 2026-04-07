import axios from "axios";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  clientSummary: string;
}

export interface PatientInfo {
  patientName?: string;
  species?: string;
  breed?: string;
  age?: string;
  ownerName?: string;
}

export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", blob, "recording.webm");

  const res = await axios.post(`${API_BASE}/api/overlay/transcribe`, form, {
    headers: { "Content-Type": "multipart/form-data" },
    timeout: 120000,
  });

  return res.data.transcript as string;
}

export async function generateSOAP(
  transcript: string,
  patient: PatientInfo = {}
): Promise<SOAPNote> {
  const res = await axios.post(
    `${API_BASE}/api/overlay/soap`,
    { transcript, ...patient },
    { timeout: 60000 }
  );
  return res.data as SOAPNote;
}

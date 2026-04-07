/**
 * UI State Storage for VetBuddy Desktop Overlay
 * Uses localStorage (same async interface as extension's chrome.storage version)
 */

export interface UIState {
  currentView: string;
  activeConsultationId: number | null;
  selectedPatientId: number | null;
  selectedPatientName: string;
}

const UI_STATE_KEY = 'vetbuddy_ui_state';

const defaultUIState: UIState = {
  currentView: 'patients',
  activeConsultationId: null,
  selectedPatientId: null,
  selectedPatientName: '',
};

export async function getUIState(): Promise<UIState> {
  try {
    const raw = localStorage.getItem(UI_STATE_KEY);
    if (raw) {
      return { ...defaultUIState, ...JSON.parse(raw) };
    }
    return defaultUIState;
  } catch {
    return defaultUIState;
  }
}

export async function setUIState(state: Partial<UIState>): Promise<void> {
  try {
    const current = await getUIState();
    localStorage.setItem(UI_STATE_KEY, JSON.stringify({ ...current, ...state }));
  } catch (error) {
    console.error('Error saving UI state:', error);
  }
}

export async function clearUIState(): Promise<void> {
  localStorage.removeItem(UI_STATE_KEY);
}

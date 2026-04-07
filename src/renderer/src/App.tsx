import { useState, useEffect, useCallback } from "react";
import { AuthPanel } from "./components/AuthPanel";
import { RecordingWidget } from "./components/RecordingWidget";
import { PatientList } from "./components/PatientList";
import { ActiveConsultations } from "./components/ActiveConsultations";
import { SOAPNoteList } from "./components/SOAPNoteList";
import { SOAPNoteGenerator } from "./components/SOAPNoteGenerator";
import { TemplateManager } from "./components/TemplateManager";
import { EzyVetSettings } from "./components/EzyVetSettings";
import { logout } from "./authService";
import { getUIState, setUIState, clearUIState } from "./stateStorage";
import { Stethoscope, Users2, Clock10, FileText, FileEdit, Settings } from "lucide-react";
import type { EzyVetPrefillData } from "./types/patient";

type View =
  | "home"
  | "patients"
  | "consultations"
  | "soapnotes"
  | "recording"
  | "notes"
  | "templates"
  | "ezyvet-settings";

export default function App() {
  // Window controls
  const [pinned, setPinned] = useState(true);
  const [opacity, setOpacity] = useState(1);

  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // UI state
  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [currentView, setCurrentView] = useState<View>("patients");
  const [activeConsultationId, setActiveConsultationId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  const [ezyvetPrefill] = useState<EzyVetPrefillData | null>(null);

  // ── Window controls ─────────────────────────────────────────────────────────
  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    (window as any).electron?.togglePin(next);
  };

  useEffect(() => {
    (window as any).electron?.setOpacity(opacity);
  }, [opacity]);

  // ── Auth check ──────────────────────────────────────────────────────────────
  const checkAuthState = useCallback(() => {
    const token = localStorage.getItem("vetbuddy_token");
    const user = localStorage.getItem("vetbuddy_user");
    setIsLoggedIn(!!(token && user));
    setIsCheckingAuth(false);
  }, []);

  useEffect(() => {
    checkAuthState();
  }, [checkAuthState]);

  // ── UI state persistence ────────────────────────────────────────────────────
  useEffect(() => {
    const loadPersistedState = async () => {
      try {
        const savedState = await getUIState();
        setCurrentView(savedState.currentView as View);
        setActiveConsultationId(savedState.activeConsultationId);
        setSelectedPatientId(savedState.selectedPatientId);
        setSelectedPatientName(savedState.selectedPatientName);
      } catch (error) {
        console.error("Error loading persisted state:", error);
      } finally {
        setIsStateLoaded(true);
      }
    };
    loadPersistedState();
  }, []);

  useEffect(() => {
    if (!isStateLoaded) return;
    setUIState({ currentView, activeConsultationId, selectedPatientId, selectedPatientName });
  }, [currentView, activeConsultationId, selectedPatientId, selectedPatientName, isStateLoaded]);

  const handleLogout = async () => {
    try {
      await logout();
      await clearUIState();
      setIsLoggedIn(false);
      setCurrentView("patients");
      setActiveConsultationId(null);
      setSelectedPatientId(null);
      setSelectedPatientName("");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const isMainView = ["patients", "consultations", "notes", "templates"].includes(currentView);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isCheckingAuth) {
    return (
      <div id="root">
        <div className="titlebar">
          <div className="titlebar-left">
            <Stethoscope size={16} style={{ color: "var(--color-primary)" }} />
            <span>VetBuddy</span>
          </div>
          <div className="titlebar-controls">
            <button className="ctrl-btn close" onClick={() => (window as any).electron?.close()}>✕</button>
          </div>
        </div>
        <div className="content flex flex-col items-center justify-center gap-3">
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }}></div>
          <p className="text-muted text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // ── Auth screen ─────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div id="root">
        {/* Title bar */}
        <div className="titlebar">
          <div className="titlebar-left">
            <Stethoscope size={16} style={{ color: "var(--color-primary)" }} />
            <span>VetBuddy</span>
          </div>
          <div className="titlebar-controls">
            <div className="opacity-row">
              <label>Opacity</label>
              <input
                type="range" min="0.3" max="1" step="0.05"
                value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))}
              />
            </div>
            <button className={`ctrl-btn ${pinned ? "active" : ""}`} title="Pin on top" onClick={togglePin}>📌</button>
            <button className="ctrl-btn" title="Minimize" onClick={() => (window as any).electron?.minimize()}>−</button>
            <button className="ctrl-btn close" title="Close" onClick={() => (window as any).electron?.close()}>✕</button>
          </div>
        </div>

        {/* Auth content */}
        <div className="content" style={{ background: "var(--color-background)", overflow: "auto", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <AuthPanel
            onLoginSuccess={() => {
              setIsLoggedIn(true);
              setCurrentView("patients");
            }}
          />
        </div>
      </div>
    );
  }

  // ── Main app ────────────────────────────────────────────────────────────────
  return (
    <div id="root">
      {/* ── Title Bar ── */}
      <div className="titlebar">
        <div className="titlebar-left">
          <div
            style={{
              width: 24, height: 24, borderRadius: 6,
              background: "linear-gradient(135deg, var(--color-primary), var(--color-primary-dark))",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Stethoscope size={13} style={{ color: "white" }} />
          </div>
          <span>VetBuddy</span>
        </div>

        <div className="titlebar-controls">
          <div className="opacity-row">
            <input
              type="range" min="0.3" max="1" step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
              title="Opacity"
            />
          </div>
          <button
            onClick={() => setCurrentView("ezyvet-settings")}
            className="ctrl-btn"
            title="ezyVet Settings"
          >
            <Settings size={13} />
          </button>
          <button onClick={handleLogout} className="ctrl-btn" title="Logout" style={{ fontSize: 11, fontWeight: 600 }}>
            Out
          </button>
          <button className={`ctrl-btn ${pinned ? "active" : ""}`} title="Pin on top" onClick={togglePin}>📌</button>
          <button className="ctrl-btn" title="Minimize" onClick={() => (window as any).electron?.minimize()}>−</button>
          <button className="ctrl-btn close" title="Close" onClick={() => (window as any).electron?.close()}>✕</button>
        </div>
      </div>

      {/* ── Navigation Tabs ── */}
      {isMainView && (
        <div className="navbar">
          <div className="tabs">
            <button
              onClick={() => setCurrentView("consultations")}
              className={`tab ${currentView === "consultations" ? "tab-active" : ""}`}
            >
              <Clock10 size={13} />
              Active
            </button>
            <button
              onClick={() => { setCurrentView("patients"); setSelectedPatientId(null); }}
              className={`tab ${currentView === "patients" ? "tab-active" : ""}`}
            >
              <Users2 size={13} />
              Patients
            </button>
            <button
              onClick={() => setCurrentView("notes")}
              className={`tab ${currentView === "notes" ? "tab-active" : ""}`}
            >
              <FileText size={13} />
              Notes
            </button>
            <button
              onClick={() => setCurrentView("templates")}
              className={`tab ${currentView === "templates" ? "tab-active" : ""}`}
            >
              <FileEdit size={13} />
              Templates
            </button>
          </div>
        </div>
      )}

      {/* ── Content Area ── */}
      <div className="content">
        {/* Patients */}
        {currentView === "patients" && (
          <PatientList
            prefillData={ezyvetPrefill}
            onPatientAdded={(patientId, patientName) => {
              setSelectedPatientId(patientId);
              setSelectedPatientName(patientName);
            }}
            onConsultationStart={(consultationId) => {
              setActiveConsultationId(consultationId);
              setCurrentView("home");
            }}
            onViewActiveConsultations={() => setCurrentView("consultations")}
            onViewSOAPNotes={(patientId, patientName) => {
              setSelectedPatientId(patientId);
              setSelectedPatientName(patientName);
              setCurrentView("soapnotes");
            }}
          />
        )}

        {/* Active Consultations */}
        {currentView === "consultations" && (
          <ActiveConsultations
            onResumeConsultation={(consultationId) => {
              setActiveConsultationId(consultationId);
              setCurrentView("home");
            }}
            onGenerateSOAP={(consultationId) => {
              setActiveConsultationId(consultationId);
              setCurrentView("notes");
            }}
          />
        )}

        {/* Recording */}
        {(currentView === "home" || currentView === "recording") && (
          <RecordingWidget
            consultationId={activeConsultationId}
            onConsultationCreated={(id: number) => setActiveConsultationId(id)}
            onRecordingComplete={(blob: Blob) => {
              console.log("Recording completed:", blob.size, "bytes");
            }}
            onBack={() => setCurrentView("patients")}
            onGenerateSOAP={(consultationId) => {
              setActiveConsultationId(consultationId);
              setCurrentView("notes");
            }}
          />
        )}

        {/* SOAP Notes (past, per patient) */}
        {currentView === "soapnotes" && (
          <SOAPNoteList
            selectedPatientId={selectedPatientId !== null ? selectedPatientId : undefined}
            selectedPatientName={selectedPatientName}
            onBack={() => {
              setCurrentView("patients");
              setSelectedPatientId(null);
              setSelectedPatientName("");
            }}
          />
        )}

        {/* SOAP Note Generator */}
        {currentView === "notes" && (
          <SOAPNoteGenerator
            initialConsultationId={activeConsultationId}
            autoGenerate={activeConsultationId !== null}
          />
        )}

        {/* Templates */}
        {currentView === "templates" && <TemplateManager />}

        {/* ezyVet Settings */}
        {currentView === "ezyvet-settings" && (
          <EzyVetSettings onBack={() => setCurrentView("patients")} />
        )}
      </div>
    </div>
  );
}

import { useState, useEffect, useCallback } from "react";
import { AuthPanel } from "./components/AuthPanel";
import { RecordingWidget } from "./components/RecordingWidget";
import { PatientList } from "./components/PatientList";
import { ActiveConsultations } from "./components/ActiveConsultations";
import { SOAPNoteList } from "./components/SOAPNoteList";
import { SOAPNoteGenerator } from "./components/SOAPNoteGenerator";
import { TemplateManager } from "./components/TemplateManager";
import { EzyVetSettings } from "./components/EzyVetSettings";
import { PasteLab } from "./components/PasteLab";
import { UpdateBanner } from "./components/UpdateBanner";
import { logout } from "./authService";
import { getUIState, setUIState, clearUIState } from "./stateStorage";
import { Stethoscope, Users2, Clock10, FileText, FileEdit, Settings, Zap, LogOut, Pin, Minus, X } from "lucide-react";
import type { EzyVetPrefillData } from "./types/patient";

type View =
  | "home"
  | "patients"
  | "consultations"
  | "soapnotes"
  | "recording"
  | "notes"
  | "templates"
  | "paste-lab"
  | "ezyvet-settings";

export default function App() {
  const [pinned, setPinned] = useState(true);
  const [opacity, setOpacity] = useState(1);

  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  const [isStateLoaded, setIsStateLoaded] = useState(false);
  const [currentView, setCurrentView] = useState<View>("patients");
  const [activeConsultationId, setActiveConsultationId] = useState<number | null>(null);
  const [selectedPatientId, setSelectedPatientId] = useState<number | null>(null);
  const [selectedPatientName, setSelectedPatientName] = useState<string>("");
  const [ezyvetPrefill] = useState<EzyVetPrefillData | null>(null);

  const togglePin = () => {
    const next = !pinned;
    setPinned(next);
    (window as any).electron?.togglePin(next);
  };

  useEffect(() => {
    (window as any).electron?.setOpacity(opacity);
  }, [opacity]);

  useEffect(() => {
    const el = window as any;
    const cleanup = el.electron?.onNavigate?.((view: string) => {
      if (isLoggedIn) setCurrentView(view as View);
    });
    return () => cleanup?.();
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;
    const handler = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (!mod) return;
      const map: Record<string, View> = {
        "1": "consultations",
        "2": "patients",
        "3": "notes",
        "4": "templates",
        // "5": "paste-lab",
      };
      if (map[e.key]) {
        e.preventDefault();
        setCurrentView(map[e.key]);
      }
      if (e.key === "w") { e.preventDefault(); (window as any).electron?.close(); }
      if (e.key === "m") { e.preventDefault(); (window as any).electron?.minimize(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isLoggedIn]);

  const checkAuthState = useCallback(() => {
    const token = localStorage.getItem("vetbuddy_token");
    const user = localStorage.getItem("vetbuddy_user");
    setIsLoggedIn(!!(token && user));
    setIsCheckingAuth(false);
  }, []);

  useEffect(() => { checkAuthState(); }, [checkAuthState]);

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

  const isMainView = ["patients", "consultations", "notes", "templates", "paste-lab"].includes(currentView);

  const TitleBar = ({ minimal = false }: { minimal?: boolean }) => (
    <div className="titlebar">
      <div className="titlebar-left">
        <div className="titlebar-logo">
          <Stethoscope size={14} style={{ color: "white" }} />
        </div>
        <span className="titlebar-wordmark">My VetBuddy</span>
      </div>

      <div className="titlebar-controls">
        <div className="opacity-row">
          <input
            type="range" min="0.3" max="1" step="0.05"
            value={opacity}
            onChange={(e) => setOpacity(Number(e.target.value))}
            title="Window opacity"
          />
        </div>

        {!minimal && (
          <button
            onClick={() => setCurrentView("ezyvet-settings")}
            className="ctrl-btn"
            title="ezyVet Settings"
          >
            <Settings size={13} />
          </button>
        )}

        {!minimal && (
          <button
            onClick={handleLogout}
            className="ctrl-btn"
            title="Logout"
          >
            <LogOut size={12} />
          </button>
        )}

        <button
          className={`ctrl-btn ${pinned ? "active" : ""}`}
          title={pinned ? "Unpin window" : "Pin on top"}
          onClick={togglePin}
        >
          <Pin size={12} />
        </button>
        <button className="ctrl-btn" title="Minimize" onClick={() => (window as any).electron?.minimize()}>
          <Minus size={13} />
        </button>
        <button className="ctrl-btn close" title="Close" onClick={() => (window as any).electron?.close()}>
          <X size={13} />
        </button>
      </div>
    </div>
  );

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isCheckingAuth) {
    return (
      <div id="root">
        <TitleBar minimal />
        <div className="content" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, background: "var(--color-background)" }}>
          <div className="spinner" style={{ width: 28, height: 28, borderWidth: 3 }} />
          <p style={{ fontSize: 12, color: "var(--color-muted-foreground)", fontWeight: 500 }}>Loading My VetBuddy...</p>
        </div>
      </div>
    );
  }

  // ── Auth screen ─────────────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div id="root">
        <TitleBar minimal />
        <div className="content" style={{ background: "var(--color-background)", overflow: "auto", display: "flex", flexDirection: "column", justifyContent: "center" }}>
          <AuthPanel onLoginSuccess={() => { setIsLoggedIn(true); setCurrentView("patients"); }} />
        </div>
      </div>
    );
  }

  // ── Main app ────────────────────────────────────────────────────────────────
  return (
    <div id="root">
      <TitleBar />
      <UpdateBanner />

      {/* ── Navigation Tabs ── */}
      {isMainView && (
        <div className="navbar">
          <div className="tabs">
            {[
              { view: "consultations" as View, icon: <Clock10 size={13} />, label: "Active" },
              { view: "patients" as View, icon: <Users2 size={13} />, label: "Patients" },
              { view: "notes" as View, icon: <FileText size={13} />, label: "Notes" },
              { view: "templates" as View, icon: <FileEdit size={13} />, label: "Templates" },
              // { view: "paste-lab" as View, icon: <Zap size={13} />, label: "Paste Lab" },
            ].map(({ view, icon, label }) => (
              <button
                key={view}
                onClick={() => {
                  if (view === "patients") setSelectedPatientId(null);
                  setCurrentView(view);
                }}
                className={`tab ${currentView === view ? "tab-active" : ""}`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Content Area ── */}
      <div className="content">
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

        {currentView === "notes" && (
          <SOAPNoteGenerator
            initialConsultationId={activeConsultationId}
          />
        )}

        {currentView === "templates" && <TemplateManager />}
        {currentView === "paste-lab" && <PasteLab />}

        {currentView === "ezyvet-settings" && (
          <EzyVetSettings onBack={() => setCurrentView("patients")} />
        )}
      </div>
    </div>
  );
}

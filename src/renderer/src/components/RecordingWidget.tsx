import { useState, useRef, useEffect, useCallback } from "react";
import { LiveAudioVisualizer } from "react-audio-visualize";
import { Eye, EyeOff } from "lucide-react";
import { consultationService } from "../services/consultationService";
import { getAuthHeaders } from "../authUtils";
import { ChatInterface } from "./ChatInterface";
import "../styles/RecordingWidget.css";

interface Recording {
  id: number;
  fileName: string;
  duration: number;
  transcription?: string;
  isTranscribed: boolean;
  transcriptionFailed?: boolean;
  createdAt: string;
}

interface PatientInfo {
  id: number;
  name: string;
  species: string;
  breed?: string;
  owner: {
    id: number;
    name: string;
    phone: string;
  };
}

interface ConsultationDetails {
  id: number;
  consultationType: string;
  species?: string;
  patient?: PatientInfo | null;
  startedAt?: string;
}

interface RecordingWidgetProps {
  consultationId?: number | null;
  onConsultationCreated?: (consultationId: number) => void;
  onRecordingComplete?: (blob: Blob) => void;
  onBack?: () => void;
  onGenerateSOAP?: (consultationId: number) => void;
}

export function RecordingWidget({
  consultationId: initialConsultationId,
  onConsultationCreated,
  onRecordingComplete,
  onBack,
  onGenerateSOAP,
}: RecordingWidgetProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(
    null,
  );
  const [isUploading, setIsUploading] = useState(false);
  const [consultationId, setConsultationId] = useState<number | null>(
    initialConsultationId || null,
  );
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [transcriptionText, setTranscriptionText] = useState("");
  const [transcriptionLanguage, setTranscriptionLanguage] =
    useState<string>("auto");
  const [consultationDetails, setConsultationDetails] =
    useState<ConsultationDetails | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [transcriptionModel] = useState<string>("gpt-4o-mini-transcribe");
  const [manualNotes, setManualNotes] = useState("");
  const [showVisualizer, setShowVisualizer] = useState<boolean>(() => {
    const saved = localStorage.getItem("vetbuddy_show_visualizer");
    return saved !== null ? JSON.parse(saved) : false;
  });
  const manualNoteIdRef = useRef<number | null>(null);
  const manualNoteDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const API_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8001";

  const formatDuration = (seconds: number | undefined | null) => {
    if (seconds == null || isNaN(seconds) || seconds < 0) {
      return "0:00";
    }
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Load consultation details and recordings when consultation changes
  useEffect(() => {
    if (consultationId) {
      loadConsultationDetails();
      loadRecordings();
      loadManualNotes(consultationId);
      // Start polling for transcription updates
      startPolling();
    }
    return () => {
      stopPolling();
    };
  }, [consultationId]);

  // Update transcription text when recordings change
  useEffect(() => {
    const len = recordings.length;
    const combinedTranscription = recordings
      .filter((r) => r.transcription)
      .map((r, index) => {
        const timestamp = `${r.createdAt.split("T")[0]} ${r.createdAt.split("T")[1].split(".")[0]}`;
        return `[Recording ${len - index} - ${timestamp}]\n${r.transcription}`;
      })
      .join("\n\n");
    setTranscriptionText(combinedTranscription);
  }, [recordings]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      stopPolling();
    };
  }, []);

  const startPolling = () => {
    stopPolling(); // Clear any existing interval
    pollIntervalRef.current = setInterval(() => {
      loadRecordings();
    }, 5000); // Poll every 5 seconds
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const loadManualNotes = async (id: number) => {
    manualNoteIdRef.current = null;
    setManualNotes("");
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/api/consultations/${id}/manual-notes`,
        {
          headers: { ...headers },
          credentials: "include",
        },
      );
      if (response.ok) {
        const notes: { id: number; content: string }[] = await response.json();
        if (notes && notes.length > 0) {
          const latest = notes[notes.length - 1];
          manualNoteIdRef.current = latest.id;
          setManualNotes(latest.content);
        }
      }
    } catch {
      // Silently ignore — don't block UI
    }
  };

  const handleManualNotesChange = useCallback(
    (value: string) => {
      setManualNotes(value);

      if (!consultationId) return;

      if (manualNoteDebounceRef.current) {
        clearTimeout(manualNoteDebounceRef.current);
      }

      manualNoteDebounceRef.current = setTimeout(async () => {
        try {
          const headers = await getAuthHeaders();
          if (manualNoteIdRef.current) {
            await fetch(
              `${API_URL}/api/manual-notes/${manualNoteIdRef.current}`,
              {
                method: "PUT",
                headers: { ...headers, "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ content: value || " " }),
              },
            );
          } else {
            const response = await fetch(
              `${API_URL}/api/consultations/${consultationId}/manual-note`,
              {
                method: "POST",
                headers: { ...headers, "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ content: value || " " }),
              },
            );
            if (response.ok) {
              const created: { id: number } = await response.json();
              manualNoteIdRef.current = created.id;
            }
          }
        } catch {
          // Silently fail
        }
      }, 1000);
    },
    [consultationId],
  );

  const loadConsultationDetails = async () => {
    if (!consultationId) return;

    try {
      setLoadingDetails(true);
      setDetailsError(null);
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/api/consultations/${consultationId}`,
        {
          headers: {
            ...headers,
          },
          credentials: "include",
        },
      );

      if (response.ok) {
        const data = await response.json();
        setConsultationDetails({
          id: data.id,
          consultationType: data.consultationType,
          species: data.species,
          patient: data.patient,
          startedAt: data.startedAt,
        });
      } else {
        throw new Error("Failed to load consultation details");
      }
    } catch (error) {
      console.error("Error loading consultation details:", error);
      setDetailsError("Failed to load details");
    } finally {
      setLoadingDetails(false);
    }
  };

  const loadRecordings = async () => {
    if (!consultationId) return;

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(
        `${API_URL}/api/consultations/${consultationId}`,
        {
          headers: {
            ...headers,
          },
          credentials: "include",
        },
      );

      if (response.ok) {
        const data = await response.json();
        // The API returns the consultation object with recordings array
        setRecordings(data.recordings || []);
      }
    } catch (error) {
      console.error("Error loading recordings:", error);
    }
  };

  const createQuickStartConsultation = async (): Promise<number> => {
    try {
      const consultation = await consultationService.create({
        consultationType: "quick_start",
        species: "Unknown",
        status: "active",
        startedAt: new Date().toISOString(),
      });

      setConsultationId(consultation.id);
      if (onConsultationCreated) {
        onConsultationCreated(consultation.id);
      }
      return consultation.id;
    } catch (error) {
      console.error("Error creating consultation:", error);
      throw error;
    }
  };

  const startRecording = async () => {
    try {
      // Create consultation if not exists
      let activeConsultationId = consultationId;
      if (!activeConsultationId) {
        activeConsultationId = await createQuickStartConsultation();
      }

      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Media recording not supported in this browser");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });

      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : undefined,
      });

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm;codecs=opus",
        });

        // Capture final duration from state before it gets reset
        const finalDuration = recordingTime;

        if (audioBlob.size > 0 && activeConsultationId) {
          await uploadRecording(audioBlob, activeConsultationId, finalDuration);

          if (onRecordingComplete) {
            onRecordingComplete(audioBlob);
          }
        }

        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      let errorMessage =
        "Could not access microphone. Please check permissions.";

      if (error instanceof Error) {
        if (error.name === "NotAllowedError") {
          errorMessage =
            'Microphone access denied.\n\nTo enable:\n1. Click the puzzle icon (Extensions) in Chrome toolbar\n2. Right-click VetBuddy → "This can read and change site data"\n3. Select "On all sites" or reload the extension\n\nOR\n\n1. Go to chrome://extensions\n2. Find VetBuddy and click "Details"\n3. Reload the extension\n4. Try recording again and click "Allow" when prompted';
        } else if (error.name === "NotFoundError") {
          errorMessage =
            "No microphone found. Please connect a microphone and try again.";
        } else if (error.name === "NotReadableError") {
          errorMessage =
            "Microphone is already in use by another application. Please close other apps using the microphone.";
        }
      }

      alert(errorMessage);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      setMediaRecorder(null);

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const uploadRecording = async (
    audioBlob: Blob,
    activeConsultationId: number,
    duration: number = 0,
  ) => {
    setIsUploading(true);

    try {
      const formData = new FormData();
      const fileName = `recording_${Date.now()}.webm`;
      formData.append("audio", audioBlob, fileName);
      // Enable automatic transcription
      formData.append("doTranscribe", "true");
      // Set transcription model
      formData.append("model", transcriptionModel);
      // Append transcription language
      formData.append("language", transcriptionLanguage);
      // Append duration
      formData.append("duration", duration.toString());

      console.log("Uploading audio:", {
        consultationId: activeConsultationId,
        blobSize: audioBlob.size,
        blobType: audioBlob.type,
        doTranscribe: true,
        model: transcriptionModel,
      });

      const headers = await getAuthHeaders();

      const response = await fetch(
        `${API_URL}/api/consultations/${activeConsultationId}/recordings`,
        {
          method: "POST",
          headers: {
            ...headers,
          },
          body: formData,
          credentials: "include",
        },
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Upload failed");
      }

      console.log(
        "Recording uploaded successfully, transcription will start automatically",
      );

      // Reload recordings to show the new one
      await loadRecordings();
    } catch (error) {
      console.error("Error uploading recording:", error);
      alert("Failed to upload recording. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const deleteRecording = async (recordingId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this recording? This action cannot be undone.",
      )
    ) {
      return;
    }

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_URL}/api/recordings/${recordingId}`, {
        method: "DELETE",
        headers: {
          ...headers,
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to delete recording");
      }

      // Reload recordings to update the list
      await loadRecordings();
    } catch (error) {
      console.error("Error deleting recording:", error);
      alert("Failed to delete recording. Please try again.");
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="recording-widget">
      {/* Back Button */}
      {onBack && (
        <button
          onClick={onBack}
          className="btn btn-ghost mb-1 gap-2"
          style={{ alignSelf: "flex-start" }}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          Back
        </button>
      )}

      {showVisualizer && <div className="recording-header">
        <h3>Consultation Recorder</h3>
        <span className="recording-time">{formatTime(recordingTime)}</span>
      </div>}

      {/* Consultation Status */}
      {consultationId && (
        <div className="consultation-status mb-4" data-testid="PatientSummary">
          {loadingDetails ? (
            <div className="flex items-center gap-2">
              <div className="spinner w-4 h-4"></div>
              <span className="text-sm text-gray-600">Loading details...</span>
            </div>
          ) : detailsError ? (
            <div className="flex items-center gap-2">
              <span className="badge badge-error">
                Consultation #{consultationId}
              </span>
              <button
                onClick={loadConsultationDetails}
                className="text-xs text-blue-600 hover:underline"
                title="Retry loading details"
              >
                Retry
              </button>
            </div>
          ) : consultationDetails?.patient ? (
            <div className="flex flex-col gap-1">
              <span
                className="badge badge-primary"
                title={`Consultation #${consultationId} • Started: ${consultationDetails.startedAt ? new Date(consultationDetails.startedAt).toLocaleString() : "Unknown"}`}
              >
                {consultationDetails.patient.name} —{" "}
                {consultationDetails.patient.species}
              </span>
              {consultationDetails.patient.breed && (
                <span className="text-xs text-gray-600">
                  {consultationDetails.patient.breed}
                </span>
              )}
              <span className="text-xs text-gray-500">
                Owner: {consultationDetails.patient.owner.name}
              </span>
            </div>
          ) : consultationDetails?.consultationType === "quick_start" ? (
            <div className="flex flex-col gap-1">
              <span
                className="badge badge-primary"
                title={`Consultation #${consultationId} • Quick Start`}
              >
                Quick Start — {consultationDetails.species || "Unknown"}
              </span>
              <span className="text-xs text-warning">
                Patient not linked yet
              </span>
            </div>
          ) : (
            <span className="badge badge-primary">
              Active Consultation #{consultationId}
            </span>
          )}
        </div>
      )}

      {/* Visual Indicator */}
      {showVisualizer && <div className="visualizer-container">
        {isRecording && mediaRecorder ? (
          <div className="audio-visualizer active">
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                width: "100%",
                maxWidth: "100%",
                overflow: "hidden",
              }}
            >
              <LiveAudioVisualizer
                mediaRecorder={mediaRecorder}
                width={400}
                height={80}
                barWidth={2}
                gap={1}
                barColor={"#f76565"}
                backgroundColor={"transparent"}
                fftSize={512}
              />
            </div>
            <div className="visualizer-controls-row">
              <p className="recording-status">
                <span className="recording-dot"></span>
                Recording in progress...
              </p>
            </div>
          </div>
        ) : (
          <div className="audio-visualizer">
            <div className="placeholder-text">
              {consultationId
                ? "Click the microphone button to record"
                : "Click to start a new consultation and record"}
            </div>
          </div>
        )}
      </div>}

      {/* Recording Controls */}
      <div className="recording-controls grid grid-cols-2">
        <button
          className={`record-button ${isRecording ? "recording" : ""}`}
          onClick={isRecording ? stopRecording : startRecording}
          title={isRecording ? "Stop Recording" : "Start Recording"}
        >
          {isRecording ? (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="6" y="6" width="12" height="12" />
            </svg>
          ) : (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="23" />
              <line x1="8" y1="23" x2="16" y2="23" />
            </svg>
          )}
        </button>
        <button
          className="toggle-visualizer-btn"
          onClick={() => {
            const newValue = !showVisualizer;
            setShowVisualizer(newValue);
            localStorage.setItem(
              "vetbuddy_show_visualizer",
              JSON.stringify(newValue)
            );
          }}
          title={showVisualizer ? "Hide waves" : "Show waves"}
        >
          {showVisualizer ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>

      {/* Info */}
      {/* <div className="recording-info mb-4">
        <p className="info-text">
          {isRecording
            ? "Recording will be transcribed automatically"
            : isUploading
              ? "Uploading and transcribing..."
              : "Auto-transcription enabled"}
        </p>
      </div> */}

      {/* Language Selector */}
      {!isRecording && (
        <div className="language-selector mb-2 flex flex-col items-center">
          <label
            htmlFor="transcriptionLanguage"
            className="text-sm text-gray-600 mb-1"
          >
            Transcription Language
          </label>
          <select
            id="transcriptionLanguage"
            value={transcriptionLanguage}
            onChange={(e) => setTranscriptionLanguage(e.target.value)}
            className="select select-bordered select-sm w-full max-w-xs"
          >
            <option value="auto">Auto Detect</option>
            <option value="en">English (Medical)</option>
            <option value="hi">Hindi</option>
            <option value="fr">French</option>
            <option value="es">Spanish</option>
            <option value="de">German</option>
            <option value="pt">Portuguese</option>
          </select>
        </div>
      )}

      {/* Recordings List */}
      {recordings.length > 0 && (
        <div className="recordings-section mt-6">
          <h4 className="font-medium mb-3">Recordings ({recordings.length})</h4>
          <div className="recordings-list">
            {recordings.map((recording, index) => (
              <div key={recording.id} className="recording-item">
                <div className="recording-info-row">
                  <div className="recording-name-group">
                    <span className="recording-name">
                      Recording {recordings.length - index}
                    </span>
                    <span className="recording-duration">
                      {recording.duration
                        ? formatDuration(recording.duration)
                        : "00:00"}
                    </span>
                  </div>
                  <div className="recording-actions-group">
                    {recording.isTranscribed ? (
                      <span className="badge badge-success">Transcribed</span>
                    ) : recording.transcriptionFailed ? (
                      <span className="badge badge-error">Failed</span>
                    ) : (
                      <span className="badge badge-secondary">
                        Processing...
                      </span>
                    )}
                    <button
                      className="delete-recording-btn"
                      onClick={() => deleteRecording(recording.id)}
                      title="Delete recording"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M3 6h18" />
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Transcription Display */}
      {transcriptionText && (
        <div className="transcription-section mt-6">
          <h4 className="font-medium mb-3">Transcription</h4>
          <div className="transcription-box">
            {transcriptionText || "Transcription in progress..."}
          </div>
        </div>
      )}

      {/* Manual Notes */}
      {consultationId && (
        <div className="manual-notes-section mt-6">
          <h4 className="font-medium mb-2">Manual Notes</h4>
          <textarea
            className="manual-notes-textarea"
            value={manualNotes}
            onChange={(e) => handleManualNotesChange(e.target.value)}
            placeholder="Type your consultation notes here..."
            rows={4}
            style={{
              width: "100%",
              padding: "8px",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              fontSize: "13px",
              resize: "vertical",
              fontFamily: "inherit",
            }}
          />
          <p style={{ fontSize: "11px", color: "#6b7280", marginTop: "4px" }}>
            Notes auto-save and sync across browsers.
          </p>
        </div>
      )}

      {/* Generate SOAP Note Button */}
      {consultationId && onGenerateSOAP && recordings.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => onGenerateSOAP(consultationId)}
            className="btn btn-primary w-full gap-2"
            disabled={isRecording || isUploading}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
            Generate SOAP Note
          </button>
        </div>
      )}
      {/* Chat Interface */}
      {consultationId && (
        <ChatInterface
          consultationId={consultationId}
          patientId={consultationDetails?.patient?.id}
          contextData={{
            patient: consultationDetails?.patient,
            transcription: transcriptionText,
            manualNotes: manualNotes,
          }}
        />
      )}
    </div>
  );
}

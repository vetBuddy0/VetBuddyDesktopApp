import { useState } from 'react';
import { Camera, Zap, CheckCircle, XCircle, Loader2, RotateCcw, ClipboardCopy } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8001';

const DEFAULT_SECTIONS = [
  {
    name: 'Subjective',
    content: "Owner reports Buddy has been lethargic for 3 days, not eating well, mild coughing.",
  },
  {
    name: 'Objective',
    content: "T: 39.2°C, HR: 110 bpm, RR: 28 bpm. Mild crackles auscultated bilaterally. CRT < 2s.",
  },
  {
    name: 'Assessment',
    content: "Suspected bacterial bronchopneumonia. Rule out kennel cough (Bordetella).",
  },
  {
    name: 'Plan',
    content: "Amoxicillin-clavulanate 20mg/kg BID x 7 days. Recheck in 1 week or sooner if worsening.",
  },
  {
    name: 'Client Summary',
    content: "Buddy has a chest infection. We've prescribed antibiotics. Rest, monitor breathing. Call if gets worse.",
  },
];

type Target = {
  sectionName: string;
  fieldLabel: string;
  x: number;
  y: number;
  confidence: number;
  enabled: boolean;
};

type LogEntry = {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error';
};

export function PasteLab() {
  const [sections, setSections] = useState(DEFAULT_SECTIONS.map(s => ({ ...s })));
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [targets, setTargets] = useState<Target[]>([]);
  const [analysing, setAnalysing] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [log, setLog] = useState<LogEntry[]>([]);
  const [step, setStep] = useState<'idle' | 'captured' | 'analysed'>('idle');

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLog(prev => [...prev, { id: Date.now() + Math.random(), message, type }]);
  };

  const handleCapture = async () => {
    setAnalysing(true);
    setScreenshot(null);
    setTargets([]);
    setLog([]);
    setStep('idle');

    try {
      addLog('Capturing screen…');
      const base64 = await (window as any).electron?.captureScreen();
      if (!base64) {
        addLog('Screen capture failed — check Screen Recording permission in System Preferences > Privacy.', 'error');
        return;
      }
      setScreenshot(base64);
      addLog('Screen captured ✓', 'success');

      addLog('Sending to AI for field detection…');
      const response = await fetch(`${API_URL}/api/overlay/analyze-screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          screenshot: base64,
          sections: sections.map(s => ({ name: s.name, content: s.content })),
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        addLog(`Analysis failed: ${err.error || response.statusText}`, 'error');
        return;
      }

      const data = await response.json();
      const rawTargets: Target[] = (data.targets || []).map((t: any) => ({ ...t, enabled: true }));

      if (!rawTargets.length) {
        addLog('No matching fields found on screen. Try opening your EHR to a patient record page first.', 'error');
        return;
      }

      setTargets(rawTargets);
      setStep('analysed');
      addLog(`Found ${rawTargets.length} matching field(s) ✓`, 'success');
    } catch (err: any) {
      addLog(`Error: ${err.message}`, 'error');
    } finally {
      setAnalysing(false);
    }
  };

  const handlePasteAll = async () => {
    const enabled = targets.filter(t => t.enabled);
    if (!enabled.length) {
      addLog('No targets selected.', 'error');
      return;
    }

    setPasting(true);
    addLog('Starting paste sequence…');

    for (const target of enabled) {
      const section = sections.find(s => s.name === target.sectionName);
      if (!section) continue;

      addLog(`Copying "${target.sectionName}" to clipboard…`);

      // Write to clipboard via main process (avoids focus issues)
      const clipResult = await (window as any).electron?.writeClipboard(section.content);
      if (!clipResult?.success) {
        // Fallback to navigator clipboard
        try {
          await navigator.clipboard.writeText(section.content);
        } catch {
          addLog(`  ✗ Clipboard write failed for ${target.sectionName}`, 'error');
          continue;
        }
      }

      await delay(200);

      addLog(`Clicking field "${target.fieldLabel}" at (${target.x}, ${target.y})…`);
      const pasteResult = await (window as any).electron?.pasteAt(target.x, target.y);

      if (pasteResult?.success === false) {
        addLog(`  ✗ Paste failed: ${pasteResult.error}`, 'error');
      } else {
        addLog(`  ✓ "${target.sectionName}" pasted into "${target.fieldLabel}"`, 'success');
      }

      // Small gap between pastes so the EHR can keep up
      await delay(400);
    }

    addLog('Done!', 'success');
    setPasting(false);
  };

  const handleCopyAll = async () => {
    const text = sections
      .map(s => `${s.name.toUpperCase()}:\n${s.content}`)
      .join('\n\n');
    try {
      await navigator.clipboard.writeText(text);
      addLog('All sections copied to clipboard ✓', 'success');
    } catch {
      addLog('Failed to copy to clipboard.', 'error');
    }
  };

  const resetAll = () => {
    setSections(DEFAULT_SECTIONS.map(s => ({ ...s })));
    setScreenshot(null);
    setTargets([]);
    setLog([]);
    setStep('idle');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
            Smart Paste Lab
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted-foreground)' }}>
            Test screen detection + auto-paste with mock notes
          </p>
        </div>
        <button onClick={resetAll} className="btn btn-ghost btn-sm gap-1" title="Reset">
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Note Sections */}
      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium" style={{ color: 'var(--color-muted-foreground)' }}>
          MOCK NOTE — edit before testing
        </p>
        {sections.map((s, i) => (
          <div key={s.name} className="card">
            <div className="card-header py-2 px-3">
              <span className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>{s.name}</span>
            </div>
            <div className="card-content p-2">
              <textarea
                value={s.content}
                onChange={e => {
                  const next = [...sections];
                  next[i] = { ...next[i], content: e.target.value };
                  setSections(next);
                }}
                className="input text-xs"
                style={{ minHeight: 52, resize: 'vertical', padding: '6px 8px' }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleCapture}
          disabled={analysing || pasting}
          className="btn btn-primary flex-1 gap-2 py-2.5"
        >
          {analysing ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Analysing…</>
          ) : (
            <><Camera className="w-4 h-4" /> Capture & Detect</>
          )}
        </button>
        <button
          onClick={handleCopyAll}
          disabled={analysing || pasting}
          className="btn btn-outline gap-1 py-2.5 px-3"
          title="Copy all to clipboard"
        >
          <ClipboardCopy className="w-4 h-4" />
        </button>
      </div>

      {/* Screenshot preview */}
      {screenshot && (
        <div className="card overflow-hidden">
          <div className="card-header py-2 px-3">
            <span className="text-xs font-medium">Screen Preview</span>
          </div>
          <img
            src={screenshot}
            alt="Captured screen"
            className="w-full"
            style={{ maxHeight: 120, objectFit: 'cover', objectPosition: 'top' }}
          />
        </div>
      )}

      {/* Detected Targets */}
      {step === 'analysed' && targets.length > 0 && (
        <div className="card">
          <div className="card-header py-2 px-3 flex items-center justify-between">
            <span className="text-xs font-medium">Detected Fields</span>
            <span className="badge badge-success">{targets.filter(t => t.enabled).length} selected</span>
          </div>
          <div className="card-content p-0">
            {targets.map((t, i) => (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <input
                  type="checkbox"
                  checked={t.enabled}
                  onChange={e => {
                    const next = [...targets];
                    next[i] = { ...next[i], enabled: e.target.checked };
                    setTargets(next);
                  }}
                  className="w-3.5 h-3.5 flex-shrink-0"
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{t.sectionName}</p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--color-muted-foreground)' }}>
                    → {t.fieldLabel} ({t.x}, {t.y})
                  </p>
                </div>
                <span
                  className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                    t.confidence >= 70
                      ? 'bg-green-100 text-green-700'
                      : t.confidence >= 40
                      ? 'bg-yellow-100 text-yellow-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {t.confidence}%
                </span>
              </div>
            ))}
          </div>
          <div className="card-footer p-2">
            <button
              onClick={handlePasteAll}
              disabled={pasting || !targets.some(t => t.enabled)}
              className="btn btn-primary w-full gap-2 py-2"
            >
              {pasting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Pasting…</>
              ) : (
                <><Zap className="w-4 h-4" /> Paste Now</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Log */}
      {log.length > 0 && (
        <div
          className="rounded-lg p-2 flex flex-col gap-1"
          style={{ background: 'var(--color-foreground)', maxHeight: 140, overflowY: 'auto' }}
        >
          {log.map(entry => (
            <div key={entry.id} className="flex items-start gap-1.5">
              {entry.type === 'success' && <CheckCircle className="w-3 h-3 text-green-400 flex-shrink-0 mt-0.5" />}
              {entry.type === 'error' && <XCircle className="w-3 h-3 text-red-400 flex-shrink-0 mt-0.5" />}
              {entry.type === 'info' && <div className="w-3 h-3 flex-shrink-0" />}
              <p className={`text-[11px] font-mono ${
                entry.type === 'success' ? 'text-green-300' :
                entry.type === 'error' ? 'text-red-400' :
                'text-gray-300'
              }`}>{entry.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Permission note */}
      <p className="text-[10px] text-center" style={{ color: 'var(--color-muted-foreground)' }}>
        Requires <strong>Screen Recording</strong> + <strong>Accessibility</strong> permissions in macOS System Settings
      </p>
    </div>
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

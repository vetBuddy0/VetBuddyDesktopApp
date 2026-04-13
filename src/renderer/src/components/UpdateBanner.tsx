import { useState, useEffect, useCallback, useRef } from 'react';
import { Download, X, ChevronDown, ChevronUp, Zap, RotateCcw, AlertCircle } from 'lucide-react';

const RELEASES_URL = 'https://vetbuddy-385b2.web.app/updates/releases.json';
const AUTO_RESTART_SECS = 10;

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; percent: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string };

interface ReleaseNote { version: string; notes: string[] }

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [releaseNote, setReleaseNote] = useState<ReleaseNote | null>(null);
  const [countdown, setCountdown] = useState(AUTO_RESTART_SECS);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subscribe to updater events from main process
  useEffect(() => {
    const el = (window as any).electron;
    if (!el?.updater?.onStatus) return;

    const unsubscribe = el.updater.onStatus((status: any) => {
      console.log('[UpdateBanner] received status:', status);
      if (status.type === 'available') {
        setState({ phase: 'available', version: status.version });
        setDismissed(false);
        setShowNotes(false);
        fetch(`${RELEASES_URL}?t=${Date.now()}`, { cache: "no-store" })
          .then(r => r.json())
          .then(data => setReleaseNote({ version: data.latest.version, notes: data.latest.notes }))
          .catch(() => {});
      } else if (status.type === 'downloading') {
        setState({ phase: 'downloading', percent: status.percent ?? 0 });
        setDismissed(false);
      } else if (status.type === 'downloaded') {
        setState({ phase: 'downloaded', version: status.version });
        setDismissed(false);
        // Start countdown
        setCountdown(AUTO_RESTART_SECS);
      } else if (status.type === 'error') {
        setState({ phase: 'error', message: status.message });
        setDismissed(false);
      }
      // 'checking' and 'up-to-date' leave banner as-is (don't flash)
    });

    return unsubscribe;
  }, []);

  // Countdown timer that fires after download completes
  useEffect(() => {
    if (state.phase !== 'downloaded' || dismissed) {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
      return;
    }
    setCountdown(AUTO_RESTART_SECS);
    countdownRef.current = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownRef.current!);
          countdownRef.current = null;
          (window as any).electron?.updater?.install?.();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [state.phase, dismissed]);

  const handleDownload = useCallback(() => {
    (window as any).electron?.updater?.download?.();
  }, []);

  const handleInstallNow = useCallback(() => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    (window as any).electron?.updater?.install?.();
  }, []);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  }, []);

  if (state.phase === 'idle' || dismissed) return null;

  // ── Update available ────────────────────────────────────────────────────────
  if (state.phase === 'available') {
    return (
      <div style={{
        margin: '8px 8px 0',
        borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(109,40,217,0.18) 0%, rgba(139,92,246,0.12) 100%)',
        border: '1.5px solid rgba(139,92,246,0.5)',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(109,40,217,0.2)',
      }}>
        {/* Title row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(139,92,246,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Zap size={14} style={{ color: 'rgb(167,139,250)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-foreground)' }}>
              Update v{state.version} available
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-muted-foreground)', marginTop: 1 }}>
              Tap Download to install in the background
            </div>
          </div>
          <button
            onClick={() => setShowNotes(n => !n)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted-foreground)', padding: 4 }}
            title="What's new"
          >
            {showNotes ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          <button
            onClick={handleDismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted-foreground)', padding: 4 }}
            title="Dismiss"
          >
            <X size={13} />
          </button>
        </div>

        {/* What's new */}
        {showNotes && releaseNote && (
          <div style={{ padding: '0 12px 8px 12px', borderTop: '1px solid rgba(139,92,246,0.2)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'rgb(167,139,250)', margin: '8px 0 5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              What's New
            </div>
            {releaseNote.notes.map((note, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 3 }}>
                <span style={{ color: 'rgb(167,139,250)', flexShrink: 0, fontSize: 11 }}>•</span>
                <span style={{ fontSize: 11.5, color: 'var(--color-foreground)', lineHeight: 1.5 }}>{note}</span>
              </div>
            ))}
          </div>
        )}

        {/* Download button */}
        <div style={{ padding: '0 12px 12px', display: 'flex', gap: 8 }}>
          <button
            onClick={handleDownload}
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'rgb(139,92,246)', color: 'white',
              fontSize: 12.5, fontWeight: 700,
            }}
          >
            <Download size={13} />
            Download Update
          </button>
        </div>
      </div>
    );
  }

  // ── Downloading ──────────────────────────────────────────────────────────────
  if (state.phase === 'downloading') {
    return (
      <div style={{
        margin: '8px 8px 0',
        borderRadius: 10,
        background: 'rgba(139,92,246,0.1)',
        border: '1.5px solid rgba(139,92,246,0.4)',
        padding: '10px 12px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Zap size={13} style={{ color: 'rgb(167,139,250)', flexShrink: 0 }} />
          <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-foreground)', flex: 1 }}>
            Downloading update…
          </span>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'rgb(167,139,250)' }}>
            {state.percent}%
          </span>
        </div>
        <div style={{ height: 6, background: 'rgba(139,92,246,0.2)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', width: `${state.percent}%`,
            background: 'linear-gradient(90deg, rgb(109,40,217), rgb(167,139,250))',
            borderRadius: 3, transition: 'width 0.4s ease',
          }} />
        </div>
      </div>
    );
  }

  // ── Downloaded — countdown to restart ───────────────────────────────────────
  if (state.phase === 'downloaded') {
    return (
      <div style={{
        margin: '8px 8px 0',
        borderRadius: 10,
        background: 'linear-gradient(135deg, rgba(22,163,74,0.15) 0%, rgba(34,197,94,0.1) 100%)',
        border: '1.5px solid rgba(34,197,94,0.5)',
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(22,163,74,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px' }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'rgba(34,197,94,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <RotateCcw size={14} style={{ color: 'rgb(74,222,128)' }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-foreground)' }}>
              v{state.version} ready to install
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-muted-foreground)', marginTop: 1 }}>
              Auto-restarting in <strong style={{ color: 'rgb(74,222,128)' }}>{countdown}s</strong>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted-foreground)', padding: 4 }}
            title="Cancel restart"
          >
            <X size={13} />
          </button>
        </div>

        {/* Countdown bar */}
        <div style={{ height: 3, background: 'rgba(34,197,94,0.15)' }}>
          <div style={{
            height: '100%',
            width: `${(countdown / AUTO_RESTART_SECS) * 100}%`,
            background: 'rgb(34,197,94)',
            transition: 'width 1s linear',
          }} />
        </div>

        <div style={{ padding: '10px 12px', display: 'flex', gap: 8 }}>
          <button
            onClick={handleInstallNow}
            style={{
              flex: 1, padding: '8px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
              background: 'rgb(22,163,74)', color: 'white',
              fontSize: 12.5, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <RotateCcw size={13} />
            Restart Now
          </button>
          <button
            onClick={handleDismiss}
            style={{
              padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(34,197,94,0.3)', cursor: 'pointer',
              background: 'transparent', color: 'var(--color-muted-foreground)',
              fontSize: 12, fontWeight: 600,
            }}
          >
            Later
          </button>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (state.phase === 'error') {
    return (
      <div style={{
        margin: '8px 8px 0',
        borderRadius: 10,
        background: 'rgba(239,68,68,0.1)',
        border: '1.5px solid rgba(239,68,68,0.4)',
        padding: '10px 12px',
        display: 'flex', alignItems: 'flex-start', gap: 8,
      }}>
        <AlertCircle size={14} style={{ color: 'rgb(248,113,113)', flexShrink: 0, marginTop: 1 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-foreground)', marginBottom: 2 }}>
            Update check failed
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-muted-foreground)', wordBreak: 'break-word' }}>
            {state.message}
          </div>
        </div>
        <button
          onClick={handleDismiss}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-muted-foreground)', padding: 4, flexShrink: 0 }}
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return null;
}

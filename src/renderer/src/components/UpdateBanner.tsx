import { useState, useEffect, useCallback } from 'react';
import { Download, RefreshCw, X, ChevronDown, ChevronUp, Zap, ArrowDownCircle } from 'lucide-react';

const RELEASES_URL = 'https://vetbuddy-385b2.web.app/updates/releases.json';

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'checking' }
  | { phase: 'available'; version: string }
  | { phase: 'downloading'; percent: number }
  | { phase: 'downloaded'; version: string }
  | { phase: 'error'; message: string };

interface ReleaseInfo {
  version: string;
  releaseDate: string;
  notes: string[];
}

export function UpdateBanner() {
  const [state, setState] = useState<UpdateState>({ phase: 'idle' });
  const [dismissed, setDismissed] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [releaseInfo, setReleaseInfo] = useState<ReleaseInfo | null>(null);
  const [currentVersion, setCurrentVersion] = useState<string>('');

  // Load current app version
  useEffect(() => {
    (window as any).electron?.updater?.getVersion?.()
      .then((v: string) => setCurrentVersion(v))
      .catch(() => {});
  }, []);

  // Subscribe to updater events from main process
  useEffect(() => {
    const el = (window as any).electron;
    if (!el?.updater?.onStatus) return;

    const unsubscribe = el.updater.onStatus((status: any) => {
      if (status.type === 'checking') {
        setState({ phase: 'checking' });
      } else if (status.type === 'available') {
        setState({ phase: 'available', version: status.version });
        setDismissed(false);
        // Fetch patch notes
        fetch(RELEASES_URL)
          .then(r => r.json())
          .then(data => setReleaseInfo(data.latest))
          .catch(() => {});
      } else if (status.type === 'up-to-date') {
        // Briefly show then go idle
        setState({ phase: 'idle' });
      } else if (status.type === 'downloading') {
        setState({ phase: 'downloading', percent: status.percent ?? 0 });
        setDismissed(false);
      } else if (status.type === 'downloaded') {
        setState({ phase: 'downloaded', version: status.version });
        setDismissed(false);
      } else if (status.type === 'error') {
        setState({ phase: 'error', message: status.message });
        // Auto-dismiss errors after 6 seconds
        setTimeout(() => setState({ phase: 'idle' }), 6000);
      }
    });

    return unsubscribe;
  }, []);

  const handleDownload = useCallback(() => {
    (window as any).electron?.updater?.download?.();
  }, []);

  const handleInstall = useCallback(() => {
    (window as any).electron?.updater?.install?.();
  }, []);

  // Don't render anything in idle/checking/dismissed states
  if (state.phase === 'idle' || state.phase === 'checking' || dismissed) {
    return null;
  }

  if (state.phase === 'error') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '7px 12px',
        background: 'rgba(239,68,68,0.12)',
        borderBottom: '1px solid rgba(239,68,68,0.25)',
        fontSize: 11.5,
        color: 'var(--color-foreground)',
      }}>
        <span style={{ color: 'rgb(248,113,113)', flex: 1 }}>
          Update check failed: {state.message}
        </span>
        <button className="btn-icon" onClick={() => setState({ phase: 'idle' })} style={{ opacity: 0.6 }}>
          <X size={12} />
        </button>
      </div>
    );
  }

  if (state.phase === 'available') {
    return (
      <div style={{
        borderBottom: '1px solid rgba(139,92,246,0.3)',
        background: 'rgba(139,92,246,0.1)',
        animation: 'slideDown 0.2s ease-out',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px' }}>
          <Zap size={13} style={{ color: 'rgb(167,139,250)', flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-foreground)' }}>
              v{state.version} available
            </span>
            {currentVersion && (
              <span style={{ fontSize: 11, color: 'var(--color-muted-foreground)', marginLeft: 5 }}>
                (current: v{currentVersion})
              </span>
            )}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={handleDownload}
            style={{ fontSize: 11, padding: '3px 9px', flexShrink: 0 }}
          >
            <Download size={11} /> Download
          </button>
          <button
            className="btn-icon"
            onClick={() => setShowNotes(!showNotes)}
            style={{ opacity: 0.6, flexShrink: 0 }}
            title="What's new"
          >
            {showNotes ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            className="btn-icon"
            onClick={() => setDismissed(true)}
            style={{ opacity: 0.5, flexShrink: 0 }}
            title="Dismiss"
          >
            <X size={12} />
          </button>
        </div>

        {showNotes && releaseInfo && (
          <div style={{
            padding: '0 12px 10px 33px',
            borderTop: '1px solid rgba(139,92,246,0.15)',
          }}>
            <p style={{ fontSize: 10.5, fontWeight: 600, color: 'rgb(167,139,250)', marginTop: 8, marginBottom: 5, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              What's New
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {releaseInfo.notes.map((note, i) => (
                <li key={i} style={{ fontSize: 11.5, color: 'var(--color-foreground)', marginBottom: 3, display: 'flex', gap: 6 }}>
                  <span style={{ color: 'rgb(167,139,250)', flexShrink: 0 }}>•</span>
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  if (state.phase === 'downloading') {
    return (
      <div style={{
        padding: '8px 12px',
        background: 'rgba(139,92,246,0.1)',
        borderBottom: '1px solid rgba(139,92,246,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <RefreshCw size={13} style={{ color: 'rgb(167,139,250)', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-foreground)', flex: 1 }}>
            Downloading update… {state.percent}%
          </span>
        </div>
        <div style={{ height: 4, background: 'rgba(139,92,246,0.2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{
            height: '100%',
            width: `${state.percent}%`,
            background: 'rgb(139,92,246)',
            borderRadius: 2,
            transition: 'width 0.3s ease',
          }} />
        </div>
      </div>
    );
  }

  if (state.phase === 'downloaded') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 12px',
        background: 'rgba(34,197,94,0.1)',
        borderBottom: '1px solid rgba(34,197,94,0.25)',
      }}>
        <ArrowDownCircle size={13} style={{ color: 'var(--color-success)', flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-foreground)', flex: 1 }}>
          v{state.version} ready — restart to apply
        </span>
        <button
          className="btn btn-primary btn-sm"
          onClick={handleInstall}
          style={{ fontSize: 11, padding: '3px 9px', background: 'var(--color-success)', flexShrink: 0 }}
        >
          Install & Restart
        </button>
        <button
          className="btn-icon"
          onClick={() => setDismissed(true)}
          style={{ opacity: 0.5, flexShrink: 0 }}
          title="Later"
        >
          <X size={12} />
        </button>
      </div>
    );
  }

  return null;
}

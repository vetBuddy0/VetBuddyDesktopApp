import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle, RefreshCw, Search } from "lucide-react";

interface ReleaseEntry {
  version: string;
  releaseDate: string;
  notes: string[];
}

interface ReleasesData {
  latest: ReleaseEntry;
  history: ReleaseEntry[];
}

interface Props {
  onBack: () => void;
}

const RELEASES_URL = "https://vetbuddy-385b2.web.app/updates/releases.json";

export function AboutPanel({ onBack }: Props) {
  const [appVersion, setAppVersion] = useState<string>("...");
  const [releases, setReleases] = useState<ReleasesData | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    const electron = (window as any).electron;
    if (electron?.updater?.getVersion) {
      electron.updater.getVersion().then((v: string) => setAppVersion(v)).catch(() => {});
    }
    fetch(`${RELEASES_URL}?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((data: ReleasesData) => setReleases(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  const card: React.CSSProperties = {
    background: "var(--color-card)",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 12,
  };

  return (
    // No fixed height — just flow with .content's natural scroll
    <div style={{ paddingBottom: 8 }}>

      {/* Back header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
        <button
          onClick={onBack}
          style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 4,
            color: "var(--color-muted-foreground)", fontSize: 12, padding: "2px 4px",
          }}
        >
          <ArrowLeft size={13} />
          Back
        </button>
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--color-foreground)" }}>
          About My VetBuddy
        </span>
      </div>

      {/* Version card */}
      <div style={card}>
        <div style={{ padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Installed Version
            </span>
            <span style={{
              fontSize: 11, fontWeight: 600, fontFamily: "monospace",
              background: "var(--color-muted)", color: "var(--color-foreground)",
              padding: "2px 7px", borderRadius: 5,
            }}>
              v{appVersion}
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--color-muted-foreground)", marginBottom: 12 }}>
            My VetBuddy Desktop Overlay — real-time clinical note assistant for veterinary consultations.
          </div>
          <button
            onClick={async () => {
              setChecking(true);
              try { await (window as any).electron?.updater?.check?.(); } catch {}
              setTimeout(() => setChecking(false), 3000);
            }}
            style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 12px", borderRadius: 7,
              border: "1px solid var(--color-border)",
              background: "var(--color-background)", color: "var(--color-foreground)",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            <Search size={12} style={{ animation: checking ? "spin 1s linear infinite" : "none" }} />
            {checking ? "Checking…" : "Check for Updates"}
          </button>
        </div>
      </div>

      {/* Patch notes */}
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <RefreshCw size={16} style={{ animation: "spin 1s linear infinite", color: "var(--color-muted-foreground)" }} />
        </div>
      ) : releases ? (
        <>
          {/* Latest */}
          <div style={card}>
            <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-foreground)" }}>
                What's New in v{releases.latest.version}
              </span>
              <span style={{ fontSize: 11, color: "var(--color-muted-foreground)" }}>
                {formatDate(releases.latest.releaseDate)}
              </span>
            </div>
            <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
              {releases.latest.notes.map((note, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7 }}>
                  <CheckCircle size={12} style={{ color: "var(--color-primary)", flexShrink: 0, marginTop: 2 }} />
                  <span style={{ fontSize: 12, color: "var(--color-foreground)", lineHeight: 1.5 }}>{note}</span>
                </div>
              ))}
            </div>
          </div>

          {/* History */}
          {releases.history.length > 0 && (
            <div style={card}>
              <div style={{ padding: "10px 16px", borderBottom: "1px solid var(--color-border)" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--color-foreground)" }}>Previous Releases</span>
              </div>
              <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
                {releases.history.map((rel) => (
                  <div key={rel.version}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, fontFamily: "monospace", color: "var(--color-foreground)" }}>v{rel.version}</span>
                      <span style={{ fontSize: 11, color: "var(--color-muted-foreground)" }}>{formatDate(rel.releaseDate)}</span>
                    </div>
                    {rel.notes.map((note, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 7, marginBottom: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--color-muted-foreground)", flexShrink: 0, marginTop: 2 }}>•</span>
                        <span style={{ fontSize: 11, color: "var(--color-muted-foreground)", lineHeight: 1.5 }}>{note}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div style={{ fontSize: 12, color: "var(--color-muted-foreground)", textAlign: "center", padding: 16 }}>
          Couldn't load release notes.
        </div>
      )}

      <div style={{ fontSize: 11, color: "var(--color-muted-foreground)", textAlign: "center", paddingTop: 4 }}>
        © 2026 VetBuddy · Built for veterinary professionals
      </div>
    </div>
  );
}

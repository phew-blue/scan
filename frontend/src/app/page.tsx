"use client";

import { useEffect, useState, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { api, type Job, type JobWithScans, type Scan, type Pattern, formatOutput } from "@/lib/api";

const Scanner = dynamic(() => import("@/components/Scanner"), { ssr: false });

/* ── shared tokens ──────────────────────────────────────── */
const S = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
  } as React.CSSProperties,
  label: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "10px",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "var(--text-dim)",
  } as React.CSSProperties,
};

/* ── Pattern dropdown with checkboxes ───────────────────── */
function PatternDropdown({
  allPatterns,
  activeIds,
  onAdd,
  onRemove,
}: {
  allPatterns: Pattern[];
  activeIds: Set<string>;
  onAdd: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const label =
    activeIds.size === 0
      ? "NO FILTER"
      : activeIds.size === 1
      ? allPatterns.find((p) => activeIds.has(p.id))?.name ?? "1 PATTERN"
      : `${activeIds.size} PATTERNS`;

  return (
    <div ref={ref} style={{ position: "relative", marginLeft: "auto" }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex", alignItems: "center", gap: "6px",
          background: activeIds.size > 0 ? "var(--accent-dim)" : "var(--surface)",
          border: `1px solid ${activeIds.size > 0 ? "var(--accent)" : "var(--border)"}`,
          borderRadius: "4px",
          color: activeIds.size > 0 ? "var(--accent)" : "var(--text-dim)",
          padding: "4px 8px",
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: "10px",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
          <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute", right: 0, top: "calc(100% + 6px)",
          background: "var(--surface)",
          border: "1px solid var(--border-bright)",
          borderRadius: "8px",
          minWidth: "180px",
          zIndex: 100,
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        }}>
          {allPatterns.length === 0 ? (
            <div style={{ padding: "12px 14px", ...S.label }}>
              NO PATTERNS — add in settings
            </div>
          ) : (
            allPatterns.map((p) => {
              const checked = activeIds.has(p.id);
              return (
                <label
                  key={p.id}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                    background: checked ? "var(--accent-dim)" : "transparent",
                    transition: "background 0.1s",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => checked ? onRemove(p.id) : onAdd(p.id)}
                    style={{ accentColor: "var(--accent)", width: "14px", height: "14px", flexShrink: 0 }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "12px",
                      color: checked ? "var(--accent)" : "var(--text)",
                      letterSpacing: "0.04em",
                    }}>
                      {p.name}
                    </div>
                    <div style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "9px",
                      color: "var(--text-dim)",
                      marginTop: "2px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {p.regex}
                    </div>
                  </div>
                </label>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* ── Job Detail ─────────────────────────────────────────── */
function JobDetail({ id }: { id: string }) {
  const [job, setJob] = useState<JobWithScans | null>(null);
  const [allPatterns, setAllPatterns] = useState<Pattern[]>([]);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    api.getJob(id).then(setJob).catch(() => setError("Job not found"));
    api.listPatterns().then(setAllPatterns).catch(console.error);
  }, [id]);

  const activePatternIds = new Set(job?.patterns.map((p) => p.id) ?? []);

  async function handleAddPattern(patternId: string) {
    await api.addJobPattern(id, patternId);
    const pattern = allPatterns.find((p) => p.id === patternId);
    if (pattern) {
      setJob((prev) => prev ? { ...prev, patterns: [...prev.patterns, pattern] } : prev);
    }
  }

  async function handleRemovePattern(patternId: string) {
    await api.removeJobPattern(id, patternId);
    setJob((prev) => prev ? { ...prev, patterns: prev.patterns.filter((p) => p.id !== patternId) } : prev);
  }

  const handleScan = useCallback(async (barcode: string) => {
    if (job?.scans.some((s) => s.barcode === barcode)) return;
    try {
      const scan = await api.addScan(id, barcode);
      setJob((prev) => prev ? { ...prev, scans: [...prev.scans, scan] } : prev);
    } catch (err) {
      console.error("add scan failed", err);
    }
  }, [id, job]);

  async function removeScan(scan: Scan) {
    await api.deleteScan(id, scan.id);
    setJob((prev) => prev ? { ...prev, scans: prev.scans.filter((s) => s.id !== scan.id) } : prev);
  }

  async function copyOutput() {
    if (!job) return;
    await navigator.clipboard.writeText(formatOutput(job));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (error) return (
    <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--red)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}>
      {error}
    </div>
  );
  if (!job) return (
    <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-dim)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}>
      LOADING<span className="blink">_</span>
    </div>
  );

  const validScans = job.scans.filter((s) => s.valid);
  const invalidScans = job.scans.filter((s) => !s.valid);

  return (
    <div style={{ display: "flex", flexDirection: "column", paddingBottom: "32px" }}>

      {/* Job header */}
      <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--border)" }}>
        <a
          href="/"
          style={{
            display: "inline-flex", alignItems: "center", gap: "6px",
            color: "var(--text-dim)", fontSize: "12px",
            fontFamily: "'IBM Plex Mono', monospace",
            letterSpacing: "0.05em", textDecoration: "none",
            marginBottom: "12px",
          }}
        >
          ← JOBS
        </a>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{
              fontSize: "20px", fontWeight: 600, margin: 0,
              color: "var(--text)", lineHeight: 1.2,
              whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            }}>
              {job.title}
            </h1>
            <p style={{ ...S.label, margin: "6px 0 0" }}>
              {new Date(job.created_at).toLocaleDateString("en-GB", {
                weekday: "short", day: "numeric", month: "short", year: "numeric",
              })}
            </p>
          </div>
          {/* Copy button */}
          <button
            onClick={copyOutput}
            disabled={job.scans.length === 0}
            style={{
              display: "flex", alignItems: "center", gap: "8px",
              background: copied ? "var(--green-dim)" : job.scans.length > 0 ? "var(--accent-dim)" : "var(--surface)",
              border: `1px solid ${copied ? "var(--green)" : job.scans.length > 0 ? "var(--accent)" : "var(--border)"}`,
              borderRadius: "8px",
              color: copied ? "var(--green)" : job.scans.length > 0 ? "var(--accent)" : "var(--text-muted)",
              padding: "10px 16px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "12px", letterSpacing: "0.08em",
              cursor: job.scans.length === 0 ? "not-allowed" : "pointer",
              transition: "all 0.15s",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {copied ? (
              <>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
                COPIED
              </>
            ) : (
              <>
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3" />
                </svg>
                COPY
              </>
            )}
          </button>
        </div>

        {/* Scan count pills + pattern dropdown */}
        <div style={{ display: "flex", gap: "8px", marginTop: "12px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{
            ...S.label,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            padding: "4px 8px",
          }}>
            {job.scans.length} SCAN{job.scans.length !== 1 ? "S" : ""}
          </span>
          {validScans.length > 0 && (
            <span style={{
              ...S.label,
              background: "var(--green-dim)",
              border: "1px solid var(--green)",
              borderRadius: "4px",
              padding: "4px 8px",
              color: "var(--green)",
            }}>
              {validScans.length} VALID
            </span>
          )}
          {invalidScans.length > 0 && (
            <span style={{
              ...S.label,
              background: "var(--red-dim)",
              border: "1px solid var(--red)",
              borderRadius: "4px",
              padding: "4px 8px",
              color: "var(--red)",
            }}>
              {invalidScans.length} INVALID
            </span>
          )}
          <PatternDropdown
            allPatterns={allPatterns}
            activeIds={activePatternIds}
            onAdd={handleAddPattern}
            onRemove={handleRemovePattern}
          />
        </div>
      </div>

      {/* Scanner section */}
      <div style={{ padding: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <span style={S.label}>SCANNER</span>
          <button
            onClick={() => setScanning(!scanning)}
            style={{
              background: "none", border: "none",
              color: "var(--text-dim)", fontSize: "11px",
              fontFamily: "'IBM Plex Mono', monospace",
              cursor: "pointer", letterSpacing: "0.05em", padding: "4px 0",
            }}
          >
            {scanning ? "HIDE" : "SHOW"}
          </button>
        </div>
        {scanning && <Scanner onScan={handleScan} />}
      </div>

      {/* Output preview */}
      {job.scans.length > 0 && (
        <div style={{ padding: "0 16px 16px" }}>
          <div style={{ ...S.card, padding: "14px" }}>
            <p style={{ ...S.label, marginBottom: "10px" }}>OUTPUT PREVIEW</p>
            <pre style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "13px",
              color: "var(--text)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              margin: 0,
              lineHeight: 1.6,
            }}>
              {formatOutput(job)}
            </pre>
          </div>
        </div>
      )}

      {/* Scans list */}
      <div style={{ padding: "0 16px" }}>
        <p style={{ ...S.label, marginBottom: "10px" }}>SCANNED CODES</p>
        {job.scans.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: "13px", fontFamily: "'IBM Plex Mono', monospace" }}>
            No codes yet
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {[...job.scans].reverse().map((scan) => (
              <div
                key={scan.id}
                style={{
                  display: "flex", alignItems: "center",
                  background: scan.valid ? "var(--surface)" : "var(--red-dim)",
                  border: `1px solid ${scan.valid ? "var(--border)" : "var(--red)"}`,
                  borderRadius: "8px",
                  padding: "12px 14px",
                  gap: "10px",
                }}
              >
                <span style={{
                  flex: 1,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "15px",
                  color: scan.valid ? "var(--text)" : "var(--red)",
                  letterSpacing: "0.04em",
                  wordBreak: "break-all",
                }}>
                  {scan.barcode}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
                  {!scan.valid && (
                    <span style={{ fontSize: "10px", color: "var(--red)", fontFamily: "'IBM Plex Mono', monospace" }}>
                      INVALID
                    </span>
                  )}
                  <button
                    onClick={() => removeScan(scan)}
                    style={{
                      width: "36px", height: "36px",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "none", border: "none",
                      color: "var(--text-muted)", cursor: "pointer",
                      borderRadius: "6px",
                      fontSize: "18px",
                      transition: "color 0.15s",
                    }}
                    onTouchStart={(e) => (e.currentTarget.style.color = "var(--red)")}
                    onTouchEnd={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                    aria-label="Remove scan"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Job List ────────────────────────────────────────────── */
function JobList() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [title, setTitle] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listJobs().then(setJobs).catch(console.error);
  }, []);

  async function createJob(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setCreating(true);
    setError("");
    try {
      const job = await api.createJob(title.trim());
      window.location.href = `/?id=${job.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
      setCreating(false);
    }
  }

  async function deleteJob(e: React.MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm("Delete this job and all its scans?")) return;
    await api.deleteJob(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* New job bar */}
      <div style={{ padding: "16px", borderBottom: "1px solid var(--border)" }}>
        {showForm ? (
          <form onSubmit={createJob} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Job title — e.g. S4C Mens Match"
              style={{
                background: "var(--surface)",
                border: "1px solid var(--accent)",
                borderRadius: "8px",
                color: "var(--text)",
                padding: "14px",
                fontFamily: "'IBM Plex Sans', sans-serif",
                fontSize: "16px",
                outline: "none",
                width: "100%",
              }}
            />
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="submit"
                disabled={creating || !title.trim()}
                style={{
                  flex: 1,
                  background: creating || !title.trim() ? "var(--surface)" : "var(--accent)",
                  border: "1px solid var(--accent)",
                  borderRadius: "8px",
                  color: creating || !title.trim() ? "var(--text-dim)" : "#000",
                  padding: "14px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "13px",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  cursor: creating || !title.trim() ? "not-allowed" : "pointer",
                  transition: "all 0.15s",
                }}
              >
                {creating ? "CREATING…" : "CREATE JOB"}
              </button>
              <button
                type="button"
                onClick={() => { setShowForm(false); setTitle(""); setError(""); }}
                style={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "8px",
                  color: "var(--text-dim)",
                  padding: "14px 20px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                CANCEL
              </button>
            </div>
            {error && <p style={{ color: "var(--red)", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace" }}>{error}</p>}
          </form>
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="touch-active"
            style={{
              width: "100%",
              background: "var(--accent-dim)",
              border: "1px solid var(--accent)",
              borderRadius: "8px",
              color: "var(--accent)",
              padding: "16px",
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.1em",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            NEW JOB
          </button>
        )}
      </div>

      {/* Jobs list */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        {jobs.length === 0 ? (
          <div style={{ padding: "40px 0", textAlign: "center" }}>
            <p style={{ ...S.label, marginBottom: "8px" }}>NO JOBS</p>
            <p style={{ color: "var(--text-dim)", fontSize: "13px" }}>Create a job to start scanning</p>
          </div>
        ) : (
          <>
            <p style={{ ...S.label, marginBottom: "4px" }}>
              {jobs.length} JOB{jobs.length !== 1 ? "S" : ""}
            </p>
            {jobs.map((job) => (
              <a
                key={job.id}
                href={`/?id=${job.id}`}
                style={{
                  display: "flex", alignItems: "center",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  padding: "16px",
                  textDecoration: "none",
                  gap: "12px",
                  transition: "border-color 0.15s",
                  minHeight: "72px",
                }}
                onTouchStart={(e) => (e.currentTarget.style.borderColor = "var(--border-bright)")}
                onTouchEnd={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              >
                {/* Scan count indicator */}
                <div style={{
                  width: "44px", height: "44px", flexShrink: 0,
                  border: "1px solid var(--border-bright)",
                  borderRadius: "8px",
                  display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center",
                  background: "var(--bg)",
                }}>
                  <span style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: job.scan_count && job.scan_count > 99 ? "11px" : "16px",
                    fontWeight: 600,
                    color: "var(--text)",
                    lineHeight: 1,
                  }}>
                    {job.scan_count ?? 0}
                  </span>
                  <span style={{ ...S.label, fontSize: "8px", marginTop: "2px" }}>
                    SCANS
                  </span>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: "15px", fontWeight: 500,
                    color: "var(--text)", margin: 0, lineHeight: 1.3,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {job.title}
                  </p>
                  <p style={{ ...S.label, margin: "5px 0 0", fontSize: "10px" }}>
                    {new Date(job.created_at).toLocaleDateString("en-GB", {
                      day: "numeric", month: "short", year: "numeric",
                    })}
                  </p>
                </div>

                {/* Delete */}
                <button
                  onClick={(e) => deleteJob(e, job.id)}
                  style={{
                    width: "40px", height: "40px", flexShrink: 0,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    background: "none", border: "none",
                    color: "var(--text-muted)", cursor: "pointer",
                    borderRadius: "8px", fontSize: "20px",
                    transition: "color 0.15s",
                  }}
                  onTouchStart={(e) => (e.currentTarget.style.color = "var(--red)")}
                  onTouchEnd={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                  onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                  aria-label={`Delete ${job.title}`}
                >
                  ×
                </button>
              </a>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

/* ── App root ────────────────────────────────────────────── */
function App() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  return id ? <JobDetail id={id} /> : <JobList />;
}

export default function Home() {
  return (
    <Suspense fallback={
      <div style={{ padding: "32px 16px", textAlign: "center", color: "var(--text-dim)", fontFamily: "'IBM Plex Mono', monospace", fontSize: "13px" }}>
        LOADING<span className="blink">_</span>
      </div>
    }>
      <App />
    </Suspense>
  );
}

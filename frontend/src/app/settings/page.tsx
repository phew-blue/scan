"use client";

import { useEffect, useState } from "react";
import { api, type Pattern } from "@/lib/api";

const S = {
  label: {
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "10px",
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: "var(--text-dim)",
  } as React.CSSProperties,
  input: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "8px",
    color: "var(--text)",
    padding: "12px 14px",
    fontFamily: "'IBM Plex Mono', monospace",
    fontSize: "14px",
    outline: "none",
    width: "100%",
  } as React.CSSProperties,
};

export default function SettingsPage() {
  const [patterns, setPatterns] = useState<Pattern[]>([]);
  const [name, setName] = useState("");
  const [regex, setRegex] = useState("");
  const [regexError, setRegexError] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.listPatterns().then(setPatterns).catch(console.error);
  }, []);

  function validateRegex(value: string) {
    setRegex(value);
    if (!value) { setRegexError(""); return; }
    try {
      new RegExp(value);
      setRegexError("");
    } catch {
      setRegexError("Invalid regex");
    }
  }

  async function createPattern(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !regex.trim() || regexError) return;
    setSaving(true);
    setError("");
    try {
      const pattern = await api.createPattern(name.trim(), regex.trim());
      setPatterns((prev) => [...prev, pattern]);
      setName("");
      setRegex("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create pattern");
    } finally {
      setSaving(false);
    }
  }

  async function toggleDefault(id: string, current: boolean) {
    await api.setPatternDefault(id, !current);
    setPatterns((prev) => prev.map((p) => p.id === id ? { ...p, is_default: !current } : p));
  }

  async function deletePattern(id: string) {
    if (!confirm("Delete this pattern? Jobs using it will fall back to the default filter.")) return;
    await api.deletePattern(id);
    setPatterns((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", paddingBottom: "32px" }}>

      {/* Header */}
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
        <h1 style={{
          fontSize: "20px", fontWeight: 600, margin: 0,
          color: "var(--text)",
        }}>
          Settings
        </h1>
        <h2 style={{
          fontSize: "14px", fontWeight: 600, margin: "16px 0 0",
          color: "var(--text)",
        }}>
          Patterns
        </h2>
        <p style={{ ...S.label, marginTop: "4px" }}>
          Manage barcode validation patterns
        </p>
      </div>

      {/* Pattern list */}
      <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "8px" }}>
        <p style={S.label}>{patterns.length} PATTERN{patterns.length !== 1 ? "S" : ""}</p>

        {patterns.length === 0 ? (
          <p style={{ color: "var(--text-dim)", fontSize: "13px", fontFamily: "'IBM Plex Mono', monospace" }}>
            No patterns yet
          </p>
        ) : (
          patterns.map((p) => (
            <div
              key={p.id}
              style={{
                display: "flex", alignItems: "center", gap: "12px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                padding: "14px 16px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <p style={{
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "14px", fontWeight: 600,
                    color: "var(--text)", margin: 0,
                  }}>
                    {p.name}
                  </p>
                  {p.is_default && (
                    <span style={{
                      fontFamily: "'IBM Plex Mono', monospace",
                      fontSize: "9px", letterSpacing: "0.1em",
                      color: "var(--green)", background: "var(--green-dim)",
                      border: "1px solid var(--green)",
                      borderRadius: "3px", padding: "1px 5px",
                    }}>
                      DEFAULT
                    </span>
                  )}
                </div>
                <p style={{
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "12px",
                  color: "var(--accent)",
                  margin: "4px 0 0",
                  wordBreak: "break-all",
                }}>
                  {p.regex}
                </p>
              </div>
              <button
                onClick={() => toggleDefault(p.id, p.is_default)}
                style={{
                  flexShrink: 0,
                  background: p.is_default ? "var(--green-dim)" : "var(--surface)",
                  border: `1px solid ${p.is_default ? "var(--green)" : "var(--border)"}`,
                  borderRadius: "6px",
                  color: p.is_default ? "var(--green)" : "var(--text-dim)",
                  padding: "4px 8px",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "9px", letterSpacing: "0.1em",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {p.is_default ? "DEFAULT ✓" : "SET DEFAULT"}
              </button>
              <button
                onClick={() => deletePattern(p.id)}
                style={{
                  width: "36px", height: "36px", flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: "none", border: "none",
                  color: "var(--text-muted)", cursor: "pointer",
                  borderRadius: "6px", fontSize: "18px",
                  transition: "color 0.15s",
                }}
                onTouchStart={(e) => (e.currentTarget.style.color = "var(--red)")}
                onTouchEnd={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--red)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                aria-label={`Delete ${p.name}`}
              >
                ×
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add pattern form */}
      <div style={{ padding: "0 16px" }}>
        <div style={{
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "10px",
          padding: "16px",
        }}>
          <p style={{ ...S.label, marginBottom: "14px" }}>ADD PATTERN</p>
          <form onSubmit={createPattern} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Name — e.g. Timeline"
                style={{
                  ...S.input,
                  borderColor: "var(--border)",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = "var(--border)")}
              />
            </div>
            <div>
              <input
                type="text"
                value={regex}
                onChange={(e) => validateRegex(e.target.value)}
                placeholder="Regex — e.g. ^TL\d{8}$"
                style={{
                  ...S.input,
                  borderColor: regexError ? "var(--red)" : "var(--border)",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = regexError ? "var(--red)" : "var(--accent)")}
                onBlur={(e) => (e.currentTarget.style.borderColor = regexError ? "var(--red)" : "var(--border)")}
              />
              {regexError && (
                <p style={{ color: "var(--red)", fontSize: "11px", fontFamily: "'IBM Plex Mono', monospace", marginTop: "4px" }}>
                  {regexError}
                </p>
              )}
            </div>
            {error && (
              <p style={{ color: "var(--red)", fontSize: "12px", fontFamily: "'IBM Plex Mono', monospace" }}>
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={saving || !name.trim() || !regex.trim() || !!regexError}
              style={{
                background: saving || !name.trim() || !regex.trim() || !!regexError ? "var(--surface)" : "var(--accent)",
                border: "1px solid var(--accent)",
                borderRadius: "8px",
                color: saving || !name.trim() || !regex.trim() || !!regexError ? "var(--text-dim)" : "#000",
                padding: "14px",
                fontFamily: "'IBM Plex Mono', monospace",
                fontSize: "13px",
                fontWeight: 600,
                letterSpacing: "0.08em",
                cursor: saving || !name.trim() || !regex.trim() || !!regexError ? "not-allowed" : "pointer",
                transition: "all 0.15s",
              }}
            >
              {saving ? "SAVING…" : "ADD PATTERN"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onScan: (barcode: string) => void;
  disabled?: boolean;
}

export default function Scanner({ onScan, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [cameraError, setCameraError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<unknown>(null);

  useEffect(() => {
    return () => { stopCamera(); };
  }, []);

  async function startCamera() {
    setCameraError("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        reader.decodeFromStream(stream, videoRef.current, (result, err) => {
          if (result && !disabled) onScan(result.getText());
          if (err && err.name !== "NotFoundException") console.debug("scan error", err);
        });
      }
    } catch (err) {
      setCameraError("Camera unavailable — use keyboard input below.");
      console.error("camera error", err);
    }
  }

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const val = manualInput.trim();
    if (val && !disabled) {
      onScan(val);
      setManualInput("");
      inputRef.current?.focus();
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Camera viewfinder */}
      <div style={{
        borderRadius: "8px",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        overflow: "hidden",
        position: "relative",
      }}>
        {cameraActive ? (
          <div style={{ position: "relative" }}>
            <video
              ref={videoRef}
              style={{ width: "100%", maxHeight: "260px", objectFit: "cover", display: "block" }}
              muted
              playsInline
            />
            {/* Scan overlay */}
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              pointerEvents: "none",
            }}>
              {/* Corner marks */}
              {[
                { top: "50%", left: "50%", transform: "translate(-96px, -36px)", borderTop: "2px solid var(--accent)", borderLeft: "2px solid var(--accent)" },
                { top: "50%", left: "50%", transform: "translate(80px, -36px)", borderTop: "2px solid var(--accent)", borderRight: "2px solid var(--accent)" },
                { top: "50%", left: "50%", transform: "translate(-96px, 20px)", borderBottom: "2px solid var(--accent)", borderLeft: "2px solid var(--accent)" },
                { top: "50%", left: "50%", transform: "translate(80px, 20px)", borderBottom: "2px solid var(--accent)", borderRight: "2px solid var(--accent)" },
              ].map((s, i) => (
                <div key={i} style={{ position: "absolute", width: "16px", height: "16px", ...s }} />
              ))}
              {/* Scan line */}
              <div style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                transform: "translateX(-80px) translateY(-28px)",
                width: "160px",
                height: "2px",
                background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
                boxShadow: "0 0 8px var(--accent)",
              }} className="scan-line" />
            </div>
            <button
              onClick={stopCamera}
              style={{
                position: "absolute", top: "10px", right: "10px",
                background: "rgba(8,12,15,0.85)",
                border: "1px solid var(--border-bright)",
                borderRadius: "6px",
                color: "var(--text-dim)",
                padding: "6px 12px",
                fontSize: "12px",
                fontFamily: "'IBM Plex Mono', monospace",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              STOP
            </button>
          </div>
        ) : (
          <button
            onClick={startCamera}
            disabled={disabled}
            className="touch-active"
            style={{
              width: "100%",
              padding: "32px 24px",
              background: "transparent",
              border: "none",
              cursor: disabled ? "not-allowed" : "pointer",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px",
              opacity: disabled ? 0.4 : 1,
              transition: "opacity 0.15s",
            }}
          >
            <div style={{
              width: "56px", height: "56px",
              borderRadius: "50%",
              border: "1px solid var(--border-bright)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "var(--accent)",
            }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              letterSpacing: "0.12em",
              color: "var(--text-dim)",
              textTransform: "uppercase",
            }}>
              TAP TO SCAN
            </span>
          </button>
        )}
      </div>

      {cameraError && (
        <p style={{ fontSize: "12px", color: "var(--amber)", fontFamily: "'IBM Plex Mono', monospace", padding: "0 4px" }}>
          ⚠ {cameraError}
        </p>
      )}

      {/* HID / manual input */}
      <form onSubmit={submitManual} style={{ display: "flex", gap: "8px" }}>
        <input
          ref={inputRef}
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          disabled={disabled}
          placeholder="HID scanner or type barcode…"
          autoComplete="off"
          autoCapitalize="none"
          style={{
            flex: 1,
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: "var(--text)",
            padding: "14px 14px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "14px",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => e.target.style.borderColor = "var(--accent)"}
          onBlur={(e) => e.target.style.borderColor = "var(--border)"}
        />
        <button
          type="submit"
          disabled={disabled || !manualInput.trim()}
          style={{
            background: manualInput.trim() && !disabled ? "var(--accent-dim)" : "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            color: manualInput.trim() && !disabled ? "var(--accent)" : "var(--text-dim)",
            padding: "14px 20px",
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: "12px",
            letterSpacing: "0.08em",
            cursor: disabled || !manualInput.trim() ? "not-allowed" : "pointer",
            transition: "all 0.15s",
            whiteSpace: "nowrap",
          }}
        >
          ADD
        </button>
      </form>
    </div>
  );
}

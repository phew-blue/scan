"use client";

import { useEffect, useRef, useState } from "react";

interface Props {
  onScan: (barcode: string) => void;
  disabled?: boolean;
}

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = "square";
    osc.frequency.value = 1046; // C6 — classic till beep frequency
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.12);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.12);
    osc.onended = () => ctx.close();
  } catch {
    // AudioContext not available (e.g. server-side render) — ignore
  }
}

export default function Scanner({ onScan, disabled }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [manualInput, setManualInput] = useState("");
  const [cameraError, setCameraError] = useState("");
  const streamRef = useRef<MediaStream | null>(null);
  const readerRef = useRef<unknown>(null);
  const lastScanRef = useRef<{ barcode: string; time: number } | null>(null);

  useEffect(() => {
    // Auto-start only if the browser already has permission — avoids prompting
    // on page load. If the Permissions API isn't supported (older Safari), fall
    // back to auto-start and let the browser decide whether to prompt.
    async function maybeAutoStart() {
      try {
        const status = await navigator.permissions.query({ name: "camera" as PermissionName });
        if (status.state === "granted") startCamera();
      } catch {
        startCamera(); // Permissions API not supported — try anyway
      }
    }
    maybeAutoStart();
    return () => { stopCamera(); };
  }, []);

  async function startCamera() {
    setCameraError("");
    try {
      const { BrowserMultiFormatReader, BarcodeFormat } = await import("@zxing/browser");
      const { DecodeHintType } = await import("@zxing/library");
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [
        BarcodeFormat.CODE_128,
        BarcodeFormat.CODE_39,
        BarcodeFormat.EAN_13,
        BarcodeFormat.EAN_8,
        BarcodeFormat.QR_CODE,
        BarcodeFormat.DATA_MATRIX,
      ]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      readerRef.current = reader;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);
        reader.decodeFromStream(stream, videoRef.current, (result, err) => {
          if (result && !disabled) {
            const barcode = result.getText();
            const now = Date.now();
            const last = lastScanRef.current;
            if (!last || last.barcode !== barcode || now - last.time > 2500) {
              lastScanRef.current = { barcode, time: now };
              beep();
              onScan(barcode);
            }
          }
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
      beep();
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
        {/* Video always in DOM so videoRef is available when startCamera runs */}
        <div style={{ position: "relative", display: cameraActive ? "block" : "none" }}>
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
            {/* Target box — corner marks + animated scan line inside */}
            <div style={{ position: "relative", width: "220px", height: "80px" }}>
              {/* Corner marks */}
              {[
                { top: 0, left: 0, borderTop: "2px solid var(--accent)", borderLeft: "2px solid var(--accent)" },
                { top: 0, right: 0, borderTop: "2px solid var(--accent)", borderRight: "2px solid var(--accent)" },
                { bottom: 0, left: 0, borderBottom: "2px solid var(--accent)", borderLeft: "2px solid var(--accent)" },
                { bottom: 0, right: 0, borderBottom: "2px solid var(--accent)", borderRight: "2px solid var(--accent)" },
              ].map((s, i) => (
                <div key={i} style={{ position: "absolute", width: "16px", height: "16px", ...s }} />
              ))}
              {/* Scan line animates within the box using top: 0→100% */}
              <div style={{
                left: 0,
                right: 0,
                height: "2px",
                background: "linear-gradient(90deg, transparent, var(--accent), transparent)",
                boxShadow: "0 0 8px var(--accent)",
              }} className="scan-line" />
            </div>
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

        {!cameraActive && (
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

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
    return () => {
      stopCamera();
    };
  }, []);

  async function startCamera() {
    setCameraError("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      readerRef.current = reader;

      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraActive(true);

        reader.decodeFromStream(stream, videoRef.current, (result, err) => {
          if (result && !disabled) {
            onScan(result.getText());
          }
          if (err && !(err.name === "NotFoundException")) {
            console.debug("scan error", err);
          }
        });
      }
    } catch (err) {
      setCameraError("Could not access camera. Use manual input below.");
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
    }
  }

  return (
    <div className="space-y-4">
      {/* Camera */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
        {cameraActive ? (
          <div className="relative">
            <video
              ref={videoRef}
              className="w-full max-h-64 object-cover"
              muted
              playsInline
            />
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-48 h-24 border-2 border-blue-400 rounded opacity-60" />
            </div>
            <button
              onClick={stopCamera}
              className="absolute top-2 right-2 rounded bg-gray-900/80 px-3 py-1 text-xs text-white hover:bg-gray-700"
            >
              Stop camera
            </button>
          </div>
        ) : (
          <button
            onClick={startCamera}
            disabled={disabled}
            className="flex w-full items-center justify-center gap-2 py-10 text-sm text-gray-400 hover:text-white disabled:opacity-40"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Start camera scanner
          </button>
        )}
      </div>

      {cameraError && <p className="text-xs text-amber-400">{cameraError}</p>}

      {/* Manual / HID input */}
      <form onSubmit={submitManual} className="flex gap-2">
        <input
          ref={inputRef}
          type="text"
          value={manualInput}
          onChange={(e) => setManualInput(e.target.value)}
          disabled={disabled}
          placeholder="Scan or type barcode, press Enter"
          className="flex-1 rounded-md border border-gray-700 bg-gray-900 px-3 py-2 text-sm font-mono focus:border-blue-500 focus:outline-none disabled:opacity-40"
          autoComplete="off"
          autoCapitalize="none"
        />
        <button
          type="submit"
          disabled={disabled || !manualInput.trim()}
          className="rounded-md border border-gray-700 px-3 py-2 text-sm hover:bg-gray-800 disabled:opacity-40"
        >
          Add
        </button>
      </form>
    </div>
  );
}

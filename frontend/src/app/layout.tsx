import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scan",
  description: "Barcode scanner for media jobs",
  icons: { icon: "/favicon.svg" },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Scan",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#080c0f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex flex-col" style={{ minHeight: "100dvh", background: "var(--bg)" }}>
        <header
          style={{
            borderBottom: "1px solid var(--border)",
            background: "var(--surface)",
            padding: "0 16px",
            height: "52px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            position: "sticky",
            top: 0,
            zIndex: 50,
            flexShrink: 0,
          }}
        >
          <a href="/" aria-label="scan home" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src="/logo.svg" alt="" style={{ width: "28px", height: "28px" }} />
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "13px",
              fontWeight: 600,
              letterSpacing: "0.05em",
              color: "var(--accent)",
            }}>
              BARCODE SCANNER
            </span>
          </a>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <a
              href="/settings"
              aria-label="Settings"
              style={{ display: "flex", alignItems: "center", color: "var(--text-dim)" }}
            >
              <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </a>
            <span style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: "11px",
              color: "var(--text-dim)",
              letterSpacing: "0.05em",
            }}>
              {process.env.NEXT_PUBLIC_APP_VERSION ?? "dev"}
            </span>
          </div>
        </header>
        <main style={{ flex: 1, width: "100%", maxWidth: "640px", margin: "0 auto", padding: "0" }}>
          {children}
        </main>
      </body>
    </html>
  );
}

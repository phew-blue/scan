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
              scan
            </span>
          </a>
        </header>
        <main style={{ flex: 1, width: "100%", maxWidth: "640px", margin: "0 auto", padding: "0" }}>
          {children}
        </main>
      </body>
    </html>
  );
}

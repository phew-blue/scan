import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "scan",
  description: "Barcode scanner for media jobs",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-950 text-gray-100 antialiased">
        <header className="border-b border-gray-800 px-6 py-4">
          <a href="/" className="text-xl font-semibold tracking-tight text-white hover:text-gray-300">
            scan
          </a>
        </header>
        <main className="mx-auto max-w-3xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}

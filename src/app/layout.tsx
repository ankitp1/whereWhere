import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#16a34a",
};

export const metadata: Metadata = {
  title: "SyncUp — Vote on When & Where (10 sec, no signup)",
  description: "Mobile-first, zero-signup group coordination web app. Lock in a time and place when multiple constraints overlap.",
  referrer: "no-referrer",
  openGraph: {
    title: "SyncUp — Vote on When & Where (10 sec, no signup)",
    description: "Mobile-first, zero-signup group coordination web app for fast group decisions.",
    type: "website",
    siteName: "SyncUp",
  },
  twitter: {
    card: "summary",
    title: "SyncUp — Vote on When & Where (10 sec, no signup)",
    description: "Mobile-first, zero-signup group coordination web app for fast group decisions.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900 min-h-screen antialiased flex flex-col items-center">
        <div className="w-full max-w-md min-h-screen bg-white shadow-xl flex flex-col border-x border-slate-100">
          {children}
        </div>
      </body>
    </html>
  );
}

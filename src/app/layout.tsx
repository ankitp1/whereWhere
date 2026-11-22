import type { Metadata, Viewport } from "next";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#090a0f",
};

export const metadata: Metadata = {
  title: "WhenWhere — Plan with your group in one sentence (No app, zero signup)",
  description: "Mobile-first, zero-signup group coordination. Lock in a day and spot with friends in 10 seconds without 40 messages in chat.",
  referrer: "no-referrer",
  openGraph: {
    title: "WhenWhere — Vote on When & Where (10 sec, no signup)",
    description: "Group coordination for dinner, drinks, and meetups. No app, no login required.",
    type: "website",
    siteName: "WhenWhere",
  },
  twitter: {
    card: "summary",
    title: "WhenWhere — Vote on When & Where (10 sec, no signup)",
    description: "Group coordination for dinner, drinks, and meetups. No app, no login required.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[#090a0f]">
      <body className="min-h-screen text-slate-900 bg-[#090a0f] flex flex-col items-center justify-start antialiased selection:bg-emerald-500 selection:text-white">
        {/* Ambient desktop glow */}
        <div className="fixed inset-0 pointer-events-none hidden sm:block overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[700px] h-[700px] bg-emerald-500/10 blur-[130px] rounded-full" />
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-teal-500/10 blur-[120px] rounded-full" />
        </div>

        {/* Mobile frame */}
        <div className="w-full max-w-md min-h-screen bg-[#fafaf9] flex flex-col relative z-10 sm:my-8 sm:rounded-[36px] sm:shadow-[0_25px_70px_rgba(0,0,0,0.5)] sm:border sm:border-slate-800/40 overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}

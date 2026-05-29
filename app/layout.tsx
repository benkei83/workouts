import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import WorkoutTimer from "@/components/WorkoutTimer";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";
import IOSInstallPrompt from "@/components/IOSInstallPrompt";
import AppNav from "@/components/AppNav";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Yeah Buddy",
  description: "Lightweight, baby. Your personal strength training tracker.",
  applicationName: "Yeah Buddy",
  appleWebApp: {
    capable: true,
    title: "Yeah Buddy",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,   // prevent accidental pinch-zoom mid-set
  userScalable: false,
  themeColor: "#18181b",
};

const geistSans = Geist({
  variable: "--font-geist-sans",
  display: "swap",
  subsets: ["latin"],
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.className} antialiased`}>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {/* Reserves 28 px at the top for the floating timer pill when a
              workout is active. The fallback div matches resolved height so
              there is zero layout shift on stream-in. */}
          <Suspense fallback={<div className="h-7" />}>
            <ActiveWorkoutTimerLoader />
          </Suspense>

          {children}

          <Suspense fallback={null}>
            <AppNav />
          </Suspense>

          {/* PWA: register service worker */}
          <ServiceWorkerRegistration />

          {/* PWA: iOS "Add to Home Screen" nudge (only shown in iOS Safari,
              not when already installed as a standalone app) */}
          <IOSInstallPrompt />
        </ThemeProvider>
      </body>
    </html>
  );
}

// ─── async sub-component (inside Suspense → no longer blocks the route) ──────
async function ActiveWorkoutTimerLoader() {
  let activeWorkout: { id: string; created_at: string } | null = null;
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("workouts")
        .select("id, created_at")
        .eq("user_id", user.id)
        .is("total_duration_mins", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      activeWorkout = data;
    }
  } catch {
    /* not authenticated or cookies unavailable */
  }

  return (
    <div className="h-7">
      {activeWorkout && (
        <WorkoutTimer
          startedAt={activeWorkout.created_at}
          workoutId={activeWorkout.id}
        />
      )}
    </div>
  );
}

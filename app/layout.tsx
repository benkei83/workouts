import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Suspense } from "react";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import WorkoutTimer from "@/components/WorkoutTimer";

const defaultUrl = process.env.VERCEL_URL
  ? `https://${process.env.VERCEL_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(defaultUrl),
  title: "Workout Logger",
  description: "The fastest way to build apps with Next.js and Supabase",
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
          {/* Always reserves 28 px at the top; the async loader fills it with the
              timer when a workout is active. Fallback matches resolved height so
              there is zero layout shift on stream-in. */}
          <Suspense fallback={<div className="h-7" />}>
            <ActiveWorkoutTimerLoader />
          </Suspense>
          {children}
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

  // Always render an h-7 block so page content is pushed down by exactly the
  // same amount whether the timer is visible or not.
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

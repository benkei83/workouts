import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import WeightPageClient from '@/components/WeightPageClient'
import { estimateOneRM } from '@/lib/stats/compute'

export default function WeightPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-7 z-10 shadow-sm flex items-center gap-3">
        <Link
          href="/"
          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500"
        >
          ←
        </Link>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Weight Tracker</h1>
      </header>

      <div className="p-4">
        <Suspense
          fallback={
            <div className="space-y-4 animate-pulse">
              <div className="h-14 bg-gray-200 rounded-2xl" />
              <div className="grid grid-cols-2 gap-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-20 bg-gray-200 rounded-2xl" />
                ))}
              </div>
              <div className="h-48 bg-gray-200 rounded-2xl" />
            </div>
          }
        >
          <WeightLoader />
        </Suspense>
      </div>
    </main>
  )
}

async function WeightLoader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  // Fetch weight logs, recent workouts for best lifts, and height setting in parallel
  const [
    { data: weightLogs },
    { data: recentWorkouts },
    settingsResult,
  ] = await Promise.all([
    supabase
      .from('body_weight_logs')
      .select('id, logged_at, weight_kg, note')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(365),

    supabase
      .from('workouts')
      .select(`
        strength_logs (
          strength_sets (
            exercise_id,
            actual_weight,
            actual_reps,
            exercises ( name )
          )
        )
      `)
      .eq('user_id', user.id)
      .not('total_duration_mins', 'is', null)
      .order('created_at', { ascending: false })
      .limit(150),

    supabase
      .from('user_settings')
      .select('height_cm')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(r => r)
      .catch(() => ({ data: null })),
  ])

  // Compute best estimated 1RM per exercise across all sets
  const best1RMs = new Map<string, { name: string; orm: number }>()
  for (const workout of recentWorkouts || []) {
    for (const log of (workout.strength_logs as any[]) || []) {
      for (const set of (log.strength_sets as any[]) || []) {
        if (!set.exercise_id || !set.actual_weight || !set.actual_reps) continue
        const w = Number(set.actual_weight)
        const r = Number(set.actual_reps)
        if (w <= 0 || r <= 0) continue
        const orm = estimateOneRM(w, r)
        const existing = best1RMs.get(set.exercise_id)
        if (!existing || orm > existing.orm) {
          best1RMs.set(set.exercise_id, {
            name: (set.exercises as any)?.name ?? 'Unknown',
            orm,
          })
        }
      }
    }
  }

  const topLifts = [...best1RMs.values()]
    .sort((a, b) => b.orm - a.orm)
    .slice(0, 10)

  const heightCm = (settingsResult as any)?.data?.height_cm
    ? Number((settingsResult as any).data.height_cm)
    : null

  return (
    <WeightPageClient
      weightLogs={(weightLogs || []).map(l => ({
        id: l.id,
        logged_at: l.logged_at as string,
        weight_kg: Number(l.weight_kg),
        note: (l.note as string | null) ?? null,
      }))}
      topLifts={topLifts}
      heightCm={heightCm}
    />
  )
}

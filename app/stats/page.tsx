import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import StatsClient from '@/components/StatsClient'
import { estimateOneRM } from '@/lib/stats/compute'

export default function StatsPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      <header className="bg-white px-6 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <Link href="/" className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500">
          ←
        </Link>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Stats</h1>
      </header>

      <div className="p-6">
        <Suspense fallback={
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-2 gap-3">
              {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-gray-200 rounded-2xl" />)}
            </div>
            <div className="h-40 bg-gray-200 rounded-2xl" />
            <div className="h-64 bg-gray-200 rounded-2xl" />
          </div>
        }>
          <StatsLoader />
        </Suspense>
      </div>
    </main>
  )
}

// ─── helpers ────────────────────────────────────────────────

function computeStreak(dates: Date[]): number {
  if (dates.length === 0) return 0
  const sorted = [...new Set(dates.map(d => {
    const c = new Date(d); c.setHours(0, 0, 0, 0); return c.getTime()
  }))].sort((a, b) => b - a).map(t => new Date(t))

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)
  if (sorted[0] < yesterday) return 0

  let streak = 1
  for (let i = 1; i < sorted.length; i++) {
    const diff = Math.round((sorted[i - 1].getTime() - sorted[i].getTime()) / 86400000)
    if (diff === 1) streak++
    else break
  }
  return streak
}

function groupByWeek(dates: Date[]): { label: string; count: number }[] {
  const now = new Date()
  const buckets = new Map<number, number>()

  for (let i = 11; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - d.getDay() - i * 7)
    d.setHours(0, 0, 0, 0)
    buckets.set(d.getTime(), 0)
  }

  for (const date of dates) {
    const d = new Date(date)
    d.setDate(d.getDate() - d.getDay())
    d.setHours(0, 0, 0, 0)
    const key = d.getTime()
    if (buckets.has(key)) buckets.set(key, (buckets.get(key) ?? 0) + 1)
  }

  return Array.from(buckets.entries()).map(([ts, count]) => {
    const d = new Date(ts)
    const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    return { label, count }
  })
}

function computeTrend(history: number[]): 'up' | 'flat' | 'down' {
  if (history.length < 4) return 'flat'
  const recent = history.slice(-3)
  const older = history.slice(-6, -3)
  if (older.length === 0) return 'flat'
  const r = recent.reduce((a, b) => a + b, 0) / recent.length
  const o = older.reduce((a, b) => a + b, 0) / older.length
  if (r - o > 1) return 'up'
  if (o - r > 1) return 'down'
  return 'flat'
}

// ─── data loader ────────────────────────────────────────────

async function StatsLoader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const { data: raw } = await supabase
    .from('workouts')
    .select(`
      id, created_at, total_duration_mins,
      strength_logs(
        id,
        strength_sets( exercise_id, actual_weight, actual_reps, rpe, exercises(id, name, muscle_group) )
      ),
      running_logs( id, distance_km, duration_seconds, average_speed, session_type, environment )
    `)
    .eq('user_id', user.id)
    .not('total_duration_mins', 'is', null)
    .order('created_at', { ascending: true })

  const workouts = raw ?? []

  // ── summary numbers ──────────────────────────────────────
  const totalWorkouts = workouts.length
  const streak = computeStreak(workouts.map(w => new Date(w.created_at)))
  const weeklyBuckets = groupByWeek(workouts.map(w => new Date(w.created_at)))

  // ── exercise settings (for Best Set method) ──────────────
  const { data: settingsRows } = await supabase
    .from('user_exercise_settings')
    .select('exercise_id, target_reps')
    .eq('user_id', user.id)
    .eq('is_active', true)

  const settingsMap: Record<string, number | null> = {}
  for (const s of settingsRows ?? []) {
    settingsMap[s.exercise_id] = s.target_reps ?? null
  }

  // ── strength ─────────────────────────────────────────────
  // Build per-exercise aggregates
  type ExSession = { date: string; weight: number; volume: number }
  type BestSetEntry = { weight: number; reps: number; orm: number; date: string }
  type BestVolEntry = { weight: number; reps: number; volume: number; date: string }
  type ExAgg = {
    id: string; name: string; pr: number; totalVolume: number; history: ExSession[]
    best1rmSet?: BestSetEntry
    bestVolumeSet?: BestVolEntry
  }
  const exMap = new Map<string, ExAgg>()

  for (const w of workouts) {
    // collect max weight per exercise in this workout session
    const sessionMax = new Map<string, { weight: number; volume: number; name: string }>()

    for (const log of (w.strength_logs ?? [])) {
      for (const set of (log.strength_sets ?? [])) {
        const exId = set.exercise_id
        const name = (set.exercises as any)?.name ?? 'Unknown'
        const weight = Number(set.actual_weight) || 0
        const reps = Number(set.actual_reps) || 0
        const vol = weight * reps

        const prev = sessionMax.get(exId)
        sessionMax.set(exId, {
          name,
          weight: Math.max(weight, prev?.weight ?? 0),
          volume: (prev?.volume ?? 0) + vol,
        })

        // Track all-time best 1RM set and volume set (clean sets only — RPE ≤ 10)
        const rpe = (set as any).rpe ?? null
        if (weight > 0 && reps > 0 && (rpe == null || Number(rpe) <= 10)) {
          if (!exMap.has(exId)) {
            exMap.set(exId, { id: exId, name, pr: 0, totalVolume: 0, history: [] })
          }
          const agg = exMap.get(exId)!
          const orm = estimateOneRM(weight, reps)
          if (!agg.best1rmSet || orm > agg.best1rmSet.orm) {
            agg.best1rmSet = { weight, reps, orm, date: w.created_at }
          }
          if (!agg.bestVolumeSet || vol > agg.bestVolumeSet.volume) {
            agg.bestVolumeSet = { weight, reps, volume: Math.round(vol), date: w.created_at }
          }
        }
      }
    }

    for (const [exId, sess] of sessionMax) {
      if (!exMap.has(exId)) {
        exMap.set(exId, { id: exId, name: sess.name, pr: 0, totalVolume: 0, history: [] })
      }
      const agg = exMap.get(exId)!
      agg.pr = Math.max(agg.pr, sess.weight)
      agg.totalVolume += sess.volume
      agg.history.push({ date: w.created_at, weight: sess.weight, volume: sess.volume })
    }
  }

  const totalKgLifted = [...exMap.values()].reduce((s, e) => s + e.totalVolume, 0)

  const exercises = [...exMap.values()]
    .filter(e => e.history.length > 0)
    .sort((a, b) => b.history.length - a.history.length)
    .map(e => ({
      ...e,
      trend: computeTrend(e.history.map(h => h.weight)),
      sessionCount: e.history.length,
      targetReps: settingsMap[e.id] ?? null,
    }))

  // ── muscle split ─────────────────────────────────────────
  const muscleSplit: Record<string, { sets: number; reps: number; volume: number }> = {}
  for (const w of workouts) {
    for (const log of (w.strength_logs ?? [])) {
      for (const set of (log.strength_sets ?? [])) {
        const muscle = (set.exercises as any)?.muscle_group
        if (!muscle) continue
        if (!muscleSplit[muscle]) muscleSplit[muscle] = { sets: 0, reps: 0, volume: 0 }
        muscleSplit[muscle].sets   += 1
        muscleSplit[muscle].reps   += Number(set.actual_reps)   || 0
        muscleSplit[muscle].volume += (Number(set.actual_weight) || 0) * (Number(set.actual_reps) || 0)
      }
    }
  }

  // ── cardio ───────────────────────────────────────────────
  const allRuns = workouts.flatMap(w =>
    (w.running_logs ?? []).map(r => ({ ...r, date: w.created_at }))
  )
  const totalKm = allRuns.reduce((s, r) => s + (r.distance_km ?? 0), 0)
  const avgSpeed = allRuns.length
    ? allRuns.reduce((s, r) => s + (r.average_speed ?? 0), 0) / allRuns.length
    : 0
  const recentRuns = allRuns.slice(-10).reverse().map(r => ({
    date: r.date,
    km: r.distance_km ?? 0,
    speed: r.average_speed ?? 0,
    type: `${r.environment ?? ''} ${r.session_type ?? ''}`.trim(),
  }))

  return (
    <StatsClient
      totalWorkouts={totalWorkouts}
      streak={streak}
      totalKgLifted={Math.round(totalKgLifted)}
      totalKm={Math.round(totalKm * 10) / 10}
      weeklyBuckets={weeklyBuckets}
      exercises={exercises}
      avgSpeed={Math.round(avgSpeed * 10) / 10}
      recentRuns={recentRuns}
      cardioSessionCount={allRuns.length}
      muscleSplitSets={Object.fromEntries(Object.entries(muscleSplit).map(([k, v]) => [k, v.sets]))}
      muscleSplitReps={Object.fromEntries(Object.entries(muscleSplit).map(([k, v]) => [k, v.reps]))}
      muscleSplitVol={Object.fromEntries(Object.entries(muscleSplit).map(([k, v]) => [k, v.volume]))}
    />
  )
}

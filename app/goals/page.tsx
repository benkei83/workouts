import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import GoalsPageClient from '@/components/GoalsPageClient'
import { estimateOneRM } from '@/lib/stats/compute'
import type { ComputedGoal, AvailableExercise } from '@/components/GoalsPageClient'

export default function GoalsPage() {
  return (
    <main className="max-w-md mx-auto min-h-screen bg-gray-50 pb-24">
      <header className="bg-white px-4 py-4 border-b border-gray-200 sticky top-0 z-10 shadow-sm flex items-center gap-3">
        <Link
          href="/"
          className="w-10 h-10 flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors font-bold text-gray-500"
        >
          ←
        </Link>
        <h1 className="text-xl font-extrabold text-gray-900 tracking-tight">Goals</h1>
      </header>

      <div className="p-4">
        <Suspense
          fallback={
            <div className="space-y-4 animate-pulse">
              <div className="h-12 bg-gray-200 rounded-2xl" />
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded-2xl" />
              ))}
            </div>
          }
        >
          <GoalsLoader />
        </Suspense>
      </div>
    </main>
  )
}

// ── Pure computation helpers ──────────────────────────────────────────────────

/** Linear regression: returns slope in units/day, or null if not enough data. */
function regressionSlope(points: { date: string; value: number }[]): number | null {
  const n = points.length
  if (n < 3) return null
  const base = new Date(points[0].date).getTime()
  const xs = points.map(p => (new Date(p.date).getTime() - base) / 86400000)
  const ys = points.map(p => p.value)
  const sx  = xs.reduce((a, b) => a + b, 0)
  const sy  = ys.reduce((a, b) => a + b, 0)
  const sxy = xs.reduce((acc, x, i) => acc + x * ys[i], 0)
  const sx2 = xs.reduce((acc, x) => acc + x * x, 0)
  const d   = n * sx2 - sx * sx
  return d === 0 ? null : (n * sxy - sx * sy) / d
}

function isoDatePlusDays(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toLocaleDateString('en-CA')
}

function calcEta(weeklyRate: number | null, current: number, target: number): string | null {
  if (!weeklyRate || weeklyRate <= 0) return null
  const weeks = (target - current) / weeklyRate
  if (weeks <= 0 || weeks > 520) return null
  return isoDatePlusDays(Math.round(weeks * 7))
}

function calcProgress(current: number, starting: number | null, target: number): number {
  const s = starting ?? current
  if (s === target) return current >= target ? 100 : 0
  return Math.min(100, Math.max(0, ((current - s) / (target - s)) * 100))
}

// ── Data loader ───────────────────────────────────────────────────────────────

async function GoalsLoader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/sign-in')

  const cutoff60 = isoDatePlusDays(-60)

  const [
    { data: rawGoals },
    { data: recentWorkouts },
    { data: bwLogs },
    { data: exerciseSettings },
  ] = await Promise.all([
    supabase
      .from('user_goals')
      .select('id, goal_type, target_value, target_reps, starting_value, label, deadline, achieved_at, created_at, exercise_id, exercises(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false }),

    supabase
      .from('workouts')
      .select(`
        created_at,
        strength_logs (
          strength_sets (
            exercise_id,
            actual_weight,
            actual_reps,
            exercises ( id, name )
          )
        )
      `)
      .eq('user_id', user.id)
      .not('total_duration_mins', 'is', null)
      .order('created_at', { ascending: false })
      .limit(200),

    supabase
      .from('body_weight_logs')
      .select('logged_at, weight_kg')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: true })
      .limit(365),

    supabase
      .from('user_exercise_settings')
      .select('exercise_id, exercises(id, name)')
      .eq('user_id', user.id)
      .eq('is_active', true),
  ])

  // ── Build per-exercise per-session bests (asc by date) ────────────────────

  const exSessionsMap = new Map<string, { date: string; max_weight: number; best_1rm: number }[]>()

  // For weight_reps goals: Map<exerciseId, Map<weight_kg, maxReps>>
  // Tracks the best reps ever achieved at each weight across all sessions.
  const exBestRepsMap = new Map<string, Map<number, number>>()

  for (const workout of recentWorkouts || []) {
    const dateStr = (workout.created_at as string).slice(0, 10)
    const daily: Record<string, { max_weight: number; best_1rm: number }> = {}

    for (const log of (workout.strength_logs as any[]) || []) {
      for (const set of (log.strength_sets as any[]) || []) {
        const exId = set.exercise_id as string
        if (!exId) continue
        const w = Number(set.actual_weight) || 0
        const r = Number(set.actual_reps) || 0
        if (w <= 0 || r <= 0) continue
        const orm = estimateOneRM(w, r)

        // Session bests
        if (!daily[exId]) daily[exId] = { max_weight: 0, best_1rm: 0 }
        if (w > daily[exId].max_weight)   daily[exId].max_weight = w
        if (orm > daily[exId].best_1rm)   daily[exId].best_1rm   = orm

        // All-time best reps at each weight (for weight_reps achievement check)
        if (!exBestRepsMap.has(exId)) exBestRepsMap.set(exId, new Map())
        const repsAtWeight = exBestRepsMap.get(exId)!
        const prev = repsAtWeight.get(w) ?? 0
        if (r > prev) repsAtWeight.set(w, r)
      }
    }

    for (const [exId, vals] of Object.entries(daily)) {
      if (!exSessionsMap.has(exId)) exSessionsMap.set(exId, [])
      const arr = exSessionsMap.get(exId)!
      const hit = arr.find(s => s.date === dateStr)
      if (hit) {
        hit.max_weight = Math.max(hit.max_weight, vals.max_weight)
        hit.best_1rm   = Math.max(hit.best_1rm,   vals.best_1rm)
      } else {
        arr.push({ date: dateStr, ...vals })
      }
    }
  }
  for (const arr of exSessionsMap.values()) {
    arr.sort((a, b) => a.date.localeCompare(b.date))
  }

  // ── Body weight: sorted asc, current value ─────────────────────────────────

  const bwHistory = (bwLogs || []).map(l => ({
    date:  String(l.logged_at),
    value: Number(l.weight_kg),
  }))
  const currentBW = bwHistory.length > 0 ? bwHistory[bwHistory.length - 1].value : null

  // ── Compute goal stats ─────────────────────────────────────────────────────

  const computedGoals: ComputedGoal[] = (rawGoals || []).map(goal => {
    const gt       = goal.goal_type as ComputedGoal['goal_type']
    const exId     = goal.exercise_id as string | null
    const exName   = (goal.exercises as any)?.name as string | null
    const target   = Number(goal.target_value)
    const tReps    = goal.target_reps != null ? Number(goal.target_reps) : null
    const starting = goal.starting_value != null ? Number(goal.starting_value) : null

    let current_value: number | null = null
    let weekly_rate:   number | null = null
    let eta_date:      string | null = null
    let progress_pct               = 0

    const sessions = exId ? (exSessionsMap.get(exId) || []) : []
    const current_1rm = sessions.length > 0
      ? Math.max(...sessions.map(s => s.best_1rm))
      : null

    if (gt === 'body_weight') {
      current_value = currentBW
      const recentBW = bwHistory.filter(p => p.date >= cutoff60)
      const s = regressionSlope(recentBW)
      weekly_rate = s != null ? parseFloat((s * 7).toFixed(3)) : null
      if (current_value !== null) {
        eta_date     = calcEta(weekly_rate, current_value, target)
        progress_pct = calcProgress(current_value, starting, target)
      }

    } else if (gt === 'max_weight' && sessions.length > 0) {
      current_value = Math.max(...sessions.map(s => s.max_weight))
      const s = regressionSlope(sessions.filter(p => p.date >= cutoff60).map(p => ({ date: p.date, value: p.max_weight })))
      weekly_rate  = s != null ? parseFloat((s * 7).toFixed(2)) : null
      eta_date     = calcEta(weekly_rate, current_value, target)
      progress_pct = calcProgress(current_value, starting, target)

    } else if (gt === '1rm' && sessions.length > 0) {
      current_value = Math.max(...sessions.map(s => s.best_1rm))
      const s = regressionSlope(sessions.filter(p => p.date >= cutoff60).map(p => ({ date: p.date, value: p.best_1rm })))
      weekly_rate  = s != null ? parseFloat((s * 7).toFixed(2)) : null
      eta_date     = calcEta(weekly_rate, current_value, target)
      progress_pct = calcProgress(current_value, starting, target)

    } else if (gt === 'bw_multiple' && sessions.length > 0 && currentBW) {
      const best1rm = Math.max(...sessions.map(s => s.best_1rm))
      current_value = parseFloat((best1rm / currentBW).toFixed(3))

      const target1rm  = target * currentBW
      const s          = regressionSlope(sessions.filter(p => p.date >= cutoff60).map(p => ({ date: p.date, value: p.best_1rm })))
      const weeklyOrm  = s != null ? s * 7 : null
      weekly_rate      = weeklyOrm != null ? parseFloat((weeklyOrm / currentBW).toFixed(4)) : null
      eta_date         = calcEta(weeklyOrm, best1rm, target1rm)
      progress_pct     = calcProgress(current_value, starting, target)

    } else if (gt === 'weight_reps' && sessions.length > 0 && tReps !== null) {
      const impliedTargetOrm = estimateOneRM(target, tReps)
      const bestOrm          = Math.max(...sessions.map(s => s.best_1rm))
      const repsMap          = exBestRepsMap.get(exId ?? '') ?? new Map<number, number>()

      // current_value: max reps achieved at or above target weight (for display)
      const atOrAbove = Array.from(repsMap.entries()).filter(([w]) => w >= target)
      current_value   = atOrAbove.length > 0 ? Math.max(...atOrAbove.map(([, r]) => r)) : 0

      // Progress: best weight at which the user achieved >= tReps reps, divided by target weight.
      // Using 1RM here caused 100% progress even when the goal wasn't hit — e.g. 87 kg × 12
      // gives a higher estimated 1RM than estimateOneRM(97, 5), so it showed 100% despite
      // never doing 5 reps at 97 kg.
      const bestWeightAtTargetReps = Array.from(repsMap.entries())
        .filter(([, r]) => r >= tReps)
        .reduce((max, [w]) => Math.max(max, w), 0)
      progress_pct = bestWeightAtTargetReps > 0
        ? Math.min(100, Math.round((bestWeightAtTargetReps / target) * 100))
        : 0

      // Rate + ETA still use 1RM trend (best available continuous signal)
      const s      = regressionSlope(sessions.filter(p => p.date >= cutoff60).map(p => ({ date: p.date, value: p.best_1rm })))
      weekly_rate  = s != null ? parseFloat((s * 7).toFixed(2)) : null
      eta_date     = calcEta(weekly_rate, bestOrm, impliedTargetOrm)
    }

    return {
      id:             goal.id as string,
      goal_type:      gt,
      target_value:   target,
      target_reps:    tReps,
      starting_value: starting,
      label:          goal.label as string | null,
      deadline:       goal.deadline as string | null,
      achieved_at:    goal.achieved_at as string | null,
      created_at:     goal.created_at as string,
      exercise_id:    exId,
      exercise_name:  exName,
      current_value,
      current_1rm,
      weekly_rate,
      eta_date,
      progress_pct,
    }
  })

  // ── Auto-achieve goals that just crossed 100% ─────────────────────────────
  // weight_reps: must have an actual logged set with weight >= target AND reps >= target_reps.
  // All other types: use 1RM-based progress_pct >= 100.

  const newlyAchievedIds = computedGoals
    .filter(g => {
      if (g.achieved_at) return false
      if (g.goal_type === 'weight_reps' && g.target_reps !== null && g.exercise_id) {
        const repsMap   = exBestRepsMap.get(g.exercise_id) ?? new Map<number, number>()
        const achieved  = Array.from(repsMap.entries()).some(
          ([w, r]) => w >= g.target_value && r >= g.target_reps!
        )
        return achieved
      }
      return g.progress_pct >= 100
    })
    .map(g => g.id)

  if (newlyAchievedIds.length > 0) {
    const now = new Date().toISOString()
    await supabase
      .from('user_goals')
      .update({ achieved_at: now })
      .in('id', newlyAchievedIds)
    for (const g of computedGoals) {
      if (newlyAchievedIds.includes(g.id)) g.achieved_at = now
    }
  }

  // ── Available exercises for the add-goal form ─────────────────────────────
  // Sources (in priority order, deduplicated by id):
  //   1. user_exercise_settings rows (have configured settings)
  //   2. workout history (logged at least once, even without settings)
  //   3. existing goals (exercise may have been deleted from settings but goal persists)

  const seenIds = new Set<string>()
  const availableExercises: AvailableExercise[] = []

  for (const row of exerciseSettings || []) {
    const ex = (row as any).exercises
    if (!ex?.id || seenIds.has(ex.id)) continue
    seenIds.add(ex.id)
    availableExercises.push({ id: ex.id, name: ex.name })
  }

  // Add exercises seen in workout history (covers users who log workouts
  // without ever opening the exercise settings panel)
  for (const workout of recentWorkouts || []) {
    for (const log of (workout.strength_logs as any[]) || []) {
      for (const s of (log.strength_sets as any[]) || []) {
        const ex = s.exercises
        if (!ex?.id || seenIds.has(ex.id)) continue
        seenIds.add(ex.id)
        availableExercises.push({ id: ex.id, name: ex.name })
      }
    }
  }

  for (const g of computedGoals) {
    if (g.exercise_id && g.exercise_name && !seenIds.has(g.exercise_id)) {
      seenIds.add(g.exercise_id)
      availableExercises.push({ id: g.exercise_id, name: g.exercise_name })
    }
  }
  availableExercises.sort((a, b) => a.name.localeCompare(b.name))

  return (
    <GoalsPageClient
      goals={computedGoals}
      availableExercises={availableExercises}
      currentBodyWeight={currentBW}
      newlyAchievedIds={newlyAchievedIds}
    />
  )
}

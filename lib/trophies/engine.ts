/**
 * lib/trophies/engine.ts
 *
 * The main trophy evaluation pipeline.
 *
 *   runTrophyEngine(supabase, userId, workoutId) → TrophyUnlock[]
 *
 * Call this immediately after finishWorkoutWithFeel sets total_duration_mins,
 * so the just-finished workout is included in all aggregate queries.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { EvalContext, TrophyUnlock } from './types'
import { TROPHY_REGISTRY } from './registry'
import { EVALUATORS } from './evaluators'

// ─── ISO week helpers ─────────────────────────────────────────────────────────

/** Returns the Monday of the ISO week for a given date. */
function isoWeekMonday(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4) // Jan 4 is always in ISO week 1
  const dow = jan4.getDay() || 7     // Mon=1 … Sun=7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dow + 1 + (week - 1) * 7)
  return monday
}

/** "YYYY-WW" string using ISO 8601 week numbering. */
function isoWeekKey(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7)) // move to nearest Thursday
  const year = d.getFullYear()
  const jan4 = new Date(year, 0, 4)
  const week1Mon = new Date(jan4)
  week1Mon.setDate(jan4.getDate() - ((jan4.getDay() + 6) % 7))
  const weekNo = 1 + Math.floor((d.getTime() - week1Mon.getTime()) / (7 * 86_400_000))
  return `${year}-${String(weekNo).padStart(2, '0')}`
}

/** Whole-week difference between two ISO week keys. */
function weeksBetween(
  a: { year: number; week: number },
  b: { year: number; week: number }
): number {
  const mA = isoWeekMonday(a.year, a.week)
  const mB = isoWeekMonday(b.year, b.week)
  return Math.round((mB.getTime() - mA.getTime()) / (7 * 86_400_000))
}

function parseWeekKey(key: string) {
  const [y, w] = key.split('-').map(Number)
  return { year: y, week: w }
}

// ─── EvalContext builder ──────────────────────────────────────────────────────

export async function buildEvalContext(
  supabase: SupabaseClient<any>,
  userId: string,
  workoutId: string,
): Promise<EvalContext> {

  // ── 1. Completed workouts ──────────────────────────────────────────────────
  const { data: allWorkouts = [] } = await supabase
    .from('workouts')
    .select('id, created_at, total_duration_mins')
    .eq('user_id', userId)
    .not('total_duration_mins', 'is', null)
    .order('created_at', { ascending: true })

  const ws: any[] = allWorkouts ?? []
  const workoutIds = ws.map((w) => w.id)

  // ── 2. Strength logs + sets ────────────────────────────────────────────────
  let strengthLogs: any[] = []
  if (workoutIds.length > 0) {
    const { data } = await supabase
      .from('strength_logs')
      .select('id, workout_id, superset_id, strength_sets(exercise_id, actual_weight, actual_reps, rpe, is_pr)')
      .in('workout_id', workoutIds)
    strengthLogs = data ?? []
  }

  // ── 3. Running logs ────────────────────────────────────────────────────────
  let runningLogs: any[] = []
  if (workoutIds.length > 0) {
    const { data } = await supabase
      .from('running_logs')
      .select('workout_id, distance_km, average_speed, session_type')
      .in('workout_id', workoutIds)
    runningLogs = data ?? []
  }

  // ── 4. Settings history (for retroactive progression counts) ───────────────
  const { data: settingsHistory = [] } = await supabase
    .from('user_exercise_settings')
    .select('exercise_id, current_weight, protocol, created_at')
    .eq('user_id', userId)
    .order('exercise_id')
    .order('created_at', { ascending: true })

  // ── 5. Trophy events (moment-based, going forward) ─────────────────────────
  let trophyEvents: any[] = []
  try {
    const { data } = await supabase
      .from('user_trophy_events')
      .select('event_type, value')
      .eq('user_id', userId)
    trophyEvents = data ?? []
  } catch {
    // Table may not exist yet; silently continue with empty list
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPUTE WORKOUT-LEVEL STATS
  // ══════════════════════════════════════════════════════════════════════════

  const totalWorkouts     = ws.length
  const totalWorkoutMins  = ws.reduce((s, w) => s + (Number(w.total_duration_mins) || 0), 0)
  const longestSessionMins = ws.reduce((m, w) => Math.max(m, Number(w.total_duration_mins) || 0), 0)

  // Max gap between consecutive workout dates
  let maxWorkoutGapDays = 0
  for (let i = 1; i < ws.length; i++) {
    const gap = Math.floor(
      (new Date(ws[i].created_at).getTime() - new Date(ws[i - 1].created_at).getTime()) / 86_400_000
    )
    if (gap > maxWorkoutGapDays) maxWorkoutGapDays = gap
  }

  // Longest consecutive-day streak
  const daySet = new Set(ws.map((w) => w.created_at.slice(0, 10)))
  const sortedDays = [...daySet].sort()
  let longestEverStreakDays = sortedDays.length > 0 ? 1 : 0
  let currentStreakDays = longestEverStreakDays
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1]).getTime()
    const curr = new Date(sortedDays[i]).getTime()
    if (Math.round((curr - prev) / 86_400_000) === 1) {
      currentStreakDays++
      if (currentStreakDays > longestEverStreakDays) longestEverStreakDays = currentStreakDays
    } else {
      currentStreakDays = 1
    }
  }

  // Consecutive weeks with 3+ workouts
  const weekCounts = new Map<string, number>()
  for (const w of ws) {
    const key = isoWeekKey(new Date(w.created_at))
    weekCounts.set(key, (weekCounts.get(key) ?? 0) + 1)
  }
  const qualifying = [...weekCounts.entries()]
    .filter(([, cnt]) => cnt >= 3)
    .map(([k]) => k)
    .sort()

  let consecutiveWeeks3x = qualifying.length > 0 ? 1 : 0
  let currentWeekRun = consecutiveWeeks3x
  for (let i = 1; i < qualifying.length; i++) {
    const diff = weeksBetween(parseWeekKey(qualifying[i - 1]), parseWeekKey(qualifying[i]))
    if (diff === 1) {
      currentWeekRun++
      if (currentWeekRun > consecutiveWeeks3x) consecutiveWeeks3x = currentWeekRun
    } else {
      currentWeekRun = 1
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPUTE STRENGTH STATS
  // ══════════════════════════════════════════════════════════════════════════

  // Per-workout accumulators
  const workoutTonnage   = new Map<string, number>()      // wid → kg
  const workoutExSets    = new Map<string, Map<string, { weight: number; reps: number }[]>>()
  const workoutHasSuper  = new Set<string>()              // wids with a superset log
  const workoutsWithStr  = new Set<string>()              // wids with any strength log
  const exerciseWorkouts = new Map<string, Set<string>>() // exId → set of wids

  let lifetimeTonnage = 0
  let trueOnermSets   = 0
  let highRpeSets     = 0
  let totalPrCount    = 0
  const exerciseSeen  = new Set<string>()
  let hasLoggedStrength  = false
  let hasLoggedSuperset  = false

  for (const log of strengthLogs) {
    const wid = log.workout_id as string
    workoutsWithStr.add(wid)
    if (log.superset_id) {
      workoutHasSuper.add(wid)
      hasLoggedSuperset = true
    }

    for (const s of (log.strength_sets ?? []) as any[]) {
      const exId: string = s.exercise_id
      if (!exId) continue
      hasLoggedStrength = true

      const w   = Number(s.actual_weight) || 0
      const r   = Number(s.actual_reps)   || 0
      const rpe = s.rpe != null ? Number(s.rpe) : null
      const cheated = rpe != null && rpe > 10

      exerciseSeen.add(exId)

      if (!exerciseWorkouts.has(exId)) exerciseWorkouts.set(exId, new Set())
      exerciseWorkouts.get(exId)!.add(wid)

      if (!cheated && w > 0 && r > 0) {
        const vol = w * r
        lifetimeTonnage += vol
        workoutTonnage.set(wid, (workoutTonnage.get(wid) ?? 0) + vol)

        if (r === 1)                                 trueOnermSets++
        if (rpe !== null && rpe >= 9 && rpe <= 10)  highRpeSets++

        // Accumulate sets for 5×5 detection
        if (!workoutExSets.has(wid)) workoutExSets.set(wid, new Map())
        const exMap = workoutExSets.get(wid)!
        if (!exMap.has(exId)) exMap.set(exId, [])
        exMap.get(exId)!.push({ weight: w, reps: r })
      }

      if (s.is_pr) totalPrCount++
    }
  }

  const exerciseVarietyCount   = exerciseSeen.size
  const maxSessionTonnage      = workoutTonnage.size > 0 ? Math.max(...workoutTonnage.values()) : 0
  const maxExerciseSessionCount = exerciseWorkouts.size > 0
    ? Math.max(...[...exerciseWorkouts.values()].map((s) => s.size))
    : 0

  // Best 5×5 weight: max weight with 5+ clean sets at reps ≥ 5 in the same workout
  let bestFiveByFiveWeight = 0
  for (const exMap of workoutExSets.values()) {
    for (const sets of exMap.values()) {
      const byWeight = new Map<number, number>()
      for (const { weight, reps } of sets) {
        if (reps >= 5) byWeight.set(weight, (byWeight.get(weight) ?? 0) + 1)
      }
      for (const [weight, count] of byWeight) {
        if (count >= 5 && weight > bestFiveByFiveWeight) bestFiveByFiveWeight = weight
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COMPUTE CARDIO STATS
  // ══════════════════════════════════════════════════════════════════════════

  const rl = runningLogs
  const totalKmRun      = rl.reduce((s, r) => s + (Number(r.distance_km)    || 0), 0)
  const bestCardioSpeed = rl.reduce((m, r) => Math.max(m, Number(r.average_speed) || 0), 0)
  const hasLoggedCardio = rl.length > 0

  // maxSpeedImprovementPct — best % improvement over previous best, per session_type
  const workoutDateMap = new Map(ws.map((w) => [w.id, w.created_at as string]))
  const runningWithDate = rl
    .filter((r) => Number(r.average_speed) > 0)
    .map((r) => ({
      speed:       Number(r.average_speed),
      sessionType: (r.session_type as string) || 'default',
      date:        workoutDateMap.get(r.workout_id) ?? '1970-01-01T00:00:00Z',
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  let maxSpeedImprovementPct = 0
  const bestSpeedByType = new Map<string, number>()
  for (const { speed, sessionType } of runningWithDate) {
    const prev = bestSpeedByType.get(sessionType)
    if (prev !== undefined && prev > 0 && speed > prev) {
      const pct = ((speed - prev) / prev) * 100
      if (pct > maxSpeedImprovementPct) maxSpeedImprovementPct = pct
    }
    bestSpeedByType.set(sessionType, Math.max(bestSpeedByType.get(sessionType) ?? 0, speed))
  }

  // ══════════════════════════════════════════════════════════════════════════
  // ALL THREE IN ONE SESSION
  // ══════════════════════════════════════════════════════════════════════════

  const workoutsWithCardio = new Set(rl.map((r) => r.workout_id as string))
  let allThreeInOneSession = false
  for (const wid of workoutsWithStr) {
    if (workoutsWithCardio.has(wid) && workoutHasSuper.has(wid)) {
      allThreeInOneSession = true
      break
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // PROGRESSION COUNTS FROM SETTINGS HISTORY (retroactive)
  // ══════════════════════════════════════════════════════════════════════════

  // Group by exercise_id (already sorted by created_at in the query)
  const settingsByEx = new Map<string, any[]>()
  for (const row of settingsHistory ?? []) {
    if (!settingsByEx.has(row.exercise_id)) settingsByEx.set(row.exercise_id, [])
    settingsByEx.get(row.exercise_id)!.push(row)
  }

  let autoProgressionCount   = 0
  let doubleProgressionCount = 0

  for (const rows of settingsByEx.values()) {
    for (let i = 1; i < rows.length; i++) {
      const prevW = Number(rows[i - 1].current_weight) || 0
      const currW = Number(rows[i].current_weight)     || 0
      if (currW > prevW) {
        const proto = rows[i].protocol as string
        if (proto === 'linear') autoProgressionCount++
        else if (proto === 'double') doubleProgressionCount++
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════
  // EVENT-SOURCED MOMENT-BASED STATS
  // ══════════════════════════════════════════════════════════════════════════

  const evByType = new Map<string, any[]>()
  for (const ev of trophyEvents) {
    if (!evByType.has(ev.event_type)) evByType.set(ev.event_type, [])
    evByType.get(ev.event_type)!.push(ev)
  }

  const perfectSessionCount  = (evByType.get('perfect_session')  ?? []).length
  const deloadRecoveryCount  = (evByType.get('deload_recovery')  ?? []).length
  const perfectSupersetCount = (evByType.get('perfect_superset') ?? []).length

  const maxFailureStreakBroken = (evByType.get('failure_streak_broken') ?? []).reduce(
    (m, ev) => Math.max(m, Number(ev.value) || 0),
    0,
  )

  return {
    userId,
    workoutId,
    totalWorkouts,
    totalWorkoutMins,
    longestSessionMins,
    maxWorkoutGapDays,
    longestEverStreakDays,
    consecutiveWeeks3x,
    lifetimeTonnage,
    maxSessionTonnage,
    trueOnermSets,
    highRpeSets,
    totalPrCount,
    bestFiveByFiveWeight,
    exerciseVarietyCount,
    maxExerciseSessionCount,
    totalKmRun,
    bestCardioSpeed,
    maxSpeedImprovementPct,
    hasLoggedCardio,
    hasLoggedStrength,
    hasLoggedSuperset,
    allThreeInOneSession,
    autoProgressionCount,
    doubleProgressionCount,
    perfectSessionCount,
    maxFailureStreakBroken,
    deloadRecoveryCount,
    perfectSupersetCount,
  }
}

// ─── Main engine entry point ──────────────────────────────────────────────────

/**
 * Evaluate all trophies for a user after finishing a workout.
 * Returns only newly-unlocked trophies (the highest new tier per trophy).
 * Persists new rows to `user_trophies`.
 */
export async function runTrophyEngine(
  supabase: SupabaseClient<any>,
  userId: string,
  workoutId: string,
): Promise<TrophyUnlock[]> {
  // Fetch already-earned trophies first (fast query)
  let earned: { trophy_id: string; tier: number }[] = []
  try {
    const { data } = await supabase
      .from('user_trophies')
      .select('trophy_id, tier')
      .eq('user_id', userId)
    earned = data ?? []
  } catch {
    // Table may not exist yet — treat as no trophies earned
  }

  const earnedSet = new Set(earned.map((e) => `${e.trophy_id}:${e.tier}`))

  // Build full stat snapshot
  const ctx = await buildEvalContext(supabase, userId, workoutId)

  // Run every evaluator and collect new unlocks (all tiers, additive)
  const allNewUnlocks: TrophyUnlock[] = []
  const toInsert: {
    user_id: string
    trophy_id: string
    tier: number
    unlocked_at: string
    context: Record<string, unknown>
  }[] = []

  const now = new Date().toISOString()

  for (const trophy of TROPHY_REGISTRY) {
    const fn = EVALUATORS[trophy.evaluator]
    if (!fn) continue

    const score = fn(ctx)

    for (const tier of trophy.tiers) {
      if (score >= tier.threshold) {
        const key = `${trophy.id}:${tier.level}`
        if (!earnedSet.has(key)) {
          earnedSet.add(key) // guard against duplicates within this loop
          const ctx2: Record<string, unknown> = { score, threshold: tier.threshold }
          allNewUnlocks.push({
            trophy,
            tier: tier.level,
            tierLabel: tier.label,
            tierEmoji: tier.emoji,
            context: ctx2,
          })
          toInsert.push({
            user_id:     userId,
            trophy_id:   trophy.id,
            tier:        tier.level,
            unlocked_at: now,
            context:     ctx2,
          })
        }
      }
    }
  }

  // Persist (ignore conflicts — belt & suspenders safety)
  if (toInsert.length > 0) {
    try {
      await supabase.from('user_trophies').upsert(toInsert, {
        onConflict: 'user_id,trophy_id,tier',
        ignoreDuplicates: true,
      })
    } catch {
      // Table may not exist yet — swallow so the workout finish still succeeds
    }
  }

  // Deduplicate: keep only the HIGHEST newly-unlocked tier per trophy
  // (avoids showing Bronze → Silver → Gold all at once for the same trophy)
  const topByTrophy = new Map<string, TrophyUnlock>()
  for (const unlock of allNewUnlocks) {
    const prev = topByTrophy.get(unlock.trophy.id)
    if (!prev || unlock.tier > prev.tier) topByTrophy.set(unlock.trophy.id, unlock)
  }

  return [...topByTrophy.values()]
}

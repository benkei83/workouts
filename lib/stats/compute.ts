// ──────────────────────────────────────────────────────────────────────────────
// lib/stats/compute.ts  —  Pure, framework-free stat computation functions.
// All functions accept plain data objects and return typed results.
// ──────────────────────────────────────────────────────────────────────────────

// ── 1RM ──────────────────────────────────────────────────────────────────────

/** Epley formula: w × (1 + reps / 30). Returns weight if reps === 1. */
export function estimateOneRM(weight: number, reps: number): number {
  if (reps <= 0 || weight <= 0) return 0
  if (reps === 1) return weight
  return Math.round(weight * (1 + reps / 30))
}

// ── Best Set ──────────────────────────────────────────────────────────────────

export type BestSetMethod = '1rm' | 'volume'

/**
 * Determine which "best set" method to use for a given exercise.
 * target_reps < 10  → 1RM-based
 * target_reps >= 10 → volume-based (weight × reps)
 * null              → default to 1RM, flag hasNoSettings = true
 */
export function getBestSetMethod(targetReps: number | null | undefined): {
  method: BestSetMethod
  hasNoSettings: boolean
} {
  if (targetReps == null) return { method: '1rm', hasNoSettings: true }
  return { method: targetReps >= 10 ? 'volume' : '1rm', hasNoSettings: false }
}

/** The actual individual set that constitutes the "best" for an exercise. */
export type ExerciseBestSet = {
  weight: number
  reps: number
  estimatedOneRM: number    // Epley (equals weight when reps === 1)
  singleSetVolume: number   // weight × reps
  date: string              // ISO timestamp of the workout
  isActual1rm: boolean      // true when reps === 1 (no estimation involved)
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type RawStrengthSet = {
  exercise_id: string
  actual_weight: number | null
  actual_reps: number | null
  rpe?: number | null           // optional; >10 means the set was assisted/cheated
  exercises?: { name: string } | null
}

/** True when the set should be excluded from records and progression. */
export function isCheatedSet(rpe: number | null | undefined): boolean {
  return rpe != null && Number(rpe) > 10
}

export type RawRunningLog = {
  distance_km: number | null
  duration_seconds: number | null
  average_speed: number | null
}

export type ExerciseMeta = {
  id: string
  name: string
  muscle_group?: string | null
}

// ── Workout Stats ─────────────────────────────────────────────────────────────

export type ExerciseSessionSummary = {
  exerciseId: string
  name: string
  volume: number      // kg × reps
  sets: number
  maxWeight: number
  avgReps: number
  muscleGroup: string | null
}

export type WorkoutStats = {
  totalVolume: number           // kg × reps
  totalSets: number
  avgWeightPerSet: number
  durationMins: number
  setsPerHour: number
  topExercises: ExerciseSessionSummary[]
  muscleGroupVolume: Record<string, number>
  muscleGroupSets:   Record<string, number>
  muscleGroupReps:   Record<string, number>
  totalKmRun: number
  bestOneRM: { exerciseId: string; name: string; oneRM: number } | null
}

export function computeWorkoutStats(input: {
  strengthLogs: { strength_sets: RawStrengthSet[] }[]
  runningLogs: RawRunningLog[]
  durationMins: number
  exercises: ExerciseMeta[]
}): WorkoutStats {
  const { strengthLogs, runningLogs, durationMins, exercises } = input

  // Group sets by exercise
  type ExBucket = {
    id: string; name: string; muscleGroup: string | null
    sets: { weight: number; reps: number }[]
  }
  const exMap = new Map<string, ExBucket>()

  for (const log of strengthLogs) {
    for (const s of log.strength_sets || []) {
      if (!s.exercise_id) continue
      const w = Number(s.actual_weight) || 0
      const r = Number(s.actual_reps) || 0
      if (!exMap.has(s.exercise_id)) {
        const meta = exercises.find(e => e.id === s.exercise_id)
        exMap.set(s.exercise_id, {
          id: s.exercise_id,
          name: meta?.name || (s.exercises as any)?.name || 'Unknown',
          muscleGroup: meta?.muscle_group ?? null,
          sets: [],
        })
      }
      exMap.get(s.exercise_id)!.sets.push({ weight: w, reps: r })
    }
  }

  let totalVolume = 0
  let totalSets = 0
  let totalWeightSum = 0
  const muscleGroupVolume: Record<string, number> = {}
  const muscleGroupSets:   Record<string, number> = {}
  const muscleGroupReps:   Record<string, number> = {}
  const topExercises: ExerciseSessionSummary[] = []
  let bestOneRM: WorkoutStats['bestOneRM'] = null

  for (const [exId, ex] of exMap) {
    const vol = ex.sets.reduce((s, set) => s + set.weight * set.reps, 0)
    const maxW = Math.max(0, ...ex.sets.map(s => s.weight))
    const avgReps = ex.sets.length
      ? ex.sets.reduce((s, set) => s + set.reps, 0) / ex.sets.length
      : 0

    totalVolume += vol
    totalSets += ex.sets.length
    totalWeightSum += ex.sets.reduce((s, set) => s + set.weight, 0)

    if (ex.muscleGroup) {
      const mg = ex.muscleGroup
      const totalReps = ex.sets.reduce((s, set) => s + set.reps, 0)
      muscleGroupVolume[mg] = (muscleGroupVolume[mg] || 0) + vol
      muscleGroupSets[mg]   = (muscleGroupSets[mg]   || 0) + ex.sets.length
      muscleGroupReps[mg]   = (muscleGroupReps[mg]   || 0) + totalReps
    }

    // Best 1RM across all sets in this workout
    for (const set of ex.sets) {
      const orm = estimateOneRM(set.weight, set.reps)
      if (orm > 0 && (!bestOneRM || orm > bestOneRM.oneRM)) {
        bestOneRM = { exerciseId: exId, name: ex.name, oneRM: orm }
      }
    }

    topExercises.push({
      exerciseId: exId,
      name: ex.name,
      volume: Math.round(vol),
      sets: ex.sets.length,
      maxWeight: maxW,
      avgReps: Math.round(avgReps * 10) / 10,
      muscleGroup: ex.muscleGroup,
    })
  }

  topExercises.sort((a, b) => b.volume - a.volume)

  const setsPerHour = durationMins > 0
    ? Math.round((totalSets / durationMins) * 60 * 10) / 10
    : 0

  const totalKmRun = runningLogs.reduce((s, r) => s + (Number(r.distance_km) || 0), 0)

  return {
    totalVolume: Math.round(totalVolume),
    totalSets,
    avgWeightPerSet: totalSets > 0 ? Math.round((totalWeightSum / totalSets) * 10) / 10 : 0,
    durationMins,
    setsPerHour,
    topExercises,
    muscleGroupVolume,
    muscleGroupSets,
    muscleGroupReps,
    totalKmRun: Math.round(totalKmRun * 10) / 10,
    bestOneRM,
  }
}

// ── Exercise History Stats ────────────────────────────────────────────────────

export type ExerciseHistorySession = {
  workoutDate: string          // ISO timestamp
  maxWeight: number
  totalVolume: number
  sets: number
  avgReps: number
  estimatedOneRM: number
  // The actual set that produced the session's best 1RM / best volume (optional — added in v2)
  best1rmSet?: { weight: number; reps: number; estimatedOneRM: number }
  bestVolumeSet?: { weight: number; reps: number; volume: number }
}

export type ExerciseStats = {
  allTimePR: number
  bestEstimatedOneRM: number
  totalSessions: number
  totalVolume: number          // all-time sum
  weightTrend: 'up' | 'flat' | 'down'
  recentHistory: ExerciseHistorySession[]   // sorted oldest→newest, up to 50
  best1rmSet: ExerciseBestSet | null        // all-time best individual set by 1RM
  bestVolumeSet: ExerciseBestSet | null     // all-time best individual set by volume
}

export function computeExerciseStats(history: ExerciseHistorySession[]): ExerciseStats {
  if (history.length === 0) {
    return {
      allTimePR: 0, bestEstimatedOneRM: 0, totalSessions: 0,
      totalVolume: 0, weightTrend: 'flat', recentHistory: [],
      best1rmSet: null, bestVolumeSet: null,
    }
  }

  const sorted = [...history].sort(
    (a, b) => new Date(a.workoutDate).getTime() - new Date(b.workoutDate).getTime()
  )

  const allTimePR = Math.max(...sorted.map(h => h.maxWeight))
  const bestEstimatedOneRM = Math.max(...sorted.map(h => h.estimatedOneRM))
  const totalSessions = sorted.length
  const totalVolume = sorted.reduce((s, h) => s + h.totalVolume, 0)

  // Find all-time best individual sets across all sessions
  let best1rmSet: ExerciseBestSet | null = null
  let bestVolumeSet: ExerciseBestSet | null = null

  for (const session of sorted) {
    if (session.best1rmSet) {
      const s = session.best1rmSet
      if (!best1rmSet || s.estimatedOneRM > best1rmSet.estimatedOneRM) {
        best1rmSet = {
          weight: s.weight,
          reps: s.reps,
          estimatedOneRM: s.estimatedOneRM,
          singleSetVolume: s.weight * s.reps,
          date: session.workoutDate,
          isActual1rm: s.reps === 1,
        }
      }
    }
    if (session.bestVolumeSet) {
      const s = session.bestVolumeSet
      if (!bestVolumeSet || s.volume > bestVolumeSet.singleSetVolume) {
        bestVolumeSet = {
          weight: s.weight,
          reps: s.reps,
          estimatedOneRM: estimateOneRM(s.weight, s.reps),
          singleSetVolume: s.volume,
          date: session.workoutDate,
          isActual1rm: false, // volume method doesn't distinguish actual vs. estimated
        }
      }
    }
  }

  // Trend: compare average weight of last 3 sessions vs the 3 before that
  const weights = sorted.map(h => h.maxWeight)
  let weightTrend: 'up' | 'flat' | 'down' = 'flat'
  if (weights.length >= 4) {
    const recent = weights.slice(-3).reduce((a, b) => a + b, 0) / Math.min(weights.length, 3)
    const olderSlice = weights.slice(-6, -3)
    if (olderSlice.length > 0) {
      const older = olderSlice.reduce((a, b) => a + b, 0) / olderSlice.length
      if (recent - older > 1) weightTrend = 'up'
      else if (older - recent > 1) weightTrend = 'down'
    }
  }

  return {
    allTimePR,
    bestEstimatedOneRM,
    totalSessions,
    totalVolume: Math.round(totalVolume),
    weightTrend,
    recentHistory: sorted.slice(-50),
    best1rmSet,
    bestVolumeSet,
  }
}

// ── Session Best Sets (WorkoutStatsPanel — Section A) ─────────────────────────

export type SessionBestSet = {
  exerciseId: string
  name: string
  weight: number
  reps: number
  estimatedOneRM: number
  singleSetVolume: number
  method: BestSetMethod
  hasNoSettings: boolean
  isActual1rm: boolean      // true when reps === 1 and method is 1rm
}

/**
 * For each exercise in the workout, find the "best" individual set
 * using each exercise's configured method (1RM or volume).
 */
export function computeSessionBestSets(
  strengthLogs: { strength_sets: RawStrengthSet[] }[],
  exercises: ExerciseMeta[],
  exerciseSettingsMap: Record<string, { target_reps?: number | null } | null>,
): SessionBestSet[] {
  // Collect all valid sets grouped by exercise (cheated sets excluded)
  const exSets = new Map<string, { weight: number; reps: number }[]>()
  for (const log of strengthLogs) {
    for (const s of log.strength_sets || []) {
      if (!s.exercise_id) continue
      if (isCheatedSet(s.rpe)) continue   // RPE > 10 → excluded from records
      const w = Number(s.actual_weight) || 0
      const r = Number(s.actual_reps) || 0
      if (w <= 0 || r <= 0) continue
      if (!exSets.has(s.exercise_id)) exSets.set(s.exercise_id, [])
      exSets.get(s.exercise_id)!.push({ weight: w, reps: r })
    }
  }

  const results: SessionBestSet[] = []

  for (const [exId, sets] of exSets) {
    const meta = exercises.find(e => e.id === exId)
    const name = meta?.name || 'Unknown'
    const settings = exerciseSettingsMap[exId]
    const { method, hasNoSettings } = getBestSetMethod(settings?.target_reps)

    let bestWeight = 0, bestReps = 0

    if (method === '1rm') {
      let best1rm = 0
      for (const s of sets) {
        const orm = estimateOneRM(s.weight, s.reps)
        if (orm > best1rm) { best1rm = orm; bestWeight = s.weight; bestReps = s.reps }
      }
    } else {
      let bestVol = 0
      for (const s of sets) {
        const vol = s.weight * s.reps
        if (vol > bestVol) { bestVol = vol; bestWeight = s.weight; bestReps = s.reps }
      }
    }

    if (bestWeight <= 0) continue

    results.push({
      exerciseId: exId,
      name,
      weight: bestWeight,
      reps: bestReps,
      estimatedOneRM: estimateOneRM(bestWeight, bestReps),
      singleSetVolume: bestWeight * bestReps,
      method,
      hasNoSettings,
      isActual1rm: method === '1rm' && bestReps === 1,
    })
  }

  // Sort by volume descending so the most impressive exercises come first
  return results.sort((a, b) => b.singleSetVolume - a.singleSetVolume)
}

// ── Historical Bests (WorkoutStatsPanel — Section B new-record detection) ─────

export type HistoricalBest = {
  best1rm: number       // best estimated 1RM from any single set in history
  bestVolume: number    // best single-set volume (weight × reps) in history
}

/**
 * Walk through historical logs and return the all-time best 1RM and volume
 * for each exercise. Use recentLogs (already fetched in page.tsx).
 */
export function computeHistoricalBestsFromLogs(
  logs: { strength_sets: { exercise_id: string; actual_weight: number | null; actual_reps: number | null; rpe?: number | null }[] }[]
): Record<string, HistoricalBest> {
  const bests: Record<string, HistoricalBest> = {}

  for (const log of logs) {
    for (const s of log.strength_sets || []) {
      const exId = s.exercise_id
      if (!exId) continue
      if (isCheatedSet(s.rpe)) continue   // RPE > 10 → excluded from records
      const w = Number(s.actual_weight) || 0
      const r = Number(s.actual_reps) || 0
      if (w <= 0 || r <= 0) continue
      const orm = estimateOneRM(w, r)
      const vol = w * r
      if (!bests[exId]) bests[exId] = { best1rm: 0, bestVolume: 0 }
      if (orm > bests[exId].best1rm) bests[exId].best1rm = orm
      if (vol > bests[exId].bestVolume) bests[exId].bestVolume = vol
    }
  }

  return bests
}

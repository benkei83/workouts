// ──────────────────────────────────────────────────────────────────────────────
// lib/workoutOutcomes.ts
// Pure functions for computing per-exercise outcomes from a list of history
// workouts (newest-first).  Used on both the home page and the history page.
// ──────────────────────────────────────────────────────────────────────────────

type BaseOutcome = 'success' | 'maintenance' | 'failure'
export type Outcome = 'success_increase' | 'success' | 'maintenance' | 'failure_deload' | 'failure'
export type WorkoutOutcome = { name: string; outcome: Outcome }

type SettingsEntry = {
  protocol?: string | null
  target_sets?: number | null
  target_reps?: number | null
  target_reps_min?: number | null
  min_successes?: number | null
  max_failures?: number | null
}

/**
 * Given ALL history workouts (newest-first) and a settingsMap keyed by exercise_id,
 * returns a Map<workoutId → WorkoutOutcome[]>.
 *
 * The streak computation must see the full list so outcomes are accurate even
 * when only a slice is displayed.
 */
export function computeWorkoutOutcomes(
  historyWorkouts: any[],
  settingsMap: Record<string, SettingsEntry>
): Map<string, WorkoutOutcome[]> {
  // ── Pre-pass 1: base outcome per (workout × exercise) ───────────────────────
  const baseOutcomeMap = new Map<string, Map<string, BaseOutcome>>()
  for (const w of historyWorkouts) {
    const allS = (w.strength_logs ?? []).flatMap((l: any) => l.strength_sets ?? [])
    const exReps = new Map<string, number[]>()
    for (const s of allS as any[]) {
      if (!s.exercise_id) continue
      if (!exReps.has(s.exercise_id)) exReps.set(s.exercise_id, [])
      exReps.get(s.exercise_id)!.push(Number(s.actual_reps))
    }
    const exOutcomes = new Map<string, BaseOutcome>()
    for (const [exId, reps] of exReps) {
      const cfg = settingsMap[exId]
      if (!cfg) continue
      const n      = reps.length
      const tSets  = Number(cfg.target_sets)     || 5
      const tReps  = Number(cfg.target_reps)     || 5
      const tMin   = Number(cfg.target_reps_min) || 8
      const allTop   = reps.every(r => r >= tReps)
      const allFloor = reps.every(r => r >= tMin)
      let o: BaseOutcome
      if      (n >= tSets && allTop)                                     o = 'success'
      else if (cfg.protocol === 'double' && n >= tSets && allFloor)      o = 'maintenance'
      else                                                                o = 'failure'
      exOutcomes.set(exId, o)
    }
    baseOutcomeMap.set(w.id, exOutcomes)
  }

  // ── Pre-pass 2: consecutive streaks per (workout × exercise) ────────────────
  // historyWorkouts[0] = most recent; older = higher index
  const failureStreakMap = new Map<string, Map<string, number>>()
  const successStreakMap = new Map<string, Map<string, number>>()
  for (let i = 0; i < historyWorkouts.length; i++) {
    const exMap   = baseOutcomeMap.get(historyWorkouts[i].id) ?? new Map<string, BaseOutcome>()
    const fStreaks = new Map<string, number>()
    const sStreaks = new Map<string, number>()
    for (const [exId, outcome] of exMap) {
      const target = outcome === 'failure' ? 'failure' : outcome === 'success' ? 'success' : null
      if (!target) { fStreaks.set(exId, 0); sStreaks.set(exId, 0); continue }
      let count = 1
      for (let j = i + 1; j < historyWorkouts.length; j++) {
        const o = baseOutcomeMap.get(historyWorkouts[j].id)?.get(exId)
        if      (o === target)    count++
        else if (o !== undefined) break   // different outcome ends the streak
        // undefined → exercise not logged that day → skip
      }
      fStreaks.set(exId, outcome === 'failure' ? count : 0)
      sStreaks.set(exId, outcome === 'success' ? count : 0)
    }
    failureStreakMap.set(historyWorkouts[i].id, fStreaks)
    successStreakMap.set(historyWorkouts[i].id, sStreaks)
  }

  // ── Build final outcome list per workout ────────────────────────────────────
  const result = new Map<string, WorkoutOutcome[]>()
  for (const w of historyWorkouts) {
    const allSets = (w.strength_logs ?? []).flatMap((l: any) => l.strength_sets ?? [])
    const exerciseOrder: string[] = []
    const setsByExercise = new Map<string, string>()   // id → name
    for (const s of allSets as any[]) {
      const exId: string = s.exercise_id
      if (!exId || setsByExercise.has(exId)) continue
      exerciseOrder.push(exId)
      setsByExercise.set(exId, (s.exercises as any)?.name ?? 'Unknown')
    }

    const outcomes: WorkoutOutcome[] = []
    for (const exId of exerciseOrder) {
      const cfg  = settingsMap[exId]
      if (!cfg)  continue
      const base = baseOutcomeMap.get(w.id)?.get(exId)
      if (!base) continue

      const minSuccesses  = Number(cfg.min_successes) || 1
      const maxFails      = Number(cfg.max_failures)  || 3
      const failStreak    = failureStreakMap.get(w.id)?.get(exId) ?? 0
      const successStreak = successStreakMap.get(w.id)?.get(exId) ?? 0

      let outcome: Outcome
      if (base === 'success') {
        outcome = successStreak >= minSuccesses ? 'success_increase' : 'success'
      } else if (base === 'maintenance') {
        outcome = 'maintenance'
      } else {
        outcome = failStreak >= maxFails ? 'failure_deload' : 'failure'
      }
      outcomes.push({ name: setsByExercise.get(exId)!, outcome })
    }
    result.set(w.id, outcomes)
  }

  return result
}

/** Compute consecutive-day workout streak from newest-first list of workouts. */
export function computeWorkoutStreak(historyWorkouts: { created_at: string }[]): number {
  if (historyWorkouts.length === 0) return 0

  // Deduplicate into calendar dates (local), newest first
  const seen = new Set<string>()
  const days: Date[] = []
  for (const w of historyWorkouts) {
    const d = new Date(w.created_at)
    d.setHours(0, 0, 0, 0)
    const key = d.toISOString()
    if (!seen.has(key)) { seen.add(key); days.push(d) }
  }
  // days is already newest-first

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1)

  // Streak only counts if most recent workout was today or yesterday
  if (days[0].getTime() < yesterday.getTime()) return 0

  let streak = 1
  for (let i = 1; i < days.length; i++) {
    const diff = Math.round((days[i - 1].getTime() - days[i].getTime()) / 86_400_000)
    if (diff === 1) streak++
    else break
  }
  return streak
}

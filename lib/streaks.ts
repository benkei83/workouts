/**
 * Computes an exercise's current outcome streak by replaying recent workout logs.
 * This is the source of truth for badge display — never relies on stored counters,
 * so it stays accurate even if workouts are deleted.
 */

export type ComputedStreak = {
  type: 'success' | 'failure' | 'maintenance'
  count: number
} | null

export function computeExerciseStreak(
  exerciseId: string,
  settings: any,
  /** Recent completed workouts, newest first */
  recentWorkouts: { id: string }[],
  /** strength_logs for those workouts, each with strength_sets array */
  recentLogs: { workout_id: string; strength_sets: any[] }[]
): ComputedStreak {
  if (!settings?.protocol || settings.protocol === 'manual') return null

  const targetSets    = Number(settings.target_sets)     || 5
  const targetReps    = Number(settings.target_reps)     || 5
  const targetRepsMin = Number(settings.target_reps_min) || 8
  const currentTarget = Number(settings.current_weight)  || 0
  const isDouble      = settings.protocol === 'double'

  const outcomes: Array<'success' | 'failure' | 'maintenance'> = []

  for (const workout of recentWorkouts) {
    const setsForExercise = recentLogs
      .filter(l => l.workout_id === workout.id)
      .flatMap(l => (l.strength_sets as any[]) || [])
      .filter(s => s.exercise_id === exerciseId)

    if (setsForExercise.length === 0) continue // exercise not done that day

    // Count sets that meet the rep target — warm-ups, feeler sets, and heavy
    // singles (fewer reps at a higher weight) must not penalise the outcome.
    const qualTop   = setsForExercise.filter(s => Number(s.actual_reps) >= targetReps).length
    const qualFloor = setsForExercise.filter(s => Number(s.actual_reps) >= targetRepsMin).length

    // Deload guard: if the user completed enough sets at or above the scheduled
    // weight, the session is at worst "maintenance" — never a failure.
    const aboveTarget = setsForExercise.filter(s => Number(s.actual_weight) >= currentTarget).length
    const enoughAbove = aboveTarget >= targetSets

    let outcome: 'success' | 'failure' | 'maintenance'
    if (isDouble) {
      if (qualTop >= targetSets)                 outcome = 'success'
      else if (qualFloor >= targetSets || enoughAbove) outcome = 'maintenance'
      else                                       outcome = 'failure'
    } else {
      if (qualTop >= targetSets)   outcome = 'success'
      else if (enoughAbove)        outcome = 'maintenance'
      else                         outcome = 'failure'
    }

    outcomes.push(outcome)
  }

  if (outcomes.length === 0) return null

  // Count consecutive identical outcomes from the most recent session
  const latestType = outcomes[0]
  let count = 0
  for (const o of outcomes) {
    if (o === latestType) count++
    else break
  }

  return { type: latestType, count }
}

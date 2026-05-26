'use server'

import { createClient } from '@/lib/supabase/server'
import type { ExerciseHistorySession } from '@/lib/stats/compute'

/**
 * Fetch all completed-workout sessions for a given exercise, for the current user.
 * Returns sessions sorted oldest → newest.
 */
export async function fetchExerciseHistory(
  exerciseId: string
): Promise<ExerciseHistorySession[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  // 1. All completed workouts for this user (up to 300 sessions)
  const { data: completedWorkouts } = await supabase
    .from('workouts')
    .select('id, created_at')
    .eq('user_id', user.id)
    .not('total_duration_mins', 'is', null)
    .order('created_at', { ascending: true })
    .limit(300)

  if (!completedWorkouts || completedWorkouts.length === 0) return []

  const workoutIds = completedWorkouts.map(w => w.id)

  // 2. Strength logs belonging to those workouts
  const { data: logs } = await supabase
    .from('strength_logs')
    .select('id, workout_id')
    .in('workout_id', workoutIds)

  if (!logs || logs.length === 0) return []

  const logIds = logs.map(l => l.id)

  // 3. Sets for this exercise in those logs
  const { data: sets } = await supabase
    .from('strength_sets')
    .select('strength_log_id, actual_weight, actual_reps, set_number')
    .in('strength_log_id', logIds)
    .eq('exercise_id', exerciseId)
    .order('set_number')

  if (!sets || sets.length === 0) return []

  // Build log → workout lookup
  const logToWorkout = new Map<string, { id: string; created_at: string }>()
  for (const log of logs) {
    const w = completedWorkouts.find(w => w.id === log.workout_id)
    if (w) logToWorkout.set(log.id, w)
  }

  // Group sets by workout (one exercise may appear in multiple logs of the same workout)
  const workoutSets = new Map<string, { date: string; rawSets: { weight: number; reps: number }[] }>()
  for (const set of sets) {
    const w = logToWorkout.get(set.strength_log_id)
    if (!w) continue
    if (!workoutSets.has(w.id)) {
      workoutSets.set(w.id, { date: w.created_at, rawSets: [] })
    }
    workoutSets.get(w.id)!.rawSets.push({
      weight: Number(set.actual_weight) || 0,
      reps: Number(set.actual_reps) || 0,
    })
  }

  // Compute per-session stats
  const sessions: ExerciseHistorySession[] = []
  for (const [, session] of workoutSets) {
    const { date, rawSets } = session
    if (rawSets.length === 0) continue

    const maxWeight = Math.max(...rawSets.map(s => s.weight))
    const totalVolume = rawSets.reduce((s, set) => s + set.weight * set.reps, 0)
    const avgReps = rawSets.reduce((s, set) => s + set.reps, 0) / rawSets.length
    const estimatedOneRM = Math.max(
      ...rawSets.map(s =>
        s.reps <= 1 ? s.weight : Math.round(s.weight * (1 + s.reps / 30))
      )
    )

    sessions.push({
      workoutDate: date,
      maxWeight,
      totalVolume: Math.round(totalVolume),
      sets: rawSets.length,
      avgReps: Math.round(avgReps * 10) / 10,
      estimatedOneRM,
    })
  }

  // Sort oldest → newest
  return sessions.sort(
    (a, b) => new Date(a.workoutDate).getTime() - new Date(b.workoutDate).getTime()
  )
}

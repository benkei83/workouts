'use server'

import { unstable_noStore as noStore } from 'next/cache'
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
    .select('strength_log_id, actual_weight, actual_reps, set_number, rpe')
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
  const workoutSets = new Map<string, { date: string; rawSets: { weight: number; reps: number; rpe: number | null }[] }>()
  for (const set of sets) {
    const w = logToWorkout.get(set.strength_log_id)
    if (!w) continue
    if (!workoutSets.has(w.id)) {
      workoutSets.set(w.id, { date: w.created_at, rawSets: [] })
    }
    workoutSets.get(w.id)!.rawSets.push({
      weight: Number(set.actual_weight) || 0,
      reps: Number(set.actual_reps) || 0,
      rpe: (set as any).rpe ?? null,
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

    // Only "clean" sets (RPE ≤ 10 or unrecorded) count toward records
    const cleanSets = rawSets.filter(s => s.rpe == null || s.rpe <= 10)

    // Find the set that produced the best estimated 1RM (clean sets only)
    let best1rmSet: { weight: number; reps: number; estimatedOneRM: number } | undefined
    let topOrm = 0
    for (const s of cleanSets) {
      const orm = s.reps <= 1 ? s.weight : Math.round(s.weight * (1 + s.reps / 30))
      if (orm > topOrm) {
        topOrm = orm
        best1rmSet = { weight: s.weight, reps: s.reps, estimatedOneRM: orm }
      }
    }

    // Find the set that produced the best single-set volume (clean sets only)
    let bestVolumeSet: { weight: number; reps: number; volume: number } | undefined
    let topVol = 0
    for (const s of cleanSets) {
      const vol = s.weight * s.reps
      if (vol > topVol) {
        topVol = vol
        bestVolumeSet = { weight: s.weight, reps: s.reps, volume: Math.round(vol) }
      }
    }

    sessions.push({
      workoutDate: date,
      maxWeight,
      totalVolume: Math.round(totalVolume),
      sets: rawSets.length,
      avgReps: Math.round(avgReps * 10) / 10,
      estimatedOneRM: topOrm,
      best1rmSet,
      bestVolumeSet,
    })
  }

  // Sort oldest → newest
  return sessions.sort(
    (a, b) => new Date(a.workoutDate).getTime() - new Date(b.workoutDate).getTime()
  )
}

/**
 * Richer fetch for the dedicated exercise page: returns per-session history
 * AND the flat list of clean sets (with dates) needed for the rep-max ladder.
 */
export async function fetchExercisePageData(exerciseId: string): Promise<{
  history: ExerciseHistorySession[]
  cleanSets: { weight: number; reps: number; date: string }[]
}> {
  noStore()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { history: [], cleanSets: [] }

  const { data: completedWorkouts } = await supabase
    .from('workouts')
    .select('id, created_at')
    .eq('user_id', user.id)
    .not('total_duration_mins', 'is', null)
    .order('created_at', { ascending: true })
    .limit(300)

  if (!completedWorkouts?.length) return { history: [], cleanSets: [] }
  const workoutIds = completedWorkouts.map(w => w.id)

  const { data: logs } = await supabase
    .from('strength_logs')
    .select('id, workout_id')
    .in('workout_id', workoutIds)

  if (!logs?.length) return { history: [], cleanSets: [] }
  const logIds = logs.map(l => l.id)

  const { data: sets } = await supabase
    .from('strength_sets')
    .select('strength_log_id, actual_weight, actual_reps, set_number, rpe')
    .in('strength_log_id', logIds)
    .eq('exercise_id', exerciseId)
    .order('set_number')

  if (!sets?.length) return { history: [], cleanSets: [] }

  const logToWorkout = new Map<string, { id: string; created_at: string }>()
  for (const log of logs) {
    const w = completedWorkouts.find(w => w.id === log.workout_id)
    if (w) logToWorkout.set(log.id, w)
  }

  const workoutSets = new Map<string, { date: string; rawSets: { weight: number; reps: number; rpe: number | null }[] }>()
  const cleanSets: { weight: number; reps: number; date: string }[] = []

  for (const set of sets) {
    const w = logToWorkout.get(set.strength_log_id)
    if (!w) continue
    const weight = Number(set.actual_weight) || 0
    const reps = Number(set.actual_reps) || 0
    const rpe = (set as any).rpe ?? null
    if (!workoutSets.has(w.id)) workoutSets.set(w.id, { date: w.created_at, rawSets: [] })
    workoutSets.get(w.id)!.rawSets.push({ weight, reps, rpe })
    // Clean sets (RPE ≤ 10 or unrecorded) with positive weight/reps feed the rep-max ladder
    if (weight > 0 && reps > 0 && (rpe == null || rpe <= 10)) {
      cleanSets.push({ weight, reps, date: w.created_at })
    }
  }

  const history: ExerciseHistorySession[] = []
  for (const [, session] of workoutSets) {
    const { date, rawSets } = session
    if (rawSets.length === 0) continue
    const maxWeight = Math.max(...rawSets.map(s => s.weight))
    const totalVolume = rawSets.reduce((s, set) => s + set.weight * set.reps, 0)
    const avgReps = rawSets.reduce((s, set) => s + set.reps, 0) / rawSets.length
    const clean = rawSets.filter(s => s.rpe == null || s.rpe <= 10)

    let best1rmSet: { weight: number; reps: number; estimatedOneRM: number } | undefined
    let topOrm = 0
    for (const s of clean) {
      const orm = s.reps <= 1 ? s.weight : Math.round(s.weight * (1 + s.reps / 30))
      if (orm > topOrm) { topOrm = orm; best1rmSet = { weight: s.weight, reps: s.reps, estimatedOneRM: orm } }
    }
    let bestVolumeSet: { weight: number; reps: number; volume: number } | undefined
    let topVol = 0
    for (const s of clean) {
      const vol = s.weight * s.reps
      if (vol > topVol) { topVol = vol; bestVolumeSet = { weight: s.weight, reps: s.reps, volume: Math.round(vol) } }
    }

    history.push({
      workoutDate: date,
      maxWeight,
      totalVolume: Math.round(totalVolume),
      sets: rawSets.length,
      avgReps: Math.round(avgReps * 10) / 10,
      estimatedOneRM: topOrm,
      best1rmSet,
      bestVolumeSet,
    })
  }

  history.sort((a, b) => new Date(a.workoutDate).getTime() - new Date(b.workoutDate).getTime())
  return { history, cleanSets }
}

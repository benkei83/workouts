'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { WGER_CATEGORY_MAP, WGER_EQUIPMENT_MAP } from '@/lib/muscleGroups'
import { runTrophyEngine } from '@/lib/trophies/engine'
import type { TrophyUnlock } from '@/lib/trophies/types'

// ─── Trophy event helper ──────────────────────────────────────────────────────

/** Silently emits an event row used by the trophy engine for moment-based trophies.
 *  Swallows all errors so it never breaks the caller's transaction. */
async function emitTrophyEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  eventType: string,
  opts: { workoutId?: string; exerciseId?: string; value?: number } = {},
) {
  try {
    await supabase.from('user_trophy_events').insert({
      user_id:     userId,
      event_type:  eventType,
      workout_id:  opts.workoutId  ?? null,
      exercise_id: opts.exerciseId ?? null,
      value:       opts.value      ?? null,
    })
  } catch {
    // Silently ignore — table may not exist yet, or RLS may block it.
  }
}

export async function saveWorkoutNotes(workoutId: string, notes: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('workouts')
    .update({ notes })
    .eq('id', workoutId)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  return { ok: true }
}

export async function saveCardioLog(formData: FormData) {
  const supabase = await createClient()
  
  const workoutId = formData.get('workout_id') as string
  const environment = formData.get('environment') as string
  const sessionType = formData.get('session_type') as string
  const durationRaw = formData.get('duration')
  const distanceRaw = formData.get('distance')
  const speedRaw = formData.get('average_speed')
  const inclineRaw = formData.get('incline')
  const legsRaw = formData.get('legs') as string 

  if (!workoutId || !durationRaw) return { error: 'Missing required fields' }

  const durationMins = parseFloat(durationRaw as string)
  let finalDistance = distanceRaw ? parseFloat(distanceRaw as string) : null
  let finalSpeed = speedRaw ? parseFloat(speedRaw as string) : null
  const finalIncline = inclineRaw ? parseFloat(inclineRaw as string) : null

  const { data: runningLog, error: logError } = await supabase.from('running_logs').insert({
    workout_id: workoutId,
    environment: environment,
    session_type: sessionType,
    duration_seconds: durationMins * 60,
    distance_km: finalDistance,
    average_speed: finalSpeed,
    average_incline: finalIncline,
  }).select('id').single()

  if (logError || !runningLog) {
    console.error(logError)
    return { error: 'Failed to save cardio log' }
  }

  if (sessionType === 'interval' && legsRaw) {
    const legs = JSON.parse(legsRaw)
    
    const legsToInsert = legs.map((leg: any, index: number) => ({
      running_log_id: runningLog.id,
      leg_order: index + 1,
      leg_type: leg.type,
      duration_mins: leg.duration,
      speed_kmh: leg.speed,
      incline_percent: leg.incline
    }))

    const { error: legsError } = await supabase.from('running_legs').insert(legsToInsert)
    
    if (legsError) {
      console.error(legsError)
      return { error: 'Failed to save interval legs' }
    }
  }

  revalidatePath(`/workout/${workoutId}`)
  return { success: true }
}

export async function saveStrengthExercise(
  workoutId: string,
  exerciseId: string,
  sets: { weight: number; reps: number; rpe?: number | null }[],
  options?: { createdAt?: string, supersetId?: string }
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 1. SAVE THE EXERCISE LOGS
  const logPayload: any = { workout_id: workoutId }
  if (options?.createdAt) logPayload.created_at = options.createdAt
  if (options?.supersetId) logPayload.superset_id = options.supersetId

  const { data: strengthLog, error: logError } = await supabase
    .from('strength_logs')
    .insert(logPayload)
    .select('id')
    .single()

  if (logError || !strengthLog) {
    console.error("Failed to create strength log:", logError)
    return { error: 'Failed to create strength log' }
  }

  const setsToInsert = sets.map((set, index) => ({
    strength_log_id: strengthLog.id,
    exercise_id: exerciseId,
    set_number: index + 1,
    actual_weight: set.weight,
    actual_reps: set.reps,
    rpe: set.rpe ?? null,
  }))

  const { data: insertedSets, error: setsError } = await supabase
    .from('strength_sets')
    .insert(setsToInsert)
    .select('id, actual_weight, actual_reps')

  if (setsError || !insertedSets) {
    console.error("Supabase sets error:", setsError)
    await supabase.from('strength_logs').delete().eq('id', strengthLog.id)
    return { error: setsError?.message || 'Failed to save sets' }
  }

  // ── PR detection (per rep count, clean sets only) ─────────
  // Cheated sets (RPE > 10) are excluded — they don't count as PRs.
  const cleanInsertedSets = insertedSets.filter((_, i) => {
    const rpe = sets[i]?.rpe
    return rpe == null || Number(rpe) <= 10
  })
  const uniqueRepCounts = [...new Set(cleanInsertedSets.map(s => Number(s.actual_reps)))]

  for (const reps of uniqueRepCounts) {
    if (reps <= 0) continue
    const setsAtReps = cleanInsertedSets.filter(s => Number(s.actual_reps) === reps)
    const maxWeightAtReps = Math.max(...setsAtReps.map(s => Number(s.actual_weight)))
    if (maxWeightAtReps <= 0) continue

    const { data: prevBest } = await supabase
      .from('strength_sets')
      .select('actual_weight')
      .eq('exercise_id', exerciseId)
      .eq('actual_reps', reps)
      .neq('strength_log_id', strengthLog.id)
      .order('actual_weight', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (maxWeightAtReps > (prevBest?.actual_weight ?? 0)) {
      const prSet = setsAtReps.find(s => Number(s.actual_weight) === maxWeightAtReps)
      if (prSet) {
        await supabase.from('strength_sets').update({ is_pr: true }).eq('id', prSet.id)
      }
    }
  }

  // 2. THE PROGRESSION ENGINE
  const { data: setting } = await supabase
    .from('user_exercise_settings')
    .select('*')
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .eq('is_active', true)
    .single()

  if (setting && setting.protocol && setting.protocol !== 'manual') {
    let newFailures = Number(setting.current_failures) || 0
    let newSuccesses = Number(setting.current_successes) || 0
    let newWeight = Number(setting.current_weight) || 0
    let changed = false

    const targetSets = Number(setting.target_sets) || 5
    const targetReps = Number(setting.target_reps) || 5
    const progRate = Number(setting.progression_rate) || 2.5
    const maxFails = Number(setting.max_failures) || 3
    const minSuccesses = Number(setting.min_successes) || 1
    const deloadMult = Number(setting.deload_multiplier) || 2.0

    // Only clean sets (RPE ≤ 10 or no RPE) count toward progression.
    // Cheated sets are excluded — they shouldn't trigger a weight increase.
    const cleanSets = sets.filter(s => s.rpe == null || Number(s.rpe) <= 10)

    const completedSetsCount = cleanSets.length
    const allSetsHitTarget = cleanSets.every(s => Number(s.reps) >= targetReps)

    // Base weight on clean sets only. Fall back to stored target if all sets were cheated.
    const actualWeight = cleanSets.length > 0
      ? Math.min(...cleanSets.map(s => Number(s.weight)))
      : newWeight

    // Fetch the most-recent inactive settings row to detect a deload recovery.
    // If the current active weight is lower than the previous row's weight, the
    // user is mid-deload — a perfect session now counts as deload_recovery.
    const { data: prevSettingRow } = await supabase
      .from('user_exercise_settings')
      .select('current_weight')
      .eq('user_id', user.id)
      .eq('exercise_id', exerciseId)
      .eq('is_active', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const wasDeloaded = prevSettingRow !== null
      && Number(setting.current_weight) < Number(prevSettingRow.current_weight)

    let isPerfectSession = false

    if (setting.protocol === 'linear') {
      // 5x5 STYLE
      if (completedSetsCount >= targetSets && allSetsHitTarget) {
        isPerfectSession = true
        newSuccesses += 1
        newFailures = 0
        if (newSuccesses >= minSuccesses) {
          newWeight = actualWeight + progRate   // increment from what they lifted
          newSuccesses = 0
        } else {
          newWeight = actualWeight              // track actual weight for next session's pre-fill
        }
        changed = true
      } else {
        newSuccesses = 0
        newFailures += 1
        if (newFailures >= maxFails) {
          newWeight = Math.max(0, actualWeight - (progRate * deloadMult))  // deload from actual
          newFailures = 0
        } else {
          newWeight = actualWeight
        }
        changed = true
      }
    } else if (setting.protocol === 'double') {
      // Rep-range style (e.g. 3×8-12). Lower bound is explicit target_reps_min (default 8).
      const lowerBound = Math.max(1, Number(setting.target_reps_min) || 8)
      const allSetsHitMaintain = cleanSets.every(s => Number(s.reps) >= lowerBound)

      if (completedSetsCount >= targetSets && allSetsHitTarget) {
        isPerfectSession = true
        newSuccesses += 1
        newFailures = 0
        if (newSuccesses >= minSuccesses) {
          newWeight = actualWeight + progRate
          newSuccesses = 0
        } else {
          newWeight = actualWeight
        }
        changed = true
      } else if (completedSetsCount >= targetSets && allSetsHitMaintain) {
        // Maintenance: forgive streaks, track actual weight
        if (newFailures !== 0 || newSuccesses !== 0 || actualWeight !== newWeight) {
          newFailures = 0
          newSuccesses = 0
          newWeight = actualWeight
          changed = true
        }
      } else {
        newSuccesses = 0
        newFailures += 1
        if (newFailures >= maxFails) {
          newWeight = Math.max(0, actualWeight - (progRate * deloadMult))
          newFailures = 0
        } else {
          newWeight = actualWeight
        }
        changed = true
      }
    }

    // 3. APPLY SETTINGS UPDATE
    if (changed) {
      const prevWeight = Number(setting.current_weight) || 0
      const prevFailures = Number(setting.current_failures) || 0

      await supabase.from('user_exercise_settings')
        .update({ is_active: false, valid_to: new Date().toISOString() })
        .eq('id', setting.id)

      await supabase.from('user_exercise_settings').insert({
        user_id: setting.user_id,
        exercise_id: setting.exercise_id,
        current_weight: newWeight,
        target_sets: setting.target_sets,
        target_reps: setting.target_reps,
        target_reps_min: setting.target_reps_min ?? 8,
        increment_step: setting.increment_step,
        progression_rate: setting.progression_rate,
        protocol: setting.protocol,
        current_failures: newFailures,
        max_failures: setting.max_failures,
        min_successes: setting.min_successes ?? 1,
        current_successes: newSuccesses,
        deload_multiplier: setting.deload_multiplier,
        is_active: true
      })

      // Emit trophy events
      if (newWeight > prevWeight) {
        // Successful weight progression
        const eventType = setting.protocol === 'double' ? 'double_progression' : 'auto_progression'
        await emitTrophyEvent(supabase, user.id, eventType, {
          workoutId,
          exerciseId,
          value: newWeight,
        })
      }
      if (prevFailures > 0 && newFailures === 0 && newWeight >= prevWeight) {
        // Broke a failure streak without deloading
        await emitTrophyEvent(supabase, user.id, 'failure_streak_broken', {
          workoutId,
          exerciseId,
          value: prevFailures,
        })
      }
      if (isPerfectSession) {
        await emitTrophyEvent(supabase, user.id, 'perfect_session', {
          workoutId,
          exerciseId,
        })
        if (wasDeloaded) {
          // Perfect session while weight is still below the pre-deload peak
          await emitTrophyEvent(supabase, user.id, 'deload_recovery', {
            workoutId,
            exerciseId,
          })
        }
      }
    }
  }

  revalidatePath(`/workout/${workoutId}`)
  return { success: true }
}

export async function updateSupersetLog(
  cards: { logId: string; exerciseId: string; sets: { weight: number; reps: number; rpe?: number | null }[] }[],
  workoutId: string
) {
  const supabase = await createClient()

  for (const card of cards) {
    // Replace all sets for this log with the new values
    await supabase.from('strength_sets').delete().eq('strength_log_id', card.logId)

    if (card.sets.length > 0) {
      await supabase.from('strength_sets').insert(
        card.sets.map((set, i) => ({
          strength_log_id: card.logId,
          exercise_id: card.exerciseId,
          set_number: i + 1,
          actual_weight: set.weight,
          actual_reps: set.reps,
          rpe: set.rpe ?? null,
        }))
      )
    }
  }

  revalidatePath(`/workout/${workoutId}`)
  return { success: true }
}

export async function saveSupersetLog(
  workoutId: string,
  matrix: { [exerciseId: string]: { weight: number, reps: number }[] }
) {
  // Generate one shared supersetId so all exercises are visually grouped
  const supersetId = crypto.randomUUID()

  // Call saveStrengthExercise for each exercise — this runs the progression engine per exercise
  for (const exId of Object.keys(matrix)) {
    const result = await saveStrengthExercise(workoutId, exId, matrix[exId], { supersetId })
    if (result?.error) return result
  }

  revalidatePath(`/workout/${workoutId}`)
  return { success: true }
}

export async function finishWorkout(formData: FormData) {
  const workoutId = formData.get('workout_id') as string
  if (!workoutId) return

  const supabase = await createClient()

  const { data: workout } = await supabase
    .from('workouts')
    .select('created_at')
    .eq('id', workoutId)
    .single()

  if (workout) {
    const startTime = new Date(workout.created_at).getTime()
    const now = new Date().getTime()
    const durationMins = Math.max(1, Math.round((now - startTime) / 60000))

    await supabase
      .from('workouts')
      .update({ total_duration_mins: durationMins })
      .eq('id', workoutId)
  }

  revalidatePath('/')
  redirect('/')
}

/**
 * Finish a workout and optionally save feel_rating + intensity.
 * Called from the client-side FinishWorkoutButton (does NOT redirect —
 * the client handles navigation via useRouter).
 * Returns any newly-unlocked trophies so the client can show toasts.
 */
export async function finishWorkoutWithFeel(
  workoutId: string,
  feelRating: number | null,
  intensity: string | null,
): Promise<{ success: true; newTrophies: TrophyUnlock[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: workout } = await supabase
    .from('workouts')
    .select('created_at')
    .eq('id', workoutId)
    .single()

  if (workout) {
    const durationMins = Math.max(
      1,
      Math.round((Date.now() - new Date(workout.created_at).getTime()) / 60_000)
    )
    await supabase
      .from('workouts')
      .update({ total_duration_mins: durationMins, feel_rating: feelRating, intensity })
      .eq('id', workoutId)
  }

  // Run trophy engine (after duration is set so the workout counts as completed)
  let newTrophies: TrophyUnlock[] = []
  if (user) {
    try {
      newTrophies = await runTrophyEngine(supabase, user.id, workoutId)
    } catch (err) {
      console.error('[trophy engine]', err)
      // Never let trophy errors block finishing a workout
    }
  }

  // ── Auto-share to community feed ─────────────────────────────────────────
  if (user) {
    try {
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('screen_name, auto_share_workouts')
        .eq('user_id', user.id)
        .maybeSingle()

      const autoShare = userSettings?.auto_share_workouts ?? true

      if (autoShare) {
        const { data: wData } = await supabase
          .from('workouts')
          .select(`
            title, total_duration_mins,
            running_logs( distance_km, session_type ),
            strength_logs(
              strength_sets(
                exercise_id, actual_weight, actual_reps, is_pr,
                exercises(name)
              )
            )
          `)
          .eq('id', workoutId)
          .single()

        if (wData) {
          const allSets = (wData.strength_logs as any[]).flatMap((l: any) => l.strength_sets || [])
          const completedSets = allSets.filter((s: any) => (Number(s.actual_reps) || 0) > 0)

          // Cardio sessions
          const cardio = ((wData.running_logs as any[]) || [])
            .filter((r: any) => Number(r.distance_km) > 0)
            .map((r: any) => ({
              session_type: (r.session_type as string | null) ?? null,
              distance_km:  Math.round(Number(r.distance_km) * 10) / 10,
            }))

          // Per-exercise stats: sets, max weight, reps at max weight
          const exMap = new Map<string, { name: string; sets: number; max_weight: number; top_reps: number }>()
          for (const s of completedSets) {
            if (!s.exercise_id) continue
            const name = (s.exercises as any)?.name ?? 'Unknown'
            const weight = Number(s.actual_weight) || 0
            const reps   = Number(s.actual_reps)   || 0
            if (!exMap.has(s.exercise_id)) {
              exMap.set(s.exercise_id, { name, sets: 0, max_weight: 0, top_reps: 0 })
            }
            const ex = exMap.get(s.exercise_id)!
            ex.sets++
            if (weight > ex.max_weight || (weight === ex.max_weight && reps > ex.top_reps)) {
              ex.max_weight = weight
              ex.top_reps   = reps
            }
          }
          const exercises = Array.from(exMap.values())

          const totalSets   = completedSets.length
          const totalVolume = Math.round(
            completedSets.reduce((sum: number, s: any) =>
              sum + (Number(s.actual_weight) || 0) * (Number(s.actual_reps) || 0), 0)
          )

          // PRs — one badge per exercise
          const seenPrEx = new Set<string>()
          const prs = allSets
            .filter((s: any) => s.is_pr)
            .filter((s: any) => {
              if (!s.exercise_id || seenPrEx.has(s.exercise_id)) return false
              seenPrEx.add(s.exercise_id)
              return true
            })
            .map((s: any) => ({
              exercise: (s.exercises as any)?.name ?? 'Unknown',
              weight:   Number(s.actual_weight),
              reps:     Number(s.actual_reps),
            }))

          // Goal achievements hit during this workout
          const achievements: { label: string }[] = []
          try {
            const { data: goals } = await supabase
              .from('user_goals')
              .select('id, goal_type, target_value, target_reps, exercise_id')
              .eq('user_id', user.id)
              .is('achieved_at', null)
              .in('goal_type', ['max_weight', 'weight_reps'])

            for (const goal of (goals || [])) {
              const exSets = completedSets.filter((s: any) => s.exercise_id === goal.exercise_id)
              if (exSets.length === 0) continue
              const exName = (exSets[0].exercises as any)?.name ?? 'Exercise'
              if (goal.goal_type === 'max_weight') {
                const hit = exSets.some((s: any) => Number(s.actual_weight) >= Number(goal.target_value))
                if (hit) achievements.push({ label: `${exName} ${goal.target_value} kg` })
              } else if (goal.goal_type === 'weight_reps') {
                const hit = exSets.some((s: any) =>
                  Number(s.actual_weight) >= Number(goal.target_value) &&
                  Number(s.actual_reps)   >= Number(goal.target_reps || 1)
                )
                if (hit) achievements.push({ label: `${exName} ${goal.target_reps}×${goal.target_value} kg` })
              }
            }
          } catch { /* goals table may not have target_reps yet */ }

          await supabase.from('feed_posts').insert({
            user_id:      user.id,
            workout_id:   workoutId,
            post_type:    'workout',
            screen_name:  userSettings?.screen_name ?? null,
            workout_title: wData.title,
            workout_summary: {
              duration_mins: Number(wData.total_duration_mins) || 0,
              exercises,
              total_sets:    totalSets,
              total_volume:  totalVolume,
              prs,
              achievements,
              cardio,
            },
          })
          // Do NOT call revalidatePath here — any revalidatePath call from this
          // server action triggers a full page re-render on the client, which
          // unmounts FinishWorkoutButton and wipes pendingTrophies (trophy toast
          // disappears instantly). The feed page uses force-dynamic so it always
          // fetches fresh data on navigation.
        }
      }
    } catch (err) {
      console.error('[feed post]', err)
      // Never let feed errors block finishing a workout
    }
  }

  // Do NOT call revalidatePath here — it causes Next.js to refresh the current
  // page while the trophy toast is still visible, which unmounts FinishWorkoutButton
  // and clears pendingTrophies. The client already calls router.refresh() before
  // navigating away, so cache invalidation is handled on the client side.
  return { success: true, newTrophies }
}

/** Manually share a finished workout to the feed (or refresh an existing post's summary). */
export async function shareWorkoutToFeed(workoutId: string): Promise<{ ok: true; postId: string } | { error: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  // Always rebuild the full summary so re-sharing picks up the latest data
  const [{ data: wData }, { data: userSettings }, { data: existing }] = await Promise.all([
    supabase
      .from('workouts')
      .select(`
        title, total_duration_mins,
        running_logs( distance_km, session_type ),
        strength_logs(
          strength_sets(
            exercise_id, actual_weight, actual_reps, is_pr,
            exercises(name)
          )
        )
      `)
      .eq('id', workoutId)
      .eq('user_id', user.id)
      .single(),
    supabase
      .from('user_settings')
      .select('screen_name')
      .eq('user_id', user.id)
      .maybeSingle(),
    supabase
      .from('feed_posts')
      .select('id')
      .eq('workout_id', workoutId)
      .eq('user_id', user.id)
      .maybeSingle(),
  ])

  if (!wData) return { error: 'Workout not found' }

  const allSets = (wData.strength_logs as any[]).flatMap((l: any) => l.strength_sets || [])
  const completedSets = allSets.filter((s: any) => (Number(s.actual_reps) || 0) > 0)

  // Cardio sessions
  const cardio = ((wData.running_logs as any[]) || [])
    .filter((r: any) => Number(r.distance_km) > 0)
    .map((r: any) => ({
      session_type: (r.session_type as string | null) ?? null,
      distance_km:  Math.round(Number(r.distance_km) * 10) / 10,
    }))

  // Per-exercise stats
  const exMap = new Map<string, { name: string; sets: number; max_weight: number; top_reps: number }>()
  for (const s of completedSets) {
    if (!s.exercise_id) continue
    const name   = (s.exercises as any)?.name ?? 'Unknown'
    const weight = Number(s.actual_weight) || 0
    const reps   = Number(s.actual_reps)   || 0
    if (!exMap.has(s.exercise_id)) {
      exMap.set(s.exercise_id, { name, sets: 0, max_weight: 0, top_reps: 0 })
    }
    const ex = exMap.get(s.exercise_id)!
    ex.sets++
    if (weight > ex.max_weight || (weight === ex.max_weight && reps > ex.top_reps)) {
      ex.max_weight = weight
      ex.top_reps   = reps
    }
  }
  const exercises = Array.from(exMap.values())

  const seenPrEx = new Set<string>()
  const prs = allSets
    .filter((s: any) => s.is_pr)
    .filter((s: any) => {
      if (!s.exercise_id || seenPrEx.has(s.exercise_id)) return false
      seenPrEx.add(s.exercise_id)
      return true
    })
    .map((s: any) => ({
      exercise: (s.exercises as any)?.name ?? 'Unknown',
      weight:   Number(s.actual_weight),
      reps:     Number(s.actual_reps),
    }))

  // Goal achievements
  const achievements: { label: string }[] = []
  try {
    const { data: goals } = await supabase
      .from('user_goals')
      .select('id, goal_type, target_value, target_reps, exercise_id')
      .eq('user_id', user.id)
      .is('achieved_at', null)
      .in('goal_type', ['max_weight', 'weight_reps'])

    for (const goal of (goals || [])) {
      const exSets = completedSets.filter((s: any) => s.exercise_id === goal.exercise_id)
      if (exSets.length === 0) continue
      const exName = (exSets[0].exercises as any)?.name ?? 'Exercise'
      if (goal.goal_type === 'max_weight') {
        const hit = exSets.some((s: any) => Number(s.actual_weight) >= Number(goal.target_value))
        if (hit) achievements.push({ label: `${exName} ${goal.target_value} kg` })
      } else if (goal.goal_type === 'weight_reps') {
        const hit = exSets.some((s: any) =>
          Number(s.actual_weight) >= Number(goal.target_value) &&
          Number(s.actual_reps)   >= Number(goal.target_reps || 1)
        )
        if (hit) achievements.push({ label: `${exName} ${goal.target_reps}×${goal.target_value} kg` })
      }
    }
  } catch { /* goals table may not have target_reps yet */ }

  const workout_summary = {
    duration_mins: Number(wData.total_duration_mins) || 0,
    exercises,
    total_sets:    completedSets.length,
    total_volume:  Math.round(
      completedSets.reduce((sum: number, s: any) =>
        sum + (Number(s.actual_weight) || 0) * (Number(s.actual_reps) || 0), 0)
    ),
    prs,
    achievements,
    cardio,
  }

  if (existing) {
    // Update existing post: refresh summary and make visible
    await supabase
      .from('feed_posts')
      .update({ is_visible: true, workout_summary })
      .eq('id', existing.id)
    revalidatePath(`/workout/${workoutId}`)
    revalidatePath('/feed')
    return { ok: true, postId: existing.id }
  }

  // No post yet — insert fresh
  const { data: newPost, error } = await supabase.from('feed_posts').insert({
    user_id:       user.id,
    workout_id:    workoutId,
    post_type:     'workout',
    screen_name:   userSettings?.screen_name ?? null,
    workout_title: wData.title,
    workout_summary,
  }).select('id').single()

  if (error || !newPost) return { error: error?.message ?? 'Insert failed' }

  revalidatePath(`/workout/${workoutId}`)
  revalidatePath('/feed')
  return { ok: true, postId: newPost.id }
}

/** Hide a workout post from the feed (soft-delete: is_visible = false). */
export async function unshareWorkoutFromFeed(postId: string, workoutId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('feed_posts')
    .update({ is_visible: false })
    .eq('id', postId)
    .eq('user_id', user.id)

  revalidatePath(`/workout/${workoutId}`)
  revalidatePath('/feed')
}

/** Update feel_rating + intensity on an already-finished workout. */
export async function saveWorkoutFeel(
  workoutId: string,
  feelRating: number | null,
  intensity: string | null,
) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('workouts')
    .update({ feel_rating: feelRating, intensity })
    .eq('id', workoutId)

  if (error) return { error: 'Failed to save feel rating' }
  revalidatePath(`/workout/${workoutId}`)
  revalidatePath('/')
  return { success: true }
}

export async function deleteWorkout(workoutId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('workouts')
    .delete()
    .eq('id', workoutId)

  if (error) {
    console.error("Failed to delete workout:", error)
    return { error: 'Failed to delete workout' }
  }

  revalidatePath('/')
  redirect('/')
}

export async function renameWorkout(workoutId: string, newTitle: string) {
  const supabase = await createClient()
  
  const { error } = await supabase
    .from('workouts')
    .update({ title: newTitle })
    .eq('id', workoutId)

  if (error) return { error: 'Failed to rename workout' }

  revalidatePath(`/workout/${workoutId}`)
  revalidatePath('/')
  return { success: true }
}

export async function deleteRunningLog(logId: string, workoutId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.from('running_logs').delete().eq('id', logId)
  if (error) console.error("Failed to delete cardio:", error)

  revalidatePath(`/workout/${workoutId}`)
}

export async function deleteStrengthLog(logId: string, workoutId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.from('strength_logs').delete().eq('id', logId)
  if (error) console.error("Failed to delete strength:", error)

  revalidatePath(`/workout/${workoutId}`)
}

export async function createCustomExercise(formData: FormData) {
  const name = formData.get('name') as string
  const category = formData.get('category') as string
  const muscle_group = (formData.get('muscle_group') as string) || null
  const equipment = (formData.get('equipment') as string) || null
  if (!name || !category) return { error: 'Missing fields' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data, error } = await supabase.from('exercises').insert({
    name,
    category,
    muscle_group,
    equipment,
    user_id: user.id
  }).select('id').single()

  if (error || !data) return { error: 'Failed to create exercise' }

  revalidatePath('/exercises')
  revalidatePath('/')
  return { success: true, id: data.id }
}

/** Fetch the full wger exercise catalogue (English, all pages, sorted by name, deduplicated).
 *  Cached for 1 hour so repeated opens are instant. */
export async function fetchAllWgerExercises(): Promise<
  { name: string; muscle_group: string | null; equipment: string | null }[]
> {
  let url: string | null =
    'https://wger.de/api/v2/exerciseinfo/?format=json&language=2&limit=100&offset=0'
  const results: { name: string; muscle_group: string | null; equipment: string | null }[] = []
  const seen = new Set<string>()

  while (url) {
    const res: Response = await fetch(url, { cache: 'force-cache' })
    if (!res.ok) break
    const page = await res.json() as { next: string | null; results: any[] }

    for (const ex of page.results as any[]) {
      const enTrans = (ex.translations ?? []).find((t: any) => t.language === 2)
      if (!enTrans?.name?.trim()) continue

      const name = enTrans.name.trim()
      const key = name.toLowerCase()
      if (seen.has(key)) continue  // wger has duplicate entries — skip them
      seen.add(key)

      const firstEquip = ex.equipment?.[0]?.name
      results.push({
        name,
        muscle_group: WGER_CATEGORY_MAP[ex.category?.name] ?? null,
        equipment: firstEquip ? (WGER_EQUIPMENT_MAP[firstEquip] ?? null) : null,
      })
    }

    url = page.next ?? null  // page is typed so url stays string | null
  }

  return results.sort((a, b) => a.name.localeCompare(b.name))
}

/** Add a single exercise (from wger or manually) as a global template.
 *  Does NOT revalidate — caller does optimistic UI update instead so the modal stays open.
 *  Works even if the muscle_group / equipment columns haven't been migrated yet. */
export async function addWgerExercise(name: string, muscle_group: string | null, equipment: string | null = null) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // If it already exists (by name, case-insensitive), just return it
  const { data: existing } = await supabase
    .from('exercises')
    .select('id')
    .ilike('name', name)
    .maybeSingle()

  if (existing) return { success: true, id: existing.id, existed: true }

  // Insert with only the columns that are guaranteed to exist
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name, category: 'strength', user_id: user.id })
    .select('id')
    .single()

  if (error || !data) return { error: error?.message ?? 'Failed to add exercise' }

  // Best-effort: also set muscle_group + equipment if the columns exist (migration may not be run yet)
  if (muscle_group || equipment) {
    await supabase.from('exercises')
      .update({ muscle_group, equipment })
      .eq('id', data.id)
    // Failure here is silent — tags just won't be set until migration is run
  }

  return { success: true, id: data.id, existed: false }
}

/** Update the muscle group and equipment tags on an existing exercise */
export async function updateExerciseMeta(
  exerciseId: string,
  muscle_group: string | null,
  equipment: string | null,
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('exercises')
    .update({ muscle_group, equipment })
    .eq('id', exerciseId)

  if (error) return { error: 'Failed to update exercise' }

  revalidatePath('/exercises')
  return { success: true }
}

export async function deleteExercise(exerciseId: string) {
  const supabase = await createClient()
  
  const { error } = await supabase.from('exercises').delete().eq('id', exerciseId)
  if (error) return { error: 'Failed to delete exercise' }
  
  revalidatePath('/exercises')
  return { success: true }
}

export async function updateExerciseSettings(exerciseId: string, settings: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  await supabase
    .from('user_exercise_settings')
    .update({ is_active: false, valid_to: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .eq('is_active', true)

  const { error } = await supabase.from('user_exercise_settings').insert({
    user_id: user.id,
    exercise_id: exerciseId,
    current_weight: settings.weight || null,
    target_sets: settings.sets || null,
    target_reps: settings.reps || null,
    target_reps_min: settings.reps_min || 8,
    increment_step: settings.increment || 2.5,
    progression_rate: settings.progression_rate || 2.5,
    protocol: settings.protocol || 'manual',
    current_failures: settings.current_failures || 0,
    max_failures: settings.max_failures || 3,
    min_successes: settings.min_successes || 1,
    current_successes: settings.current_successes || 0,
    deload_multiplier: settings.deload_multiplier || 2.0,
    is_active: true
  })

  if (error) return { error: 'Failed to update settings' }
  revalidatePath('/', 'layout')
  return { success: true }
}

// ============================================================
// PROGRAM ACTIONS
// ============================================================

export async function fetchProgramById(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('programs')
    .select(`
      *,
      program_workouts (
        *,
        program_exercises (
          *,
          exercises ( id, name ),
          superset_templates ( id, name, superset_template_exercises ( sort_order, exercise_id, exercises(id, name) ) )
        )
      )
    `)
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  return data || null
}

export async function fetchPrograms() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('programs')
    .select(`
      *,
      program_workouts (
        *,
        program_exercises (
          *,
          exercises ( id, name ),
          superset_templates ( id, name, superset_template_exercises ( sort_order, exercise_id, exercises(id, name) ) )
        )
      )
    `)
    .eq('user_id', user.id)
    .order('name')

  return data || []
}

export async function createProgram(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const name = formData.get('name') as string
  const description = (formData.get('description') as string) || null
  const split = parseInt(formData.get('split') as string) || 1

  const { data: program, error } = await supabase
    .from('programs')
    .insert({ name, description, user_id: user.id })
    .select('id')
    .single()

  if (error || !program) return { error: error?.message || 'Failed to create program' }

  const dayNames: Record<number, string[]> = {
    1: ['Workout A'],
    2: ['Workout A', 'Workout B'],
    3: ['Workout A', 'Workout B', 'Workout C'],
  }
  const names = dayNames[split] || ['Workout A']

  const workoutDays = names.map((dayName, i) => ({
    program_id: program.id,
    name: dayName,
    rotation_order: i + 1,
  }))

  const { error: daysError } = await supabase.from('program_workouts').insert(workoutDays)
  if (daysError) return { error: `Created program but failed to create workout days: ${daysError.message}` }

  revalidatePath('/programs')
  return { success: true, id: program.id }
}

export async function updateProgram(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const id = formData.get('id') as string
  const name = formData.get('name') as string
  const description = (formData.get('description') as string) || null

  const { error } = await supabase
    .from('programs')
    .update({ name, description })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Failed to update program' }
  revalidatePath('/programs')
  return { success: true }
}

export async function deleteProgram(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('programs')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Failed to delete program' }
  revalidatePath('/programs')
  return { success: true }
}

export async function addProgramExercise(programWorkoutId: string, exerciseId: string, sortOrder: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('program_exercises').insert({
    program_workout_id: programWorkoutId,
    exercise_id: exerciseId,
    sort_order: sortOrder,
  })

  if (error) return { error: 'Failed to add exercise' }
  revalidatePath('/programs')
  return { success: true }
}

export async function removeProgramExercise(programExerciseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('program_exercises')
    .delete()
    .eq('id', programExerciseId)

  if (error) return { error: 'Failed to remove exercise' }
  revalidatePath('/programs')
  return { success: true }
}

export async function advanceRotation(programId: string, nextIndex: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  await supabase
    .from('user_active_programs')
    .upsert({
      user_id: user.id,
      program_id: programId,
      current_rotation_index: nextIndex,
      started_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

  return { success: true }
}

export async function fetchUserActiveProgram() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('user_active_programs')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return data || null
}

// ============================================================
// SUPERSET TEMPLATE ACTIONS
// ============================================================

export async function fetchSupersetTemplates() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('superset_templates')
    .select(`
      id, name,
      superset_template_exercises ( sort_order, exercise_id, exercises(id, name) )
    `)
    .eq('user_id', user.id)
    .order('name')

  return data || []
}

export async function saveSupersetTemplate(name: string, exerciseIds: string[]) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data: template, error } = await supabase
    .from('superset_templates')
    .insert({ name, user_id: user.id })
    .select('id')
    .single()

  if (error || !template) return { error: error?.message || 'Failed to save template' }

  const exercises = exerciseIds.map((exId, i) => ({
    superset_id: template.id,
    exercise_id: exId,
    sort_order: i + 1,
  }))

  const { error: exError } = await supabase.from('superset_template_exercises').insert(exercises)
  if (exError) {
    await supabase.from('superset_templates').delete().eq('id', template.id)
    return { error: exError.message }
  }

  return { success: true, id: template.id }
}

export async function renameSupersetTemplate(id: string, name: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('superset_templates')
    .update({ name })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Failed to rename template' }
  revalidatePath('/', 'layout')
  return { success: true }
}

export async function deleteSupersetTemplate(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase
    .from('superset_templates')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: 'Failed to delete template' }
  return { success: true }
}

export async function deleteSupersetGroup(supersetId: string, workoutId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('strength_logs')
    .delete()
    .eq('superset_id', supersetId)

  if (error) return { error: 'Failed to delete superset group' }

  revalidatePath(`/workout/${workoutId}`)
  return { success: true }
}

export async function addSupersetToProgram(programWorkoutId: string, supersetTemplateId: string, sortOrder: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('program_exercises').insert({
    program_workout_id: programWorkoutId,
    superset_template_id: supersetTemplateId,
    sort_order: sortOrder,
  })

  if (error) return { error: error.message || 'Failed to add superset to program' }
  revalidatePath('/programs')
  return { success: true }
}
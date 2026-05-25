'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

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

  const durationMins = parseInt(durationRaw as string)
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
  sets: { weight: number, reps: number }[],
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
    actual_reps: set.reps
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

  // ── PR detection (per rep count) ──────────────────────────
  // For each unique rep count in this session, check if the heaviest set at
  // that rep count beats the all-time record for this exercise at that rep count.
  // e.g. 80kg × 5 can be a 5RM PR independently of whether 100kg × 1 is a 1RM PR.
  const uniqueRepCounts = [...new Set(insertedSets.map(s => Number(s.actual_reps)))]

  for (const reps of uniqueRepCounts) {
    if (reps <= 0) continue
    const setsAtReps = insertedSets.filter(s => Number(s.actual_reps) === reps)
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

    const completedSetsCount = sets.length
    const allSetsHitTarget = sets.every(s => Number(s.reps) >= targetReps)

    // Base all weight calculations on what was actually lifted, not the stored target.
    // Using the minimum across sets is the conservative choice when someone lifts lighter.
    const actualWeight = sets.length > 0
      ? Math.min(...sets.map(s => Number(s.weight)))
      : newWeight

    if (setting.protocol === 'linear') {
      // 5x5 STYLE
      if (completedSetsCount >= targetSets && allSetsHitTarget) {
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
      const allSetsHitMaintain = sets.every(s => Number(s.reps) >= lowerBound)

      if (completedSetsCount >= targetSets && allSetsHitTarget) {
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
    }
  }

  revalidatePath(`/workout/${workoutId}`)
  return { success: true }
}

export async function updateSupersetLog(
  cards: { logId: string; exerciseId: string; sets: { weight: number; reps: number }[] }[],
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
  if (!name || !category) return { error: 'Missing fields' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { data, error } = await supabase.from('exercises').insert({
    name,
    category,
    user_id: user.id 
  }).select('id').single()

  if (error || !data) return { error: 'Failed to create exercise' }
  
  revalidatePath('/exercises') 
  revalidatePath('/') 
  return { success: true, id: data.id }
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
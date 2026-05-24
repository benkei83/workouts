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

// FIXED: Now accepts historical data to preserve ordering and superset groupings
export async function saveStrengthExercise(
  workoutId: string, 
  exerciseId: string, 
  sets: { weight: number, reps: number }[],
  options?: { createdAt?: string, supersetId?: string }
) {
  const supabase = await createClient()

  // Build the payload dynamically so we don't pass undefined to Supabase
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

  const { error: setsError } = await supabase
    .from('strength_sets')
    .insert(setsToInsert)

  if (setsError) {
    console.error("Supabase sets error:", setsError)
    await supabase.from('strength_logs').delete().eq('id', strengthLog.id)
    return { error: setsError.message } 
  }

  revalidatePath(`/workout/${workoutId}`)
  return { success: true }
}

export async function saveSupersetLog(
  workoutId: string, 
  matrix: { [exerciseId: string]: { weight: number, reps: number }[] }
) {
  const supabase = await createClient()
  
  const supersetId = crypto.randomUUID()
  const exerciseIds = Object.keys(matrix)

  const logsToInsert = exerciseIds.map(() => ({
    workout_id: workoutId,
    superset_id: supersetId
  }))

  const { data: insertedLogs, error: logsError } = await supabase
    .from('strength_logs')
    .insert(logsToInsert)
    .select('id')

  if (logsError || !insertedLogs || insertedLogs.length !== exerciseIds.length) {
    console.error("Failed to create superset logs:", logsError)
    return { error: 'Failed to initialize superset' }
  }

  const setsToInsert: any[] = []
  
  exerciseIds.forEach((exId, index) => {
    const logId = insertedLogs[index].id
    const sets = matrix[exId]

    sets.forEach((set, setIndex) => {
      setsToInsert.push({
        strength_log_id: logId,
        exercise_id: exId,
        set_number: setIndex + 1,
        actual_weight: set.weight,
        actual_reps: set.reps
      })
    })
  })

  const { error: setsError } = await supabase
    .from('strength_sets')
    .insert(setsToInsert)

  if (setsError) {
    console.error("Supabase sets error:", setsError)
    await supabase.from('strength_logs').delete().eq('superset_id', supersetId)
    return { error: setsError.message }
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
    increment_step: settings.increment || 2.5,
    progression_rate: settings.progression_rate || 2.5,
    is_active: true
  })

  if (error) return { error: 'Failed to update settings' }

  revalidatePath('/', 'layout') 
  return { success: true }
}
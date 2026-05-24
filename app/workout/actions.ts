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
  const legsRaw = formData.get('legs') as string // NEW: Grab the stringified legs

  if (!workoutId || !durationRaw) return { error: 'Missing required fields' }

  const durationMins = parseInt(durationRaw as string)
  let finalDistance = distanceRaw ? parseFloat(distanceRaw as string) : null
  let finalSpeed = speedRaw ? parseFloat(speedRaw as string) : null
  const finalIncline = inclineRaw ? parseFloat(inclineRaw as string) : null

  // 1. Insert the parent header into running_logs and RETURN the new ID
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

  // 2. If this was an interval session, bulk insert the individual legs
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


export async function saveStrengthExercise(workoutId: string, exerciseId: string, sets: any[]) {
  const supabase = await createClient()

  // 1. Check if a strength_log header already exists for this workout
  let { data: strengthLog } = await supabase
    .from('strength_logs')
    .select('id')
    .eq('workout_id', workoutId)
    .single()

  // 2. If not, create one
  if (!strengthLog) {
    const { data: newLog, error: logError } = await supabase
      .from('strength_logs')
      .insert({ workout_id: workoutId, program_name: 'Custom Session' })
      .select('id')
      .single()
      
    if (logError || !newLog) return { error: 'Failed to create strength header' }
    strengthLog = newLog
  }

  // 3. Format the sets for bulk insertion
  const setsToInsert = sets.map((set, index) => ({
    strength_log_id: strengthLog.id,
    exercise_id: exerciseId,
    set_number: index + 1,
    target_weight: set.weight, // For now, we assume target = actual
    target_reps: set.reps,
    actual_weight: set.weight,
    actual_reps: set.reps
  }))

  // 4. Bulk insert the sets
  const { error: setsError } = await supabase
    .from('strength_sets')
    .insert(setsToInsert)

  if (setsError) {
    console.error(setsError)
    return { error: 'Failed to save sets' }
  }

  revalidatePath(`/workout/${workoutId}`)
  return { success: true }
}

export async function finishWorkout(formData: FormData) {
  const workoutId = formData.get('workout_id') as string
  if (!workoutId) return

  const supabase = await createClient()

  // 1. Get the start time
  const { data: workout } = await supabase
    .from('workouts')
    .select('created_at')
    .eq('id', workoutId)
    .single()

  if (workout) {
    // 2. Calculate the difference in minutes
    const startTime = new Date(workout.created_at).getTime()
    const now = new Date().getTime()
    const durationMins = Math.max(1, Math.round((now - startTime) / 60000))

    // 3. Stamp the total duration to mark it as "Completed"
    await supabase
      .from('workouts')
      .update({ total_duration_mins: durationMins })
      .eq('id', workoutId)
  }

  // 4. Refresh the home page data and navigate there
  revalidatePath('/')
  redirect('/')
}

// Add a completely new custom exercise to the database
export async function createCustomExercise(formData: FormData) {
  const name = formData.get('name') as string
  const category = formData.get('category') as string
  if (!name || !category) return { error: 'Missing fields' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const { error } = await supabase.from('exercises').insert({
    name,
    category,
    user_id: user.id // Attached strictly to you!
  })

  if (error) return { error: 'Failed to create exercise' }
  revalidatePath('/exercises') // Assuming we build an /exercises management page next
  return { success: true }
}

// Update settings using the SCD Type 2 pattern (preserves history)
export async function updateExerciseSettings(exerciseId: string, settings: any) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // 1. Deactivate the current active settings for this specific exercise
  await supabase
    .from('user_exercise_settings')
    .update({ 
      is_active: false, 
      valid_to: new Date().toISOString() 
    })
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .eq('is_active', true)

  // 2. Insert the brand new active settings
  const { error } = await supabase.from('user_exercise_settings').insert({
    user_id: user.id,
    exercise_id: exerciseId,
    current_weight: settings.weight || null,
    target_sets: settings.sets || null,
    target_reps: settings.reps || null,
    increment_step: settings.increment || 2.5,
    is_active: true
  })

  if (error) {
    console.error(error)
    return { error: 'Failed to update settings' }
  }

  revalidatePath('/exercises')
  return { success: true }
}
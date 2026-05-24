'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveCardioLog(formData: FormData) {
  const supabase = await createClient()
  
  const workoutId = formData.get('workout_id') as string
  const environment = formData.get('environment') as string
  const sessionType = formData.get('session_type') as string
  const durationRaw = formData.get('duration')
  const distanceRaw = formData.get('distance')
  const speedRaw = formData.get('average_speed')
  const inclineRaw = formData.get('incline')

  if (!workoutId || !durationRaw) return { error: 'Missing required fields' }

  const durationMins = parseInt(durationRaw as string)
  let finalDistance = distanceRaw ? parseFloat(distanceRaw as string) : null
  let finalSpeed = speedRaw ? parseFloat(speedRaw as string) : null
  const finalIncline = inclineRaw ? parseFloat(inclineRaw as string) : null

  // THE SMART MATH
  if (sessionType === 'interval' && finalSpeed && durationMins) {
    // Calculate theoretical distance: Speed (km/h) * Time (hours)
    finalDistance = parseFloat((finalSpeed * (durationMins / 60)).toFixed(2))
  } else if (sessionType === 'distance' && finalDistance && durationMins) {
    // Calculate average speed: Distance (km) / Time (hours)
    finalSpeed = parseFloat((finalDistance / (durationMins / 60)).toFixed(2))
  }

  const { error } = await supabase.from('running_logs').insert({
    workout_id: workoutId,
    environment: environment,
    session_type: sessionType,
    duration_seconds: durationMins * 60,
    distance_km: finalDistance,
    average_speed: finalSpeed,
    average_incline: finalIncline,
  })

  if (error) {
    console.error(error)
    return { error: 'Failed to save cardio log' }
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
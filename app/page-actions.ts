'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

/** Start a workout and redirect, optionally with a focused exercise pre-selected. */
export async function startFocusWorkout(exerciseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: existing } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', user.id)
    .is('total_duration_mins', null)
    .single()

  if (existing) {
    redirect(`/workout/${existing.id}?focus=${exerciseId}`)
  }

  const now  = new Date()
  const hour = now.getHours()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = days[now.getDay()]
  let timeOfDay = 'Night'
  if (hour >= 4  && hour < 12) timeOfDay = 'Morning'
  else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon'
  else if (hour >= 17 && hour < 22) timeOfDay = 'Evening'

  const { data: workout, error } = await supabase
    .from('workouts')
    .insert({ user_id: user.id, title: `${dayName} ${timeOfDay} Workout` })
    .select()
    .single()

  if (error || !workout) return

  redirect(`/workout/${workout.id}?focus=${exerciseId}`)
}

export async function startWorkout() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  // If an active workout already exists, go there
  const { data: existingWorkout } = await supabase
    .from('workouts')
    .select('id')
    .eq('user_id', user.id)
    .is('total_duration_mins', null)
    .single()

  if (existingWorkout) {
    revalidatePath('/')
    redirect(`/workout/${existingWorkout.id}`)
  }

  // Generate a smart title
  const now  = new Date()
  const hour = now.getHours()
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const dayName = days[now.getDay()]
  let timeOfDay = 'Night'
  if (hour >= 4  && hour < 12) timeOfDay = 'Morning'
  else if (hour >= 12 && hour < 17) timeOfDay = 'Afternoon'
  else if (hour >= 17 && hour < 22) timeOfDay = 'Evening'

  const { data: workout, error } = await supabase
    .from('workouts')
    .insert({ user_id: user.id, title: `${dayName} ${timeOfDay} Workout` })
    .select()
    .single()

  if (error || !workout) {
    console.error('Failed to start workout:', error)
    return
  }

  revalidatePath('/')
  redirect(`/workout/${workout.id}`)
}

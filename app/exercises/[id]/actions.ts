'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function saveExerciseTags(
  exerciseId: string,
  formData: FormData,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  const muscle_group = (formData.get('muscle_group') as string) || null
  const equipment   = (formData.get('equipment')    as string) || null

  const { data, error } = await supabase
    .from('exercises')
    .update({ muscle_group, equipment })
    .eq('id', exerciseId)
    .select('id')

  if (error) return { error: error.message }
  if (!data?.length) return { error: 'No rows updated — check Supabase UPDATE policy on exercises.' }

  revalidatePath(`/exercises/${exerciseId}`)
  revalidatePath('/exercises')
  return { success: true }
}

export async function saveExerciseSettings(
  exerciseId: string,
  formData: FormData,
): Promise<{ success?: true; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Unauthorized' }

  // Fetch current row to carry over failure/success counters
  const { data: current } = await supabase
    .from('user_exercise_settings')
    .select('current_failures, current_successes')
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .eq('is_active', true)
    .maybeSingle()

  const prMinRaw = formData.get('pr_min_weight') as string

  // SCD: mark old row inactive, insert fresh row
  await supabase
    .from('user_exercise_settings')
    .update({ is_active: false, valid_to: new Date().toISOString() })
    .eq('user_id', user.id)
    .eq('exercise_id', exerciseId)
    .eq('is_active', true)

  const { error } = await supabase.from('user_exercise_settings').insert({
    user_id:          user.id,
    exercise_id:      exerciseId,
    current_weight:   (v => isNaN(v) ? null : v)(parseFloat(formData.get('weight') as string)),
    target_sets:      parseInt(formData.get('sets') as string)     || null,
    target_reps:      parseInt(formData.get('reps') as string)     || null,
    target_reps_min:  parseInt(formData.get('reps_min') as string) || 8,
    increment_step:   parseFloat(formData.get('increment') as string) || 2.5,
    progression_rate: parseFloat(formData.get('progression_rate') as string) || 2.5,
    protocol:         (formData.get('protocol') as string) || 'manual',
    max_failures:     parseInt(formData.get('max_failures') as string)  || 3,
    min_successes:    parseInt(formData.get('min_successes') as string) || 1,
    deload_multiplier:parseFloat(formData.get('deload_multiplier') as string) || 2.0,
    current_failures: current?.current_failures  ?? 0,
    current_successes:current?.current_successes ?? 0,
    suppress_prs:     formData.get('suppress_prs') === 'on',
    pr_min_weight:    prMinRaw ? parseFloat(prMinRaw) || null : null,
    is_active:        true,
  })

  if (error) return { error: error.message }

  revalidatePath(`/exercises/${exerciseId}`)
  revalidatePath('/exercises')
  return { success: true }
}

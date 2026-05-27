'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { estimateOneRM } from '@/lib/stats/compute'

const VALID_TYPES = ['max_weight', '1rm', 'bw_multiple', 'body_weight'] as const
type GoalType = typeof VALID_TYPES[number]

export async function createGoal(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const goal_type = formData.get('goal_type') as GoalType
  const target_value = parseFloat(formData.get('target_value') as string)
  const exercise_id = (formData.get('exercise_id') as string) || null
  const label = (formData.get('label') as string)?.trim() || null
  const deadline = (formData.get('deadline') as string) || null

  if (!VALID_TYPES.includes(goal_type)) return { error: 'Invalid goal type' }
  if (isNaN(target_value) || target_value <= 0) return { error: 'Invalid target value' }
  if (goal_type !== 'body_weight' && !exercise_id) return { error: 'Exercise required' }

  // Auto-compute starting_value from current bests so progress % is meaningful
  let starting_value: number | null = null

  if (goal_type === 'body_weight') {
    const { data } = await supabase
      .from('body_weight_logs')
      .select('weight_kg')
      .eq('user_id', user.id)
      .order('logged_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    starting_value = data?.weight_kg ? Number(data.weight_kg) : null
  } else if (exercise_id) {
    const { data: workouts } = await supabase
      .from('workouts')
      .select('strength_logs(strength_sets(exercise_id, actual_weight, actual_reps))')
      .eq('user_id', user.id)
      .not('total_duration_mins', 'is', null)
      .limit(100)

    let bestWeight = 0
    let bestOrm = 0
    for (const w of workouts || []) {
      for (const log of (w as any).strength_logs || []) {
        for (const set of log.strength_sets || []) {
          if (set.exercise_id !== exercise_id) continue
          const w = Number(set.actual_weight) || 0
          const r = Number(set.actual_reps) || 0
          if (w <= 0 || r <= 0) continue
          if (w > bestWeight) bestWeight = w
          const orm = estimateOneRM(w, r)
          if (orm > bestOrm) bestOrm = orm
        }
      }
    }

    if (goal_type === 'max_weight') {
      starting_value = bestWeight || null
    } else if (goal_type === '1rm') {
      starting_value = bestOrm || null
    } else if (goal_type === 'bw_multiple') {
      const { data: bwLog } = await supabase
        .from('body_weight_logs')
        .select('weight_kg')
        .eq('user_id', user.id)
        .order('logged_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      const bw = bwLog?.weight_kg ? Number(bwLog.weight_kg) : null
      starting_value = bestOrm > 0 && bw ? parseFloat((bestOrm / bw).toFixed(3)) : null
    }
  }

  const { error } = await supabase
    .from('user_goals')
    .insert({
      user_id: user.id,
      goal_type,
      target_value,
      exercise_id,
      label,
      deadline: deadline || null,
      starting_value,
    })

  if (error) return { error: error.message }

  revalidatePath('/goals')
  return { ok: true }
}

export async function deleteGoal(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated' }

  const { error } = await supabase
    .from('user_goals')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }

  revalidatePath('/goals')
  return { ok: true }
}
